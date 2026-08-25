import "@tanstack/react-start/server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import {
	getMapImageSources,
	type MapMasterManifest,
} from "@/lib/map-master-manifest";
import { getDatabase } from "@/server/db/client.server";
import { readMapMasterManifest } from "@/server/db/map-master-manifest.server";
import {
	documentMaps,
	documents,
	keyMaps,
	keys,
	mapImages,
	maps,
} from "@/server/db/schema";

type CatalogDatabase = Awaited<ReturnType<typeof getDatabase>>["db"];

export async function readContributionCatalog() {
	const [{ db }, masterManifest] = await Promise.all([
		getDatabase(),
		readMapMasterManifest(),
	]);

	return queryContributionCatalog(db, masterManifest);
}

export async function queryContributionCatalog(
	db: CatalogDatabase,
	masterManifest: MapMasterManifest,
) {
	const [
		mapRows,
		imageRows,
		documentRows,
		documentMapRows,
		keyRows,
		keyMapRows,
	] = await Promise.all([
		db
			.select({ id: maps.id, name: maps.name })
			.from(maps)
			.where(eq(maps.isActive, true))
			.orderBy(asc(maps.name))
			.all(),
		db
			.select({
				id: mapImages.id,
				altText: mapImages.altText,
				height: mapImages.height,
				mapId: mapImages.mapId,
				name: mapImages.name,
				path: mapImages.path,
				sha256: mapImages.contentHash,
				width: mapImages.width,
			})
			.from(mapImages)
			.innerJoin(maps, eq(maps.id, mapImages.mapId))
			.where(and(eq(mapImages.isCurrent, true), eq(maps.isActive, true)))
			.orderBy(
				asc(mapImages.mapId),
				desc(eq(mapImages.viewKey, "main")),
				asc(mapImages.name),
			)
			.all(),
		db
			.select({ id: documents.id, name: documents.name })
			.from(documents)
			.where(
				and(eq(documents.isActive, true), eq(documents.isFilterable, true)),
			)
			.orderBy(asc(documents.name))
			.all(),
		db
			.select({
				documentId: documentMaps.documentId,
				mapId: documentMaps.mapId,
			})
			.from(documentMaps)
			.innerJoin(
				documents,
				and(
					eq(documents.id, documentMaps.documentId),
					eq(documents.isActive, true),
					eq(documents.isFilterable, true),
				),
			)
			.innerJoin(
				maps,
				and(eq(maps.id, documentMaps.mapId), eq(maps.isActive, true)),
			)
			.orderBy(asc(documentMaps.mapId), asc(documentMaps.documentId))
			.all(),
		db
			.select({
				id: keys.id,
				imageHeight: keys.imageHeight,
				imagePath: keys.imagePath,
				imageWidth: keys.imageWidth,
				name: keys.name,
			})
			.from(keys)
			.orderBy(asc(keys.name))
			.all(),
		db
			.select({ keyId: keyMaps.keyId, mapId: keyMaps.mapId })
			.from(keyMaps)
			.innerJoin(maps, and(eq(maps.id, keyMaps.mapId), eq(maps.isActive, true)))
			.orderBy(asc(keyMaps.mapId), asc(keyMaps.keyId))
			.all(),
	]);
	const contributableMapIds = new Set(imageRows.map(({ mapId }) => mapId));
	const visibleDocumentMaps = documentMapRows.filter(({ mapId }) =>
		contributableMapIds.has(mapId),
	);
	const visibleDocumentIds = new Set(
		visibleDocumentMaps.map(({ documentId }) => documentId),
	);
	const visibleKeyMaps = keyMapRows.filter(({ mapId }) =>
		contributableMapIds.has(mapId),
	);
	const visibleKeyIds = new Set(visibleKeyMaps.map(({ keyId }) => keyId));

	return {
		documentMaps: visibleDocumentMaps,
		documents: documentRows.filter(({ id }) => visibleDocumentIds.has(id)),
		keyMaps: visibleKeyMaps,
		keys: keyRows.filter(({ id }) => visibleKeyIds.has(id)),
		mapImages: imageRows.map((image) => ({
			...image,
			sources: getMapImageSources(masterManifest, image.path),
		})),
		maps: mapRows.filter(({ id }) => contributableMapIds.has(id)),
	};
}
