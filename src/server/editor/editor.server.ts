import "@tanstack/react-start/server-only";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, asc, desc, eq } from "drizzle-orm";

import type {
	DeleteLocationInput,
	SaveLocationFormInput,
} from "@/lib/editor-validation";
import {
	type PublicationData,
	serializePublicationData,
} from "@/lib/publication-data";
import { getDatabase, runDatabaseTransaction } from "@/server/db/client.server";
import { writePublicationManifest } from "@/server/db/publication-manifest";
import {
	assertPublicationReferences,
	readPublicationDataFromDatabase,
} from "@/server/db/publication-store";
import {
	documentMaps,
	documents,
	keyMaps,
	keys,
	locationDocuments,
	locationRequiredKeys,
	locations,
	mapImages,
	maps,
	screenshots,
} from "@/server/db/schema";
import { assertLocalEditorAccess } from "./access.server";
import {
	discardPublishedFiles,
	processScreenshotFiles,
	removeLocationScreenshotDirectories,
	removeScreenshotFiles,
} from "./screenshot-files.server";

const projectRoot = resolve(process.cwd());
const publicationPath = resolve(projectRoot, "data/publication/locations.json");
type EditorRuntimeState = {
	mutationLocks: Map<string, Promise<void>>;
	publicationWriteTail: Promise<void>;
};
const globalEditorRuntime = globalThis as typeof globalThis & {
	__tarkovEditorRuntime?: EditorRuntimeState;
};
const editorRuntime = globalEditorRuntime.__tarkovEditorRuntime ?? {
	mutationLocks: new Map(),
	publicationWriteTail: Promise.resolve(),
};
globalEditorRuntime.__tarkovEditorRuntime = editorRuntime;
const editorMutationLocks = editorRuntime.mutationLocks;

type PublicationExpectation =
	| { type: "saved"; locationId: string; mapImageId: string }
	| { type: "deleted"; locationId: string };

export async function readEditorData() {
	assertLocalEditorAccess();

	const { db } = await getDatabase();
	const mapRows = await db
		.select({
			id: maps.id,
			name: maps.name,
			description: maps.description,
			isActive: maps.isActive,
		})
		.from(maps)
		.where(eq(maps.isActive, true))
		.orderBy(asc(maps.name))
		.all();
	const imageRows = await db
		.select({
			id: mapImages.id,
			mapId: mapImages.mapId,
			viewKey: mapImages.viewKey,
			name: mapImages.name,
			path: mapImages.path,
			altText: mapImages.altText,
			width: mapImages.width,
			height: mapImages.height,
		})
		.from(mapImages)
		.innerJoin(maps, eq(maps.id, mapImages.mapId))
		.where(and(eq(mapImages.isCurrent, true), eq(maps.isActive, true)))
		.orderBy(
			asc(mapImages.mapId),
			desc(eq(mapImages.viewKey, "main")),
			asc(mapImages.name),
		)
		.all();
	const locationRows = await db
		.select({
			id: locations.id,
			mapImageId: locations.mapImageId,
			name: locations.name,
			description: locations.description,
			xBasisPoints: locations.xBasisPoints,
			yBasisPoints: locations.yBasisPoints,
			isActive: locations.isActive,
		})
		.from(locations)
		.orderBy(asc(locations.name))
		.all();
	const locationDocumentRows = await db
		.select({
			locationId: locationDocuments.locationId,
			documentId: locationDocuments.documentId,
		})
		.from(locationDocuments)
		.all();
	const screenshotRows = await db
		.select({
			id: screenshots.id,
			locationId: screenshots.locationId,
			path: screenshots.path,
			previewPath: screenshots.previewPath,
			altText: screenshots.altText,
			caption: screenshots.caption,
			width: screenshots.width,
			height: screenshots.height,
			previewWidth: screenshots.previewWidth,
			previewHeight: screenshots.previewHeight,
			sortOrder: screenshots.sortOrder,
		})
		.from(screenshots)
		.orderBy(asc(screenshots.locationId), asc(screenshots.sortOrder))
		.all();
	const documentRows = await db
		.select({
			id: documents.id,
			name: documents.name,
			imagePath: documents.imagePath,
			imageWidth: documents.imageWidth,
			imageHeight: documents.imageHeight,
		})
		.from(documents)
		.where(and(eq(documents.isActive, true), eq(documents.isFilterable, true)))
		.orderBy(asc(documents.name))
		.all();
	const documentMapRows = await db
		.select({
			documentId: documentMaps.documentId,
			mapId: documentMaps.mapId,
		})
		.from(documentMaps)
		.all();
	const keyRows = await db
		.select({
			id: keys.id,
			name: keys.name,
			imagePath: keys.imagePath,
			imageWidth: keys.imageWidth,
			imageHeight: keys.imageHeight,
			usedInQuest: keys.usedInQuest,
		})
		.from(keys)
		.orderBy(asc(keys.name))
		.all();
	const keyMapRows = await db.select().from(keyMaps).all();
	const locationRequiredKeyRows = await db
		.select()
		.from(locationRequiredKeys)
		.all();

	return {
		maps: mapRows,
		mapImages: imageRows,
		locations: locationRows,
		locationDocuments: locationDocumentRows,
		screenshots: screenshotRows,
		documents: documentRows,
		documentMaps: documentMapRows,
		keys: keyRows,
		keyMaps: keyMapRows,
		locationRequiredKeys: locationRequiredKeyRows,
	};
}

