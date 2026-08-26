import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { readMapMasterManifest } from "@/server/db/map-master-manifest.server";
import { migrateDatabase } from "@/server/db/migrate";
import { openDatabase } from "@/server/db/open";
import {
	documentMaps,
	locationDocuments,
	locations,
	maps,
} from "@/server/db/schema";
import { seedCatalog } from "@/server/db/seed";
import { queryContributionCatalog } from "./contribution-catalog.server";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("contribution catalog", () => {
	it("exposes only safe, current catalog data for active maps", async () => {
		const directory = await mkdtemp(
			resolve("/tmp/opencode", "contribution-catalog-"),
		);
		temporaryDirectories.push(directory);
		const { client, db } = await openDatabase(
			resolve(directory, "database.sqlite"),
			{ create: true },
		);

		try {
			await migrateDatabase(db, resolve(process.cwd(), "drizzle"));
			await seedCatalog(db);
			const documentAssignment = await db
				.select({ documentId: documentMaps.documentId })
				.from(documentMaps)
				.where(eq(documentMaps.mapId, "customs"))
				.get();

			if (!documentAssignment) {
				throw new Error("Expected a Customs document assignment");
			}

			await db
				.insert(locations)
				.values([
					{
						id: "visible-location",
						isActive: true,
						mapImageId: "customs-main",
						name: "Visible location",
						xBasisPoints: 4_000,
						yBasisPoints: 6_000,
					},
					{
						id: "hidden-location",
						isActive: false,
						mapImageId: "customs-main",
						name: "Hidden location",
						xBasisPoints: 5_000,
						yBasisPoints: 5_000,
					},
				])
				.run();
			await db
				.insert(locationDocuments)
				.values([
					{
						documentId: documentAssignment.documentId,
						locationId: "visible-location",
					},
					{
						documentId: documentAssignment.documentId,
						locationId: "hidden-location",
					},
				])
				.run();
			await db
				.update(maps)
				.set({ isActive: false })
				.where(eq(maps.id, "factory"));

			const catalog = await queryContributionCatalog(
				db,
				await readMapMasterManifest(),
			);
			const mapIds = new Set(catalog.maps.map(({ id }) => id));
			const documentIds = new Set(catalog.documents.map(({ id }) => id));
			const keyIds = new Set(catalog.keys.map(({ id }) => id));

			expect(mapIds.has("factory")).toBe(false);
			expect(catalog.mapImages.length).toBeGreaterThan(0);
			expect(
				catalog.mapImages.every(
					(image) =>
						mapIds.has(image.mapId) &&
						/^[a-f0-9]{64}$/.test(image.sha256) &&
						image.sources.length > 0,
				),
			).toBe(true);
			expect(documentIds.has("classified")).toBe(false);
			expect(
				catalog.documentMaps.every(
					({ documentId, mapId }) =>
						documentIds.has(documentId) && mapIds.has(mapId),
				),
			).toBe(true);
			expect(
				catalog.documents.every(({ id }) =>
					catalog.documentMaps.some(({ documentId }) => documentId === id),
				),
			).toBe(true);
			expect(
				catalog.keyMaps.every(
					({ keyId, mapId }) => keyIds.has(keyId) && mapIds.has(mapId),
				),
			).toBe(true);
			expect(
				catalog.keys.every(({ id }) =>
					catalog.keyMaps.some(({ keyId }) => keyId === id),
				),
			).toBe(true);
			expect(Object.keys(catalog).sort()).toEqual([
				"documentMaps",
				"documents",
				"keyMaps",
				"keys",
				"locations",
				"mapImages",
				"maps",
			]);
			expect(Object.keys(catalog.maps[0] ?? {}).sort()).toEqual(["id", "name"]);
			expect(Object.keys(catalog.mapImages[0] ?? {}).sort()).toEqual([
				"altText",
				"height",
				"id",
				"mapId",
				"name",
				"path",
				"sha256",
				"sources",
				"width",
			]);
			expect(Object.keys(catalog.keys[0] ?? {}).sort()).toEqual([
				"id",
				"imageHeight",
				"imagePath",
				"imageWidth",
				"name",
			]);
			expect(catalog.locations.map(({ id }) => id)).toEqual([
				"visible-location",
			]);
			expect(Object.keys(catalog.locations[0] ?? {}).sort()).toEqual([
				"id",
				"mapImageId",
				"name",
				"xBasisPoints",
				"yBasisPoints",
			]);
			expect(
				catalog.locations.every((location) =>
					catalog.mapImages.some(({ id }) => id === location.mapImageId),
				),
			).toBe(true);
		} finally {
			await client.close();
		}
	});
});
