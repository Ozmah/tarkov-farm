/**
 * Intake drafts: incomplete location proposals prepared by a local agent.
 * Portable schema only; filesystem access lives in src/server/intake.
 */

export const INTAKE_DRAFT_FORMAT_VERSION = 1;
export const MAX_INTAKE_SCREENSHOTS = 10;
export const MAX_INTAKE_SCREENSHOT_BYTES = 20 * 1_048_576;
export const MAX_INTAKE_NOTES_LENGTH = 2_000;
export const MAX_INTAKE_CONTRIBUTOR_LENGTH = 100;

const UUID_V4_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CATALOG_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type IntakeMediaType = (typeof MEDIA_TYPES)[number];

/** Every field is optional: the agent leaves out anything it cannot determine. */
export type IntakeDraftValues = {
	name: string;
	description: string;
	mapImageId: string | null;
	documentId: string | null;
	requiredKeyIds: string[];
};

export type IntakeScreenshot = {
	id: string;
	mediaType: IntakeMediaType;
	sha256: string;
	size: number;
	width: number;
	height: number;
};

export type IntakeDraftStatus = "pending" | "published" | "dismissed";

export type IntakeDraft = {
	formatVersion: typeof INTAKE_DRAFT_FORMAT_VERSION;
	id: string;
	/** Reserved before publication so a retried save cannot create a second location. */
	locationId: string;
	createdAt: string;
	contentHash: string;
	status: IntakeDraftStatus;
	/** When the draft became a location; lets a release list who contributed since its tag. */
	publishedAt: string | null;
	values: IntakeDraftValues;
	/** Private agent notes about uncertainty. Never published. */
	notes: string;
	/** Handle of whoever sent the contribution, when known. Never published in the app. */
	contributor: string;
	screenshots: IntakeScreenshot[];
};

export function isUuidV4(value: unknown): value is string {
	return typeof value === "string" && UUID_V4_PATTERN.test(value);
}

export function parseIntakeDraftId(value: unknown): string {
	if (!isUuidV4(value)) throw new Error("Draft identifier must be a UUIDv4");
	return value;
}

export function parseIntakeDraftValues(input: unknown): IntakeDraftValues {
	const value = readRecord(input, "Draft values", [
		"name",
		"description",
		"mapImageId",
		"documentId",
		"requiredKeyIds",
	]);
	const keys = value.requiredKeyIds ?? [];
	if (!Array.isArray(keys) || keys.length > 256)
		throw new Error("Required keys must be an array of at most 256 IDs");

	return {
		name: readText(value.name ?? "", "Name", 120),
		description: readText(value.description ?? "", "Description", 2_000),
		mapImageId: readOptionalCatalogId(value.mapImageId, "Map image"),
		documentId: readOptionalCatalogId(value.documentId, "Document"),
		requiredKeyIds: [
			...new Set(keys.map((id) => readCatalogId(id, "Required key"))),
		].sort(),
	};
}

export function parseIntakeNotes(value: unknown): string {
	return readText(value ?? "", "Notes", MAX_INTAKE_NOTES_LENGTH);
}

/** A bare handle such as "@BiggestNwah": one line, no source or URL required. */
export function parseIntakeContributor(value: unknown): string {
	const handle = readText(
		value ?? "",
		"Contributor",
		MAX_INTAKE_CONTRIBUTOR_LENGTH,
	);
	if (/[\n\t]/.test(handle))
		throw new Error("Contributor must be a single line");
	return handle;
}

