import { Zip, ZipPassThrough } from "fflate";
import { describe, expect, it, vi } from "vitest";

import {
	LOCATION_CONTRIBUTION_FORMAT_VERSION,
	type LocationContributionBundle,
	serializeLocationContributionBundle,
} from "./location-contribution";
import { readLocationContributionArchive } from "./location-contribution-archive-reader";
import type { LocationContributionCatalog } from "./location-contribution-catalog";
import { sha256Hex } from "./location-contribution-image";
import { LOCATION_CONTRIBUTION_ZIP_MTIME } from "./location-contribution-zip-metadata";

const BUNDLE_ID = "00000000-0000-4000-8000-000000000001";
const LOCATION_ID = "00000000-0000-4000-8000-000000000002";
const SCREENSHOT_ID = "00000000-0000-4000-8000-000000000003";
const SCREENSHOT_ENTRY = `locations/${LOCATION_ID}/screenshots/${SCREENSHOT_ID}.png`;
const PNG_BYTES = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	),
);

describe("location contribution archive reader", () => {
	it("validates and reconstructs an app-produced contribution atomically", async () => {
		const bundle = await createBundle();
		const decoder = vi.fn(async () => ({
			close: vi.fn(),
			height: 1,
			width: 1,
		}));
		const reviewed = await readLocationContributionArchive(
			createArchive(bundle),
			catalog,
			{ decodeImage: decoder },
		);

		expect(reviewed.bundleId).toBe(BUNDLE_ID);
		expect(reviewed.locations).toHaveLength(1);
		expect(reviewed.locations[0]?.screenshots[0]?.file).toMatchObject({
			name: `${SCREENSHOT_ID}.png`,
			size: PNG_BYTES.byteLength,
			type: "image/png",
		});
		expect(reviewed.locations[0]?.screenshots[0]).toMatchObject({
			altText: "Desk",
			byteLength: PNG_BYTES.byteLength,
			entry: SCREENSHOT_ENTRY,
			mediaType: "image/png",
			sourceSha256: bundle.locations[0]?.screenshots[0]?.sourceSha256,
		});
		expect(decoder).toHaveBeenCalledTimes(1);
	});

	it("rejects noncanonical manifests and mismatched inventory", async () => {
		const bundle = await createBundle();
		const compactManifest = JSON.stringify(bundle);

		await expect(
			readLocationContributionArchive(
				createArchive(bundle, { manifest: compactManifest }),
				catalog,
			),
		).rejects.toThrow("manifest is not canonical");
		await expect(
			readLocationContributionArchive(
				createArchive(bundle, { extraEntry: SCREENSHOT_ENTRY }),
				catalog,
			),
		).rejects.toThrow(/duplicate entries|inventory/);
	});

	it("rejects stale maps and unavailable catalog references", async () => {
		const bundle = await createBundle();
		const staleCatalog = structuredClone(catalog);
		staleCatalog.mapImages[0].sha256 = "f".repeat(64);

		await expect(
			readLocationContributionArchive(createArchive(bundle), staleCatalog),
		).rejects.toThrow("outdated map image");

		const missingDocumentCatalog = structuredClone(catalog);
		missingDocumentCatalog.documentMaps = [];
		await expect(
			readLocationContributionArchive(
				createArchive(bundle),
				missingDocumentCatalog,
			),
		).rejects.toThrow("unavailable document");
	});

	it("rejects spoofed images and SHA-256 mismatches", async () => {
		const bundle = await createBundle();
		const invalidImage = new TextEncoder().encode("not an image");
		const invalidImageBundle = await createBundle({ bytes: invalidImage });

		await expect(
			readLocationContributionArchive(
				createArchive(invalidImageBundle, { screenshot: invalidImage }),
				catalog,
			),
		).rejects.toThrow("not a valid PNG");

		bundle.locations[0].screenshots[0].sourceSha256 = "0".repeat(64);
		await expect(
			readLocationContributionArchive(createArchive(bundle), catalog, {
				decodeImage: async () => ({ height: 1, width: 1 }),
			}),
		).rejects.toThrow("failed SHA-256 verification");
	});

	it("aborts without returning a partial review", async () => {
		const bundle = await createBundle();
		const controller = new AbortController();
		controller.abort();

		await expect(
			readLocationContributionArchive(createArchive(bundle), catalog, {
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
	});
});

const catalog = {
	documentMaps: [{ documentId: "technical", mapId: "reserve" }],
	documents: [{ id: "technical", name: "Technical" }],
	keyMaps: [{ keyId: "rb-key", mapId: "reserve" }],
	keys: [{ id: "rb-key", name: "RB key" }],
	locations: [],
	mapImages: [
		{
			id: "reserve-main",
			mapId: "reserve",
			name: "Main",
			sha256: "a".repeat(64),
		},
	],
	maps: [{ id: "reserve", name: "Reserve" }],
} satisfies LocationContributionCatalog;

async function createBundle(options: { bytes?: Uint8Array } = {}) {
	const bytes = options.bytes ?? PNG_BYTES;
	return {
		bundleId: BUNDLE_ID,
		formatVersion: LOCATION_CONTRIBUTION_FORMAT_VERSION,
		locations: [
			{
				description: "On the desk",
				documentId: "technical",
				id: LOCATION_ID,
				mapImageId: "reserve-main",
				mapImageSha256: "a".repeat(64),
				name: "White Pawn",
				requiredKeyIds: ["rb-key"],
				screenshots: [
					{
						altText: "Desk",
						byteLength: bytes.byteLength,
						caption: null,
						entry: SCREENSHOT_ENTRY,
						id: SCREENSHOT_ID,
						mediaType: "image/png" as const,
						sourceSha256: await sha256Hex(bytes),
					},
				],
				xBasisPoints: 3_193,
				yBasisPoints: 1_527,
			},
		],
		operation: "add-locations" as const,
	} satisfies LocationContributionBundle;
}

function createArchive(
	bundle: LocationContributionBundle,
	options: {
		extraEntry?: string;
		manifest?: string;
		screenshot?: Uint8Array;
	} = {},
) {
	const entries: Array<readonly [string, Uint8Array]> = [
		[
			"manifest.json",
			new TextEncoder().encode(
				options.manifest ?? serializeLocationContributionBundle(bundle),
			),
		],
		[SCREENSHOT_ENTRY, options.screenshot ?? PNG_BYTES],
	];
	if (options.extraEntry) {
		entries.push([options.extraEntry, new Uint8Array([1])]);
	}

	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let output: Blob | undefined;
	const zip = new Zip((error, chunk, final) => {
		if (error) throw error;
		chunks.push(chunk);
		if (final) output = new Blob(chunks);
	});
	for (const [name, bytes] of entries) {
		const entry = new ZipPassThrough(name);
		entry.mtime = LOCATION_CONTRIBUTION_ZIP_MTIME;
		entry.os = 0;
		entry.attrs = 0;
		zip.add(entry);
		entry.push(bytes, true);
	}
	zip.end();
	zip.terminate();
	if (!output) throw new Error("Expected an archive");
	return output;
}
