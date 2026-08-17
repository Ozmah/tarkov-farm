import { readSelectedDocumentIds } from "./catalog-search";
import { numberMapLocations } from "./map-location-order";
import { SITE_ORIGIN } from "./seo";

type CatalogMap = { id: string; name: string };
type CatalogDocument = {
	id: string;
	name: string;
	description: string | null;
	imagePath: string;
	isFilterable: boolean;
	isWildcard: boolean;
	acquisitionType: "raid" | "store";
	acquisitionSource: string | null;
};

export type MarkdownCatalog = {
	maps: readonly CatalogMap[];
	documents: readonly CatalogDocument[];
	documentMaps: readonly { documentId: string; mapId: string }[];
	documentLocations: readonly {
		id: string;
		documentId: string;
		mapId: string;
		mapImageId: string;
	}[];
};

type MapImage = {
	id: string;
	viewKey: string;
	name: string;
};
type MapLocation = {
	id: string;
	mapImageId: string;
	documentId: string;
	documentName: string;
	name: string;
	description: string | null;
	xBasisPoints: number;
	yBasisPoints: number;
	requiredKeys: readonly {
		id: string;
		name: string;
		wikiUrl: string;
	}[];
};

export type MarkdownMapData = {
	map: CatalogMap & { description: string | null };
	images: readonly MapImage[];
	locations: readonly MapLocation[];
	screenshots: readonly {
		id: string;
		locationId: string;
		path: string;
		altText: string;
		caption: string | null;
		sortOrder: number;
	}[];
};

export function renderHomeMarkdown(catalog: MarkdownCatalog) {
	const totalLocations = catalog.documentLocations.length;
	const mapLines = catalog.maps.map((map) => {
		const count = catalog.documentLocations.filter(
			(location) => location.mapId === map.id,
		).length;
		return `- [${escapeInline(map.name)}](${createMapUrl(map.id)}): ${count} ${pluralize(count, "location")}`;
	});

	return finishMarkdown([
		"# Tarkov Farm",
		"",
		"Why? I just wanted to have everything on the same page, not 10 wiki tabs.",
		"",
		"Tarkov Farm is an interactive guide to Kord Breach document locations in Escape from Tarkov.",
		"",
		`- Maps: ${catalog.maps.length}`,
		`- Published document locations: ${totalLocations}`,
		`- Document types: ${catalog.documents.length}`,
		"",
		"## Maps",
		"",
		...mapLines,
		"",
		"## Get specific information",
		"",
		"- Request a map URL with `Accept: text/markdown` for its document locations.",
		`- Request the [document catalog](${createSiteUrl("/documents")}) with the same header for document descriptions and map assignments.`,
		"- Follow a location link from a map response for directions, required keys and screenshots.",
	]);
}

export function renderDocumentsMarkdown(catalog: MarkdownCatalog) {
	const mapById = new Map(catalog.maps.map((map) => [map.id, map]));
	const sections = catalog.documents.flatMap((document) => {
		const assignedMaps = catalog.documentMaps
			.filter((assignment) => assignment.documentId === document.id)
			.flatMap((assignment) => {
				const map = mapById.get(assignment.mapId);
				return map ? [map] : [];
			});
		const mapLinks = assignedMaps.map(
			(map) =>
				`[${escapeInline(map.name)}](${createMapUrl(map.id, { documents: document.id })})`,
		);
		const details = [
			`## ${escapeInline(document.name)}`,
			"",
			escapeBlock(document.description ?? "No description available."),
			"",
			document.acquisitionType === "store"
				? `- Acquisition: ${escapeInline(document.acquisitionSource ?? "Store")}`
				: `- Maps: ${mapLinks.length > 0 ? mapLinks.join(", ") : "None"}`,
			`- Image: ${createSiteUrl(document.imagePath)}`,
		];

		return ["", ...details];
	});

	return finishMarkdown([
		"# Battle Pass documents",
		"",
		`${catalog.documents.length} document types are currently cataloged.`,
		...sections,
	]);
}