export function parseIntakeDraft(input: unknown): IntakeDraft {
	const value = readRecord(input, "Draft", [
		"formatVersion",
		"id",
		"locationId",
		"createdAt",
		"contentHash",
		"status",
		"publishedAt",
		"values",
		"notes",
		"contributor",
		"screenshots",
	]);
	if (value.formatVersion !== INTAKE_DRAFT_FORMAT_VERSION)
		throw new Error("Unsupported draft format version");
	if (
		value.status !== "pending" &&
		value.status !== "published" &&
		value.status !== "dismissed"
	)
		throw new Error("Draft status is invalid");
	if (
		typeof value.createdAt !== "string" ||
		Number.isNaN(Date.parse(value.createdAt))
	)
		throw new Error("Draft creation date is invalid");
	if (
		!Array.isArray(value.screenshots) ||
		value.screenshots.length > MAX_INTAKE_SCREENSHOTS
	)
		throw new Error(
			`A draft holds at most ${MAX_INTAKE_SCREENSHOTS} screenshots`,
		);
	const screenshots = value.screenshots.map(parseIntakeScreenshot);
	if (new Set(screenshots.map(({ id }) => id)).size !== screenshots.length)
		throw new Error("Draft screenshot identifiers must be unique");

	return {
		formatVersion: INTAKE_DRAFT_FORMAT_VERSION,
		id: parseIntakeDraftId(value.id),
		locationId: parseIntakeDraftId(value.locationId),
		createdAt: value.createdAt,
		contentHash: readHash(value.contentHash),
		status: value.status,
		publishedAt: readPublishedAt(value.publishedAt, value.status),
		values: parseIntakeDraftValues(value.values),
		notes: parseIntakeNotes(value.notes),
		contributor: parseIntakeContributor(value.contributor),
		screenshots,
	};
}

export function parseIntakeMediaType(value: unknown): IntakeMediaType {
	const mediaType = MEDIA_TYPES.find((type) => type === value);
	if (!mediaType) throw new Error("Screenshots must be JPEG, PNG, or WebP");
	return mediaType;
}

function parseIntakeScreenshot(input: unknown): IntakeScreenshot {
	const value = readRecord(input, "Draft screenshot", [
		"id",
		"mediaType",
		"sha256",
		"size",
		"width",
		"height",
	]);
	return {
		id: parseIntakeDraftId(value.id),
		mediaType: parseIntakeMediaType(value.mediaType),
		sha256: readHash(value.sha256),
		size: readInteger(value.size, 1, MAX_INTAKE_SCREENSHOT_BYTES, "Size"),
		width: readInteger(value.width, 1, 8_192, "Width"),
		height: readInteger(value.height, 1, 8_192, "Height"),
	};
}

/** Tab and newline are allowed; any other C0 control or DEL is rejected. */
function hasControlCharacter(text: string) {
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		if ((code < 32 && code !== 9 && code !== 10) || code === 127) return true;
	}
	return false;
}

function readPublishedAt(value: unknown, status: IntakeDraftStatus) {
	if (value == null) return null;
	if (
		status !== "published" ||
		typeof value !== "string" ||
		Number.isNaN(Date.parse(value))
	)
		throw new Error("Draft publication date is invalid");
	return value;
}

function readRecord(input: unknown, label: string, allowed: string[]) {
	if (!input || typeof input !== "object" || Array.isArray(input))
		throw new Error(`${label} must be an object`);
	const record = input as Record<string, unknown>;
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	if (unknown.length)
		throw new Error(`${label} has unsupported fields: ${unknown.join(", ")}`);
	return record;
}

function readCatalogId(value: unknown, label: string) {
	if (typeof value !== "string" || !CATALOG_ID_PATTERN.test(value))
		throw new Error(`${label} identifier is invalid`);
	return value;
}

function readOptionalCatalogId(value: unknown, label: string) {
	return value == null || value === "" ? null : readCatalogId(value, label);
}

function readHash(value: unknown) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value))
		throw new Error("Hash must be a lowercase SHA-256 digest");
	return value;
}

function readInteger(value: unknown, min: number, max: number, label: string) {
	if (
		typeof value !== "number" ||
		!Number.isSafeInteger(value) ||
		value < min ||
		value > max
	)
		throw new Error(`${label} must be an integer between ${min} and ${max}`);
	return value;
}

function readText(value: unknown, label: string, limit: number) {
	if (typeof value !== "string") throw new Error(`${label} must be text`);
	const text = value.replace(/\r\n?/g, "\n").normalize("NFC").trim();
	if (hasControlCharacter(text))
		throw new Error(`${label} contains control characters`);
	if (text.length > limit)
		throw new Error(`${label} must be at most ${limit} characters`);
	return text;
}
