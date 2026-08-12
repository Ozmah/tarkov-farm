import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
	type PublicationUpdatesData,
	serializePublicationUpdatesData,
} from "../../lib/publication-updates";
import { migrateDatabase } from "./migrate";
import { openDatabase } from "./open";
import {
	assertPublicationUpdatesImportCount,
	importPublicationUpdates,
	readPublicationUpdatesFromDatabase,
	readUpdatesFromDatabase,
} from "./publication-updates-store";

const temporaryDirectories: string[] = [];
const snapshot = {
	formatVersion: 1 as const,
	locations: [
		{
			id: "location",
			name: "Location",
			mapId: "customs",
			mapName: "Customs",
			documentId: "financial",
			documentName: "Financial documents",
			fingerprint: "a".repeat(64),
			screenshotIds: ["screenshot"],
		},
	],
};
const publication: PublicationUpdatesData = {
	formatVersion: 1,
	updates: [
		{
			description: "Older update",
			id: "older",
			publishedAt: "2026-08-10T00:00:00.000Z",
			snapshot,
			title: "Older",
		},
		{
			description: "Newer update",
			id: "newer",
			publishedAt: "2026-08-11T00:00:00.000Z",
			snapshot: { formatVersion: 1, locations: [] },
			title: "Newer",
		},
	],
};

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("publication updates store", () => {
	it("imports into an empty table and round-trips newest-first exactly", async () => {
		const database = await createDatabase();

		try {
			const counts = await importPublicationUpdates(
				database.client,
				publication,
			);

			expect(counts).toEqual({ updates: 2 });
			await assertPublicationUpdatesImportCount(database.client, 2);
			expect((await readUpdatesFromDatabase(database.client))[0]?.id).toBe(
				"newer",
			);
			expect(await readUpdatesFromDatabase(database.client)).not.toHaveProperty(
				"0.snapshot",
			);
			const stored = await database.client.get(
				"SELECT snapshot FROM updates WHERE id = ?",
				["older"],
			);
			expect(stored?.snapshot).toBe(JSON.stringify(snapshot));
			expect(
				serializePublicationUpdatesData(
					await readPublicationUpdatesFromDatabase(database.client),
				),
			).toBe(serializePublicationUpdatesData(publication));
		} finally {
			await database.client.close();
		}
	});

	it("rejects imports when the updates table is nonempty", async () => {
		const database = await createDatabase();

		try {
			await importPublicationUpdates(database.client, publication);

			await expect(
				importPublicationUpdates(database.client, {
					formatVersion: 1,
					updates: [],
				}),
			).rejects.toThrow("empty updates table");
			await assertPublicationUpdatesImportCount(database.client, 2);
		} finally {
			await database.client.close();
		}
	});

	it("preserves snapshot bytes when update metadata changes", async () => {
		const database = await createDatabase();

		try {
			await importPublicationUpdates(database.client, publication);
			const before = await database.client.get(
				"SELECT snapshot FROM updates WHERE id = ?",
				["older"],
			);
			await database.client.run(
				"UPDATE updates SET title = ?, description = ?, published_at = ? WHERE id = ?",
				[
					"Edited title",
					"Edited description",
					"2026-08-12T00:00:00.000Z",
					"older",
				],
			);
			const after = await database.client.get(
				"SELECT snapshot FROM updates WHERE id = ?",
				["older"],
			);

			expect(after?.snapshot).toBe(before?.snapshot);
		} finally {
			await database.client.close();
		}
	});
});

async function createDatabase() {
	const directory = await mkdtemp(
		resolve(tmpdir(), "tarkov-publication-updates-store-"),
	);
	temporaryDirectories.push(directory);
	const database = await openDatabase(resolve(directory, "database.sqlite"), {
		create: true,
	});
	await migrateDatabase(database.db, resolve(process.cwd(), "drizzle"));
	return database;
}
