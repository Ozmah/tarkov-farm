import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { verifyOriginalSourceAtRoot } from "./export-publication-data";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("publication export", () => {
	it("verifies an original screenshot against its recorded source hash", async () => {
		const root = await createTemporaryDirectory();
		const locationDirectory = resolve(root, "location-1");
		const bytes = new TextEncoder().encode("original screenshot bytes");
		const hash = createHash("sha256").update(bytes).digest("hex");
		await mkdir(locationDirectory);
		await writeFile(resolve(locationDirectory, `${hash}.png`), bytes);

		await expect(
			verifyOriginalSourceAtRoot(root, "location-1", hash),
		).resolves.toBeUndefined();
	});

	it("rejects an original whose bytes do not match its filename hash", async () => {
		const root = await createTemporaryDirectory();
		const locationDirectory = resolve(root, "location-1");
		const claimedHash = "a".repeat(64);
		await mkdir(locationDirectory);
		await writeFile(
			resolve(locationDirectory, `${claimedHash}.jpg`),
			"different bytes",
		);

		await expect(
			verifyOriginalSourceAtRoot(root, "location-1", claimedHash),
		).rejects.toThrow("Screenshot source hash does not match");
	});
});

async function createTemporaryDirectory() {
	const directory = await mkdtemp(resolve(tmpdir(), "tarkov-publication-"));
	temporaryDirectories.push(directory);
	return directory;
}
