// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationDetailsPanel } from "./location-details-panel";

const screenshot = {
	altText: "Document on a desk",
	caption: "Second floor",
	height: 1080,
	id: "screenshot-1",
	path: "/screenshots/full.webp",
	previewHeight: 563,
	previewPath: "/screenshots/preview.webp",
	previewWidth: 1000,
	width: 1920,
};
const secondScreenshot = {
	...screenshot,
	altText: "Document beside a filing cabinet",
	caption: "Third floor",
	id: "screenshot-2",
	path: "/screenshots/second-full.webp",
	previewPath: "/screenshots/second-preview.webp",
};
const documentArtwork = {
	imageHeight: 559,
	imagePath: "/documents/financial.webp",
	imageWidth: 689,
};

beforeEach(() => setViewportWidth(1280));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("LocationDetailsPanel", () => {
	it("shows every required key with a safe external wiki link", () => {
		render(
			<LocationDetailsPanel
				location={{
					description: null,
					documentName: "Test document",
					name: "Locked room",
					requiredKeys: [
						{
							id: "factory-emergency-exit-key",
							imageHeight: 64,
							imagePath: "/keys/factory.webp",
							imageWidth: 64,
							name: "Factory emergency exit key",
							wikiUrl:
								"https://escapefromtarkov.fandom.com/wiki/Factory_emergency_exit_key",
						},
					],
				}}
				onClose={vi.fn()}
				screenshots={[screenshot]}
			/>,
		);

		const link = screen.getByRole("link", {
			name: "Factory emergency exit key",
		});
		expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		expect(link.getAttribute("target")).toBe("_blank");
	});

	it("shows decorative document artwork with intrinsic dimensions", () => {
		renderPanel();
		const image = document.querySelector<HTMLImageElement>(
			'img[src="/documents/financial.webp"]',
		);

		expect(image).not.toBeNull();
		expect(image?.alt).toBe("");
		expect(image?.width).toBe(689);
		expect(image?.height).toBe(559);
		expect(image?.getAttribute("loading")).toBe("lazy");
		expect(image?.getAttribute("decoding")).toBe("async");
	});

	it("keeps the desktop map interactive while details are open", () => {
		const onClose = vi.fn();
		const onSelectLocation = vi.fn();

		render(
			<>
				<button type="button" onClick={onSelectLocation}>
					Select another location
				</button>
				<LocationDetailsPanel
					location={{
						description: "Near the stairs",
						documentName: "Test document",
						name: "Sawmill",
						requiredKeys: [],
					}}
					onClose={onClose}
					screenshots={[screenshot]}
				/>
			</>,
		);

		expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Select another location" }),
		);

		expect(onSelectLocation).toHaveBeenCalledOnce();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes the mobile location sheet from its backdrop", async () => {
		setViewportWidth(800);
		const onClose = vi.fn();
		renderPanel(onClose);
		await waitFor(() =>
			expect(
				document.querySelector('[data-slot="sheet-overlay"]'),
			).not.toBeNull(),
		);
		const backdrop = document.querySelector<HTMLElement>(
			'[data-slot="sheet-overlay"]',
		);
		expect(backdrop).not.toBeNull();

		fireEvent.pointerDown(backdrop as HTMLElement);
		fireEvent.pointerUp(backdrop as HTMLElement);
		fireEvent.click(backdrop as HTMLElement);

		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it("opens in place and closes with its close button", async () => {
		const onScreenshotOpen = vi.fn();
		renderPanel(vi.fn(), onScreenshotOpen);
		fireEvent.click(
			screen.getByRole("button", {
				name: "View Document on a desk screenshot",
			}),
		);
		expect(onScreenshotOpen).toHaveBeenCalledOnce();
		expect(onScreenshotOpen).toHaveBeenCalledWith(0);

		expect(
			screen.getByRole("dialog", { name: screenshot.altText }),
		).toBeTruthy();
		expect(
			screen.getByRole("img", { name: screenshot.altText }),
		).toHaveProperty("src", expect.stringContaining(screenshot.path));

		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshot.altText }),
			).toBeNull(),
		);
	});

	it("navigates full-size screenshots with A, D, and arrow keys", () => {
		const onScreenshotOpen = vi.fn();
		renderPanel(vi.fn(), onScreenshotOpen, [screenshot, secondScreenshot]);
		fireEvent.click(
			screen.getByRole("button", {
				name: `View ${screenshot.altText} screenshot`,
			}),
		);

		const dialog = screen.getByRole("dialog", { name: screenshot.altText });
		fireEvent.keyDown(dialog, { key: "D" });
		expect(
			screen.getByRole("img", { name: secondScreenshot.altText }),
		).toHaveProperty("src", expect.stringContaining(secondScreenshot.path));

		fireEvent.keyDown(dialog, { key: "ArrowLeft" });
		expect(
			screen.getByRole("img", { name: screenshot.altText }),
		).toHaveProperty("src", expect.stringContaining(screenshot.path));

		fireEvent.keyDown(dialog, { key: "ArrowRight" });
		expect(
			screen.getByRole("img", { name: secondScreenshot.altText }),
		).toBeTruthy();
		fireEvent.keyDown(dialog, { key: "A" });
		expect(screen.getByRole("img", { name: screenshot.altText })).toBeTruthy();

		fireEvent.keyDown(dialog, { key: "ArrowLeft" });
		expect(onScreenshotOpen).toHaveBeenCalledTimes(5);

		fireEvent.keyDown(dialog, { ctrlKey: true, key: "d" });
		expect(screen.getByRole("img", { name: screenshot.altText })).toBeTruthy();
		expect(onScreenshotOpen.mock.calls).toEqual([[0], [1], [0], [1], [0]]);
	});

	it("navigates full-size screenshots with horizontal touch swipes", () => {
		setViewportWidth(800);
		const onScreenshotOpen = vi.fn();
		renderPanel(vi.fn(), onScreenshotOpen, [screenshot, secondScreenshot]);
		fireEvent.click(
			screen.getByRole("button", {
				name: `View ${screenshot.altText} screenshot`,
			}),
		);

		const surface = document.querySelector<HTMLElement>(
			'[data-slot="screenshot-swipe-surface"]',
		);
		expect(surface).not.toBeNull();
		swipe(surface as HTMLElement, 240, 80, 1);
		expect(
			screen.getByRole("dialog", { name: secondScreenshot.altText }),
		).toBeTruthy();

		swipe(surface as HTMLElement, 80, 240, 2);
		expect(
			screen.getByRole("dialog", { name: screenshot.altText }),
		).toBeTruthy();
		swipe(surface as HTMLElement, 240, 80, 3, "mouse");
		expect(
			screen.getByRole("dialog", { name: screenshot.altText }),
		).toBeTruthy();
		expect(onScreenshotOpen.mock.calls).toEqual([[0], [1], [0]]);
	});

	it("closes from the backdrop without closing the location panel", async () => {
		const onClose = vi.fn();
		renderPanel(onClose);
		fireEvent.click(
			screen.getByRole("button", {
				name: "View Document on a desk screenshot",
			}),
		);

		const backdrop = document.querySelector<HTMLElement>(
			'[data-slot="dialog-overlay"]',
		);
		expect(backdrop).not.toBeNull();
		fireEvent.pointerDown(backdrop as HTMLElement);
		fireEvent.pointerUp(backdrop as HTMLElement);
		fireEvent.click(backdrop as HTMLElement);

		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshot.altText }),
			).toBeNull(),
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes with Escape without closing the location panel", async () => {
		const onClose = vi.fn();
		renderPanel(onClose);
		fireEvent.click(
			screen.getByRole("button", {
				name: "View Document on a desk screenshot",
			}),
		);

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshot.altText }),
			).toBeNull(),
		);
		expect(onClose).not.toHaveBeenCalled();
	});
});

function renderPanel(
	onClose = vi.fn(),
	onScreenshotOpen = vi.fn(),
	screenshots = [screenshot],
) {
	return render(
		<LocationDetailsPanel
			documentArtwork={documentArtwork}
			location={{
				description: "Near the stairs",
				documentName: "Test document",
				name: "Sawmill",
				requiredKeys: [],
			}}
			onClose={onClose}
			onScreenshotOpen={onScreenshotOpen}
			screenshots={screenshots}
		/>,
	);
}

function setViewportWidth(width: number) {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: width,
	});
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			addEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			matches: width < 1024,
			media: query,
			onchange: null,
			removeEventListener: vi.fn(),
		})),
	});
}

function swipe(
	element: HTMLElement,
	startX: number,
	endX: number,
	pointerId: number,
	pointerType = "touch",
) {
	const pointer = { isPrimary: true, pointerId, pointerType };
	fireEvent.pointerDown(element, { ...pointer, clientX: startX, clientY: 100 });
	fireEvent.pointerMove(element, { ...pointer, clientX: endX, clientY: 104 });
	fireEvent.pointerUp(element, { ...pointer, clientX: endX, clientY: 104 });
}
