import { lstat, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "./open";
import { readPublicationDataFromDatabase } from "./publication-store";
import { setupDatabase } from "./setup";

const temporaryDirectories: string[] = [];
const projectRoot = resolve(process.cwd());
const setupOptions = {
	migrationsPath: resolve(projectRoot, "drizzle"),
	publicationPath: resolve(projectRoot, "data/publication/locations.json"),
};

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("database setup", () => {
	it("creates a missing database from versioned files", async () => {
		const directory = await createTemporaryDirectory();
		const databasePath = resolve(directory, "database.sqlite");
		const result = await setupDatabase(databasePath, setupOptions);

		expect(result).toMatchObject({
			counts: { locationDocuments: 9, locations: 9, screenshots: 12 },
			status: "created",
		});

		const { client } = await openDatabase(databasePath, { create: false });

		try {
			expect(
				(await readPublicationDataFromDatabase(client)).locations,
			).toHaveLength(9);
		} finally {
			await client.close();
		}
	});

	it("replaces an existing database from versioned files", async () => {
		const directory = await createTemporaryDirectory();
		const databasePath = resolve(directory, "database.sqlite");
		const sentinel = "existing local database";
		await writeFile(databasePath, sentinel);

		await expect(
			setupDatabase(databasePath, setupOptions),
		).resolves.toMatchObject({
			counts: { locationDocuments: 9, locations: 9, screenshots: 12 },
			status: "created",
		});

		const { client } = await openDatabase(databasePath, { create: false });

		try {
			expect(
				await client.get("SELECT COUNT(*) AS count FROM locations"),
			).toMatchObject({ count: 9 });
		} finally {
			await client.close();
		}
	});

	it("does not delete the database when setup is started concurrently", async () => {
		const directory = await createTemporaryDirectory();
		const databasePath = resolve(directory, "database.sqlite");
		const results = await Promise.allSettled([
			setupDatabase(databasePath, setupOptions),
			setupDatabase(databasePath, setupOptions),
		]);
		const created = results.filter(
			(result) =>
				result.status === "fulfilled" && result.value.status === "created",
		);

		expect(created).toHaveLength(1);
		expect((await lstat(databasePath)).isFile()).toBe(true);

		const { client } = await openDatabase(databasePath, { create: false });

		try {
			expect(
				await client.get("SELECT COUNT(*) AS count FROM locations"),
			).toMatchObject({ count: 9 });
		} finally {
			await client.close();
		}
	});

	it.skipIf(process.platform === "win32")(
		"rejects a dangling symlink instead of creating its target",
		async () => {
			const directory = await createTemporaryDirectory();
			const databasePath = resolve(directory, "database.sqlite");
			const outsidePath = resolve(directory, "outside.sqlite");
			await symlink(outsidePath, databasePath);

			await expect(setupDatabase(databasePath, setupOptions)).rejects.toThrow(
				"Configured database path is not a regular file",
			);
			await expect(lstat(outsidePath)).rejects.toMatchObject({
				code: "ENOENT",
			});
		},
	);
});

async function createTemporaryDirectory() {
	const directory = await mkdtemp(resolve(tmpdir(), "tarkov-db-setup-"));
	temporaryDirectories.push(directory);
	return directory;
}
