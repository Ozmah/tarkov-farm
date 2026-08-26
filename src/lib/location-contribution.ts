const CATALOG_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UUID_V4_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const LOCATION_CONTRIBUTION_FORMAT_VERSION = 1;
export const MAX_CONTRIBUTION_LOCATIONS = 20;
export const MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION = 10;
export const MAX_CONTRIBUTION_REQUIRED_KEYS_PER_LOCATION = 256;
export const MAX_CONTRIBUTION_SCREENSHOT_BYTES = 20 * 1_048_576;
export const CONTRIBUTION_BUNDLE_WARNING_BYTES = 75 * 1_048_576;
export const MAX_CONTRIBUTION_BUNDLE_BYTES = 100 * 1_048_576;
export const MAX_CONTRIBUTION_MANIFEST_BYTES = 2 * 1_048_576;
export const MAX_CONTRIBUTION_ARCHIVE_METADATA_BYTES = 64 * 1_024;
export const MAX_CONTRIBUTION_ARCHIVE_ENTRIES =
	1 + MAX_CONTRIBUTION_LOCATIONS * MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION;
export const MAX_CONTRIBUTION_ARCHIVE_BYTES =
	MAX_CONTRIBUTION_BUNDLE_BYTES +
	MAX_CONTRIBUTION_MANIFEST_BYTES +
	MAX_CONTRIBUTION_ARCHIVE_METADATA_BYTES;

export type LocationContributionScreenshot = {
	altText: string;
	byteLength: number;
	caption: string | null;
	entry: string;
	id: string;
	mediaType: "image/jpeg" | "image/png" | "image/webp";
	sourceSha256: string;
};

export type LocationContribution = {
	description: string | null;
	documentId: string;
	id: string;
	mapImageId: string;
	mapImageSha256: string;
	name: string;
	requiredKeyIds: string[];
	screenshots: LocationContributionScreenshot[];
	xBasisPoints: number;
	yBasisPoints: number;
};

export type LocationContributionBundle = {
	bundleId: string;
	formatVersion: typeof LOCATION_CONTRIBUTION_FORMAT_VERSION;
	locations: LocationContribution[];
	operation: "add-locations";
};

export function parseLocationContributionBundle(
	input: unknown,
): LocationContributionBundle {
	const value = readObject(input, "Contribution bundle", [
		"bundleId",
		"formatVersion",
		"locations",
		"operation",
	]);

	if (value.formatVersion !== LOCATION_CONTRIBUTION_FORMAT_VERSION) {
		throw new Error("Contribution bundle format version is unsupported");
	}

	if (value.operation !== "add-locations") {
		throw new Error("Contribution bundle operation is unsupported");
	}

	if (
		!Array.isArray(value.locations) ||
		value.locations.length === 0 ||
		value.locations.length > MAX_CONTRIBUTION_LOCATIONS
	) {
		throw new Error(
			`Contribution bundle must contain between 1 and ${MAX_CONTRIBUTION_LOCATIONS} locations`,
		);
	}

	const locations = value.locations.map(parseLocation);
	assertUnique(
		locations.map(({ id }) => id),
		"Contribution location identifiers",
	);
	assertUnique(
		locations.flatMap(({ screenshots }) => screenshots.map(({ id }) => id)),
		"Contribution screenshot identifiers",
	);
	assertUnique(
		locations.flatMap(({ screenshots }) =>
			screenshots.map(({ entry }) => entry),
		),
		"Contribution screenshot entries",
	);

	const bundle = {
		bundleId: readUuid(value.bundleId, "Contribution bundle identifier"),
		formatVersion: LOCATION_CONTRIBUTION_FORMAT_VERSION,
		locations,
		operation: "add-locations",
	} satisfies LocationContributionBundle;

	if (
		getLocationContributionBundleBytes(bundle) > MAX_CONTRIBUTION_BUNDLE_BYTES
	) {
		throw new Error(
			`Contribution bundle screenshots cannot exceed ${MAX_CONTRIBUTION_BUNDLE_BYTES} bytes`,
		);
	}

	return bundle;
}

export function serializeLocationContributionBundle(
	input: LocationContributionBundle,
) {
	return `${JSON.stringify(parseLocationContributionBundle(input), null, "\t")}\n`;
}

export function getLocationContributionBundleBytes(
	bundle: Pick<LocationContributionBundle, "locations">,
) {
	return bundle.locations.reduce(
		(locationTotal, location) =>
			locationTotal +
			location.screenshots.reduce(
				(screenshotTotal, screenshot) =>
					screenshotTotal + screenshot.byteLength,
				0,
			),
		0,
	);
}

