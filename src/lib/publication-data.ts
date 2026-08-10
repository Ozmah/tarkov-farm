const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_SCREENSHOTS_PER_LOCATION = 10;

export type PublicationAsset = {
	height: number;
	path: string;
	sha256: string;
	width: number;
};

export type PublicationScreenshot = {
	altText: string;
	caption: string | null;
	full: PublicationAsset;
	id: string;
	isActive: boolean;
	preview: PublicationAsset;
	sortOrder: number;
	sourceSha256: string;
};

export type PublicationLocation = {
	description: string | null;
	documentId: string;
	id: string;
	isActive: boolean;
	mapImageId: string;
	name: string;
	screenshots: PublicationScreenshot[];
	xBasisPoints: number;
	yBasisPoints: number;
};

export type PublicationData = {
	formatVersion: 1;
	locations: PublicationLocation[];
};

export function parsePublicationData(input: unknown): PublicationData {
	const value = readObject(input, "Publication data", [
		"formatVersion",
		"locations",
	]);

	if (value.formatVersion !== 1) {
		throw new Error("Publication format version is unsupported");
	}

	if (!Array.isArray(value.locations)) {
		throw new Error("Publication locations must be an array");
	}

	const locations = value.locations.map(parseLocation);
	assertUnique(
		locations.map(({ id }) => id),
		"Location identifiers",
	);
	assertUnique(
		locations.flatMap(({ screenshots }) => screenshots.map(({ id }) => id)),
		"Screenshot identifiers",
	);
	assertUnique(
		locations.flatMap(({ screenshots }) =>
			screenshots.flatMap(({ full, preview }) => [full.path, preview.path]),
		),
		"Screenshot asset paths",
	);

	return canonicalizePublicationData({ formatVersion: 1, locations });
}

export function serializePublicationData(input: PublicationData) {
	return `${JSON.stringify(parsePublicationData(input), null, "\t")}\n`;
}

function parseLocation(input: unknown): PublicationLocation {
	const value = readObject(input, "Location", [
		"description",
		"documentId",
		"id",
		"isActive",
		"mapImageId",
		"name",
		"screenshots",
		"xBasisPoints",
		"yBasisPoints",
	]);
	const id = readId(value.id, "Location identifier");

	if (
		!Array.isArray(value.screenshots) ||
		value.screenshots.length === 0 ||
		value.screenshots.length > MAX_SCREENSHOTS_PER_LOCATION
	) {
		throw new Error(
			`Location ${id} must contain between 1 and ${MAX_SCREENSHOTS_PER_LOCATION} screenshots`,
		);
	}

	const screenshots = value.screenshots.map((screenshot) =>
		parseScreenshot(screenshot, id),
	);
	assertUnique(
		screenshots.map(({ sourceSha256 }) => sourceSha256),
		`Screenshot source hashes for location ${id}`,
	);

	const sortedScreenshots = [...screenshots].sort(
		(left, right) =>
			left.sortOrder - right.sortOrder || compareCodePoints(left.id, right.id),
	);

	if (sortedScreenshots.some(({ sortOrder }, index) => sortOrder !== index)) {
		throw new Error(
			`Location ${id} screenshot order must be contiguous from zero`,
		);
	}

	if (!sortedScreenshots.some(({ isActive }) => isActive)) {
		throw new Error(`Location ${id} requires at least one active screenshot`);
	}

	return {
		description: readNullableText(
			value.description,
			"Location description",
			2_000,
		),
		documentId: readId(value.documentId, "Document identifier"),
		id,
		isActive: readBoolean(value.isActive, "Location active state"),
		mapImageId: readId(value.mapImageId, "Map image identifier"),
		name: readText(value.name, "Location name", 120, false),
		screenshots: sortedScreenshots,
		xBasisPoints: readInteger(value.xBasisPoints, "X coordinate", 0, 10_000),
		yBasisPoints: readInteger(value.yBasisPoints, "Y coordinate", 0, 10_000),
	};
}

function parseScreenshot(
	input: unknown,
	locationId: string,
): PublicationScreenshot {
	const value = readObject(input, "Screenshot", [
		"altText",
		"caption",
		"full",
		"id",
		"isActive",
		"preview",
		"sortOrder",
		"sourceSha256",
	]);
	const id = readId(value.id, "Screenshot identifier");
	const sourceSha256 = readSha256(value.sourceSha256, "Screenshot source hash");

	return {
		altText: readText(value.altText, "Screenshot alt text", 240, true),
		caption: readNullableText(value.caption, "Screenshot caption", 500),
		full: parseAsset(
			value.full,
			`/screenshots/${locationId}/${sourceSha256}-1920.webp`,
			"Full screenshot",
		),
		id,
		isActive: readBoolean(value.isActive, "Screenshot active state"),
		preview: parseAsset(
			value.preview,
			`/screenshots/${locationId}/${sourceSha256}-1000.webp`,
			"Screenshot preview",
		),
		sortOrder: readInteger(value.sortOrder, "Screenshot order", 0),
		sourceSha256,
	};
}

function parseAsset(
	input: unknown,
	expectedPath: string,
	label: string,
): PublicationAsset {
	const value = readObject(input, label, ["height", "path", "sha256", "width"]);
	const path = readText(value.path, `${label} path`, 500, false);

	if (path !== expectedPath) {
		throw new Error(`${label} path must be ${expectedPath}`);
	}

	return {
		height: readInteger(value.height, `${label} height`, 1),
		path,
		sha256: readSha256(value.sha256, `${label} hash`),
		width: readInteger(value.width, `${label} width`, 1),
	};
}

function canonicalizePublicationData(data: PublicationData): PublicationData {
	return {
		formatVersion: 1,
		locations: [...data.locations].sort((left, right) =>
			compareCodePoints(left.id, right.id),
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
	const unexpectedKeys = Object.keys(record).filter(
		(key) => !allowedKeys.includes(key),
	);

	if (unexpectedKeys.length > 0) {
		throw new Error(`${label} contains unexpected field ${unexpectedKeys[0]}`);
	}

	return record;
}

function readId(value: unknown, label: string) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 100 ||
		!ID_PATTERN.test(value)
	) {
		throw new Error(`${label} is invalid`);
	}

	return value;
}

function readSha256(value: unknown, label: string) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		throw new Error(`${label} must be a lowercase SHA-256 hash`);
	}

	return value;
}

function readText(
	value: unknown,
	label: string,
	maxLength: number,
	allowEmpty: boolean,
) {
	if (typeof value !== "string") {
		throw new Error(`${label} must be a string`);
	}

	if (
		value !== value.trim() ||
		value.length > maxLength ||
		(!allowEmpty && value.length === 0)
	) {
		throw new Error(`${label} is not canonical`);
	}

	return value;
}

function readNullableText(value: unknown, label: string, maxLength: number) {
	if (value === null) return null;
	return readText(value, label, maxLength, false);
}

function readBoolean(value: unknown, label: string) {
	if (typeof value !== "boolean") {
		throw new Error(`${label} must be a boolean`);
	}

	return value;
}

function readInteger(
	value: unknown,
	label: string,
	minimum: number,
	maximum = Number.MAX_SAFE_INTEGER,
) {
	if (
		typeof value !== "number" ||
		!Number.isSafeInteger(value) ||
		value < minimum ||
		value > maximum
	) {
		throw new Error(`${label} is outside its allowed range`);
	}

	return value;
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
