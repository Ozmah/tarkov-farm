import "@tanstack/react-start/server-only";

import type { SaveLocationFormInput } from "@/lib/editor-validation";
import { parseIntakeDraftId } from "@/lib/intake-draft";
import { assertLocalEditorAccess } from "@/server/editor/access.server";
import {
	LocationAlreadyExistsError,
	readEditorData,
	saveEditorLocation,
} from "@/server/editor/editor.server";
import { createIntakeDraftStore } from "./draft-store";

const store = createIntakeDraftStore(process.cwd());

export async function listPendingIntakeDrafts() {
	assertLocalEditorAccess();
	return (await store.list()).filter(({ status }) => status === "pending");
}

/**
 * Saves through the regular editor path with the draft's reserved location ID.
 * If an earlier attempt already created it, only the draft acknowledgement is retried.
 */
export async function saveIntakeDraftLocation(
	draftId: string,
	input: SaveLocationFormInput,
) {
	assertLocalEditorAccess({ mutation: true });
	const draft = await store.get(draftId);
	if (draft.status !== "pending")
		throw new Error(`This draft is already ${draft.status}`);

	let target: { id: string; mapId: string; mapImageId: string };
	try {
		target = await saveEditorLocation(input, {
			newLocationId: draft.locationId,
		});
	} catch (error) {
		if (!(error instanceof LocationAlreadyExistsError)) throw error;
		target = await findLocationTarget(draft.locationId);
	}
	await store.setStatus(draft.id, "published");
	return target;
}

export async function dismissIntakeDraft(draftId: string) {
	assertLocalEditorAccess({ mutation: true });
	await store.setStatus(parseIntakeDraftId(draftId), "dismissed");
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
