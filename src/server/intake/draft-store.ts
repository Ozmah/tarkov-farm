import { createHash, randomUUID } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import {
	INTAKE_DRAFT_FORMAT_VERSION,
	type IntakeDraft,
	type IntakeDraftStatus,
	type IntakeDraftValues,
	type IntakeMediaType,
	type IntakeScreenshot,
	isUuidV4,
	MAX_INTAKE_SCREENSHOT_BYTES,
	MAX_INTAKE_SCREENSHOTS,
	parseIntakeDraft,
	parseIntakeDraftId,
	parseIntakeDraftValues,
	parseIntakeNotes,
} from "@/lib/intake-draft";

export const INTAKE_DRAFTS_DIRECTORY = "assets/intake/drafts";

/** Image bytes already verified by the caller (header, real decode, dimensions). */
export type VerifiedIntakeImage = {
	bytes: Uint8Array;
	mediaType: IntakeMediaType;
	width: number;
	height: number;
};

export type CreateIntakeDraftInput = {
	values: IntakeDraftValues;
	notes: string;
	screenshots: VerifiedIntakeImage[];
};

/**
 * One directory per draft: draft.json plus one file per screenshot, named by
 * its UUID. IDs are validated UUIDs, so they can never escape the drafts root.
 */
export function createIntakeDraftStore(projectRoot: string) {
	const root = join(projectRoot, INTAKE_DRAFTS_DIRECTORY);
	const draftPath = (id: string) => join(root, id, "draft.json");
	// Creation checks for identical content first; concurrent calls must not both pass.
	let creation: Promise<unknown> = Promise.resolve();

	async function readDraft(id: string) {
		return parseIntakeDraft(
			JSON.parse(await readFile(draftPath(parseIntakeDraftId(id)), "utf8")),
		);
	}

	async function list() {
		await mkdir(root, { recursive: true });
		const entries = await readdir(root, { withFileTypes: true });
		const drafts = await Promise.all(
			entries
				.filter((entry) => entry.isDirectory() && isUuidV4(entry.name))
				.map((entry) =>
					readDraft(entry.name).catch((error: unknown) => {
						throw new Error(
							`Draft ${entry.name} is unreadable: ${error instanceof Error ? error.message : "unknown error"}`,
						);
					}),
				),
		);
		return drafts.sort(
			(left, right) =>
				right.createdAt.localeCompare(left.createdAt) ||
				left.id.localeCompare(right.id),
		);
	}

	async function createDraft(
		input: CreateIntakeDraftInput,
	): Promise<{ draft: IntakeDraft; created: boolean }> {
		const values = parseIntakeDraftValues(input.values);
		const notes = parseIntakeNotes(input.notes);
		if (input.screenshots.length > MAX_INTAKE_SCREENSHOTS)
			throw new Error(
				`A draft holds at most ${MAX_INTAKE_SCREENSHOTS} screenshots`,
			);
		const screenshots = input.screenshots.map((image) => {
			if (
				image.bytes.byteLength < 1 ||
				image.bytes.byteLength > MAX_INTAKE_SCREENSHOT_BYTES
			)
				throw new Error("Screenshots must be between 1 byte and 20 MiB");
			return {
				image,
				metadata: {
					id: randomUUID(),
					mediaType: image.mediaType,
					sha256: sha256(image.bytes),
					size: image.bytes.byteLength,
					width: image.width,
					height: image.height,
				} satisfies IntakeScreenshot,
			};
		});
		const shas = screenshots.map(({ metadata }) => metadata.sha256);
		if (new Set(shas).size !== shas.length)
			throw new Error("The same screenshot was supplied more than once");

		const contentHash = sha256(JSON.stringify({ values, notes, shas }));
		const existing = (await list()).find(
			(draft) => draft.contentHash === contentHash,
		);
		if (existing) return { draft: existing, created: false };

		const draft = parseIntakeDraft({
			formatVersion: INTAKE_DRAFT_FORMAT_VERSION,
			id: randomUUID(),
			locationId: randomUUID(),
			createdAt: new Date().toISOString(),
			contentHash,
			status: "pending",
			values,
			notes,
			screenshots: screenshots.map(({ metadata }) => metadata),
		});
		// Stage the whole directory, then rename: readers never see a partial draft.
		const stage = join(root, `.stage-${randomUUID()}`);
		await mkdir(stage, { recursive: true });
		try {
			for (const { image, metadata } of screenshots)
				await writeFile(join(stage, metadata.id), image.bytes, {
					flag: "wx",
					mode: 0o600,
				});
			await writeFile(join(stage, "draft.json"), serialize(draft), {
				flag: "wx",
				mode: 0o600,
			});
			await rename(stage, join(root, draft.id));
		} finally {
			await rm(stage, { recursive: true, force: true });
		}
		return { draft, created: true };
	}

	return {
		list,
		get: readDraft,

		/** Idempotent: identical content returns the existing draft instead of a copy. */
		create(
			input: CreateIntakeDraftInput,
		): Promise<{ draft: IntakeDraft; created: boolean }> {
			const result = creation.then(() => createDraft(input));
			creation = result.catch(() => undefined);
			return result;
		},

		async readScreenshot(id: string, screenshotId: string) {
			const draft = await readDraft(id);
			const screenshot = draft.screenshots.find(
				(item) => item.id === parseIntakeDraftId(screenshotId),
			);
			if (!screenshot) throw new Error("Screenshot not found in this draft");
			const bytes = new Uint8Array(
				await readFile(join(root, draft.id, screenshot.id)),
			);
			if (sha256(bytes) !== screenshot.sha256)
				throw new Error("Stored draft screenshot failed its integrity check");
			return { bytes, screenshot };
		},

		/** Only pending drafts change state; published and dismissed are final. */
		async setStatus(id: string, status: Exclude<IntakeDraftStatus, "pending">) {
			const draft = await readDraft(id);
			if (draft.status === status) return draft;
			if (draft.status !== "pending")
				throw new Error(`This draft is already ${draft.status}`);
			const next = { ...draft, status };
			const temporary = join(root, draft.id, `.draft-${randomUUID()}.json`);
			try {
				await writeFile(temporary, serialize(next), {
					flag: "wx",
					mode: 0o600,
				});
				await rename(temporary, draftPath(draft.id));
			} finally {
				await rm(temporary, { force: true });
			}
			return next;
		},
	};
}

export type IntakeDraftStore = ReturnType<typeof createIntakeDraftStore>;

function sha256(value: string | Uint8Array) {
	return createHash("sha256").update(value).digest("hex");
}

function serialize(draft: IntakeDraft) {
	return `${JSON.stringify(draft, null, "\t")}\n`;
}
