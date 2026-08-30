// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LocationImageInput } from "@/components/location-image/location-image-renderer";
import {
	createLocationSharePath,
	LocationShareControls,
} from "@/components/map/location-share-controls";

const clipboardWrite = vi.fn();
const clipboardWriteText = vi.fn();

class TestClipboardItem {
	data: Record<string, Promise<Blob>>;

	constructor(data: Record<string, Promise<Blob>>) {
		this.data = data;
	}
}

const imageInput: LocationImageInput = {
	documentName: "PMC personnel files",
	map: {
		height: 1_000,
		name: "Shoreline",
		path: "/map.webp",
		sources: [{ height: 1_000, path: "/map.webp", width: 1_000 }],
		viewKey: "resort",
		viewName: "Health Resort",
		width: 1_000,
	},
	location: {
		markerLabel: "8",
		name: "Southeastern Water Basin Tent",
		xBasisPoints: 5_000,
		yBasisPoints: 5_000,
	},
	requiredKeyNames: [],
	screenshot: { height: 1_080, path: "/screenshot.webp", width: 1_920 },
};

vi.mock("@/components/location-image/location-image-renderer", async () => {
	const actual = await vi.importActual<
		typeof import("@/components/location-image/location-image-renderer")
	>("@/components/location-image/location-image-renderer");
	return {
		...actual,
		canvasToPngBlob: vi.fn(
			async () => new Blob(["png"], { type: "image/png" }),
		),
		renderPublicLocationImage: vi.fn(async () => undefined),
	};
});

describe("location share controls", () => {
	afterEach(cleanup);

	beforeEach(() => {
		clipboardWrite.mockReset();
		clipboardWrite.mockResolvedValue(undefined);
		clipboardWriteText.mockReset();
		clipboardWriteText.mockResolvedValue(undefined);
		Object.defineProperty(window, "isSecureContext", {
			configurable: true,
			value: true,
		});
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { write: clipboardWrite, writeText: clipboardWriteText },
		});
		vi.stubGlobal("ClipboardItem", TestClipboardItem);
	});

	it("creates a clean canonical location path", () => {
		expect(
			createLocationSharePath({
				locationId: "b50dffad-5106-4e06-938b-8cb7e2906f38",
				mapId: "shoreline",
				viewKey: "resort",
			}),
		).toBe(
			"/maps/shoreline?location=b50dffad-5106-4e06-938b-8cb7e2906f38&view=resort",
		);
	});

	it("copies the canonical location URL directly", async () => {
		renderControls();
		fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

		await screen.findByRole("button", { name: "Link copied" });
		expect(clipboardWriteText).toHaveBeenCalledWith(
			"http://localhost:3000/maps/shoreline?location=b50dffad-5106-4e06-938b-8cb7e2906f38&view=resort",
		);
	});

	it("copies only the generated PNG representation", async () => {
		renderControls();
		fireEvent.click(screen.getByRole("button", { name: "Copy as image" }));

		await screen.findByRole("button", { name: "Image copied" });
		expect(clipboardWrite).toHaveBeenCalledOnce();
		const item = clipboardWrite.mock.calls[0]?.[0]?.[0] as TestClipboardItem;
		expect(Object.keys(item.data)).toEqual(["image/png"]);
		await expect(item.data["image/png"]).resolves.toMatchObject({
			type: "image/png",
		});
	});

	it("exposes clipboard failures without opening another surface", async () => {
		clipboardWriteText.mockRejectedValueOnce(new Error("Permission denied"));
		renderControls();
		fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

		await screen.findByRole("button", { name: "Copy failed" });
		await waitFor(() =>
			expect(screen.getByText("Permission denied")).toBeTruthy(),
		);
	});
});

function renderControls() {
	return render(
		<LocationShareControls
			imageInput={imageInput}
			locationId="b50dffad-5106-4e06-938b-8cb7e2906f38"
			mapId="shoreline"
			viewKey="resort"
		/>,
	);
}
