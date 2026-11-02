import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseDocumentCatalog } from "@/lib/document-catalog";
import type { IntakeDraftValues } from "@/lib/intake-draft";
import { parseKeyCatalog } from "@/lib/key-catalog";
import { mapImageDefinitions, mapSeed } from "@/lib/map-catalog-seed";
import { parsePublicationData } from "@/lib/publication-data";

export type IntakeCatalog = Awaited<ReturnType<typeof readIntakeCatalog>>;

/** Reads the versioned catalog files only: no database, no .env, no dev server. */
export async function readIntakeCatalog(projectRoot: string) {
	const readJson = async (path: string): Promise<unknown> =>
		JSON.parse(await readFile(join(projectRoot, path), "utf8"));
	const [documents, keys, publication] = await Promise.all([
		readJson("data/catalog/documents.json").then(parseDocumentCatalog),
		readJson("data/catalog/keys.json").then(parseKeyCatalog),
		readJson("data/publication/locations.json").then(parsePublicationData),
	]);
	const activeDocuments = documents.documents.filter(
		({ isActive, isFilterable }) => isActive && isFilterable,
	);

	return {
		maps: mapSeed.map(({ id, name }) => ({
			id,
			name,
			images: mapImageDefinitions
				.filter(({ mapId }) => mapId === id)
				.map(({ id: imageId, name: imageName }) => ({
					id: imageId,
					name: imageName,
				})),
		})),
		documents: activeDocuments.map(({ id, name, mapIds }) => ({
			id,
			name,
			mapIds,
		})),
		keys: keys.keys.map(({ id, name, mapIds }) => ({ id, name, mapIds })),
		locations: publication.locations
			.filter(({ isActive }) => isActive)
			.map(({ id, name, mapImageId, documentId, screenshots }) => ({
				id,
				name,
				mapImageId,
				documentId,
				screenshotSha256s: screenshots.map(({ sourceSha256 }) => sourceSha256),
			})),
	};
}

/** Rejects IDs that do not exist or do not belong to the selected map. */
export function validateIntakeValues(
	values: IntakeDraftValues,
	catalog: IntakeCatalog,
) {
	const mapId = values.mapImageId
		? catalog.maps.find(({ images }) =>
				images.some(({ id }) => id === values.mapImageId),
			)?.id
		: undefined;
	if (values.mapImageId && !mapId)
		throw new Error(`Unknown map image "${values.mapImageId}"`);

	if (values.documentId) {
		const document = catalog.documents.find(
			({ id }) => id === values.documentId,
		);
		if (!document) throw new Error(`Unknown document "${values.documentId}"`);
		if (mapId && !document.mapIds.includes(mapId))
			throw new Error(
				`Document "${values.documentId}" is not assigned to map "${mapId}"`,
			);
	}

	for (const keyId of values.requiredKeyIds) {
		const key = catalog.keys.find(({ id }) => id === keyId);
		if (!key) throw new Error(`Unknown key "${keyId}"`);
		if (mapId && !key.mapIds.includes(mapId))
			throw new Error(`Key "${keyId}" is not assigned to map "${mapId}"`);
	}
}
