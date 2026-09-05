import { describe, expect, it } from "vitest";

import {
	type PublicationData,
	parsePublicationData,
	serializePublicationData,
} from "./publication-data";

const SOURCE_HASH = "a".repeat(64);
const FULL_HASH = "b".repeat(64);
const PREVIEW_HASH = "c".repeat(64);

const validData: PublicationData = {
	formatVersion: 2,
	locations: [
		{
			description: "Near the extraction point",
			documentId: "technical",
			id: "location-1",
			isActive: true,
			mapImageId: "woods-main",
			name: "Test location",
			requiredKeyIds: ["zb-014-key"],
			screenshots: [
				{
					altText: "",
					caption: null,
					full: {
						height: 1_080,
						path: `/screenshots/location-1/${FULL_HASH}-1920.webp`,
						sha256: FULL_HASH,
						width: 1_920,
					},
					id: "screenshot-1",
					isActive: true,
					preview: {
						height: 563,
						path: `/screenshots/location-1/${PREVIEW_HASH}-1000.webp`,
						sha256: PREVIEW_HASH,
						width: 1_000,
					},
					sortOrder: 0,
					sourceSha256: SOURCE_HASH,
				},
			],
			xBasisPoints: 4_500,
			yBasisPoints: 6_000,
		},
	],
};

describe("publication data", () => {
	it("parses and serializes canonical data deterministically", () => {
		const first = serializePublicationData(validData);
		const second = serializePublicationData(JSON.parse(first));

		expect(second).toBe(first);
		expect(parsePublicationData(JSON.parse(first))).toEqual(validData);
	});

	it("rejects assets outside their content-addressed location path", () => {
		const invalid = structuredClone(validData);
		invalid.locations[0].screenshots[0].full.path =
			"/screenshots/other/file.webp";

		expect(() => parsePublicationData(invalid)).toThrow(
			"Full screenshot path must be",
		);
	});

	it("accepts and preserves legacy source-addressed screenshot paths", () => {
		const legacy = structuredClone(validData);
		legacy.locations[0].screenshots[0].full.path = `/screenshots/location-1/${SOURCE_HASH}-1920.webp`;
		legacy.locations[0].screenshots[0].preview.path = `/screenshots/location-1/${SOURCE_HASH}-1000.webp`;

		expect(parsePublicationData(legacy)).toEqual(legacy);
		expect(JSON.parse(serializePublicationData(legacy))).toEqual(legacy);
	});

	it("rejects a screenshot path tied to the wrong variant hash", () => {
		const invalid = structuredClone(validData);
		invalid.locations[0].screenshots[0].full.path = `/screenshots/location-1/${PREVIEW_HASH}-1920.webp`;

		expect(() => parsePublicationData(invalid)).toThrow(
			"Full screenshot path must be",
		);
	});

	it("rejects a preview path tied to the full variant hash", () => {
		const invalid = structuredClone(validData);
		invalid.locations[0].screenshots[0].preview.path = `/screenshots/location-1/${FULL_HASH}-1000.webp`;

		expect(() => parsePublicationData(invalid)).toThrow(
			"Screenshot preview path must be",
		);
	});

	it("rejects duplicated screenshot identifiers", () => {
		const invalid = structuredClone(validData);
		invalid.locations.push({
			...structuredClone(validData.locations[0]),
			id: "location-2",
			screenshots: [
				{
					...structuredClone(validData.locations[0].screenshots[0]),
					full: {
						...validData.locations[0].screenshots[0].full,
						path: `/screenshots/location-2/${FULL_HASH}-1920.webp`,
					},
					preview: {
						...validData.locations[0].screenshots[0].preview,
						path: `/screenshots/location-2/${PREVIEW_HASH}-1000.webp`,
					},
				},
			],
		});

		expect(() => parsePublicationData(invalid)).toThrow(
			"Screenshot identifiers contain duplicates",
		);
	});

	it("allows screenshots to share an identical generated variant", () => {
		const shared = structuredClone(validData);
		const secondScreenshot = structuredClone(
			shared.locations[0].screenshots[0],
		);
		secondScreenshot.id = "screenshot-2";
		secondScreenshot.sortOrder = 1;
		secondScreenshot.sourceSha256 = "d".repeat(64);
		secondScreenshot.full.sha256 = "e".repeat(64);
		secondScreenshot.full.path = `/screenshots/location-1/${secondScreenshot.full.sha256}-1920.webp`;
		shared.locations[0].screenshots.push(secondScreenshot);

		expect(parsePublicationData(shared)).toEqual(shared);
	});

	it("rejects conflicting metadata for a shared variant path", () => {
		const conflicting = structuredClone(validData);
		const secondScreenshot = structuredClone(
			conflicting.locations[0].screenshots[0],
		);
		secondScreenshot.id = "screenshot-2";
		secondScreenshot.sortOrder = 1;
		secondScreenshot.sourceSha256 = "d".repeat(64);
		secondScreenshot.full.sha256 = "e".repeat(64);
		secondScreenshot.full.path = `/screenshots/location-1/${secondScreenshot.full.sha256}-1920.webp`;
		secondScreenshot.preview.width -= 1;
		conflicting.locations[0].screenshots.push(secondScreenshot);

		expect(() => parsePublicationData(conflicting)).toThrow(
			"Screenshot asset paths contain conflicting metadata",
		);
	});

	it("orders identifiers by code point instead of host locale", () => {
		const unordered = structuredClone(validData);
		const secondLocation = structuredClone(validData.locations[0]);
		const secondSourceHash = "d".repeat(64);
		secondLocation.id = "A-location";
		secondLocation.screenshots[0].id = "screenshot-2";
		secondLocation.screenshots[0].sourceSha256 = secondSourceHash;
		secondLocation.screenshots[0].full.path = `/screenshots/A-location/${FULL_HASH}-1920.webp`;
		secondLocation.screenshots[0].preview.path = `/screenshots/A-location/${PREVIEW_HASH}-1000.webp`;
		unordered.locations.push(secondLocation);

		const parsed = parsePublicationData(unordered);

		expect(parsed.locations.map(({ id }) => id)).toEqual([
			"A-location",
			"location-1",
		]);
	});

	it("rejects obsolete publication formats", () => {
		const obsolete = structuredClone(validData) as unknown as Record<
			string,
			unknown
		>;
		obsolete.formatVersion = 1;

		expect(() => parsePublicationData(obsolete)).toThrow(
			"Publication format version is unsupported",
		);
	});

	it("does not impose an arbitrary limit on required keys", () => {
		const data = structuredClone(validData);
		data.locations[0].requiredKeyIds = Array.from(
			{ length: 30 },
			(_, index) => `key-${index}`,
		);

		expect(
			parsePublicationData(data).locations[0]?.requiredKeyIds,
		).toHaveLength(30);
	});
});
