import "@tanstack/react-start/server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";

import type {
	DeleteLocationInput,
	SaveLocationInput,
} from "@/lib/editor-validation";
import { getDatabase } from "@/server/db/client.server";
import {
	documentMaps,
	documents,
	locationDocuments,
	locations,
	mapImages,
	maps,
} from "@/server/db/schema";
import { assertLocalEditorAccess } from "./access.server";

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
		.where(eq(mapImages.isCurrent, true))
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
	const documentRows = await db
		.select({ id: documents.id, name: documents.name })
		.from(documents)
		.where(eq(documents.isActive, true))
		.orderBy(asc(documents.name))
		.all();
	const documentMapRows = await db
		.select({
			documentId: documentMaps.documentId,
			mapId: documentMaps.mapId,
		})
		.from(documentMaps)
		.all();

	return {
		maps: mapRows,
		mapImages: imageRows,
		locations: locationRows,
		locationDocuments: locationDocumentRows,
		documents: documentRows,
		documentMaps: documentMapRows,
	};
}

export async function saveEditorLocation(input: SaveLocationInput) {
	assertLocalEditorAccess({ mutation: true });

	const { db } = await getDatabase();
	const locationId = input.id ?? randomUUID();

	await db.transaction(async (transaction) => {
		const image = await transaction
			.select({ mapId: mapImages.mapId })
			.from(mapImages)
			.where(
				and(eq(mapImages.id, input.mapImageId), eq(mapImages.isCurrent, true)),
			)
			.get();

		if (!image) {
			throw new Error("The selected map image does not exist");
		}

		if (input.documentIds.length > 0) {
			const allowedDocuments = await transaction
				.select({ id: documentMaps.documentId })
				.from(documentMaps)
				.innerJoin(documents, eq(documents.id, documentMaps.documentId))
				.where(
					and(
						eq(documentMaps.mapId, image.mapId),
						eq(documents.isActive, true),
						eq(documents.isFilterable, true),
					),
				)
				.all();
			const allowedDocumentIds = new Set(allowedDocuments.map(({ id }) => id));

			if (input.documentIds.some((id) => !allowedDocumentIds.has(id))) {
				throw new Error("A selected document does not belong to this map");
			}
		}

		if (input.id) {
			const existingLocation = await transaction
				.select({ id: locations.id })
				.from(locations)
				.where(eq(locations.id, input.id))
				.get();

			if (!existingLocation) {
				throw new Error("The selected location no longer exists");
			}

			await transaction
				.update(locations)
				.set({
					mapImageId: input.mapImageId,
					name: input.name,
					description: input.description,
					xBasisPoints: input.xBasisPoints,
					yBasisPoints: input.yBasisPoints,
					isActive: input.isActive,
				})
				.where(eq(locations.id, input.id))
				.run();
		} else {
			await transaction
				.insert(locations)
				.values({
					id: locationId,
					mapImageId: input.mapImageId,
					name: input.name,
					description: input.description,
					xBasisPoints: input.xBasisPoints,
					yBasisPoints: input.yBasisPoints,
					isActive: input.isActive,
				})
				.run();
		}

		await transaction
			.delete(locationDocuments)
			.where(eq(locationDocuments.locationId, locationId))
			.run();

		if (input.documentIds.length > 0) {
			await transaction
				.insert(locationDocuments)
				.values(
					input.documentIds.map((documentId) => ({
						locationId,
						documentId,
					})),
				)
				.run();
		}
	});

	return { id: locationId };
}

export async function deleteEditorLocation(input: DeleteLocationInput) {
	assertLocalEditorAccess({ mutation: true });

	const { db } = await getDatabase();
	const deleted = await db
		.delete(locations)
		.where(eq(locations.id, input.id))
		.returning({ id: locations.id })
		.get();

	if (!deleted) {
		throw new Error("The selected location no longer exists");
	}

	return { id: deleted.id };
}
