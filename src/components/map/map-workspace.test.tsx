// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapWorkspace } from "./map-workspace";

type MapWorkspaceProps = ComponentProps<typeof MapWorkspace>;

const DEFAULT_IMAGE = {
	altText: "Customs map",
	height: 1_000,
	path: "/maps/customs.webp",
	sources: [
		{ height: 500, path: "/maps/customs-500w.webp", width: 500 },
		{ height: 1_000, path: "/maps/customs.webp", width: 1_000 },
	],
	width: 1_000,
};

let nextAnimationFrameId: number;
let animationFrames: Map<number, FrameRequestCallback>;
let resizeObservers: ResizeObserverMock[];

class ResizeObserverMock {
	readonly callback: ResizeObserverCallback;
	disconnect = vi.fn();
	observe = vi.fn();
	unobserve = vi.fn();

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
		resizeObservers.push(this);
	}

	emit(width: number, height: number) {
		this.callback(
			[
				{
					contentRect: { height, width },
				} as ResizeObserverEntry,
			],
			this as unknown as ResizeObserver,
		);
	}
}

beforeEach(() => {
	nextAnimationFrameId = 1;
	animationFrames = new Map();
	resizeObservers = [];

	vi.stubGlobal("ResizeObserver", ResizeObserverMock);
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((callback: FrameRequestCallback) => {
			const frameId = nextAnimationFrameId++;
			animationFrames.set(frameId, callback);
			return frameId;
		}),
	);
	vi.stubGlobal(
		"cancelAnimationFrame",
		vi.fn((frameId: number) => {
			animationFrames.delete(frameId);
		}),
	);
	vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
		false,
	);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("MapWorkspace", () => {
	it("uses flex sizing when the workspace height comes from min-height", () => {
		renderWorkspace();
		const viewport = screen.getByRole("application", { name: "Test map" });
		const viewportFrame = viewport.parentElement;

		expect(viewport.classList.contains("flex-1")).toBe(true);
		expect(viewportFrame?.classList.contains("flex")).toBe(true);
		expect(viewportFrame?.classList.contains("flex-col")).toBe(true);
	});

	it("selects responsive sources from the rendered map width", () => {
		renderWorkspace();
		const image = screen.getByAltText("Customs map");

		expect(image.getAttribute("src")).toBeNull();
		expect(image.getAttribute("srcset")).toBe(
			"/maps/customs-500w.webp 500w, /maps/customs.webp 1000w",
		);
		expect(image.getAttribute("sizes")).toBe("100vw");

		prepareViewport();
		expect(image.getAttribute("sizes")).toBe("100vw");
	});

	it("keeps the current source visible until a sharper source is decoded", async () => {
		let resolveDecode: () => void = () => {};
		let preloadedPath: string | undefined;
		vi.spyOn(HTMLImageElement.prototype, "currentSrc", "get").mockReturnValue(
			"http://localhost/maps/customs-500w.webp",
		);
		vi.stubGlobal(
			"Image",
			class {
				decoding = "auto";
				onerror: (() => void) | null = null;
				onload: (() => void) | null = null;

				decode() {
					return new Promise<void>((resolve) => {
						resolveDecode = resolve;
					});
				}

				set src(path: string) {
					preloadedPath = path;
					queueMicrotask(() => this.onload?.());
				}
			},
		);
		renderWorkspace();
		prepareReadyViewport();
		const image = screen.getByAltText("Customs map");

		expect(image.getAttribute("src")).toBe("/maps/customs-500w.webp");
		expect(image.getAttribute("srcset")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
		flushAnimationFrames();
		await vi.waitFor(() => expect(preloadedPath).toBe("/maps/customs.webp"));
		expect(image.getAttribute("src")).toBe("/maps/customs-500w.webp");

		resolveDecode();
		await vi.waitFor(() =>
			expect(image.getAttribute("src")).toBe("/maps/customs.webp"),
		);
	});

	it("renders a static map before hydration and reveals markers after loading", () => {
		renderWorkspace({
			markers: [
				{
					id: "big-red",
					label: "1",
					name: "Big Red office",
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				},
			],
			onSelectMarker: vi.fn(),
		});
		const image = screen.getByRole("img", { name: "Customs map" });

		expect(image.classList.contains("object-contain")).toBe(true);
		expect(image.parentElement?.style.transform).toBe("");
		expect(
			screen.queryByRole("button", { name: "Open Big Red office" }),
		).toBeNull();

		const viewport = prepareViewport();
		expect(image.parentElement?.style.transform).toBe(
			"translate3d(250px, 0px, 0) scale(0.5)",
		);

		fireEvent.load(image);

		expect(viewport.getAttribute("aria-busy")).toBe("false");
		expect(
			screen.getByRole("button", { name: "Open Big Red office" }),
		).toBeTruthy();
		expect(viewport.getAttribute("aria-describedby")).toBeTruthy();
	});

	it("zooms only over the image and preserves the zoom ratio after resize", () => {
		renderWorkspace();
		const viewport = prepareReadyViewport();
		const outsideWheel = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			clientX: 100,
			clientY: 250,
			deltaY: -100,
		});

		act(() => viewport.dispatchEvent(outsideWheel));
		expect(outsideWheel.defaultPrevented).toBe(false);
		expect(animationFrames.size).toBe(0);

		const insideWheel = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			clientX: 500,
			clientY: 250,
			deltaY: -100,
		});
		act(() => viewport.dispatchEvent(insideWheel));

		expect(insideWheel.defaultPrevented).toBe(true);
		expect(animationFrames.size).toBe(1);
		flushAnimationFrames();
		expect(screen.getByText("116%")).toBeTruthy();

		emitResize(800, 400);
		expect(screen.getByText("116%")).toBeTruthy();
	});

	it("supports toolbar and keyboard zoom controls", () => {
		renderWorkspace();
		const viewport = prepareReadyViewport();
		const zoomOut = screen.getByRole("button", { name: "Zoom out" });

		expect((zoomOut as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
		flushAnimationFrames();
		expect(screen.getByText("125%")).toBeTruthy();
		expect((zoomOut as HTMLButtonElement).disabled).toBe(false);

		fireEvent.keyDown(viewport, { key: "0" });
		flushAnimationFrames();
		expect(screen.getByText("100%")).toBeTruthy();

		fireEvent.keyDown(viewport, { key: "+" });
		flushAnimationFrames();
		expect(screen.getByText("125%")).toBeTruthy();
	});

	it("converts a map press to basis points and suppresses presses after dragging", () => {
		const onMapPress = vi.fn();
		renderWorkspace({ onMapPress });
		const viewport = prepareReadyViewport();
		const pointerCapture = installPointerCapture(viewport);

		fireEvent.pointerDown(viewport, {
			button: 0,
			clientX: 500,
			clientY: 250,
			pointerId: 7,
			pointerType: "mouse",
		});
		fireEvent.pointerUp(viewport, {
			button: 0,
			clientX: 500,
			clientY: 250,
			pointerId: 7,
			pointerType: "mouse",
		});

		expect(onMapPress).toHaveBeenCalledWith({
			xBasisPoints: 5_000,
			yBasisPoints: 5_000,
		});
		expect(pointerCapture.set).toHaveBeenCalledWith(7);
		expect(pointerCapture.release).toHaveBeenCalledWith(7);

		fireEvent.pointerDown(viewport, {
			button: 0,
			clientX: 500,
			clientY: 250,
			pointerId: 8,
			pointerType: "mouse",
		});
		fireEvent.pointerMove(viewport, {
			button: 0,
			clientX: 510,
			clientY: 250,
			pointerId: 8,
			pointerType: "mouse",
		});
		fireEvent.pointerUp(viewport, {
			button: 0,
			clientX: 510,
			clientY: 250,
			pointerId: 8,
			pointerType: "mouse",
		});

		expect(onMapPress).toHaveBeenCalledOnce();
	});

	it("centers a selected marker and keeps marker input out of map presses", () => {
		const onMapPress = vi.fn();
		const onSelectMarker = vi.fn();
		renderWorkspace({
			markers: [
				{
					id: "selected",
					label: "4",
					name: "Selected location",
					xBasisPoints: 8_000,
					yBasisPoints: 2_000,
				},
			],
			onMapPress,
			onSelectMarker,
			selectedMarkerId: "selected",
		});
		const viewport = prepareReadyViewport();
		const pointerCapture = installPointerCapture(viewport);

		flushAnimationFrames();
		expect(screen.getByText("150%")).toBeTruthy();

		const marker = screen.getByRole("button", {
			name: "Open Selected location",
		});
		fireEvent.pointerDown(marker, {
			button: 0,
			pointerId: 9,
			pointerType: "mouse",
		});
		fireEvent.click(marker);

		expect(onSelectMarker).toHaveBeenCalledWith("selected");
		expect(onMapPress).not.toHaveBeenCalled();
		expect(pointerCapture.set).not.toHaveBeenCalled();
	});

	it("shows the first screenshot preview on marker focus and closes it on selection", async () => {
		const onSelectMarker = vi.fn();
		renderWorkspace({
			markers: [
				{
					id: "office",
					label: "4",
					name: "Office book pile",
					preview: {
						altText: "Books scattered across an office floor",
						height: 600,
						path: "/screenshots/office-preview.webp",
						width: 1_000,
					},
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				},
			],
			onSelectMarker,
		});
		prepareReadyViewport();
		const marker = screen.getByRole("button", {
			name: "Open Office book pile",
		});

		fireEvent.focus(marker);
		await waitFor(() =>
			expect(
				document.querySelector('[data-slot="map-marker-preview"]'),
			).not.toBeNull(),
		);
		const preview = document.querySelector('[data-slot="map-marker-preview"]');
		const image = preview?.querySelector("img");
		expect(preview?.textContent).toContain("Office book pile");
		expect(image?.getAttribute("src")).toBe("/screenshots/office-preview.webp");
		expect(image?.getAttribute("width")).toBe("1000");
		expect(image?.getAttribute("height")).toBe("600");
		expect(image?.getAttribute("alt")).toBe(
			"Books scattered across an office floor",
		);
		expect(image?.getAttribute("decoding")).toBe("async");
		if (!image) throw new Error("Expected the marker preview image");
		fireEvent.error(image);
		expect(screen.getByText("Preview unavailable")).toBeTruthy();

		fireEvent.click(marker);
		expect(onSelectMarker).toHaveBeenCalledWith("office");
		await waitFor(() =>
			expect(
				document.querySelector('[data-slot="map-marker-preview"]'),
			).toBeNull(),
		);
	});

	it("uses the selected focus override without moving the rendered marker", () => {
		renderWorkspace({
			image: { ...DEFAULT_IMAGE, width: 2_000 },
			markers: [
				{
					id: "selected",
					label: "4",
					name: "Selected location",
					xBasisPoints: 2_000,
					yBasisPoints: 8_000,
				},
			],
			onSelectMarker: vi.fn(),
			selectedMarkerId: "selected",
			selectedMarkerPosition: {
				xBasisPoints: 8_000,
				yBasisPoints: 2_000,
			},
		});
		prepareReadyViewport();
		flushAnimationFrames();

		const image = screen.getByRole("img", { name: "Customs map" });
		expect(image.parentElement?.style.transform).toBe(
			"translate3d(-500px, 0px, 0) scale(0.75)",
		);
		const marker = screen.getByRole("button", {
			name: "Open Selected location",
		});
		expect(marker.style.left).toBe("300px");
		expect(marker.style.top).toBe("600px");
	});

	it("keeps a selected marker inside a reduced interaction viewport", () => {
		const markers = [
			{
				id: "selected",
				label: "4",
				name: "Selected location",
				xBasisPoints: 8_000,
				yBasisPoints: 2_000,
			},
		];
		const { rerender } = renderWorkspace({
			markers,
			rightViewportInset: 400,
			selectedMarkerId: "selected",
		});
		prepareReadyViewport();
		flushAnimationFrames();
		const image = screen.getByRole("img", { name: "Customs map" });

		expect(image.parentElement?.style.transform).toBe(
			"translate3d(-150px, 0px, 0) scale(0.75)",
		);

		rerender(
			<MapWorkspace
				ariaLabel="Test map"
				image={DEFAULT_IMAGE}
				instructions="Drag to move"
				markers={markers}
				rightViewportInset={0}
				selectedMarkerId="selected"
			/>,
		);
		flushAnimationFrames();

		expect(image.parentElement?.style.transform).toBe(
			"translate3d(125px, 0px, 0) scale(0.75)",
		);
	});

	it("groups overlapping locations while keeping standalone markers separate", () => {
		const onSelectMarker = vi.fn();
		renderWorkspace({
			markers: [
				{
					id: "one",
					label: "1",
					name: "First location",
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				},
				{
					id: "two",
					label: "2",
					name: "Second location",
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				},
				{
					clusterable: false,
					id: "draft",
					label: "+",
					name: "Draft location",
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				},
				{
					appearance: "reference",
					id: "published",
					label: "",
					name: "Published location",
					selectable: false,
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				},
			],
			onSelectMarker,
		});
		prepareReadyViewport();

		expect(
			screen.getByRole("button", {
				name: "Choose among 2 nearby locations",
			}),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Open Draft location" }),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Open First location" }),
		).toBeNull();
		const publishedLocation = screen.getByRole("img", {
			name: "Existing location: Published location",
		});
		fireEvent.click(publishedLocation);
		expect(onSelectMarker).not.toHaveBeenCalled();
	});

	it("reports an image failure once and exposes an alert", () => {
		const onImageError = vi.fn();
		renderWorkspace({ onImageError });
		const image = screen.getByAltText("Customs map");

		fireEvent.error(image);
		fireEvent.error(image);

		expect(onImageError).toHaveBeenCalledOnce();
		expect(screen.getByRole("alert").textContent).toContain("Map unavailable");
	});

	it("cancels a pending view frame when unmounted", () => {
		const { unmount } = renderWorkspace();
		const viewport = prepareReadyViewport();
		const wheel = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			clientX: 500,
			clientY: 250,
			deltaY: -100,
		});
		act(() => viewport.dispatchEvent(wheel));
		expect(animationFrames.size).toBe(1);

		unmount();

		expect(cancelAnimationFrame).toHaveBeenCalledOnce();
		expect(animationFrames.size).toBe(0);
	});
});

