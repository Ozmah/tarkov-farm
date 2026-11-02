import "@tanstack/react-start/server-only";

import type { SaveLocationFormInput } from "@/lib/editor-validation";
import { parseIntakeDraftId } from "@/lib/intake-draft";
import { assertLocalEditorAccess } from "@/server/editor/access.server";
import {
	LocationAlreadyExistsError,
	readEditorData,
	republishEditorLocation,
	saveEditorLocation,
} from "@/server/editor/editor.server";
import { createIntakeDraftStore } from "./draft-store";

const store = createIntakeDraftStore(process.cwd());
const draftLocks = new Map<string, Promise<unknown>>();

/**
 * Never throws: the editor loader awaits it next to the locations and updates,
 * and a drafts problem must not take those sections down with it.
 */
export async function listPendingIntakeDrafts() {
	assertLocalEditorAccess();
	try {
		const { drafts, unreadable } = await store.list();
		return {
			drafts: drafts.filter(({ status }) => status === "pending"),
			problem:
				unreadable.length > 0
					? `${unreadable.length} draft(s) could not be read and are hidden: ${unreadable.join("; ")}`
					: undefined,
		};
	} catch (error) {
		return {
			drafts: [],
			problem: `Drafts could not be listed: ${error instanceof Error ? error.message : "unknown error"}`,
		};
	}
}

/** Save and dismiss of one draft run one at a time, from the pending check to the final status. */
function withDraftLock<Result>(
	draftId: string,
	operation: () => Promise<Result>,
) {
	const id = parseIntakeDraftId(draftId);
	const result = (draftLocks.get(id) ?? Promise.resolve())
		.catch(() => undefined)
		.then(operation);
	const tail = result.catch(() => undefined);
	draftLocks.set(id, tail);
	void tail.then(() => {
		if (draftLocks.get(id) === tail) draftLocks.delete(id);
	});
	return result;
}

/**
 * Saves through the regular editor path with the draft's reserved location ID.
 * If an earlier attempt already created it, only the draft acknowledgement is
 * retried: the new input is not applied (its uploads would duplicate the saved
 * screenshots), and `acknowledgedOnly` tells the reviewer so.
 */
export async function saveIntakeDraftLocation(
	draftId: string,
	input: SaveLocationFormInput,
	contributor?: string,
) {
	assertLocalEditorAccess({ mutation: true });
	return withDraftLock(draftId, () =>
		saveIntakeDraftLocationLocked(draftId, input, contributor),
	);
}

async function saveIntakeDraftLocationLocked(
	draftId: string,
	input: SaveLocationFormInput,
	contributor?: string,
) {
	const draft = await store.get(draftId);
	if (draft.status !== "pending")
		throw new Error(`This draft is already ${draft.status}`);

	let target: { id: string; mapId: string; mapImageId: string };
	let acknowledgedOnly = false;
	try {
		target = await saveEditorLocation(input, {
			newLocationId: draft.locationId,
		});
	} catch (error) {
		if (!(error instanceof LocationAlreadyExistsError)) throw error;
		target = await findLocationTarget(draft.locationId);
		// The first attempt may have committed the database but failed the manifest write.
		await republishEditorLocation(target);
		acknowledgedOnly = true;
	}
	await store.publish(draft.id, { contributor });
	return { target, acknowledgedOnly };
}

export async function dismissIntakeDraft(draftId: string) {
	assertLocalEditorAccess({ mutation: true });
	await withDraftLock(draftId, () => store.dismiss(draftId));
}

/**
 * Draft images are private: loopback only and never embeddable cross-site.
 * Server route handlers must return a Response; a thrown notFound() becomes a 500.
 */
export async function readIntakeDraftScreenshot(
	request: Request,
	draftId: string,
	screenshotId: string,
) {
	try {
		assertLocalEditorAccess();
		if (request.headers.get("sec-fetch-site") === "cross-site")
			throw new Error("Cross-site draft image request");
		const { bytes, screenshot } = await store.readScreenshot(
			draftId,
			screenshotId,
		);
		return new Response(new Uint8Array(bytes), {
			headers: {
				"cache-control": "no-store",
				"content-type": screenshot.mediaType,
				"content-security-policy": "default-src 'none'; sandbox",
				"cross-origin-resource-policy": "same-origin",
				"x-content-type-options": "nosniff",
			},
		});
	} catch {
		return new Response("Not found", {
			status: 404,
			headers: { "cache-control": "no-store" },
		});
	}
}

async function findLocationTarget(locationId: string) {
	const data = await readEditorData();
	const location = data.locations.find(({ id }) => id === locationId);
	const image = data.mapImages.find(({ id }) => id === location?.mapImageId);
	if (!location || !image)
		throw new Error("The reserved location exists but could not be read");
	return { id: location.id, mapId: image.mapId, mapImageId: image.id };
}
