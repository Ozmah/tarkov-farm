import { describe, expect, it } from "vitest";

import type { LocationContributionBundle } from "./location-contribution";
import {
	type LocationContributionCatalog,
	validateLocationContributionCatalog,
} from "./location-contribution-catalog";

describe("location contribution catalog", () => {
	it("warns only for nearby coordinates, regardless of location names", () => {
		const bundle: LocationContributionBundle = {
			bundleId: "00000000-0000-4000-8000-000000000001",
			formatVersion: 1,
			locations: [
				{
					description: null,
					documentId: "technical",
					id: "00000000-0000-4000-8000-000000000002",
					mapImageId: "reserve-main",
					mapImageSha256: "a".repeat(64),
					name: "White Pawn",
					requiredKeyIds: [],
					screenshots: [],
					xBasisPoints: 3_193,
					yBasisPoints: 1_527,
				},
			],
			operation: "add-locations",
		};
		const catalog: LocationContributionCatalog = {
			documentMaps: [{ documentId: "technical", mapId: "reserve" }],
			documents: [{ id: "technical", name: "Technical manual" }],
			keyMaps: [],
			keys: [],
			locations: [
				{
					id: "same-name-far-away",
					mapImageId: "reserve-main",
					name: "White Pawn",
					xBasisPoints: 8_000,
					yBasisPoints: 8_000,
				},
				{
					id: "different-name-nearby",
					mapImageId: "reserve-main",
					name: "Underground warehouse",
					xBasisPoints: 3_220,
					yBasisPoints: 1_550,
				},
			],
			mapImages: [
				{
					id: "reserve-main",
					mapId: "reserve",
					name: "Main",
					sha256: "a".repeat(64),
				},
			],
			maps: [{ id: "reserve", name: "Reserve" }],
		};

		expect(validateLocationContributionCatalog(bundle, catalog)).toEqual([
			{
				locationId: "00000000-0000-4000-8000-000000000002",
				possibleDuplicateIds: ["different-name-nearby"],
			},
		]);
	});
});