export async function saveEditorLocation(input: SaveLocationFormInput) {
	assertLocalEditorAccess({ mutation: true });
	const locationId = input.location.id ?? randomUUID();

	return withLocationMutationLock(locationId, () =>
		saveEditorLocationLocked(input, locationId),
	);
}

async function saveEditorLocationLocked(
	input: SaveLocationFormInput,
	locationId: string,
) {
	const { db } = await getDatabase();
	const { location } = input;
	const image = await db
		.select({ mapId: mapImages.mapId })
		.from(mapImages)
		.innerJoin(maps, eq(maps.id, mapImages.mapId))
		.where(
			and(
				eq(mapImages.id, location.mapImageId),
				eq(mapImages.isCurrent, true),
				eq(maps.isActive, true),
			),
		)
		.get();

	if (!image) {
		throw new Error("The selected map image does not exist");
	}

	const allowedDocument = await db
		.select({ id: documentMaps.documentId })
		.from(documentMaps)
		.innerJoin(documents, eq(documents.id, documentMaps.documentId))
		.where(
			and(
				eq(documentMaps.documentId, location.documentId),
				eq(documentMaps.mapId, image.mapId),
				eq(documents.isActive, true),
				eq(documents.isFilterable, true),
			),
		)
		.get();

	if (!allowedDocument) {
		throw new Error("The selected document does not belong to this map");
	}

	if (location.requiredKeyIds.length > 0) {
		const allowedKeys = await db
			.select({ id: keys.id })
			.from(keys)
			.innerJoin(
				keyMaps,
				and(eq(keyMaps.keyId, keys.id), eq(keyMaps.mapId, image.mapId)),
			)
			.all();
		const allowedKeyIds = new Set(allowedKeys.map(({ id }) => id));
		if (location.requiredKeyIds.some((keyId) => !allowedKeyIds.has(keyId))) {
			throw new Error("A selected key does not belong to this map");
		}
	}

	if (location.id) {
		const existingLocation = await db
			.select({ id: locations.id })
			.from(locations)
			.where(eq(locations.id, location.id))
			.get();

		if (!existingLocation) {
			throw new Error("The selected location no longer exists");
		}
	}

	const existingScreenshotRows = location.id
		? await db
				.select({
					id: screenshots.id,
					path: screenshots.path,
					previewPath: screenshots.previewPath,
					altText: screenshots.altText,
					caption: screenshots.caption,
					width: screenshots.width,
					height: screenshots.height,
					previewWidth: screenshots.previewWidth,
					previewHeight: screenshots.previewHeight,
					fullHash: screenshots.fullHash,
					isActive: screenshots.isActive,
					previewHash: screenshots.previewHash,
					sourceHash: screenshots.sourceHash,
				})
				.from(screenshots)
				.where(eq(screenshots.locationId, locationId))
				.all()
		: [];
	const existingById = new Map(
		existingScreenshotRows.map((screenshot) => [screenshot.id, screenshot]),
	);

	for (const screenshot of input.screenshots) {
		if (screenshot.id && !existingById.has(screenshot.id)) {
			throw new Error(
				"An existing screenshot does not belong to this location",
			);
		}
	}

	const processedBatch = await processScreenshotFiles(locationId, input.files);

	try {
		const finalScreenshots = input.screenshots.map((screenshot, sortOrder) => {
			if (screenshot.id) {
				const existing = existingById.get(screenshot.id);

				if (!existing) {
					throw new Error("An existing screenshot is unavailable");
				}

				return {
					...existing,
					locationId,
					altText: screenshot.altText,
					caption: screenshot.caption,
					sortOrder,
				};
			}

			const processed =
				processedBatch.screenshots[screenshot.uploadIndex ?? -1];

			if (!processed) {
				throw new Error("A processed screenshot is unavailable");
			}

			return {
				id: randomUUID(),
				locationId,
				...processed,
				altText: screenshot.altText,
				caption: screenshot.caption,
				sortOrder,
				isActive: true,
			};
		});
		const sourceHashes = finalScreenshots.map(({ sourceHash }) => sourceHash);

		if (new Set(sourceHashes).size !== sourceHashes.length) {
			throw new Error("The same screenshot cannot be attached twice");
		}

		await runDatabaseTransaction(async (transaction) => {
			if (location.id) {
				await transaction
					.update(locations)
					.set({
						mapImageId: location.mapImageId,
						name: location.name,
						description: location.description,
						xBasisPoints: location.xBasisPoints,
						yBasisPoints: location.yBasisPoints,
						isActive: location.isActive,
					})
					.where(eq(locations.id, location.id))
					.run();
			} else {
				await transaction
					.insert(locations)
					.values({
						id: locationId,
						mapImageId: location.mapImageId,
						name: location.name,
						description: location.description,
						xBasisPoints: location.xBasisPoints,
						yBasisPoints: location.yBasisPoints,
						isActive: location.isActive,
					})
					.run();
			}

			await transaction
				.delete(locationDocuments)
				.where(eq(locationDocuments.locationId, locationId))
				.run();
			await transaction
				.insert(locationDocuments)
				.values({ locationId, documentId: location.documentId })
				.run();
			await transaction
				.delete(locationRequiredKeys)
				.where(eq(locationRequiredKeys.locationId, locationId))
				.run();
			if (location.requiredKeyIds.length > 0) {
				await transaction
					.insert(locationRequiredKeys)
					.values(
						location.requiredKeyIds.map((keyId) => ({ keyId, locationId })),
					)
					.run();
			}
			await transaction
				.delete(screenshots)
				.where(eq(screenshots.locationId, locationId))
				.run();
			await transaction.insert(screenshots).values(finalScreenshots).run();
		});

		const retainedIds = new Set(
			input.screenshots.flatMap(({ id }) => (id ? [id] : [])),
		);
		const retainedPaths = new Set(
			finalScreenshots.flatMap(({ path, previewPath }) => [path, previewPath]),
		);
		const removedScreenshots = existingScreenshotRows.filter(
			({ id, path, previewPath }) =>
				!retainedIds.has(id) &&
				!retainedPaths.has(path) &&
				!retainedPaths.has(previewPath),
		);

		try {
			await removeScreenshotFiles(locationId, removedScreenshots);
		} catch (error) {
			console.error("Failed to remove obsolete screenshot files", error);
		}
	} catch (error) {
		await discardPublishedFiles(processedBatch.createdFiles);
		throw error;
	}

	await publishEditorManifest({
		type: "saved",
		locationId,
		mapImageId: location.mapImageId,
	});
	return {
		id: locationId,
		mapId: image.mapId,
		mapImageId: location.mapImageId,
	};
}

