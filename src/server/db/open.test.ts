import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "./open";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("database usage locks", () => {
	it("holds a usage lock for the client lifetime", async () => {
		const directory = await createTemporaryDirectory();
		const { client } = await openDatabase(
			resolve(directory, "database.sqlite"),
			{
				create: true,
			},
		);

		expect(await usageLocks(directory)).toHaveLength(1);
		await client.close();
		expect(await usageLocks(directory)).toHaveLength(0);
	});

	it("refuses to open while replacement recovery is pending", async () => {
		const directory = await createTemporaryDirectory();
		await writeFile(
			resolve(directory, ".database-replacement-state.json"),
			"{}",
		);

		await expect(
			openDatabase(resolve(directory, "database.sqlite"), { create: true }),
		).rejects.toThrow("Database replacement is in progress");
	});
});

async function usageLocks(directory: string) {
	return (await readdir(directory)).filter((entry) =>
		entry.startsWith(".database-usage-"),
	);
}

async function createTemporaryDirectory() {
	const directory = await mkdtemp(resolve(tmpdir(), "tarkov-db-open-"));
	temporaryDirectories.push(directory);
	return directory;
}