export function renderMapMarkdown(
	catalog: MarkdownCatalog,
	mapData: MarkdownMapData,
	requestUrl: URL,
) {
	const locations = numberLocationsByView(mapData);
	const selectedLocationId = requestUrl.searchParams.get("location");
	const selectedLocation = locations.find(
		(location) => location.id === selectedLocationId,
	);

	if (selectedLocation) {
		return renderLocationMarkdown(catalog, mapData, selectedLocation);
	}

	const requestedDocumentIds = readSelectedDocumentIds(
		requestUrl.searchParams.get("documents"),
	);
	const availableDocumentIds = new Set(
		mapData.locations.map((location) => location.documentId),
	);
	const matchingRequestedIds = requestedDocumentIds.filter((id) =>
		availableDocumentIds.has(id),
	);
	const selectedDocumentIds = new Set(
		matchingRequestedIds.length > 0
			? matchingRequestedIds
			: Array.from(availableDocumentIds),
	);
	const visibleLocations = locations.filter((location) =>
		selectedDocumentIds.has(location.documentId),
	);
	const assignedDocuments = catalog.documents.filter(
		(document) =>
			document.isFilterable &&
			catalog.documentMaps.some(
				(assignment) =>
					assignment.mapId === mapData.map.id &&
					assignment.documentId === document.id,
			),
	);
	const documentSections = assignedDocuments.flatMap((document) => {
		if (
			matchingRequestedIds.length > 0 &&
			!selectedDocumentIds.has(document.id)
		) {
			return [];
		}

		const documentLocations = visibleLocations.filter(
			(location) => location.documentId === document.id,
		);
		const lines = documentLocations.map((location) => {
			const viewSuffix =
				mapData.images.length > 1
					? ` (${escapeInline(location.viewName)} view)`
					: "";
			const description = location.description
				? `: ${escapeInline(location.description)}`
				: "";
			return `- [${location.markerLabel}. ${escapeInline(location.name)}](${createLocationUrl(mapData.map.id, location.id, location.viewKey)})${viewSuffix}${description}`;
		});

		return [
			"",
			`## ${escapeInline(document.name)}`,
			"",
			...(lines.length > 0 ? lines : ["No published locations yet."]),
		];
	});

	return finishMarkdown([
		`# ${escapeInline(mapData.map.name)} document locations`,
		"",
		`${visibleLocations.length} published ${pluralize(visibleLocations.length, "location")}.`,
		...(mapData.map.description
			? ["", escapeBlock(mapData.map.description)]
			: []),
		"",
		`Interactive map: ${createMapUrl(mapData.map.id)}`,
		...documentSections,
		"",
		"Follow a location link for screenshots and required keys.",
	]);
}

type NumberedLocation = MapLocation & {
	markerLabel: string;
	viewKey: string;
	viewName: string;
};

function renderLocationMarkdown(
	catalog: MarkdownCatalog,
	mapData: MarkdownMapData,
	location: NumberedLocation,
) {
	const document = catalog.documents.find(
		(item) => item.id === location.documentId,
	);
	const screenshots = mapData.screenshots.filter(
		(screenshot) => screenshot.locationId === location.id,
	);
	const directUrl = createLocationUrl(
		mapData.map.id,
		location.id,
		location.viewKey,
	);
	const keyLinks = location.requiredKeys.map((key) => {
		const wikiUrl = readExternalHttpUrl(key.wikiUrl);
		return wikiUrl
			? `[${escapeInline(key.name)}](${wikiUrl})`
			: escapeInline(key.name);
	});
	const screenshotLinks = screenshots.map((screenshot, index) => {
		const label =
			screenshot.caption || screenshot.altText || `Screenshot ${index + 1}`;
		return `- [${escapeInline(label)}](${createSiteUrl(screenshot.path)})`;
	});

	return finishMarkdown([
		`# ${escapeInline(location.name)}`,
		"",
		`- Map: [${escapeInline(mapData.map.name)}](${createMapUrl(mapData.map.id)})`,
		`- Document: [${escapeInline(document?.name ?? location.documentName)}](${createSiteUrl(`/documents#${encodeURIComponent(location.documentId)}`)})`,
		`- Map view: ${escapeInline(location.viewName)}`,
		`- Marker: ${location.markerLabel}`,
		`- Required keys: ${keyLinks.length > 0 ? keyLinks.join(", ") : "None"}`,
		"",
		"## Location",
		"",
		escapeBlock(location.description ?? "No directions available."),
		"",
		"## Screenshots",
		"",
		...(screenshotLinks.length > 0
			? screenshotLinks
			: ["No screenshots available."]),
		"",
		`Interactive map: ${directUrl}`,
	]);
}

function numberLocationsByView(mapData: MarkdownMapData) {
	return mapData.images.flatMap((image) =>
		numberMapLocations(
			mapData.locations.filter((location) => location.mapImageId === image.id),
		).map((location) => ({
			...location,
			viewKey: image.viewKey,
			viewName: image.name,
		})),
	);
}

function createMapUrl(
	mapId: string,
	search?: { documents?: string; location?: string; view?: string },
) {
	const url = new URL(`/maps/${encodeURIComponent(mapId)}`, SITE_ORIGIN);
	if (search?.documents) url.searchParams.set("documents", search.documents);
	if (search?.location) url.searchParams.set("location", search.location);
	if (search?.view) url.searchParams.set("view", search.view);
	return url.toString();
}

function createLocationUrl(mapId: string, locationId: string, view: string) {
	return createMapUrl(mapId, { location: locationId, view });
}

function createSiteUrl(pathname: string) {
	const url = new URL(pathname, SITE_ORIGIN);
	return url.origin === SITE_ORIGIN ? url.toString() : SITE_ORIGIN;
}

function readExternalHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

function escapeInline(value: string) {
	return value
		.replaceAll("\\", "\\\\")
		.replace(/([`*_[\]<>])/g, "\\$1")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeBlock(value: string) {
	return value
		.replaceAll("\r\n", "\n")
		.split("\n")
		.map((line) => {
			const escaped = escapeInline(line);
			return /^(?:#{1,6}|[-+*>]|\d+\.)\s/.test(escaped)
				? `\\${escaped}`
				: escaped;
		})
		.join("\n")
		.trim();
}

function pluralize(count: number, singular: string) {
	return count === 1 ? singular : `${singular}s`;
}

function finishMarkdown(lines: readonly string[]) {
	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim()}\n`;
}
