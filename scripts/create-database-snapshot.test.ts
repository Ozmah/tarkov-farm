import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { connect } from "@tursodatabase/database";
import { afterEach, describe, expect, it } from "vitest";

import {
	createSnapshot,
	verifyKnownForeignKeys,
} from "./create-database-snapshot";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("database snapshots", () => {
	it("creates a readable copy containing committed data", async () => {
		const directory = await createTemporaryDirectory();
		const sourcePath = resolve(directory, "source.sqlite");
		const snapshotPath = resolve(directory, "snapshot.sqlite");
		const source = await connect(sourcePath);

		try {
			await source.exec(`
				CREATE TABLE locations (id TEXT PRIMARY KEY, name TEXT NOT NULL);
				INSERT INTO locations (id, name) VALUES ('location-1', 'Test location');
			`);
		} finally {
			await source.close();
		}

		await createSnapshot(sourcePath, snapshotPath);

		const snapshot = await connect(snapshotPath, {
			fileMustExist: true,
			readonly: true,
		});

		try {
			await expect(
				snapshot.get("SELECT id, name FROM locations"),
			).resolves.toMatchObject({
				id: "location-1",
				name: "Test location",
			});
		} finally {
			await snapshot.close();
		}
	});

	it("detects orphaned relationships without relying on foreign_key_check", async () => {
		const database = await connect(":memory:");

		try {
			await database.exec(`
				CREATE TABLE maps (id TEXT PRIMARY KEY);
				CREATE TABLE map_images (id TEXT PRIMARY KEY, map_id TEXT NOT NULL);
				CREATE TABLE documents (id TEXT PRIMARY KEY);
				CREATE TABLE document_maps (document_id TEXT NOT NULL, map_id TEXT NOT NULL);
				CREATE TABLE locations (id TEXT PRIMARY KEY, map_image_id TEXT NOT NULL);
				CREATE TABLE location_documents (location_id TEXT NOT NULL, document_id TEXT NOT NULL);
				CREATE TABLE screenshots (id TEXT PRIMARY KEY, location_id TEXT NOT NULL);

				INSERT INTO maps (id) VALUES ('map-1');
				INSERT INTO map_images (id, map_id) VALUES
					('image-1', 'map-1'),
					('orphan-image', 'missing-map');
				INSERT INTO documents (id) VALUES ('document-1');
				INSERT INTO document_maps (document_id, map_id) VALUES ('document-1', 'map-1');
				INSERT INTO locations (id, map_image_id) VALUES ('location-1', 'image-1');
				INSERT INTO location_documents (location_id, document_id) VALUES ('location-1', 'document-1');
				INSERT INTO screenshots (id, location_id) VALUES ('screenshot-1', 'location-1');
			`);

			const errors: string[] = [];
			const violations = await verifyKnownForeignKeys(database, errors);

			expect(violations).toBe(1);
			expect(errors).toEqual([
				"map_images.map_id -> maps.id has 1 orphaned row(s)",
			]);
		} finally {
			await database.close();
		}
	});
});

async function createTemporaryDirectory() {
	const directory = await mkdtemp(resolve(tmpdir(), "tarkov-db-snapshot-"));
	temporaryDirectories.push(directory);
	return directory;
}
