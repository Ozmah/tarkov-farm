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
						path: `/screenshots/location-1/${SOURCE_HASH}-1920.webp`,
						sha256: FULL_HASH,
						width: 1_920,
					},
					id: "screenshot-1",
					isActive: true,
					preview: {
						height: 563,
						path: `/screenshots/location-1/${SOURCE_HASH}-1000.webp`,
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
						path: `/screenshots/location-2/${SOURCE_HASH}-1920.webp`,
					},
					preview: {
						...validData.locations[0].screenshots[0].preview,
						path: `/screenshots/location-2/${SOURCE_HASH}-1000.webp`,
					},
				},
			],
		});

		expect(() => parsePublicationData(invalid)).toThrow(
			"Screenshot identifiers contain duplicates",
		);
	});

	it("orders identifiers by code point instead of host locale", () => {
		const unordered = structuredClone(validData);
		const secondLocation = structuredClone(validData.locations[0]);
		const secondSourceHash = "d".repeat(64);
		secondLocation.id = "A-location";
		secondLocation.screenshots[0].id = "screenshot-2";
		secondLocation.screenshots[0].sourceSha256 = secondSourceHash;
		secondLocation.screenshots[0].full.path = `/screenshots/A-location/${secondSourceHash}-1920.webp`;
		secondLocation.screenshots[0].preview.path = `/screenshots/A-location/${secondSourceHash}-1000.webp`;
		unordered.locations.push(secondLocation);

		const parsed = parsePublicationData(unordered);

		expect(parsed.locations.map(({ id }) => id)).toEqual([
			"A-location",
			"location-1",
		]);
	});
});