function renderWorkspace(overrides: Partial<MapWorkspaceProps> = {}) {
	return render(
		<MapWorkspace
			ariaLabel="Test map"
			image={DEFAULT_IMAGE}
			instructions="Drag to move"
			markers={[]}
			{...overrides}
		/>,
	);
}

function prepareViewport() {
	const viewport = screen.getByRole("application", { name: "Test map" });
	vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
		bottom: 500,
		height: 500,
		left: 0,
		right: 1_000,
		top: 0,
		width: 1_000,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	});
	emitResize(1_000, 500);
	return viewport;
}

function prepareReadyViewport() {
	const viewport = prepareViewport();
	fireEvent.load(screen.getByRole("img", { name: "Customs map" }));
	return viewport;
}

function emitResize(width: number, height: number) {
	const observer = resizeObservers[0];
	if (!observer)
		throw new Error("Expected MapWorkspace to observe its viewport");
	act(() => observer.emit(width, height));
}

function flushAnimationFrames() {
	act(() => {
		while (animationFrames.size > 0) {
			const pendingFrames = Array.from(animationFrames.values());
			animationFrames.clear();
			for (const callback of pendingFrames) callback(performance.now());
		}
	});
}

function installPointerCapture(viewport: HTMLElement) {
	const set = vi.fn();
	const release = vi.fn();
	Object.defineProperties(viewport, {
		hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
		releasePointerCapture: { configurable: true, value: release },
		setPointerCapture: { configurable: true, value: set },
	});
	return { release, set };
}
