import "@tanstack/react-start/server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDatabase } from "./db/client.server";
import {
	documentMaps,
	documents,
	keys,
	locationDocuments,
	locationRequiredKeys,
	locations,
	mapImages,
	maps,
	screenshots,
} from "./db/schema";

export async function readCatalog() {
	const { db } = await getDatabase();

	return {
		maps: await db
			.select({ id: maps.id, name: maps.name })
			.from(maps)
			.where(eq(maps.isActive, true))
			.orderBy(asc(maps.name))
			.all(),
		documents: await db
			.select({
				id: documents.id,
				name: documents.name,
				isFilterable: documents.isFilterable,
				isWildcard: documents.isWildcard,
				acquisitionType: documents.acquisitionType,
				acquisitionSource: documents.acquisitionSource,
			})
			.from(documents)
			.where(eq(documents.isActive, true))
			.orderBy(asc(documents.name))
			.all(),
		documentMaps: await db
			.select({
				documentId: documentMaps.documentId,
				mapId: documentMaps.mapId,
			})
			.from(documentMaps)
			.innerJoin(
				documents,
				and(
					eq(documentMaps.documentId, documents.id),
					eq(documents.isActive, true),
					eq(documents.isFilterable, true),
				),
			)
			.innerJoin(
				maps,
				and(eq(documentMaps.mapId, maps.id), eq(maps.isActive, true)),
			)
			.orderBy(asc(documentMaps.mapId), asc(documentMaps.documentId))
			.all(),
		documentLocations: await db
			.select({
				id: locations.id,
				documentId: locationDocuments.documentId,
				mapId: mapImages.mapId,
				mapImageId: locations.mapImageId,
			})
			.from(locations)
			.innerJoin(
				mapImages,
				and(
					eq(locations.mapImageId, mapImages.id),
					eq(mapImages.isCurrent, true),
				),
			)
			.innerJoin(
				locationDocuments,
				eq(locationDocuments.locationId, locations.id),
			)
			.innerJoin(
				documents,
				and(
					eq(locationDocuments.documentId, documents.id),
					eq(documents.isActive, true),
					eq(documents.isFilterable, true),
				),
			)
			.innerJoin(
				documentMaps,
				and(
					eq(documentMaps.documentId, locationDocuments.documentId),
					eq(documentMaps.mapId, mapImages.mapId),
				),
			)
			.innerJoin(
				maps,
				and(eq(mapImages.mapId, maps.id), eq(maps.isActive, true)),
			)
			.where(eq(locations.isActive, true))
			.orderBy(asc(mapImages.mapId), asc(locations.name))
			.all(),
	};
}

export async function readPublicMap(mapId: string) {
	const { db } = await getDatabase();
	const map = await db
		.select({
			id: maps.id,
			name: maps.name,
			description: maps.description,
		})
		.from(maps)
		.where(and(eq(maps.id, mapId), eq(maps.isActive, true)))
		.get();

	if (!map) {
		return undefined;
	}

	const [images, locationRows, screenshotRows, requiredKeyRows] =
		await Promise.all([
			db
				.select({
					id: mapImages.id,
					viewKey: mapImages.viewKey,
					name: mapImages.name,
					path: mapImages.path,
					altText: mapImages.altText,
					width: mapImages.width,
					height: mapImages.height,
				})
				.from(mapImages)
				.where(and(eq(mapImages.mapId, mapId), eq(mapImages.isCurrent, true)))
				.orderBy(asc(mapImages.name))
				.all(),
			db
				.select({
					id: locations.id,
					mapImageId: locations.mapImageId,
					documentId: locationDocuments.documentId,
					documentName: documents.name,
					name: locations.name,
					description: locations.description,
					xBasisPoints: locations.xBasisPoints,
					yBasisPoints: locations.yBasisPoints,
				})
				.from(locations)
				.innerJoin(
					mapImages,
					and(
						eq(locations.mapImageId, mapImages.id),
						eq(mapImages.mapId, mapId),
						eq(mapImages.isCurrent, true),
					),
				)
				.innerJoin(
					locationDocuments,
					eq(locationDocuments.locationId, locations.id),
				)
				.innerJoin(
					documents,
					and(
						eq(locationDocuments.documentId, documents.id),
						eq(documents.isActive, true),
						eq(documents.isFilterable, true),
					),
				)
				.innerJoin(
					documentMaps,
					and(
						eq(documentMaps.documentId, locationDocuments.documentId),
						eq(documentMaps.mapId, mapImages.mapId),
					),
				)
				.where(eq(locations.isActive, true))
				.orderBy(asc(locations.name))
				.all(),
			db
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
				.innerJoin(locations, eq(screenshots.locationId, locations.id))
				.innerJoin(
					mapImages,
					and(
						eq(locations.mapImageId, mapImages.id),
						eq(mapImages.mapId, mapId),
						eq(mapImages.isCurrent, true),
					),
				)
				.where(
					and(eq(screenshots.isActive, true), eq(locations.isActive, true)),
				)
				.orderBy(asc(screenshots.locationId), asc(screenshots.sortOrder))
				.all(),
			db
				.select({
					locationId: locationRequiredKeys.locationId,
					id: keys.id,
					name: keys.name,
					wikiUrl: keys.wikiUrl,
					imagePath: keys.imagePath,
					imageWidth: keys.imageWidth,
					imageHeight: keys.imageHeight,
				})
				.from(locationRequiredKeys)
				.innerJoin(keys, eq(keys.id, locationRequiredKeys.keyId))
				.innerJoin(locations, eq(locations.id, locationRequiredKeys.locationId))
				.innerJoin(
					mapImages,
					and(
						eq(mapImages.id, locations.mapImageId),
						eq(mapImages.mapId, mapId),
						eq(mapImages.isCurrent, true),
					),
				)
				.where(eq(locations.isActive, true))
				.orderBy(asc(locationRequiredKeys.locationId), asc(keys.name))
				.all(),
		]);
	const locationIds = new Set(locationRows.map((location) => location.id));
	const requiredKeysByLocation = new Map<
		string,
		Omit<(typeof requiredKeyRows)[number], "locationId">[]
	>();
	for (const { locationId, ...key } of requiredKeyRows) {
		const rows = requiredKeysByLocation.get(locationId) ?? [];
		rows.push(key);
		requiredKeysByLocation.set(locationId, rows);
	}

	return {
		map,
		images,
		locations: locationRows.map((location) => ({
			...location,
			requiredKeys: requiredKeysByLocation.get(location.id) ?? [],
		})),
		screenshots: screenshotRows.filter((screenshot) =>
			locationIds.has(screenshot.locationId),
		),
	};
}
