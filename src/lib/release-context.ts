const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_SNAPSHOT_BYTES = 1_048_576;
const MAX_LOCATIONS = 500;
const MAX_SCREENSHOTS_PER_LOCATION = 10;

export type SnapshotLocation = {
	id: string;
	name: string;
	mapId: string;
	mapName: string;
	documentId: string;
	documentName: string;
	fingerprint: string;
	screenshotIds: string[];
};

export type ReleaseSnapshot = {
	formatVersion: 1;
	locations: SnapshotLocation[];
};

export type ReleaseContextLocation = {
	id: string;
	name: string;
	map: { id: string; name: string };
	document: { id: string; name: string };
};

export type ReleaseContext = {
	baselineSource: "git-head" | "latest-update";
	currentTotals: {
		locations: number;
		screenshots: number;
		maps: number;
	};
	deltas: {
		locationsAdded: number;
		locationsModified: number;
		locationsRemoved: number;
		screenshotsAdded: number;
		screenshotsRemoved: number;
	};
	affectedMaps: Array<{ id: string; name: string }>;
	affectedDocuments: Array<{ id: string; name: string }>;
	locations: {
		added: ReleaseContextLocation[];
		modified: ReleaseContextLocation[];
		removed: ReleaseContextLocation[];
	};
};

export function parseReleaseSnapshot(input: unknown): ReleaseSnapshot {
	const value = readObject(input, "Release snapshot", [
		"formatVersion",
		"locations",
	]);

	if (value.formatVersion !== 1) {
		throw new Error("Release snapshot format version is unsupported");
	}

	if (
		!Array.isArray(value.locations) ||
		value.locations.length > MAX_LOCATIONS
	) {
		throw new Error("Release snapshot locations must be a bounded array");
	}

	const locations = value.locations.map(parseSnapshotLocation);
	assertUnique(
		locations.map(({ id }) => id),
		"Release snapshot location identifiers",
	);
	assertUnique(
		locations.flatMap(({ screenshotIds }) => screenshotIds),
		"Release snapshot screenshot identifiers",
	);

	const snapshot: ReleaseSnapshot = {
		formatVersion: 1,
		locations: [...locations].sort((left, right) =>
			compareCodePoints(left.id, right.id),
		),
	};

	if (
		new TextEncoder().encode(JSON.stringify(snapshot)).byteLength >
		MAX_SNAPSHOT_BYTES
	) {
		throw new Error("Release snapshot exceeds its maximum serialized size");
	}

	return snapshot;
}

export function serializeReleaseSnapshot(input: ReleaseSnapshot) {
	return JSON.stringify(parseReleaseSnapshot(input));
}

export function compareReleaseSnapshots(
	baselineInput: ReleaseSnapshot,
	currentInput: ReleaseSnapshot,
	baselineSource: ReleaseContext["baselineSource"],
): ReleaseContext {
	const baseline = parseReleaseSnapshot(baselineInput);
	const current = parseReleaseSnapshot(currentInput);
	const baselineById = new Map(
		baseline.locations.map((location) => [location.id, location]),
	);
	const currentById = new Map(
		current.locations.map((location) => [location.id, location]),
	);
	const added: SnapshotLocation[] = [];
	const modified: SnapshotLocation[] = [];
	const removed: SnapshotLocation[] = [];
	const changedPairs: Array<{
		baseline?: SnapshotLocation;
		current?: SnapshotLocation;
	}> = [];

	for (const location of current.locations) {
		const previous = baselineById.get(location.id);

		if (!previous) {
			added.push(location);
			changedPairs.push({ current: location });
		} else if (!locationsMatch(previous, location)) {
			modified.push(location);
			changedPairs.push({ baseline: previous, current: location });
		}
	}

	for (const location of baseline.locations) {
		if (!currentById.has(location.id)) {
			removed.push(location);
			changedPairs.push({ baseline: location });
		}
	}

	const baselineScreenshotIds = new Set(
		baseline.locations.flatMap(({ screenshotIds }) => screenshotIds),
	);
	const currentScreenshotIds = new Set(
		current.locations.flatMap(({ screenshotIds }) => screenshotIds),
	);
	const affectedMaps = new Map<string, { id: string; name: string }>();
	const affectedDocuments = new Map<string, { id: string; name: string }>();

	for (const pair of changedPairs) {
		for (const location of [pair.baseline, pair.current]) {
			if (!location) continue;
			affectedMaps.set(location.mapId, {
				id: location.mapId,
				name: location.mapName,
			});
			affectedDocuments.set(location.documentId, {
				id: location.documentId,
				name: location.documentName,
			});
		}
	}

	return {
		baselineSource,
		currentTotals: {
			locations: current.locations.length,
			screenshots: currentScreenshotIds.size,
			maps: new Set(current.locations.map(({ mapId }) => mapId)).size,
		},
		deltas: {
			locationsAdded: added.length,
			locationsModified: modified.length,
			locationsRemoved: removed.length,
			screenshotsAdded: countDifference(
				currentScreenshotIds,
				baselineScreenshotIds,
			),
			screenshotsRemoved: countDifference(
				baselineScreenshotIds,
				currentScreenshotIds,
			),
		},
		affectedMaps: sortNamedValues(affectedMaps),
		affectedDocuments: sortNamedValues(affectedDocuments),
		locations: {
			added: added.map(toContextLocation),
			modified: modified.map(toContextLocation),
			removed: removed.map(toContextLocation),
		},
	};
}

