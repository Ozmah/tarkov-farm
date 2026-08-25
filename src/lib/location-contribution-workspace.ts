import {
	getLocationContributionBundleBytes,
	LOCATION_CONTRIBUTION_FORMAT_VERSION,
	type LocationContribution,
	type LocationContributionBundle,
	type LocationContributionScreenshot,
	MAX_CONTRIBUTION_BUNDLE_BYTES,
	MAX_CONTRIBUTION_LOCATIONS,
	MAX_CONTRIBUTION_SCREENSHOT_BYTES,
	MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION,
	parseLocationContributionBundle,
} from "./location-contribution";

const SCREENSHOT_EXTENSIONS = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
} as const;

type ScreenshotMediaType = keyof typeof SCREENSHOT_EXTENSIONS;

export type ContributionLocationInput = Omit<
	LocationContribution,
	"description" | "id" | "screenshots"
> & {
	description: string;
	screenshots: Array<{
		altText: string;
		caption: string;
		file: File;
	}>;
};

export type StagedContributionLocation = Omit<
	LocationContribution,
	"screenshots"
> & {
	screenshots: Array<LocationContributionScreenshot & { file: File }>;
};

export type LocationContributionWorkspace = {
	bundleId: string;
	locations: StagedContributionLocation[];
};

export function createLocationContributionWorkspace(): LocationContributionWorkspace {
	return { bundleId: crypto.randomUUID(), locations: [] };
}

export async function stageContributionLocation(
	workspace: LocationContributionWorkspace,
	input: ContributionLocationInput,
	replaceLocationId?: string,
): Promise<LocationContributionWorkspace> {
	const replaceIndex = replaceLocationId
		? workspace.locations.findIndex(({ id }) => id === replaceLocationId)
		: -1;

	if (replaceLocationId && replaceIndex < 0) {
		throw new Error("The staged contribution location does not exist");
	}

	if (
		!replaceLocationId &&
		workspace.locations.length >= MAX_CONTRIBUTION_LOCATIONS
	) {
		throw new Error(
			`A contribution can contain at most ${MAX_CONTRIBUTION_LOCATIONS} locations`,
		);
	}

	const files = input.screenshots.map(({ file }) => file);
	validateFiles(files);
	const retainedLocations = workspace.locations.filter(
		(_, index) => index !== replaceIndex,
	);
	const incomingBytes = files.reduce((total, file) => total + file.size, 0);

	if (
		getLocationContributionBundleBytes({ locations: retainedLocations }) +
			incomingBytes >
		MAX_CONTRIBUTION_BUNDLE_BYTES
	) {
		throw new Error(
			`Contribution screenshots cannot exceed ${MAX_CONTRIBUTION_BUNDLE_BYTES} bytes`,
		);
	}

	const locationId = replaceLocationId ?? crypto.randomUUID();
	const sourceHashes = await hashFiles(files);
	const stagedLocation: StagedContributionLocation = {
		description: normalizeNullableText(input.description),
		documentId: input.documentId,
		id: locationId,
		mapImageId: input.mapImageId,
		mapImageSha256: input.mapImageSha256,
		name: input.name.trim(),
		requiredKeyIds: [...input.requiredKeyIds].sort(compareCodePoints),
		screenshots: input.screenshots.map((screenshot, index) => {
			const id = crypto.randomUUID();
			const mediaType = readMediaType(screenshot.file);
			const sourceSha256 = sourceHashes[index];

			if (!sourceSha256) throw new Error("Screenshot hashing failed");

			return {
				altText: screenshot.altText.trim(),
				byteLength: screenshot.file.size,
				caption: normalizeNullableText(screenshot.caption),
				entry: `locations/${locationId}/screenshots/${id}.${SCREENSHOT_EXTENSIONS[mediaType]}`,
				file: screenshot.file,
				id,
				mediaType,
				sourceSha256,
			};
		}),
		xBasisPoints: input.xBasisPoints,
		yBasisPoints: input.yBasisPoints,
	};
	const nextLocations =
		replaceIndex < 0
			? [...workspace.locations, stagedLocation]
			: workspace.locations.map((location, index) =>
					index === replaceIndex ? stagedLocation : location,
				);

	parseLocationContributionBundle(
		createBundle(workspace.bundleId, nextLocations),
	);

	return { ...workspace, locations: nextLocations };
}

export function removeStagedContributionLocation(
	workspace: LocationContributionWorkspace,
	locationId: string,
): LocationContributionWorkspace {
	if (!workspace.locations.some(({ id }) => id === locationId)) {
		throw new Error("The staged contribution location does not exist");
	}

	return {
		...workspace,
		locations: workspace.locations.filter(({ id }) => id !== locationId),
	};
}

export function getLocationContributionWorkspaceBytes(
	workspace: LocationContributionWorkspace,
) {
	return getLocationContributionBundleBytes(workspace);
}

export function getLocationContributionWorkspaceBundle(
	workspace: LocationContributionWorkspace,
) {
	return parseLocationContributionBundle(
		createBundle(workspace.bundleId, workspace.locations),
	);
}

function validateFiles(files: File[]) {
	if (
		files.length === 0 ||
		files.length > MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION
	) {
		throw new Error(
			`A location requires between 1 and ${MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION} screenshots`,
		);
	}

	if (
		files.some(
			(file) =>
				!(file instanceof File) ||
				file.size === 0 ||
				file.size > MAX_CONTRIBUTION_SCREENSHOT_BYTES ||
				!isScreenshotMediaType(file.type),
		)
	) {
		throw new Error(
			"Screenshots must be JPEG, PNG, or WebP files under 20 MiB",
		);
	}
}

async function hashFiles(files: File[]) {
	const hashes: string[] = [];

	// Sequential by design: concurrent hashing can hold the entire 100 MiB bundle twice.
	for (const file of files) {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			await file.arrayBuffer(),
		);
		hashes.push(
			Array.from(new Uint8Array(digest), (byte) =>
				byte.toString(16).padStart(2, "0"),
			).join(""),
		);
	}

	return hashes;
}

function createBundle(
	bundleId: string,
	locations: StagedContributionLocation[],
): LocationContributionBundle {
	return {
		bundleId,
		formatVersion: LOCATION_CONTRIBUTION_FORMAT_VERSION,
		locations: locations.map((location) => ({
			...location,
			screenshots: location.screenshots.map(
				({ file: _file, ...screenshot }) => screenshot,
			),
		})),
		operation: "add-locations",
	};
}

function normalizeNullableText(value: string) {
	return value.trim() || null;
}

function readMediaType(file: File): ScreenshotMediaType {
	if (!isScreenshotMediaType(file.type)) {
		throw new Error("Unsupported screenshot media type");
	}

	return file.type;
}

function isScreenshotMediaType(value: string): value is ScreenshotMediaType {
	return Object.hasOwn(SCREENSHOT_EXTENSIONS, value);
}

function compareCodePoints(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
