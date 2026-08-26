import type { LocationContributionBundle } from "./location-contribution";

export type LocationContributionCatalog = {
	documentMaps: Array<{ documentId: string; mapId: string }>;
	documents: Array<{ id: string; name: string }>;
	keyMaps: Array<{ keyId: string; mapId: string }>;
	keys: Array<{ id: string; name: string }>;
	locations?: Array<{
		id: string;
		mapImageId: string;
		name: string;
		xBasisPoints: number;
		yBasisPoints: number;
	}>;
	mapImages: Array<{
		id: string;
		mapId: string;
		name: string;
		sha256: string;
	}>;
	maps: Array<{ id: string; name: string }>;
};

export type LocationContributionCatalogWarning = {
	locationId: string;
	possibleDuplicateIds: string[];
};

export function validateLocationContributionCatalog(
	bundle: LocationContributionBundle,
	catalog: LocationContributionCatalog,
) {
	const mapById = new Map(catalog.maps.map((map) => [map.id, map]));
	const imageById = new Map(
		catalog.mapImages.map((image) => [image.id, image]),
	);
	const documentIds = new Set(catalog.documents.map(({ id }) => id));
	const keyIds = new Set(catalog.keys.map(({ id }) => id));
	const documentAssignments = new Set(
		catalog.documentMaps.map(
			({ documentId, mapId }) => `${mapId}\u0000${documentId}`,
		),
	);
	const keyAssignments = new Set(
		catalog.keyMaps.map(({ keyId, mapId }) => `${mapId}\u0000${keyId}`),
	);
	const warnings: LocationContributionCatalogWarning[] = [];

	for (const location of bundle.locations) {
		const image = imageById.get(location.mapImageId);
		if (!image || !mapById.has(image.mapId)) {
			throw new Error(
				`Location ${location.name} references an unavailable map`,
			);
		}
		if (image.sha256 !== location.mapImageSha256) {
			throw new Error(
				`Location ${location.name} was created against an outdated map image`,
			);
		}
		if (
			!documentIds.has(location.documentId) ||
			!documentAssignments.has(`${image.mapId}\u0000${location.documentId}`)
		) {
			throw new Error(
				`Location ${location.name} references an unavailable document`,
			);
		}
		for (const keyId of location.requiredKeyIds) {
			if (
				!keyIds.has(keyId) ||
				!keyAssignments.has(`${image.mapId}\u0000${keyId}`)
			) {
				throw new Error(
					`Location ${location.name} references an unavailable key`,
				);
			}
		}

		const possibleDuplicateIds = (catalog.locations ?? [])
			.filter(
				(published) =>
					published.mapImageId === location.mapImageId &&
					(normalizeName(published.name) === normalizeName(location.name) ||
						Math.hypot(
							published.xBasisPoints - location.xBasisPoints,
							published.yBasisPoints - location.yBasisPoints,
						) <= 75),
			)
			.map(({ id }) => id);
		if (possibleDuplicateIds.length > 0) {
			warnings.push({ locationId: location.id, possibleDuplicateIds });
		}
	}

	return warnings;
}

function normalizeName(value: string) {
	return value.trim().toLocaleLowerCase("en-US");
}
