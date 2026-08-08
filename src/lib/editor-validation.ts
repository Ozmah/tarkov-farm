const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export type SaveLocationInput = {
	id?: string;
	mapImageId: string;
	name: string;
	description: string | null;
	xBasisPoints: number;
	yBasisPoints: number;
	isActive: boolean;
	documentIds: string[];
};

export type DeleteLocationInput = {
	id: string;
};

export function parseSaveLocationInput(input: unknown): SaveLocationInput {
	const value = readObject(input);
	const documentIds = readDocumentIds(value.documentIds);

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
		documentIds,
	};
}

export function parseDeleteLocationInput(input: unknown): DeleteLocationInput {
	const value = readObject(input);

	return {
		id: readId(value.id, "Location identifier"),
	};
}

function readObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Invalid editor request");
	}

	return value as Record<string, unknown>;
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

function readBoolean(value: unknown, label: string) {
	if (typeof value !== "boolean") {
		throw new Error(`${label} is invalid`);
	}

	return value;
}

function readDocumentIds(value: unknown) {
	if (!Array.isArray(value) || value.length > 20) {
		throw new Error("Document selection is invalid");
	}

	const documentIds = value.map((id) => readId(id, "Document identifier"));

	if (new Set(documentIds).size !== documentIds.length) {
		throw new Error("Document selection contains duplicates");
	}

	return documentIds;
}
