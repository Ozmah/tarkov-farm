import {
	lstat,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
	parsePublicationData,
	serializePublicationData,
} from "../../lib/publication-data";
import {
	parsePublicationUpdatesData,
	serializePublicationUpdatesData,
} from "../../lib/publication-updates";
import { openDatabase } from "./open";
import { readPublicationDataFromDatabase } from "./publication-store";
import { readPublicationUpdatesFromDatabase } from "./publication-updates-store";
import { setupDatabase } from "./setup";

const temporaryDirectories: string[] = [];
const projectRoot = resolve(process.cwd());
const setupOptions = {
	migrationsPath: resolve(projectRoot, "drizzle"),
	publicationPath: resolve(projectRoot, "data/publication/locations.json"),
	updatesPublicationPath: resolve(projectRoot, "data/publication/updates.json"),
};
const publicationSource = await readFile(setupOptions.publicationPath, "utf8");
const publication = parsePublicationData(JSON.parse(publicationSource));
const updatesPublicationSource = await readFile(
	setupOptions.updatesPublicationPath,
	"utf8",
);
const updatesPublication = parsePublicationUpdatesData(
	JSON.parse(updatesPublicationSource),
);
const expectedCounts = {
	locationDocuments: publication.locations.length,
	locationRequiredKeys: publication.locations.reduce(
		(total, location) => total + location.requiredKeyIds.length,
		0,
	),
	locations: publication.locations.length,
	screenshots: publication.locations.reduce(
		(total, location) => total + location.screenshots.length,
		0,
	),
	updates: updatesPublication.updates.length,
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

		expect(result).toEqual({
			counts: expectedCounts,
			status: "created",
		});

		const { client } = await openDatabase(databasePath, { create: false });

		try {
			await expectDatabaseToMatchManifest(client);
		} finally {
			await client.close();
		}
	});

	it("replaces an existing database from versioned files", async () => {
		const directory = await createTemporaryDirectory();
		const databasePath = resolve(directory, "database.sqlite");
		const sentinel = "existing local database";
		await writeFile(databasePath, sentinel);

		await expect(setupDatabase(databasePath, setupOptions)).resolves.toEqual({
			counts: expectedCounts,
			status: "created",
		});

		const { client } = await openDatabase(databasePath, { create: false });

		try {
			await expectDatabaseToMatchManifest(client);
		} finally {
			await client.close();
		}
	});

	it("preserves an existing database when the manifest is invalid", async () => {
		const directory = await createTemporaryDirectory();
		const databasePath = resolve(directory, "database.sqlite");
		const invalidPublicationPath = resolve(directory, "locations.json");
		const sentinel = "existing local database";
		await Promise.all([
			writeFile(databasePath, sentinel),
			writeFile(invalidPublicationPath, "<<<<<<< unresolved conflict"),
		]);

		await expect(
			setupDatabase(databasePath, {
				...setupOptions,
				publicationPath: invalidPublicationPath,
			}),
		).rejects.toThrow();
		expect(await readFile(databasePath, "utf8")).toBe(sentinel);
	});

	it("preserves an existing database when the updates manifest is noncanonical", async () => {
		const directory = await createTemporaryDirectory();
		const databasePath = resolve(directory, "database.sqlite");
		const invalidUpdatesPublicationPath = resolve(directory, "updates.json");
		const sentinel = "existing local database";
		await Promise.all([
			writeFile(databasePath, sentinel),
			writeFile(
				invalidUpdatesPublicationPath,
				'{"formatVersion":1,"updates":[]}\n',
			),
		]);

		await expect(
			setupDatabase(databasePath, {
				...setupOptions,
				updatesPublicationPath: invalidUpdatesPublicationPath,
			}),
		).rejects.toThrow("Updates publication manifest is not canonical");
		expect(await readFile(databasePath, "utf8")).toBe(sentinel);
	});

	it("preserves an existing database when the updates manifest is invalid", async () => {
		const directory = await createTemporaryDirectory();
		const databasePath = resolve(directory, "database.sqlite");
		const invalidUpdatesPublicationPath = resolve(directory, "updates.json");
		const sentinel = "existing local database";
		await Promise.all([
			writeFile(databasePath, sentinel),
			writeFile(
				invalidUpdatesPublicationPath,
				'{"formatVersion":1,"updates":[],"isPublished":true}\n',
			),
		]);

		await expect(
			setupDatabase(databasePath, {
				...setupOptions,
				updatesPublicationPath: invalidUpdatesPublicationPath,
			}),
		).rejects.toThrow("unexpected field isPublished");
		expect(await readFile(databasePath, "utf8")).toBe(sentinel);
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
			await expectDatabaseToMatchManifest(client);
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

async function expectDatabaseToMatchManifest(
	client: Parameters<typeof readPublicationDataFromDatabase>[0],
) {
	expect(
		serializePublicationData(await readPublicationDataFromDatabase(client)),
	).toBe(publicationSource);
	expect(
		serializePublicationUpdatesData(
			await readPublicationUpdatesFromDatabase(client),
		),
	).toBe(updatesPublicationSource);
}
