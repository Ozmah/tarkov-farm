import { describe, expect, it } from "vitest";

import type { ReviewedContributionLocation } from "./location-contribution-archive-reader";
import {
	createContributionLocationImportFormData,
	createContributionLocationReviewDraft,
	getContributionLocationChangeCount,
	restoreContributionLocationReviewDraft,
} from "./location-contribution-review";

describe("location contribution review drafts", () => {
	it("keeps the ZIP source immutable and restores all content changes", () => {
		const original = createLocation();
		const draft = createContributionLocationReviewDraft(original);
		const changed = {
			...draft,
			included: true,
			screenshots: [
				{
					...draft.screenshots[0],
					included: false,
					replacement: {
						file: new File(["replacement"], "replacement.png", {
							type: "image/png",
						}),
						sourceSha256: "b".repeat(64),
					},
				},
			],
			values: { ...draft.values, name: "Corrected name", xBasisPoints: 42 },
		};

		expect(getContributionLocationChangeCount(changed, original)).toBe(3);
		expect(restoreContributionLocationReviewDraft(changed, original)).toEqual({
			...draft,
			included: true,
		});
		expect(original.name).toBe("Original name");
		expect(original.screenshots[0]?.file.name).toBe("original.png");
	});

	it("imports only included screenshots and preserves hidden source metadata", () => {
		const original = createLocation();
		const replacement = new File(["replacement"], "replacement.webp", {
			type: "image/webp",
		});
		const initial = createContributionLocationReviewDraft(original);
		const draft = {
			...initial,
			included: true,
			screenshots: [
				{
					...initial.screenshots[0],
					replacement: {
						file: replacement,
						sourceSha256: "c".repeat(64),
					},
				},
				{ ...initial.screenshots[1], included: false },
			],
			values: { ...initial.values, name: "Corrected name" },
		};
		const formData = createContributionLocationImportFormData(
			draft,
			original,
			catalog,
		);
		const payload = JSON.parse(String(formData.get("payload")));

		expect(formData.get("mapImageSha256")).toBe("f".repeat(64));
		expect(formData.getAll("screenshots")).toEqual([replacement]);
		expect(payload.location.name).toBe("Corrected name");
		expect(payload.screenshots).toEqual([
			{
				altText: "Hidden source alt",
				caption: "Source caption",
				uploadIndex: 0,
			},
		]);
	});

	it("rejects selected locations with no screenshots or duplicate effective files", () => {
		const original = createLocation();
		const initial = createContributionLocationReviewDraft(original);

		expect(() =>
			createContributionLocationImportFormData(
				{
					...initial,
					included: true,
					screenshots: initial.screenshots.map((item) => ({
						...item,
						included: false,
					})),
				},
				original,
				catalog,
			),
		).toThrow("requires at least one screenshot");

		expect(() =>
			createContributionLocationImportFormData(
				{
					...initial,
					included: true,
					screenshots: initial.screenshots.map((item) => ({
						...item,
						replacement: {
							file: new File(["same"], "same.png", { type: "image/png" }),
							sourceSha256: "d".repeat(64),
						},
					})),
				},
				original,
				catalog,
			),
		).toThrow("contains duplicate screenshots");
	});

	it("does not import while a replacement file is still being verified", () => {
		const original = createLocation();
		const initial = createContributionLocationReviewDraft(original);

		expect(() =>
			createContributionLocationImportFormData(
				{
					...initial,
					included: true,
					screenshots: initial.screenshots.map((screenshot, index) =>
						index === 0
							? { ...screenshot, isCheckingReplacement: true }
							: screenshot,
					),
				},
				original,
				catalog,
			),
		).toThrow("still checking a replacement screenshot");
	});
});

const catalog = {
	documentMaps: [{ documentId: "technical", mapId: "reserve" }],
	documents: [{ id: "technical", name: "Technical" }],
	keyMaps: [{ keyId: "reserve-key", mapId: "reserve" }],
	keys: [{ id: "reserve-key", name: "Reserve key" }],
	mapImages: [
		{
			contentHash: "f".repeat(64),
			id: "reserve-main",
			mapId: "reserve",
			name: "Main",
		},
	],
	maps: [{ id: "reserve", name: "Reserve" }],
};

function createLocation(): ReviewedContributionLocation {
	return {
		description: "Original description",
		documentId: "technical",
		id: "00000000-0000-4000-8000-000000000002",
		mapImageId: "reserve-main",
		mapImageSha256: "a".repeat(64),
		name: "Original name",
		requiredKeyIds: ["reserve-key"],
		screenshots: [
			{
				altText: "Hidden source alt",
				byteLength: 8,
				caption: "Source caption",
				entry:
					"locations/00000000-0000-4000-8000-000000000002/screenshots/00000000-0000-4000-8000-000000000003.png",
				file: new File(["original"], "original.png", { type: "image/png" }),
				id: "00000000-0000-4000-8000-000000000003",
				mediaType: "image/png",
				sourceSha256: "a".repeat(64),
			},
			{
				altText: "Second hidden alt",
				byteLength: 6,
				caption: null,
				entry:
					"locations/00000000-0000-4000-8000-000000000002/screenshots/00000000-0000-4000-8000-000000000004.png",
				file: new File(["second"], "second.png", { type: "image/png" }),
				id: "00000000-0000-4000-8000-000000000004",
				mediaType: "image/png",
				sourceSha256: "b".repeat(64),
			},
		],
		xBasisPoints: 3_193,
		yBasisPoints: 1_527,
	};
}
