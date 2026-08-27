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

		expect(screen.getByText("1 of 2")).toBeTruthy();
		expect(
			screen.getByRole("img", { name: screenshots[0].altText }),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Next screenshot" }));
		expect(screen.getByText("2 of 2")).toBeTruthy();
		expect(
			screen.getByRole("img", { name: screenshots[1].altText }),
		).toBeTruthy();
	});

	it("navigates globally with A, D, and arrow keys before the map handles them", () => {
		const onMapKeyDown = vi.fn();
		renderInspector(vi.fn(), vi.fn(), onMapKeyDown);
		const mapMarker = screen.getByRole("button", { name: "Map marker" });
		mapMarker.focus();

		fireEvent.keyDown(mapMarker, { key: "d" });
		expect(screen.getByText("2 of 2")).toBeTruthy();
		fireEvent.keyDown(mapMarker, { key: "ArrowLeft" });
		expect(screen.getByText("1 of 2")).toBeTruthy();
		fireEvent.keyDown(mapMarker, { key: "ArrowRight" });
		expect(screen.getByText("2 of 2")).toBeTruthy();
		fireEvent.keyDown(mapMarker, { key: "A" });
		expect(screen.getByText("1 of 2")).toBeTruthy();
		expect(document.activeElement).toBe(mapMarker);
		expect(onMapKeyDown).not.toHaveBeenCalled();
	});

	it("does not intercept screenshot shortcuts from editable controls", () => {
		renderInspector();
		const input = screen.getByRole("textbox", { name: "Map search" });

		fireEvent.keyDown(input, { key: "d" });

		expect(screen.getByText("1 of 2")).toBeTruthy();
	});

	it("leaves application shortcuts alone when only one screenshot exists", () => {
		const onMapKeyDown = vi.fn();
		renderInspector(vi.fn(), vi.fn(), onMapKeyDown, [screenshots[0]]);
		const mapMarker = screen.getByRole("button", { name: "Map marker" });

		fireEvent.keyDown(mapMarker, { key: "d" });

		expect(screen.getByText("1 of 1")).toBeTruthy();
		expect(onMapKeyDown).toHaveBeenCalledOnce();
	});

	it("stays open until the location is closed", () => {
		renderInspector();

		expect(
			screen.getByRole("img", { name: screenshots[0].altText }),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Collapse screenshots" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Open full-size screenshot" }),
		).toBeNull();
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
		const dialog = screen.getByRole("dialog", {
			name: screenshots[0].altText,
		});
		fireEvent.keyDown(dialog, { key: "d" });
		expect(
			screen.getByRole("dialog", { name: screenshots[1].altText }),
		).toBeTruthy();
		expect(onScreenshotOpen.mock.calls).toEqual([[0], [1]]);
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshots[1].altText }),
			).toBeNull(),
		);
		expect(screen.getByText("2 of 2")).toBeTruthy();
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

function renderInspector(
	onClose = vi.fn(),
	onScreenshotOpen = vi.fn(),
	onMapKeyDown = vi.fn(),
	inspectorScreenshots = screenshots,
) {
	return render(
		<>
			<button type="button" onKeyDown={onMapKeyDown}>
				Map marker
			</button>
			<label>
				Map search
				<input />
			</label>
			<VerticalScreenshotInspector
				location={location}
				onClose={onClose}
				onScreenshotOpen={onScreenshotOpen}
				screenshots={inspectorScreenshots}
			/>
		</>,
	);
}
