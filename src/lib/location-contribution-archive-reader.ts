import {
	type LocationContributionBundle,
	parseLocationContributionBundle,
	serializeLocationContributionBundle,
} from "./location-contribution";
import {
	type LocationContributionCatalog,
	type LocationContributionCatalogWarning,
	validateLocationContributionCatalog,
} from "./location-contribution-catalog";
import {
	type ContributionImageDecoder,
	sha256Hex,
	verifyLocationContributionImage,
} from "./location-contribution-image";
import {
	indexLocationContributionZip,
	readLocationContributionZipEntry,
} from "./location-contribution-zip";

const MANIFEST_ENTRY = "manifest.json";
const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
const SCREENSHOT_EXTENSIONS = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
} as const;

export type ReviewedContributionScreenshot =
	LocationContributionBundle["locations"][number]["screenshots"][number] & {
		file: File;
	};

export type ReviewedContributionLocation = Omit<
	LocationContributionBundle["locations"][number],
	"screenshots"
> & {
	screenshots: ReviewedContributionScreenshot[];
};

export type ReviewedLocationContributionArchive = {
	bundleId: string;
	locations: ReviewedContributionLocation[];
	warnings: LocationContributionCatalogWarning[];
};

export async function readLocationContributionArchive(
	archive: Blob,
	catalog: LocationContributionCatalog,
	options: {
		decodeImage?: ContributionImageDecoder;
		signal?: AbortSignal;
	} = {},
): Promise<ReviewedLocationContributionArchive> {
	const indexed = await indexLocationContributionZip(archive, options);
	const manifestEntry = indexed.entries[0];
	if (!manifestEntry || manifestEntry.name !== MANIFEST_ENTRY) {
		throw new Error("Contribution ZIP must begin with manifest.json");
	}

	const manifestBytes = await readLocationContributionZipEntry(
		manifestEntry,
		options,
	);
	if (startsWith(manifestBytes, UTF8_BOM)) {
		throw new Error("Contribution manifest must not contain a UTF-8 BOM");
	}
	const manifestText = new TextDecoder("utf-8", { fatal: true }).decode(
		manifestBytes,
	);
	let manifestValue: unknown;
	try {
		manifestValue = JSON.parse(manifestText);
	} catch {
		throw new Error("Contribution manifest is not valid JSON");
	}
	const bundle = parseLocationContributionBundle(manifestValue);
	const canonicalBytes = new TextEncoder().encode(
		serializeLocationContributionBundle(bundle),
	);
	if (!equalBytes(manifestBytes, canonicalBytes)) {
		throw new Error("Contribution manifest is not canonical");
	}

	const expectedEntries = [
		MANIFEST_ENTRY,
		...bundle.locations.flatMap(({ screenshots }) =>
			screenshots.map(({ entry }) => entry),
		),
	];
	if (
		expectedEntries.length !== indexed.entries.length ||
		expectedEntries.some(
			(expected, index) => indexed.entries[index]?.name !== expected,
		)
	) {
		throw new Error("Contribution ZIP inventory does not match its manifest");
	}

	const warnings = validateLocationContributionCatalog(bundle, catalog);
	const entriesByName = new Map(
		indexed.entries.map((entry) => [entry.name, entry]),
	);
	const locations: ReviewedContributionLocation[] = [];

	for (const location of bundle.locations) {
		const screenshots: ReviewedContributionScreenshot[] = [];
		for (const screenshot of location.screenshots) {
			options.signal?.throwIfAborted();
			const entry = entriesByName.get(screenshot.entry);
			if (!entry || entry.size !== screenshot.byteLength) {
				throw new Error(
					`Screenshot ${screenshot.id} does not match its declared size`,
				);
			}
			const bytes = await readLocationContributionZipEntry(entry, options);
			await verifyLocationContributionImage(bytes, screenshot.mediaType, {
				decode: options.decodeImage,
				signal: options.signal,
			});
			if ((await sha256Hex(bytes)) !== screenshot.sourceSha256) {
				throw new Error(
					`Screenshot ${screenshot.id} failed SHA-256 verification`,
				);
			}
			screenshots.push({
				...screenshot,
				file: new File([entry.data], controlledFilename(screenshot), {
					type: screenshot.mediaType,
				}),
			});
		}

		locations.push({ ...location, screenshots });
	}

	return { bundleId: bundle.bundleId, locations, warnings };
}

function controlledFilename(
	screenshot: LocationContributionBundle["locations"][number]["screenshots"][number],
) {
	const extension = SCREENSHOT_EXTENSIONS[screenshot.mediaType];
	return `${screenshot.id}.${extension}`;
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array) {
	return prefix.every((byte, index) => bytes[index] === byte);
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
	return (
		left.byteLength === right.byteLength &&
		left.every((byte, index) => byte === right[index])
	);
}
