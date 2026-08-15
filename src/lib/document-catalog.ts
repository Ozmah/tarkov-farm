const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_DOCUMENTS = 20;
const MAX_MAPS_PER_DOCUMENT = 20;
const MAX_IMAGE_DIMENSION = 768;

export type CatalogDocumentImage = {
	height: number;
	path: string;
	sha256: string;
	sourceSha256: string;
	width: number;
};

export type CatalogDocument = {
	acquisitionSource: string | null;
	acquisitionType: "raid" | "store";
	description: string;
	id: string;
	image: CatalogDocumentImage;
	isActive: boolean;
	isFilterable: boolean;
	isWildcard: boolean;
	mapIds: string[];
	name: string;
};

export type DocumentCatalog = {
	documents: CatalogDocument[];
	formatVersion: 1;
};

export function parseDocumentCatalog(input: unknown): DocumentCatalog {
	const value = readObject(input, "Document catalog", [
		"documents",
		"formatVersion",
	]);

	if (value.formatVersion !== 1) {
		throw new Error("Document catalog format is unsupported");
	}

	if (
		!Array.isArray(value.documents) ||
		value.documents.length === 0 ||
		value.documents.length > MAX_DOCUMENTS
	) {
		throw new Error(
			`Document catalog must contain between 1 and ${MAX_DOCUMENTS} documents`,
		);
	}

	const documents = value.documents.map(parseDocument);
	assertUnique(
		documents.map(({ id }) => id),
		"Document identifiers",
	);
	assertUnique(
		documents.map(({ name }) => name),
		"Document names",
	);
	assertUnique(
		documents.map(({ image }) => image.path),
		"Document image paths",
	);

	return {
		formatVersion: 1,
		documents: [...documents].sort((left, right) =>
			compareCodePoints(left.name, right.name),
		),
	};
}

function parseDocument(input: unknown): CatalogDocument {
	const value = readObject(input, "Document", [
		"acquisitionSource",
		"acquisitionType",
		"description",
		"id",
		"image",
		"isActive",
		"isFilterable",
		"isWildcard",
		"mapIds",
		"name",
	]);
	const id = readId(value.id, "Document identifier");
	const image = parseImage(value.image, id);
	const acquisitionType = readAcquisitionType(value.acquisitionType, id);
	const acquisitionSource = readNullableText(
		value.acquisitionSource,
		`Document ${id} acquisition source`,
		120,
	);
	const isActive = readBoolean(value.isActive, `Document ${id} active state`);
	const isFilterable = readBoolean(
		value.isFilterable,
		`Document ${id} filterable state`,
	);
	const isWildcard = readBoolean(
		value.isWildcard,
		`Document ${id} wildcard state`,
	);
	const mapIds = readMapIds(value.mapIds, id);

	if (acquisitionType === "store" && !acquisitionSource) {
		throw new Error(`Store document ${id} requires an acquisition source`);
	}
	if (acquisitionType === "raid" && acquisitionSource) {
		throw new Error(`Raid document ${id} cannot have an acquisition source`);
	}
	if (isWildcard && (acquisitionType !== "store" || isFilterable)) {
		throw new Error(
			`Wildcard document ${id} must be a non-filterable store item`,
		);
	}
	if (isWildcard && mapIds.length > 0) {
		throw new Error(`Wildcard document ${id} cannot have map assignments`);
	}
	if (isActive && isFilterable && mapIds.length === 0) {
		throw new Error(`Filterable document ${id} requires map assignments`);
	}
	if (isFilterable && acquisitionType !== "raid") {
		throw new Error(`Filterable document ${id} must be acquired in raid`);
	}

	return {
		id,
		name: readText(value.name, `Document ${id} name`, 120),
		description: readText(
			value.description,
			`Document ${id} description`,
			1_000,
		),
		image,
		acquisitionType,
		acquisitionSource,
		isFilterable,
		isWildcard,
		isActive,
		mapIds: [...mapIds].sort(compareCodePoints),
	};
}

function parseImage(input: unknown, documentId: string): CatalogDocumentImage {
	const value = readObject(input, `Document ${documentId} image`, [
		"height",
		"path",
		"sha256",
		"sourceSha256",
		"width",
	]);
	const sha256 = readHash(value.sha256, `Document ${documentId} image hash`);
	const path = readText(value.path, `Document ${documentId} image path`, 240);

	if (path !== `/documents/${documentId}-${sha256.slice(0, 12)}.webp`) {
		throw new Error(`Document ${documentId} image path is invalid`);
	}

	return {
		height: readInteger(
			value.height,
			`Document ${documentId} image height`,
			1,
			MAX_IMAGE_DIMENSION,
		),
		path,
		sha256,
		sourceSha256: readHash(
			value.sourceSha256,
			`Document ${documentId} source image hash`,
		),
		width: readInteger(
			value.width,
			`Document ${documentId} image width`,
			1,
			MAX_IMAGE_DIMENSION,
		),
	};
}

function readObject(
	value: unknown,
	label: string,
	allowedKeys: readonly string[],
) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}

	const record = value as Record<string, unknown>;
	const unexpectedKey = Object.keys(record).find(
		(key) => !allowedKeys.includes(key),
	);

	if (unexpectedKey) {
		throw new Error(`${label} contains unexpected field ${unexpectedKey}`);
	}

	return record;
}

function readId(value: unknown, label: string) {
	if (
		typeof value !== "string" ||
		value.length > 100 ||
		!ID_PATTERN.test(value)
	) {
		throw new Error(`${label} is invalid`);
	}
	return value;
}

function readText(value: unknown, label: string, maximum: number) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > maximum ||
		value !== value.trim() ||
		value.includes("\r")
	) {
		throw new Error(`${label} is invalid`);
	}
	return value;
}

function readNullableText(value: unknown, label: string, maximum: number) {
	if (value === null) return null;
	return readText(value, label, maximum);
}

function readBoolean(value: unknown, label: string) {
	if (typeof value !== "boolean") throw new Error(`${label} is invalid`);
	return value;
}

function readInteger(
	value: unknown,
	label: string,
	minimum: number,
	maximum: number,
) {
	if (
		!Number.isSafeInteger(value) ||
		(value as number) < minimum ||
		(value as number) > maximum
	) {
		throw new Error(`${label} is invalid`);
	}
	return value as number;
}

function readHash(value: unknown, label: string) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		throw new Error(`${label} is invalid`);
	}
	return value;
}

function readAcquisitionType(
	value: unknown,
	documentId: string,
): CatalogDocument["acquisitionType"] {
	if (value !== "raid" && value !== "store") {
		throw new Error(`Document ${documentId} acquisition type is invalid`);
	}
	return value;
}

function readMapIds(value: unknown, documentId: string) {
	if (!Array.isArray(value) || value.length > MAX_MAPS_PER_DOCUMENT) {
		throw new Error(`Document ${documentId} map identifiers must be an array`);
	}

	const mapIds = value.map((mapId) =>
		readId(mapId, `Document ${documentId} map identifier`),
	);
	assertUnique(mapIds, `Document ${documentId} map identifiers`);
	return mapIds;
}

function assertUnique(values: string[], label: string) {
	if (new Set(values).size !== values.length) {
		throw new Error(`${label} contain duplicates`);
	}
}

function compareCodePoints(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
