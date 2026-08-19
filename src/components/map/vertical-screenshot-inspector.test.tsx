// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerticalScreenshotInspector } from "./vertical-screenshot-inspector";

const location = {
	description: "Near the stairs",
	documentName: "Financial records",
	name: "Sawmill office",
	requiredKeys: [],
};
const screenshots = [
	{
		altText: "Document on the first desk",
		caption: "Enter through the east door",
		height: 1080,
		id: "one",
		path: "/screenshots/one-full.webp",
		previewHeight: 563,
		previewPath: "/screenshots/one-preview.webp",
		previewWidth: 1000,
		width: 1920,
	},
	{
		altText: "Document beside the filing cabinet",
		caption: "Look beside the blue cabinet",
		height: 1080,
		id: "two",
		path: "/screenshots/two-full.webp",
		previewHeight: 563,
		previewPath: "/screenshots/two-preview.webp",
		previewWidth: 1000,
		width: 1920,
	},
];

afterEach(cleanup);

describe("VerticalScreenshotInspector", () => {
	it("navigates location screenshots without covering the map in a dialog", () => {
		renderInspector();

		expect(screen.getByText("Screenshot 1 of 2")).toBeTruthy();
		expect(
			screen.getByRole("img", { name: screenshots[0].altText }),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Next screenshot" }));
		expect(screen.getByText("Screenshot 2 of 2")).toBeTruthy();
		expect(
			screen.getByRole("img", { name: screenshots[1].altText }),
		).toBeTruthy();
	});

	it("collapses to its contextual header and expands again", async () => {
		renderInspector();
		fireEvent.click(
			screen.getByRole("button", { name: "Collapse screenshots" }),
		);

		await waitFor(() =>
			expect(
				screen.queryByRole("img", { name: screenshots[0].altText }),
			).toBeNull(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Expand screenshots" }));
		expect(
			screen.getByRole("img", { name: screenshots[0].altText }),
		).toBeTruthy();
	});

	it("opens the existing fullscreen viewer without closing the location", async () => {
		const onClose = vi.fn();
		const onScreenshotOpen = vi.fn();
		renderInspector(onClose, onScreenshotOpen);
		fireEvent.click(
			screen.getByRole("button", {
				name: `View ${screenshots[0].altText} screenshot full size`,
			}),
		);

		expect(onScreenshotOpen).toHaveBeenCalledWith(0);
		expect(
			screen.getByRole("dialog", { name: screenshots[0].altText }),
		).toBeTruthy();
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshots[0].altText }),
			).toBeNull(),
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes the selected location from its own control", () => {
		const onClose = vi.fn();
		renderInspector(onClose);
		fireEvent.click(
			screen.getByRole("button", { name: "Close location screenshots" }),
		);
		expect(onClose).toHaveBeenCalledOnce();
	});
});

function renderInspector(onClose = vi.fn(), onScreenshotOpen = vi.fn()) {
	return render(
		<VerticalScreenshotInspector
			location={location}
			onClose={onClose}
			onScreenshotOpen={onScreenshotOpen}
			screenshots={screenshots}
		/>,
	);
}
