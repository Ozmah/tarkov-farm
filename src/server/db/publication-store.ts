import type { Database } from "@tursodatabase/database";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";

import {
	type PublicationData,
	parsePublicationData,
} from "../../lib/publication-data";
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
} from "./schema";

const DYNAMIC_TABLES = [
	locations,
	locationDocuments,
	locationRequiredKeys,
	screenshots,
] as const;

export async function importPublicationData(
	client: Database,
	input: PublicationData,
) {
	const data = parsePublicationData(input);
	await assertPublicationReferences(client, data);
	const db = drizzle({ client });
	const screenshotCount = data.locations.reduce(
		(total, location) => total + location.screenshots.length,
		0,
	);
	const requiredKeyCount = data.locations.reduce(
		(total, location) => total + location.requiredKeyIds.length,
		0,
	);

	await db.transaction(async (transaction) => {
		for (const table of DYNAMIC_TABLES) {
			const row = await transaction
				.select({ count: count() })
				.from(table)
				.get();

			if (row?.count !== 0) {
				throw new Error(
					"Publication data can only be imported into empty dynamic tables",
				);
			}
		}

		if (data.locations.length === 0) return;

		await transaction
			.insert(locations)
			.values(
				data.locations.map((location) => ({
					description: location.description,
					id: location.id,
					isActive: location.isActive,
					mapImageId: location.mapImageId,
					name: location.name,
					xBasisPoints: location.xBasisPoints,
					yBasisPoints: location.yBasisPoints,
				})),
			)
			.run();
		await transaction
			.insert(locationDocuments)
			.values(
				data.locations.map((location) => ({
					documentId: location.documentId,
					locationId: location.id,
				})),
			)
			.run();
		await transaction
			.insert(screenshots)
			.values(
				data.locations.flatMap((location) =>
					location.screenshots.map((screenshot) => ({
						altText: screenshot.altText,
						caption: screenshot.caption,
						fullHash: screenshot.full.sha256,
						height: screenshot.full.height,
						id: screenshot.id,
						isActive: screenshot.isActive,
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
				),
			)
			.run();
		const requiredKeyValues = data.locations.flatMap((location) =>
			location.requiredKeyIds.map((keyId) => ({
				keyId,
				locationId: location.id,
			})),
		);
		if (requiredKeyValues.length > 0) {
			await transaction
				.insert(locationRequiredKeys)
				.values(requiredKeyValues)
				.run();
		}
	});

	return {
		locations: data.locations.length,
		locationDocuments: data.locations.length,
		locationRequiredKeys: requiredKeyCount,
		screenshots: screenshotCount,
	};
}

export async function assertPublicationReferences(
	client: Database,
	input: PublicationData,
) {
	const data = parsePublicationData(input);
	const db = drizzle({ client });
	const imageRows = await db
		.select({
			id: mapImages.id,
			isCurrent: mapImages.isCurrent,
			mapId: mapImages.mapId,
		})
		.from(mapImages)
		.all();
	const mapRows = await db
		.select({ id: maps.id, isActive: maps.isActive })
		.from(maps)
		.all();
	const documentRows = await db
		.select({
			id: documents.id,
			isActive: documents.isActive,
			isFilterable: documents.isFilterable,
		})
		.from(documents)
		.all();
	const documentMapRows = await db
		.select({ documentId: documentMaps.documentId, mapId: documentMaps.mapId })
		.from(documentMaps)
		.all();
	const keyRows = await db
		.select({ id: keys.id, mapId: keyMaps.mapId })
		.from(keys)
		.leftJoin(keyMaps, eq(keyMaps.keyId, keys.id))
		.all();
	const imageById = new Map(imageRows.map((image) => [image.id, image]));
	const activeMapIds = new Set(
		mapRows.filter(({ isActive }) => isActive).map(({ id }) => id),
	);
	const documentById = new Map(
		documentRows.map((document) => [document.id, document]),
	);
	const allowedDocumentMaps = new Set(
		documentMapRows.map(({ documentId, mapId }) =>
			relationKey(documentId, mapId),
		),
	);
	const keyMapIdsById = new Map<string, Set<string>>();
	for (const key of keyRows) {
		const mapIds = keyMapIdsById.get(key.id) ?? new Set<string>();
		if (key.mapId) mapIds.add(key.mapId);
		keyMapIdsById.set(key.id, mapIds);
	}

	for (const location of data.locations) {
		const image = imageById.get(location.mapImageId);

		if (!image?.isCurrent || !activeMapIds.has(image.mapId)) {
			throw new Error(
				`Location ${location.id} references an unpublished map image`,
			);
		}

		const document = documentById.get(location.documentId);

		if (!document?.isActive || !document.isFilterable) {
			throw new Error(
				`Location ${location.id} references an unpublished document`,
			);
		}

		if (
			!allowedDocumentMaps.has(relationKey(location.documentId, image.mapId))
		) {
			throw new Error(
				`Location ${location.id} document is not available on map ${image.mapId}`,
			);
		}

		for (const keyId of location.requiredKeyIds) {
			const keyMapIds = keyMapIdsById.get(keyId);
			if (!keyMapIds?.has(image.mapId)) {
				throw new Error(
					`Location ${location.id} references a key unavailable on map ${image.mapId}`,
				);
			}
		}
	}
}

export async function assertPublicationImportCounts(
	client: Database,
	expected: {
		locations: number;
		locationDocuments: number;
		locationRequiredKeys: number;
		screenshots: number;
	},
) {
	const db = drizzle({ client });
	const [locationCount, relationCount, requiredKeyCount, screenshotCount] =
		await Promise.all([
			db.select({ count: count() }).from(locations).get(),
			db.select({ count: count() }).from(locationDocuments).get(),
			db.select({ count: count() }).from(locationRequiredKeys).get(),
			db.select({ count: count() }).from(screenshots).get(),
		]);

	if (
		!locationCount ||
		!relationCount ||
		!requiredKeyCount ||
		!screenshotCount ||
		locationCount.count !== expected.locations ||
		relationCount.count !== expected.locationDocuments ||
		requiredKeyCount.count !== expected.locationRequiredKeys ||
		screenshotCount.count !== expected.screenshots
	) {
		throw new Error(
			"Imported publication row counts do not match the canonical data",
		);
	}
}

export async function readPublicationDataFromDatabase(
	client: Database,
): Promise<PublicationData> {
	const db = drizzle({ client });
	const locationRows = await db.select().from(locations).all();
	const relationRows = await db.select().from(locationDocuments).all();
	const screenshotRows = await db.select().from(screenshots).all();
	const requiredKeyRows = await db.select().from(locationRequiredKeys).all();
	const locationIds = new Set(locationRows.map(({ id }) => id));
	const documentByLocation = new Map<string, string>();
	const screenshotsByLocation = new Map<string, typeof screenshotRows>();
	const requiredKeyIdsByLocation = new Map<string, string[]>();

	for (const relation of relationRows) {
		if (!locationIds.has(relation.locationId)) {
			throw new Error(
				`Document relation references missing location ${relation.locationId}`,
			);
		}

		if (documentByLocation.has(relation.locationId)) {
			throw new Error(
				`Location ${relation.locationId} has more than one document`,
			);
		}

		documentByLocation.set(relation.locationId, relation.documentId);
	}

	for (const screenshot of screenshotRows) {
		if (!locationIds.has(screenshot.locationId)) {
			throw new Error(
				`Screenshot ${screenshot.id} references a missing location`,
			);
		}

		const rows = screenshotsByLocation.get(screenshot.locationId) ?? [];
		rows.push(screenshot);
		screenshotsByLocation.set(screenshot.locationId, rows);
	}

	for (const relation of requiredKeyRows) {
		if (!locationIds.has(relation.locationId)) {
			throw new Error(
				`Required key relation references missing location ${relation.locationId}`,
			);
		}
		const identifiers = requiredKeyIdsByLocation.get(relation.locationId) ?? [];
		identifiers.push(relation.keyId);
		requiredKeyIdsByLocation.set(relation.locationId, identifiers);
	}

	return parsePublicationData({
		formatVersion: 2,
		locations: locationRows.map((location) => {
			const documentId = documentByLocation.get(location.id);

			if (!documentId) {
				throw new Error(`Location ${location.id} has no document relation`);
			}

			return {
				description: location.description,
				documentId,
				id: location.id,
				isActive: location.isActive,
				mapImageId: location.mapImageId,
				name: location.name,
				requiredKeyIds: requiredKeyIdsByLocation.get(location.id) ?? [],
				screenshots: (screenshotsByLocation.get(location.id) ?? []).map(
					(screenshot) => ({
						altText: screenshot.altText,
						caption: screenshot.caption,
						full: {
							height: screenshot.height,
							path: screenshot.path,
							sha256: screenshot.fullHash,
							width: screenshot.width,
						},
						id: screenshot.id,
						isActive: screenshot.isActive,
						preview: {
							height: screenshot.previewHeight,
							path: screenshot.previewPath,
							sha256: screenshot.previewHash,
							width: screenshot.previewWidth,
						},
						sortOrder: screenshot.sortOrder,
						sourceSha256: screenshot.sourceHash,
					}),
				),
				xBasisPoints: location.xBasisPoints,
				yBasisPoints: location.yBasisPoints,
			};
		}),
	});
}

function relationKey(left: string, right: string) {
	return `${left}\u0000${right}`;
}