function parseSnapshotLocation(input: unknown): SnapshotLocation {
	const value = readObject(input, "Release snapshot location", [
		"documentId",
		"documentName",
		"fingerprint",
		"id",
		"mapId",
		"mapName",
		"name",
		"screenshotIds",
	]);

	if (
		!Array.isArray(value.screenshotIds) ||
		value.screenshotIds.length > MAX_SCREENSHOTS_PER_LOCATION
	) {
		throw new Error("Release snapshot screenshot identifiers must be bounded");
	}

	const screenshotIds = value.screenshotIds.map((id) =>
		readId(id, "Release snapshot screenshot identifier"),
	);
	assertUnique(
		screenshotIds,
		"Release snapshot location screenshot identifiers",
	);

	return {
		id: readId(value.id, "Release snapshot location identifier"),
		name: readText(value.name, "Release snapshot location name", 120),
		mapId: readId(value.mapId, "Release snapshot map identifier"),
		mapName: readText(value.mapName, "Release snapshot map name", 120),
		documentId: readId(
			value.documentId,
			"Release snapshot document identifier",
		),
		documentName: readText(
			value.documentName,
			"Release snapshot document name",
			120,
		),
		fingerprint: readSha256(value.fingerprint),
		screenshotIds: [...screenshotIds].sort(compareCodePoints),
	};
}

function locationsMatch(left: SnapshotLocation, right: SnapshotLocation) {
	return (
		left.name === right.name &&
		left.mapId === right.mapId &&
		left.mapName === right.mapName &&
		left.documentId === right.documentId &&
		left.documentName === right.documentName &&
		left.fingerprint === right.fingerprint &&
		left.screenshotIds.length === right.screenshotIds.length &&
		left.screenshotIds.every((id, index) => id === right.screenshotIds[index])
	);
}

function toContextLocation(location: SnapshotLocation): ReleaseContextLocation {
	return {
		id: location.id,
		name: location.name,
		map: { id: location.mapId, name: location.mapName },
		document: { id: location.documentId, name: location.documentName },
	};
}

function countDifference(left: Set<string>, right: Set<string>) {
	let count = 0;
	for (const value of left) {
		if (!right.has(value)) count += 1;
	}
	return count;
}

function sortNamedValues(values: Map<string, { id: string; name: string }>) {
	return [...values.values()].sort((left, right) =>
		compareCodePoints(left.id, right.id),
	);
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
		value.length === 0 ||
		value.length > 100 ||
		!ID_PATTERN.test(value)
	) {
		throw new Error(`${label} is invalid`);
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

function readSha256(value: unknown) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		throw new Error("Release snapshot fingerprint must be lowercase SHA-256");
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
