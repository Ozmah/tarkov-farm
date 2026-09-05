// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationScreenshotDialog } from "./location-screenshot-dialog";

const screenshots = [
	{
		altText: "Previous screenshot",
		caption: null,
		height: 1080,
		id: "previous",
		path: "/screenshots/previous-full.webp",
		previewHeight: 563,
		previewPath: "/screenshots/previous-preview.webp",
		previewWidth: 1000,
		width: 1920,
	},
	{
		altText: "Current screenshot",
		caption: null,
		height: 1080,
		id: "current",
		path: "/screenshots/current-full.webp",
		previewHeight: 563,
		previewPath: "/screenshots/current-preview.webp",
		previewWidth: 1000,
		width: 1920,
	},
	{
		altText: "Next screenshot",
		caption: null,
		height: 1080,
		id: "next",
		path: "/screenshots/next-full.webp",
		previewHeight: 563,
		previewPath: "/screenshots/next-preview.webp",
		previewWidth: 1000,
		width: 1920,
	},
];

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("LocationScreenshotDialog", () => {
	it("preloads adjacent full-size images only while open", async () => {
		const preloadedPaths: string[] = [];
		vi.stubGlobal(
			"Image",
			class {
				set src(path: string) {
					preloadedPaths.push(path);
				}
			},
		);
		const commonProps = {
			locationDescription: null,
			locationName: "Test location",
			nextScreenshot: screenshots[2],
			onOpenChange: vi.fn(),
			previousScreenshot: screenshots[0],
		};
		const { rerender } = render(
			<LocationScreenshotDialog {...commonProps} screenshot={undefined} />,
		);

		expect(preloadedPaths).toEqual([]);

		rerender(
			<LocationScreenshotDialog {...commonProps} screenshot={screenshots[1]} />,
		);

		await waitFor(() =>
			expect(preloadedPaths).toEqual([
				screenshots[0].path,
				screenshots[2].path,
			]),
		);
	});
});
