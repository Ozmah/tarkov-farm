const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA1_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_KEYS = 500;

export type CatalogKey = {
	id: string;
	image: {
		height: number;
		path: string;
		sha256: string;
		width: number;
	};
	mapIds: string[];
	name: string;
	source: {
		file: string;
		sha1: string;
		sha256: string;
		url: string;
		wikiSha1: string;
	};
	usedInQuest: boolean;
	wikiUrl: string;
};

export type KeyCatalog = {
	formatVersion: 1;
	keys: CatalogKey[];
	source: {
		page: string;
		revision: number;
		url: string;
	};
};

export function parseKeyCatalog(input: unknown): KeyCatalog {
	const value = readObject(input, "Key catalog");

	if (value.formatVersion !== 1)
		throw new Error("Key catalog format is unsupported");
	if (
		!Array.isArray(value.keys) ||
		value.keys.length === 0 ||
		value.keys.length > MAX_KEYS
	) {
		throw new Error(`Key catalog must contain between 1 and ${MAX_KEYS} keys`);
	}

	const source = readObject(value.source, "Key catalog source");
	const keys = value.keys
		.map(parseKey)
		.sort((left, right) => compareCodePoints(left.name, right.name));
	assertUnique(
		keys.map(({ id }) => id),
		"Key identifiers",
	);
	assertUnique(
		keys.map(({ name }) => name),
		"Key names",
	);
	assertUnique(
		keys.map(({ image }) => image.path),
		"Key image paths",
	);

	return {
		formatVersion: 1,
		keys,
		source: {
			page: readText(source.page, "Key catalog source page", 120),
			revision: readInteger(source.revision, "Key catalog source revision", 1),
			url: readWikiUrl(source.url, "Key catalog source URL"),
		},
	};
}

function parseKey(input: unknown): CatalogKey {
	const value = readObject(input, "Key");
	const image = readObject(value.image, "Key image");
	const source = readObject(value.source, "Key source");
	const id = readId(value.id, "Key identifier");
	const sha256 = readHash(image.sha256, SHA256_PATTERN, "Key image SHA-256");
	const path = readText(image.path, "Key image path", 300);

	if (path !== `/keys/${id}-${sha256.slice(0, 12)}.webp`) {
		throw new Error(`Key image path is invalid for ${id}`);
	}

	if (!Array.isArray(value.mapIds))
		throw new Error(`Key ${id} map identifiers must be an array`);
	const mapIds = value.mapIds.map((mapId) =>
		readId(mapId, `Key ${id} map identifier`),
	);
	assertUnique(mapIds, `Key ${id} map identifiers`);

	return {
		id,
		image: {
			height: readInteger(image.height, "Key image height", 1, 128),
			path,
			sha256,
			width: readInteger(image.width, "Key image width", 1, 128),
		},
		mapIds: [...mapIds].sort(compareCodePoints),
		name: readText(value.name, "Key name", 120),
		source: {
			file: readText(source.file, "Key source file", 240),
			sha1: readHash(source.sha1, SHA1_PATTERN, "Downloaded key source SHA-1"),
			sha256: readHash(
				source.sha256,
				SHA256_PATTERN,
				"Downloaded key source SHA-256",
			),
			url: readImageUrl(source.url),
			wikiSha1: readHash(
				source.wikiSha1,
				SHA1_PATTERN,
				"Wiki key source SHA-1",
			),
		},
		usedInQuest: readBoolean(value.usedInQuest, "Key quest state"),
		wikiUrl: readWikiUrl(value.wikiUrl, "Key wiki URL"),
	};
}

function readObject(value: unknown, label: string) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
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
		value !== value.trim()
	) {
		throw new Error(`${label} is invalid`);
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
		!Number.isSafeInteger(value) ||
		(value as number) < minimum ||
		(value as number) > maximum
	) {
		throw new Error(`${label} is invalid`);
	}
	return value as number;
}

function readBoolean(value: unknown, label: string) {
	if (typeof value !== "boolean") throw new Error(`${label} is invalid`);
	return value;
}

function readHash(value: unknown, pattern: RegExp, label: string) {
	if (typeof value !== "string" || !pattern.test(value))
		throw new Error(`${label} is invalid`);
	return value;
}

function readWikiUrl(value: unknown, label: string) {
	const url = readUrl(value, label);
	if (url.origin !== "https://escapefromtarkov.fandom.com")
		throw new Error(`${label} is invalid`);
	return url.href;
}

function readImageUrl(value: unknown) {
	const url = readUrl(value, "Key source image URL");
	if (url.origin !== "https://static.wikia.nocookie.net") {
		throw new Error("Key source image URL is invalid");
	}
	return url.href;
}

function readUrl(value: unknown, label: string) {
	if (typeof value !== "string" || value.length > 1_000)
		throw new Error(`${label} is invalid`);
	try {
		return new URL(value);
	} catch {
		throw new Error(`${label} is invalid`);
	}
}

function assertUnique(values: string[], label: string) {
	if (new Set(values).size !== values.length)
		throw new Error(`${label} contain duplicates`);
}

function compareCodePoints(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
