import { createHash } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/tursodatabase/database";

import type { PublicationData } from "../../lib/publication-data";
import {
	parseReleaseSnapshot,
	type ReleaseSnapshot,
} from "../../lib/release-context";
import {
	documentMaps,
	documents,
	locationDocuments,
	locationRequiredKeys,
	locations,
	mapImages,
	maps,
	screenshots,
} from "./schema";

type SnapshotTransaction = Parameters<
	Parameters<ReturnType<typeof drizzle>["transaction"]>[0]
>[0];

type Catalog = Awaited<ReturnType<typeof readSnapshotCatalog>>;

export async function readSnapshotCatalog(transaction: SnapshotTransaction) {
	const [mapRows, imageRows, documentRows, documentMapRows] = await Promise.all(
		[
			transaction.select().from(maps).all(),
			transaction.select().from(mapImages).all(),
			transaction.select().from(documents).all(),
			transaction.select().from(documentMaps).all(),
		],
	);

	return {
		maps: mapRows,
		mapImages: imageRows,
		documents: documentRows,
		documentMaps: documentMapRows,
	};
}

export async function readCurrentReleaseSnapshot(
	transaction: SnapshotTransaction,
): Promise<ReleaseSnapshot> {
	const [locationRows, requiredKeyRows, screenshotRows] = await Promise.all([
		transaction
			.select({
				description: locations.description,
				documentId: documents.id,
				documentName: documents.name,
				id: locations.id,
				mapId: maps.id,
				mapImageAltText: mapImages.altText,
				mapImageContentHash: mapImages.contentHash,
				mapImageHeight: mapImages.height,
				mapImageId: mapImages.id,
				mapImageName: mapImages.name,
				mapImagePath: mapImages.path,
				mapImageViewKey: mapImages.viewKey,
				mapImageWidth: mapImages.width,
				mapName: maps.name,
				name: locations.name,
				xBasisPoints: locations.xBasisPoints,
				yBasisPoints: locations.yBasisPoints,
			})
			.from(locations)
			.innerJoin(
				mapImages,
				and(
					eq(mapImages.id, locations.mapImageId),
					eq(mapImages.isCurrent, true),
				),
			)
			.innerJoin(
				maps,
				and(eq(maps.id, mapImages.mapId), eq(maps.isActive, true)),
			)
			.innerJoin(
				locationDocuments,
				eq(locationDocuments.locationId, locations.id),
			)
			.innerJoin(
				documents,
				and(
					eq(documents.id, locationDocuments.documentId),
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
			.orderBy(asc(locations.id))
			.all(),
		transaction
			.select({
				keyId: locationRequiredKeys.keyId,
				locationId: locationRequiredKeys.locationId,
			})
			.from(locationRequiredKeys)
			.innerJoin(locations, eq(locations.id, locationRequiredKeys.locationId))
			.where(eq(locations.isActive, true))
			.orderBy(
				asc(locationRequiredKeys.locationId),
				asc(locationRequiredKeys.keyId),
			)
			.all(),
		transaction
			.select({
				altText: screenshots.altText,
				caption: screenshots.caption,
				fullHash: screenshots.fullHash,
				height: screenshots.height,
				id: screenshots.id,
				locationId: screenshots.locationId,
				path: screenshots.path,
				previewHash: screenshots.previewHash,
				previewHeight: screenshots.previewHeight,
				previewPath: screenshots.previewPath,
				previewWidth: screenshots.previewWidth,
				sortOrder: screenshots.sortOrder,
				sourceHash: screenshots.sourceHash,
				width: screenshots.width,
			})
			.from(screenshots)
			.innerJoin(locations, eq(locations.id, screenshots.locationId))
			.where(and(eq(locations.isActive, true), eq(screenshots.isActive, true)))
			.orderBy(
				asc(screenshots.locationId),
				asc(screenshots.sortOrder),
				asc(screenshots.id),
			)
			.all(),
	]);
	const screenshotsByLocation = new Map<
		string,
		Array<(typeof screenshotRows)[number]>
	>();
	const requiredKeyIdsByLocation = new Map<string, string[]>();
	for (const relation of requiredKeyRows) {
		const identifiers = requiredKeyIdsByLocation.get(relation.locationId) ?? [];
		identifiers.push(relation.keyId);
		requiredKeyIdsByLocation.set(relation.locationId, identifiers);
	}

	for (const screenshot of screenshotRows) {
		const rows = screenshotsByLocation.get(screenshot.locationId) ?? [];
		rows.push(screenshot);
		screenshotsByLocation.set(screenshot.locationId, rows);
	}

	return buildSnapshot(
		locationRows.map((location) => ({
			...location,
			requiredKeyIds: requiredKeyIdsByLocation.get(location.id) ?? [],
			screenshots: screenshotsByLocation.get(location.id) ?? [],
		})),
	);
}

export function buildReleaseSnapshotFromPublication(
	publication: PublicationData,
	catalog: Catalog,
): ReleaseSnapshot {
	const mapById = new Map(catalog.maps.map((map) => [map.id, map]));
	const imageById = new Map(
		catalog.mapImages.map((image) => [image.id, image]),
	);
	const documentById = new Map(
		catalog.documents.map((document) => [document.id, document]),
	);
	const allowedDocumentMaps = new Set(
		catalog.documentMaps.map(
			({ documentId, mapId }) => `${documentId}\u0000${mapId}`,
		),
	);

	return buildSnapshot(
		publication.locations.flatMap((location) => {
			if (!location.isActive) return [];
			const image = imageById.get(location.mapImageId);
			const map = image ? mapById.get(image.mapId) : undefined;
			const document = documentById.get(location.documentId);

			if (!image || !map || !document) {
				throw new Error(
					`Git HEAD location ${location.id} references catalog data unavailable in the current database`,
				);
			}

			if (
				!image.isCurrent ||
				!map.isActive ||
				!document.isActive ||
				!document.isFilterable ||
				!allowedDocumentMaps.has(`${document.id}\u0000${map.id}`)
			) {
				return [];
			}

			return [
				{
					description: location.description,
					documentId: document.id,
					documentName: document.name,
					id: location.id,
					mapId: map.id,
					mapImageAltText: image.altText,
					mapImageContentHash: image.contentHash,
					mapImageHeight: image.height,
					mapImageId: image.id,
					mapImageName: image.name,
					mapImagePath: image.path,
					mapImageViewKey: image.viewKey,
					mapImageWidth: image.width,
					mapName: map.name,
					name: location.name,
					xBasisPoints: location.xBasisPoints,
					yBasisPoints: location.yBasisPoints,
					requiredKeyIds: location.requiredKeyIds,
					screenshots: location.screenshots
						.filter(({ isActive }) => isActive)
						.map((screenshot) => ({
							altText: screenshot.altText,
							caption: screenshot.caption,
							fullHash: screenshot.full.sha256,
							height: screenshot.full.height,
							id: screenshot.id,
							locationId: location.id,
							path: screenshot.full.path,
							previewHash: screenshot.preview.sha256,
							previewHeight: screenshot.preview.height,
							previewPath: screenshot.preview.path,
							previewWidth: screenshot.preview.width,
							sortOrder: screenshot.sortOrder,
							sourceHash: screenshot.sourceSha256,
							width: screenshot.full.width,
						})),
				},
			];
		}),
	);
}

function buildSnapshot(
	locations: Array<{
		id: string;
		name: string;
		description: string | null;
		xBasisPoints: number;
		yBasisPoints: number;
		mapId: string;
		mapName: string;
		mapImageId: string;
		mapImageViewKey: string;
		mapImageName: string;
		mapImagePath: string;
		mapImageAltText: string;
		mapImageWidth: number;
		mapImageHeight: number;
		mapImageContentHash: string;
		documentId: string;
		documentName: string;
		requiredKeyIds: string[];
		screenshots: Array<{
			id: string;
			locationId: string;
			altText: string;
			caption: string | null;
			path: string;
			previewPath: string;
			width: number;
			height: number;
			previewWidth: number;
			previewHeight: number;
			sourceHash: string;
			fullHash: string;
			previewHash: string;
			sortOrder: number;
		}>;
	}>,
): ReleaseSnapshot {
	return parseReleaseSnapshot({
		formatVersion: 1,
		locations: locations.map((location) => {
			const orderedScreenshots = [...location.screenshots].sort(
				(left, right) =>
					left.sortOrder - right.sortOrder ||
					compareCodePoints(left.id, right.id),
			);
			const projection = {
				id: location.id,
				name: location.name,
				description: location.description,
				xBasisPoints: location.xBasisPoints,
				yBasisPoints: location.yBasisPoints,
				map: {
					id: location.mapId,
					name: location.mapName,
					image: {
						id: location.mapImageId,
						viewKey: location.mapImageViewKey,
						name: location.mapImageName,
						path: location.mapImagePath,
						altText: location.mapImageAltText,
						width: location.mapImageWidth,
						height: location.mapImageHeight,
						contentHash: location.mapImageContentHash,
					},
				},
				document: {
					id: location.documentId,
					name: location.documentName,
				},
				...(location.requiredKeyIds.length > 0
					? {
							requiredKeyIds: [...location.requiredKeyIds].sort(
								compareCodePoints,
							),
						}
					: {}),
				screenshots: orderedScreenshots.map((screenshot) => ({
					id: screenshot.id,
					sortOrder: screenshot.sortOrder,
					altText: screenshot.altText,
					caption: screenshot.caption,
					sourceHash: screenshot.sourceHash,
					full: {
						path: screenshot.path,
						width: screenshot.width,
						height: screenshot.height,
						hash: screenshot.fullHash,
					},
					preview: {
						path: screenshot.previewPath,
						width: screenshot.previewWidth,
						height: screenshot.previewHeight,
						hash: screenshot.previewHash,
					},
				})),
			};

			return {
				id: location.id,
				name: location.name,
				mapId: location.mapId,
				mapName: location.mapName,
				documentId: location.documentId,
				documentName: location.documentName,
				fingerprint: createHash("sha256")
					.update(JSON.stringify(projection))
					.digest("hex"),
				screenshotIds: orderedScreenshots.map(({ id }) => id),
			};
		}),
	});
}

function compareCodePoints(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