export async function deleteEditorLocation(input: DeleteLocationInput) {
	assertLocalEditorAccess({ mutation: true });

	return withLocationMutationLock(input.id, () =>
		deleteEditorLocationLocked(input),
	);
}

async function deleteEditorLocationLocked(input: DeleteLocationInput) {
	const deleted = await runDatabaseTransaction((transaction) =>
		transaction
			.delete(locations)
			.where(eq(locations.id, input.id))
			.returning({ id: locations.id })
			.get(),
	);

	if (!deleted) {
		throw new Error("The selected location no longer exists");
	}

	try {
		await removeLocationScreenshotDirectories(input.id);
	} catch (error) {
		console.error("Failed to remove location screenshot files", error);
	}

	await publishEditorManifest({ type: "deleted", locationId: deleted.id });
	return { id: deleted.id };
}

async function publishEditorManifest(expectation: PublicationExpectation) {
	const write = editorRuntime.publicationWriteTail
		.catch(() => undefined)
		.then(async () => {
			const { client } = await getDatabase();
			const data = await readPublicationDataFromDatabase(client);

			assertPublicationExpectation(data, expectation);
			await assertPublicationReferences(client, data);
			await writePublicationManifest(data, publicationPath);

			const expectedManifest = serializePublicationData(data);
			const writtenManifest = await readFile(publicationPath, "utf8");
			if (writtenManifest !== expectedManifest) {
				throw new Error("Published manifest does not match the saved database");
			}
		});

	editorRuntime.publicationWriteTail = write.then(
		() => undefined,
		() => undefined,
	);

	return write;
}

function assertPublicationExpectation(
	data: PublicationData,
	expectation: PublicationExpectation,
) {
	const location = data.locations.find(
		(item) => item.id === expectation.locationId,
	);

	if (expectation.type === "deleted") {
		if (location) {
			throw new Error("Deleted location remains in the publication manifest");
		}
		return;
	}

	if (!location || location.mapImageId !== expectation.mapImageId) {
		throw new Error("Saved location is missing from the publication manifest");
	}
}

async function withLocationMutationLock<Result>(
	locationId: string,
	operation: () => Promise<Result>,
) {
	const previous = editorMutationLocks.get(locationId) ?? Promise.resolve();
	let release = () => {};
	const current = new Promise<void>((resolve) => {
		release = resolve;
	});
	const tail = previous.then(() => current);
	editorMutationLocks.set(locationId, tail);

	await previous;

	try {
		return await operation();
	} finally {
		release();

		if (editorMutationLocks.get(locationId) === tail) {
			editorMutationLocks.delete(locationId);
		}
	}
}