export function shouldWarnAboutLocationContributionBundleSize(
	bundle: Pick<LocationContributionBundle, "locations">,
) {
	return (
		getLocationContributionBundleBytes(bundle) >=
		CONTRIBUTION_BUNDLE_WARNING_BYTES
	);
}

function parseLocation(input: unknown): LocationContribution {
	const value = readObject(input, "Contribution location", [
		"description",
		"documentId",
		"id",
		"mapImageId",
		"mapImageSha256",
		"name",
		"requiredKeyIds",
		"screenshots",
		"xBasisPoints",
		"yBasisPoints",
	]);
	const id = readUuid(value.id, "Contribution location identifier");

	if (
		!Array.isArray(value.screenshots) ||
		value.screenshots.length === 0 ||
		value.screenshots.length > MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION
	) {
		throw new Error(
			`Contribution location ${id} must contain between 1 and ${MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION} screenshots`,
		);
	}
	const parsedScreenshots = value.screenshots.map((screenshot) =>
		parseScreenshot(screenshot, id),
	);
	assertUnique(
		parsedScreenshots.map(({ sourceSha256 }) => sourceSha256),
		`Contribution location ${id} screenshot source hashes`,
	);

	return {
		description: readNullableText(
			value.description,
			"Contribution location description",
			2_000,
		),
		documentId: readCatalogId(
			value.documentId,
			"Contribution document identifier",
		),
		id,
		mapImageId: readCatalogId(
			value.mapImageId,
			"Contribution map image identifier",
		),
		mapImageSha256: readSha256(
			value.mapImageSha256,
			"Contribution map image hash",
		),
		name: readText(value.name, "Contribution location name", 120, false),
		requiredKeyIds: readCatalogIdArray(
			value.requiredKeyIds,
			"Contribution required key identifiers",
		),
		screenshots: parsedScreenshots,
		xBasisPoints: readInteger(
			value.xBasisPoints,
			"Contribution X coordinate",
			0,
			10_000,
		),
		yBasisPoints: readInteger(
			value.yBasisPoints,
			"Contribution Y coordinate",
			0,
			10_000,
		),
	};
}

function parseScreenshot(
	input: unknown,
	locationId: string,
): LocationContributionScreenshot {
	const value = readObject(input, "Contribution screenshot", [
		"altText",
		"byteLength",
		"caption",
		"entry",
		"id",
		"mediaType",
		"sourceSha256",
	]);
	const id = readUuid(value.id, "Contribution screenshot identifier");
	const mediaType = readScreenshotMediaType(value.mediaType);
	const expectedEntry = `locations/${locationId}/screenshots/${id}.${extensionForMediaType(mediaType)}`;

	if (value.entry !== expectedEntry) {
		throw new Error(`Contribution screenshot entry must be ${expectedEntry}`);
	}

	return {
		altText: readText(
			value.altText,
			"Contribution screenshot alt text",
			240,
			true,
		),
		byteLength: readInteger(
			value.byteLength,
			"Contribution screenshot byte length",
			1,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
		),
		caption: readNullableText(
			value.caption,
			"Contribution screenshot caption",
			500,
		),
		entry: expectedEntry,
		id,
		mediaType,
		sourceSha256: readSha256(
			value.sourceSha256,
			"Contribution screenshot source hash",
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

function readUuid(value: unknown, label: string) {
	if (typeof value !== "string" || !UUID_V4_PATTERN.test(value)) {
		throw new Error(`${label} must be a lowercase UUID v4`);
	}

	return value;
}

function readCatalogId(value: unknown, label: string) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 100 ||
		!CATALOG_ID_PATTERN.test(value)
	) {
		throw new Error(`${label} is invalid`);
	}

	return value;
}

function readCatalogIdArray(value: unknown, label: string) {
	if (
		!Array.isArray(value) ||
		value.length > MAX_CONTRIBUTION_REQUIRED_KEYS_PER_LOCATION
	) {
		throw new Error(`${label} must be an array`);
	}

	const identifiers = value.map((identifier) =>
		readCatalogId(identifier, label),
	);
	assertUnique(identifiers, label);
	return identifiers.sort(compareCodePoints);
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
	if (
		typeof value !== "string" ||
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

function readInteger(
	value: unknown,
	label: string,
	minimum: number,
	maximum: number,
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

function readScreenshotMediaType(value: unknown) {
	if (
		value !== "image/jpeg" &&
		value !== "image/png" &&
		value !== "image/webp"
	) {
		throw new Error("Contribution screenshot media type is unsupported");
	}

	return value;
}

function extensionForMediaType(
	mediaType: LocationContributionScreenshot["mediaType"],
) {
	if (mediaType === "image/jpeg") return "jpg";
	if (mediaType === "image/png") return "png";
	return "webp";
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
