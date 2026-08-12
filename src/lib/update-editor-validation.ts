const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

import { parseCanonicalInstant } from "./date";

export type SaveUpdateInput = {
	id?: string;
	publishedAt: string;
	title: string;
	description: string;
};

export type DeleteUpdateInput = {
	id: string;
};

export function parseSaveUpdateInput(input: unknown): SaveUpdateInput {
	const value = readObject(input, [
		"description",
		"id",
		"publishedAt",
		"title",
	]);

	return {
		id:
			value.id === undefined
				? undefined
				: readId(value.id, "Update identifier"),
		publishedAt: readCanonicalUtcIso(value.publishedAt),
		title: readText(value.title, "Update title", 120),
		description: readText(value.description, "Update description", 2_000),
	};
}

export function parseDeleteUpdateInput(input: unknown): DeleteUpdateInput {
	const value = readObject(input, ["id"]);

	return { id: readId(value.id, "Update identifier") };
}

function readObject(value: unknown, allowedKeys: readonly string[]) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Invalid update editor request");
	}

	const record = value as Record<string, unknown>;
	const unexpectedKey = Object.keys(record).find(
		(key) => !allowedKeys.includes(key),
	);

	if (unexpectedKey) {
		throw new Error(
			`Update editor request contains unexpected field ${unexpectedKey}`,
		);
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

function readCanonicalUtcIso(value: unknown) {
	if (typeof value !== "string") {
		throw new Error("Publication date must be a canonical UTC timestamp");
	}

	try {
		parseCanonicalInstant(value);
	} catch {
		throw new Error("Publication date must be a canonical UTC timestamp");
	}

	return value;
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
