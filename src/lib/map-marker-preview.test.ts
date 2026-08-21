import { describe, expect, it } from "vitest";

import { indexFirstScreenshotPreviews } from "./map-marker-preview";

describe("indexFirstScreenshotPreviews", () => {
	it("indexes the first screenshot by sort order for each location", () => {
		const previews = indexFirstScreenshotPreviews([
			{
				altText: "Second office angle",
				id: "office-b",
				locationId: "office",
				previewHeight: 600,
				previewPath: "/screenshots/office-second.webp",
				previewWidth: 1_000,
				sortOrder: 2,
			},
			{
				altText: "Office book pile",
				id: "office-a",
				locationId: "office",
				previewHeight: 500,
				previewPath: "/screenshots/office-first.webp",
				previewWidth: 900,
				sortOrder: 1,
			},
			{
				altText: "Gate interior",
				id: "gate-a",
				locationId: "gate",
				previewHeight: 700,
				previewPath: "/screenshots/gate.webp",
				previewWidth: 1_000,
				sortOrder: 1,
			},
		]);

		expect(previews.get("office")).toEqual({
			altText: "Office book pile",
			height: 500,
			path: "/screenshots/office-first.webp",
			width: 900,
		});
		expect(previews.get("gate")?.path).toBe("/screenshots/gate.webp");
	});

	it("uses the screenshot id to break equal sort-order ties", () => {
		const previews = indexFirstScreenshotPreviews([
			{
				altText: "Later id",
				id: "screen-z",
				locationId: "office",
				previewHeight: 600,
				previewPath: "/screenshots/later-id.webp",
				previewWidth: 1_000,
				sortOrder: 0,
			},
			{
				altText: "Earlier id",
				id: "screen-a",
				locationId: "office",
				previewHeight: 600,
				previewPath: "/screenshots/earlier-id.webp",
				previewWidth: 1_000,
				sortOrder: 0,
			},
		]);

		expect(previews.get("office")?.path).toBe("/screenshots/earlier-id.webp");
	});
});
