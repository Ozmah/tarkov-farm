import { describe, expect, it } from "vitest";

import {
	CONTRIBUTION_BUNDLE_WARNING_BYTES,
	getLocationContributionBundleBytes,
	type LocationContributionBundle,
	MAX_CONTRIBUTION_BUNDLE_BYTES,
	MAX_CONTRIBUTION_LOCATIONS,
	MAX_CONTRIBUTION_SCREENSHOT_BYTES,
	parseLocationContributionBundle,
	serializeLocationContributionBundle,
	shouldWarnAboutLocationContributionBundleSize,
} from "./location-contribution";

const BUNDLE_ID = "00000000-0000-4000-8000-000000000001";
const LOCATION_ID = "00000000-0000-4000-8000-000000000002";
const SCREENSHOT_ID = "00000000-0000-4000-8000-000000000003";
const SHA256 = "a".repeat(64);

const validBundle: LocationContributionBundle = {
	bundleId: BUNDLE_ID,
	formatVersion: 1,
	locations: [
		{
			description: "On the desk beside the filing cabinet",
			documentId: "technical",
			id: LOCATION_ID,
			mapImageId: "reserve-main",
			mapImageSha256: SHA256,
			name: "White Pawn",
			requiredKeyIds: ["rb-orb1-key"],
			screenshots: [
				{
					altText: "",
					byteLength: 4_000_000,
					caption: null,
					entry: `locations/${LOCATION_ID}/screenshots/${SCREENSHOT_ID}.png`,
					id: SCREENSHOT_ID,
					mediaType: "image/png",
					sourceSha256: SHA256,
				},
			],
			xBasisPoints: 3_193,
			yBasisPoints: 1_527,
		},
	],
	operation: "add-locations",
};

describe("location contribution bundle", () => {
	it("parses and serializes add-only bundles deterministically", () => {
		const first = serializeLocationContributionBundle(validBundle);
		const second = serializeLocationContributionBundle(JSON.parse(first));

		expect(second).toBe(first);
		expect(parseLocationContributionBundle(JSON.parse(first))).toEqual(
			validBundle,
		);
	});

	it("supports multiple locations while preserving their order", () => {
		const secondLocation = structuredClone(validBundle.locations[0]);
		secondLocation.id = "00000000-0000-4000-8000-000000000004";
		secondLocation.screenshots[0].id = "00000000-0000-4000-8000-000000000005";
		secondLocation.screenshots[0].entry = `locations/${secondLocation.id}/screenshots/${secondLocation.screenshots[0].id}.png`;
		const input = structuredClone(validBundle);
		input.locations.push(secondLocation);

		expect(
			parseLocationContributionBundle(input).locations.map(({ id }) => id),
		).toEqual([LOCATION_ID, secondLocation.id]);
	});

	it("rejects administrative and publication fields", () => {
		const input = structuredClone(validBundle) as unknown as {
			locations: Array<Record<string, unknown>>;
		};
		input.locations[0].isActive = true;

		expect(() => parseLocationContributionBundle(input)).toThrow(
			"Contribution location contains unexpected field isActive",
		);
	});

	it("rejects entries that are not derived from their location and screenshot", () => {
		const input = structuredClone(validBundle);
		input.locations[0].screenshots[0].entry = "../../private.png";

		expect(() => parseLocationContributionBundle(input)).toThrow(
			"Contribution screenshot entry must be",
		);
	});

	it("rejects duplicate identifiers across the entire bundle", () => {
		const secondLocation = structuredClone(validBundle.locations[0]);
		secondLocation.id = "00000000-0000-4000-8000-000000000004";
		secondLocation.screenshots[0].entry = `locations/${secondLocation.id}/screenshots/${SCREENSHOT_ID}.png`;
		const input = structuredClone(validBundle);
		input.locations.push(secondLocation);

		expect(() => parseLocationContributionBundle(input)).toThrow(
			"Contribution screenshot identifiers contain duplicates",
		);
	});

	it("rejects duplicate screenshot contents within one location", () => {
		const input = structuredClone(validBundle);
		const duplicate = structuredClone(input.locations[0].screenshots[0]);
		duplicate.id = "00000000-0000-4000-8000-000000000006";
		duplicate.entry = `locations/${LOCATION_ID}/screenshots/${duplicate.id}.png`;
		input.locations[0].screenshots.push(duplicate);

		expect(() => parseLocationContributionBundle(input)).toThrow(
			"screenshot source hashes contain duplicates",
		);
	});

	it("enforces the location count limit", () => {
		const input = structuredClone(validBundle);
		input.locations = Array.from(
			{ length: MAX_CONTRIBUTION_LOCATIONS + 1 },
			() => structuredClone(validBundle.locations[0]),
		);

		expect(() => parseLocationContributionBundle(input)).toThrow(
			`between 1 and ${MAX_CONTRIBUTION_LOCATIONS} locations`,
		);
	});

	it("enforces per-file and total screenshot byte limits", () => {
		const oversizedFile = structuredClone(validBundle);
		oversizedFile.locations[0].screenshots[0].byteLength =
			MAX_CONTRIBUTION_SCREENSHOT_BYTES + 1;

		expect(() => parseLocationContributionBundle(oversizedFile)).toThrow(
			"Contribution screenshot byte length is outside its allowed range",
		);

		const oversizedBundle = createBundleWithScreenshotBytes([
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			1,
		]);

		expect(() => parseLocationContributionBundle(oversizedBundle)).toThrow(
			`cannot exceed ${MAX_CONTRIBUTION_BUNDLE_BYTES} bytes`,
		);
	});

	it("reports bundle bytes and the warning threshold", () => {
		const belowWarning = createBundleWithScreenshotBytes([
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			CONTRIBUTION_BUNDLE_WARNING_BYTES -
				3 * MAX_CONTRIBUTION_SCREENSHOT_BYTES -
				1,
		]);
		const atWarning = createBundleWithScreenshotBytes([
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			MAX_CONTRIBUTION_SCREENSHOT_BYTES,
			CONTRIBUTION_BUNDLE_WARNING_BYTES - 3 * MAX_CONTRIBUTION_SCREENSHOT_BYTES,
		]);

		expect(getLocationContributionBundleBytes(belowWarning)).toBe(
			CONTRIBUTION_BUNDLE_WARNING_BYTES - 1,
		);
		expect(shouldWarnAboutLocationContributionBundleSize(belowWarning)).toBe(
			false,
		);
		expect(shouldWarnAboutLocationContributionBundleSize(atWarning)).toBe(true);
	});
});

function createBundleWithScreenshotBytes(byteLengths: number[]) {
	const bundle = structuredClone(validBundle);
	bundle.locations[0].screenshots = byteLengths.map((byteLength, index) => {
		const id = `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`;

		return {
			...structuredClone(validBundle.locations[0].screenshots[0]),
			byteLength,
			entry: `locations/${LOCATION_ID}/screenshots/${id}.png`,
			id,
			sourceSha256: (index + 1).toString(16).padStart(64, "0"),
		};
	});
	return bundle;
}
