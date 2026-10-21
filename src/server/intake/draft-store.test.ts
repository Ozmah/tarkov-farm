import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createIntakeDraftStore,
	INTAKE_DRAFTS_DIRECTORY,
	type VerifiedIntakeImage,
} from "./draft-store";

const EMPTY_VALUES = {
	name: "",
	description: "",
	mapImageId: null,
	documentId: null,
	requiredKeyIds: [],
};

function image(content: string): VerifiedIntakeImage {
	return {
		bytes: new TextEncoder().encode(content),
		mediaType: "image/png",
		width: 10,
		height: 10,
	};
}

describe("intake draft store", () => {
	let projectRoot: string;

	beforeEach(async () => {
		projectRoot = await mkdtemp(join(tmpdir(), "tarkov-intake-"));
	});
	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	it("creates a pending draft with a reserved location ID and readable screenshots", async () => {
		const store = createIntakeDraftStore(projectRoot);
		const { draft, created } = await store.create({
			values: { ...EMPTY_VALUES, name: "  Desk by the window " },
			notes: "Document type uncertain",
			screenshots: [image("first"), image("second")],
		});

		expect(created).toBe(true);
		expect(draft.status).toBe("pending");
		expect(draft.values.name).toBe("Desk by the window");
		expect(draft.locationId).not.toBe(draft.id);
		expect(await store.list()).toEqual([draft]);

		const screenshot = draft.screenshots[1];
		if (!screenshot) throw new Error("missing screenshot");
		const read = await store.readScreenshot(draft.id, screenshot.id);
		expect(new TextDecoder().decode(read.bytes)).toBe("second");
	});

	it("allows a draft with every field omitted", async () => {
		const { draft } = await createIntakeDraftStore(projectRoot).create({
			values: EMPTY_VALUES,
			notes: "",
			screenshots: [],
		});
		expect(draft.values).toEqual(EMPTY_VALUES);
		expect(draft.screenshots).toEqual([]);
	});

	it("returns the existing draft for identical content instead of duplicating it", async () => {
		const store = createIntakeDraftStore(projectRoot);
		const input = {
			values: EMPTY_VALUES,
			notes: "same",
			screenshots: [image("same")],
		};
		const first = await store.create(input);
		const second = await store.create(input);

		expect(second.created).toBe(false);
		expect(second.draft.id).toBe(first.draft.id);
		expect(await store.list()).toHaveLength(1);
	});

	it("does not duplicate identical drafts created concurrently", async () => {
		const store = createIntakeDraftStore(projectRoot);
		const input = {
			values: EMPTY_VALUES,
			notes: "parallel",
			screenshots: [image("parallel")],
		};
		const results = await Promise.all([
			store.create(input),
			store.create(input),
			store.create(input),
		]);

		expect(results.filter(({ created }) => created)).toHaveLength(1);
		expect(await store.list()).toHaveLength(1);
	});

	it("rejects the same screenshot twice in one draft", async () => {
		await expect(
			createIntakeDraftStore(projectRoot).create({
				values: EMPTY_VALUES,
				notes: "",
				screenshots: [image("dup"), image("dup")],
			}),
		).rejects.toThrow("more than once");
	});

	it("moves pending drafts to a final status exactly once", async () => {
		const store = createIntakeDraftStore(projectRoot);
		const { draft } = await store.create({
			values: EMPTY_VALUES,
			notes: "",
			screenshots: [],
		});

		expect((await store.setStatus(draft.id, "published")).status).toBe(
			"published",
		);
		// Repeating the same transition is a no-op (retried acknowledgement).
		expect((await store.setStatus(draft.id, "published")).status).toBe(
			"published",
		);
		await expect(store.setStatus(draft.id, "dismissed")).rejects.toThrow(
			"already published",
		);
		const files = await readdir(
			join(projectRoot, INTAKE_DRAFTS_DIRECTORY, draft.id),
		);
		expect(files).toEqual(["draft.json"]);
	});

	it("detects tampered screenshot bytes", async () => {
		const store = createIntakeDraftStore(projectRoot);
		const { draft } = await store.create({
			values: EMPTY_VALUES,
			notes: "",
			screenshots: [image("original")],
		});
		const screenshot = draft.screenshots[0];
		if (!screenshot) throw new Error("missing screenshot");
		await writeFile(
			join(projectRoot, INTAKE_DRAFTS_DIRECTORY, draft.id, screenshot.id),
			"tampered",
		);

		await expect(store.readScreenshot(draft.id, screenshot.id)).rejects.toThrow(
			"integrity",
		);
	});

	it("rejects identifiers that are not UUIDs before touching the filesystem", async () => {
		const store = createIntakeDraftStore(projectRoot);
		await expect(store.get("../../etc/passwd")).rejects.toThrow("UUIDv4");
	});
});
