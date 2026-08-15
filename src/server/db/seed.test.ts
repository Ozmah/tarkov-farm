import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "./migrate";
import { openDatabase } from "./open";
import { seedCatalog } from "./seed";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("catalog seed", () => {
	it("seeds the canonical document catalog and map assignments", async () => {
		const directory = await mkdtemp(resolve(tmpdir(), "tarkov-catalog-seed-"));
		temporaryDirectories.push(directory);
		const { client, db } = await openDatabase(
			resolve(directory, "database.sqlite"),
			{ create: true },
		);

		try {
			await migrateDatabase(db, resolve(process.cwd(), "drizzle"));
			const counts = await seedCatalog(db);
			const documentRows = await client.all(
				"SELECT id, description, acquisition_type, acquisition_source, is_filterable, is_wildcard FROM documents ORDER BY name",
			);
			const documentMapRows = await client.all(
				"SELECT document_id, map_id FROM document_maps ORDER BY document_id, map_id",
			);

			expect(counts.documents).toBe(9);
			expect(counts.documentMaps).toBe(24);
			expect(documentRows).toHaveLength(9);
			expect(documentMapRows).toHaveLength(24);
			expect(
				documentRows.every(
					({ description }) =>
						typeof description === "string" && description.length > 0,
				),
			).toBe(true);
			expect(documentRows.find(({ id }) => id === "classified")).toMatchObject({
				acquisition_source: "Expansion Hub",
				acquisition_type: "store",
				is_filterable: 0,
				is_wildcard: 1,
			});
			expect(
				documentMapRows.some(({ document_id }) => document_id === "classified"),
			).toBe(false);
		} finally {
			await client.close();
		}
	});
});
