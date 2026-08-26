const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SCREENSHOT_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export const MAX_SCREENSHOT_BYTES = 20 * 1_048_576;
export const MAX_SCREENSHOTS_PER_LOCATION = 10;

export type SaveLocationInput = {
	id?: string;
	mapImageId: string;
	name: string;
	description: string | null;
	xBasisPoints: number;
	yBasisPoints: number;
	isActive: boolean;
	documentId: string;
	requiredKeyIds: string[];
};

export type DeleteLocationInput = {
	id: string;
};

export type SaveScreenshotInput = {
	id?: string;
	uploadIndex?: number;
	altText: string;
	caption: string | null;
};

export type SaveLocationFormInput = {
	location: SaveLocationInput;
	screenshots: SaveScreenshotInput[];
	files: File[];
};

export type ImportContributionLocationFormInput = {
	expectedMapImageSha256: string;
	input: SaveLocationFormInput;
};

export function parseImportContributionLocationFormData(
	formData: unknown,
): ImportContributionLocationFormInput {
	if (!(formData instanceof FormData)) {
		throw new Error("Invalid contribution import request");
	}
	const hashValues = formData.getAll("mapImageSha256");
	const expectedMapImageSha256 = hashValues[0];
	if (
		hashValues.length !== 1 ||
		typeof expectedMapImageSha256 !== "string" ||
		!SHA256_PATTERN.test(expectedMapImageSha256)
	) {
		throw new Error("Contribution map image hash is invalid");
	}
	const input = parseSaveLocationFormData(formData);
	if (
		input.location.id !== undefined ||
		input.location.isActive !== true ||
		input.screenshots.some(({ id }) => id !== undefined)
	) {
		throw new Error(
			"Contribution imports must contain only new active locations and screenshots",
		);
	}

	return { expectedMapImageSha256, input };
}

export function parseSaveLocationInput(input: unknown): SaveLocationInput {
	const value = readObject(input);

	return {
		id:
			value.id === undefined
				? undefined
				: readId(value.id, "Location identifier"),
		mapImageId: readId(value.mapImageId, "Map image"),
		name: readText(value.name, "Location name", 120),
		description: readOptionalText(value.description, "Description", 2_000),
		xBasisPoints: readCoordinate(value.xBasisPoints, "X coordinate"),
		yBasisPoints: readCoordinate(value.yBasisPoints, "Y coordinate"),
		isActive: readBoolean(value.isActive, "Active state"),
		documentId: readId(value.documentId, "Document identifier"),
		requiredKeyIds: readIdArray(
			value.requiredKeyIds,
			"Required key identifiers",
		),
	};
}

export function parseDeleteLocationInput(input: unknown): DeleteLocationInput {
	const value = readObject(input);

	return {
		id: readId(value.id, "Location identifier"),
	};
}

export function parseSaveLocationFormData(
	input: unknown,
): SaveLocationFormInput {
	if (!(input instanceof FormData)) {
		throw new Error("Expected location form data");
	}

	const payload = parseJsonObject(input.get("payload"));
	const screenshots = readScreenshots(payload.screenshots);
	const files = input.getAll("screenshots");

	if (
		files.some(
			(file) =>
				!(file instanceof File) ||
				file.size === 0 ||
				file.size > MAX_SCREENSHOT_BYTES ||
				!SCREENSHOT_MIME_TYPES.has(file.type),
		)
	) {
		throw new Error("Screenshot files must be JPEG, PNG, or WebP under 20 MiB");
	}

	const uploadIndexes = screenshots
		.filter((screenshot) => screenshot.uploadIndex !== undefined)
		.map((screenshot) => screenshot.uploadIndex as number)
		.sort((left, right) => left - right);

	if (
		uploadIndexes.length !== files.length ||
		uploadIndexes.some((index, position) => index !== position)
	) {
		throw new Error("Screenshot uploads do not match their metadata");
	}

	return {
		location: parseSaveLocationInput(payload.location),
		screenshots,
		files: files as File[],
	};
}

function readObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Invalid editor request");
	}

	return value as Record<string, unknown>;
}

function parseJsonObject(value: FormDataEntryValue | null) {
	if (typeof value !== "string" || value.length > 100_000) {
		throw new Error("Location payload is invalid");
	}

	try {
		return readObject(JSON.parse(value));
	} catch {
		throw new Error("Location payload is invalid");
	}
}

function readScreenshots(value: unknown): SaveScreenshotInput[] {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.length > MAX_SCREENSHOTS_PER_LOCATION
	) {
		throw new Error(
			`A location requires between 1 and ${MAX_SCREENSHOTS_PER_LOCATION} screenshots`,
		);
	}

	const screenshots = value.map((item, index) => {
		const screenshot = readObject(item);
		const id =
			screenshot.id === undefined
				? undefined
				: readId(screenshot.id, "Screenshot identifier");
		const uploadIndex =
			screenshot.uploadIndex === undefined
				? undefined
				: readNonNegativeInteger(screenshot.uploadIndex, "Screenshot upload");

		if ((id === undefined) === (uploadIndex === undefined)) {
			throw new Error(
				`Screenshot ${index + 1} must reference an existing image or one upload`,
			);
		}

		return {
			id,
			uploadIndex,
			altText:
				readOptionalText(screenshot.altText, "Screenshot alt text", 240) ?? "",
			caption: readOptionalText(screenshot.caption, "Screenshot caption", 500),
		};
	});

	const existingIds = screenshots.flatMap(({ id }) => (id ? [id] : []));

	if (new Set(existingIds).size !== existingIds.length) {
		throw new Error("Screenshot selection contains duplicates");
	}

	return screenshots;
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

function readIdArray(value: unknown, label: string) {
	if (!Array.isArray(value)) {
		throw new Error(`${label} must be an array`);
	}

	const identifiers = value.map((identifier) => readId(identifier, label));
	if (new Set(identifiers).size !== identifiers.length) {
		throw new Error(`${label} contain duplicates`);
	}
	return identifiers.sort(compareCodePoints);
}

function compareCodePoints(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function readText(value: unknown, label: string, maxLength: number) {
	if (typeof value !== "string") {
		throw new Error(`${label} is required`);
	}

	const normalized = value.trim();

	if (normalized.length === 0 || normalized.length > maxLength) {
		throw new Error(
			`${label} must contain between 1 and ${maxLength} characters`,
		);
	}

	return normalized;
}

function readOptionalText(value: unknown, label: string, maxLength: number) {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	if (typeof value !== "string") {
		throw new Error(`${label} is invalid`);
	}

	const normalized = value.trim();

	if (normalized.length > maxLength) {
		throw new Error(`${label} cannot exceed ${maxLength} characters`);
	}

	return normalized || null;
}

function readCoordinate(value: unknown, label: string) {
	if (
		!Number.isInteger(value) ||
		(value as number) < 0 ||
		(value as number) > 10_000
	) {
		throw new Error(`${label} must be an integer between 0 and 10000`);
	}

	return value as number;
}

function readNonNegativeInteger(value: unknown, label: string) {
	if (!Number.isInteger(value) || (value as number) < 0) {
		throw new Error(`${label} is invalid`);
	}

	return value as number;
}

function readBoolean(value: unknown, label: string) {
	if (typeof value !== "boolean") {
		throw new Error(`${label} is invalid`);
	}

	return value;
}
