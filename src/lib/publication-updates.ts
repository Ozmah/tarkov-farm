const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

import { parseCanonicalInstant } from "./date";
import { parseReleaseSnapshot, type ReleaseSnapshot } from "./release-context";

export type PublicUpdate = {
	id: string;
	publishedAt: string;
	title: string;
	description: string;
};

export type PublicationUpdate = PublicUpdate & {
	snapshot: ReleaseSnapshot;
};

export type PublicationUpdatesData = {
	formatVersion: 1;
	updates: PublicationUpdate[];
};

export function parsePublicationUpdatesData(
	input: unknown,
): PublicationUpdatesData {
	const value = readObject(input, "Updates publication data", [
		"formatVersion",
		"updates",
	]);

	if (value.formatVersion !== 1) {
		throw new Error("Updates publication format version is unsupported");
	}

	if (!Array.isArray(value.updates)) {
		throw new Error("Publication updates must be an array");
	}

	const updates = value.updates.map(parseUpdate);
	const ids = updates.map(({ id }) => id);

	if (new Set(ids).size !== ids.length) {
		throw new Error("Update identifiers contain duplicates");
	}

	return {
		formatVersion: 1,
		updates: [...updates].sort(
			(left, right) =>
				compareCodePoints(right.publishedAt, left.publishedAt) ||
				compareCodePoints(left.id, right.id),
		),
	};
}

export function serializePublicationUpdatesData(input: PublicationUpdatesData) {
	return `${JSON.stringify(parsePublicationUpdatesData(input), null, "\t")}\n`;
}

function parseUpdate(input: unknown): PublicationUpdate {
	const value = readObject(input, "Publication update", [
		"description",
		"id",
		"publishedAt",
		"snapshot",
		"title",
	]);

	return {
		id: readId(value.id),
		publishedAt: readCanonicalUtcIso(value.publishedAt),
		title: readText(value.title, "Update title", 120),
		description: readText(value.description, "Update description", 2_000),
		snapshot: parseReleaseSnapshot(value.snapshot),
	};
}

export function toPublicUpdate(update: PublicationUpdate): PublicUpdate {
	const { snapshot: _snapshot, ...metadata } = update;
	return metadata;
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

function readId(value: unknown) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 100 ||
		!ID_PATTERN.test(value)
	) {
		throw new Error("Update identifier is invalid");
	}

	return value;
}

function readCanonicalUtcIso(value: unknown) {
	if (typeof value !== "string") {
		throw new Error(
			"Update publication date must be a canonical UTC timestamp",
		);
	}

	try {
		parseCanonicalInstant(value);
	} catch {
		throw new Error(
			"Update publication date must be a canonical UTC timestamp",
		);
	}

	return value;
}

function readText(value: unknown, label: string, maxLength: number) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > maxLength ||
		value !== value.trim()
	) {
		throw new Error(`${label} is not canonical`);
	}

	return value;
}

function compareCodePoints(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
