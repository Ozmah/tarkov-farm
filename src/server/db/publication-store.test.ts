import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
	parsePublicationData,
	serializePublicationData,
} from "../../lib/publication-data";
import { migrateDatabase } from "./migrate";
import { openDatabase } from "./open";
import {
	assertPublicationImportCounts,
	importPublicationData,
	readPublicationDataFromDatabase,
} from "./publication-store";
import { seedCatalog } from "./seed";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("publication store", () => {
	it("imports canonical data into a fresh baseline and round-trips exactly", async () => {
		const directory = await createTemporaryDirectory();
		const { client, db } = await openDatabase(
			resolve(directory, "database.sqlite"),
			{
				create: true,
			},
		);

		try {
			await migrateDatabase(db, resolve(process.cwd(), "drizzle"));
			await expect(
				client.run("INSERT INTO maps (id, name) VALUES (NULL, 'Invalid map')"),
			).rejects.toThrow();
			await seedCatalog(db);
			const source = await readFile(
				resolve(process.cwd(), "data/publication/locations.json"),
				"utf8",
			);
			const publication = parsePublicationData(JSON.parse(source));
			const counts = await importPublicationData(client, publication);
			const expectedCounts = {
				locationDocuments: publication.locations.length,
				locations: publication.locations.length,
				screenshots: publication.locations.reduce(
					(total, location) => total + location.screenshots.length,
					0,
				),
			};

			expect(counts).toEqual(expectedCounts);
			await assertPublicationImportCounts(client, counts);
			expect(
				serializePublicationData(await readPublicationDataFromDatabase(client)),
			).toBe(source);

			await expect(importPublicationData(client, publication)).rejects.toThrow(
				"Publication data can only be imported into empty dynamic tables",
			);
			await assertPublicationImportCounts(client, counts);
		} finally {
			await client.close();
		}
	});
});

async function createTemporaryDirectory() {
	const directory = await mkdtemp(
		resolve(tmpdir(), "tarkov-publication-store-"),
	);
	temporaryDirectories.push(directory);
	return directory;
}
