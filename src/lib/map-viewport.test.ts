import { describe, expect, it } from "vitest";

import {
	constrainView,
	fitView,
	focusViewOnImagePoint,
	viewportPointToImagePoint,
	zoomViewAtPoint,
} from "./map-viewport";

describe("map viewport transforms", () => {
	it("fits and centers an image inside the viewport", () => {
		expect(
			fitView({ width: 1_000, height: 600 }, { width: 2_000, height: 1_000 }),
		).toEqual({ scale: 0.5, x: 0, y: 50 });
	});

	it("keeps the world point under the cursor while zooming", () => {
		const viewport = { width: 1_000, height: 600 };
		const image = { width: 2_000, height: 1_000 };
		const point = { x: 250, y: 200 };
		const initialView = fitView(viewport, image);
		const worldBefore = viewportPointToImagePoint(point, initialView);
		const zoomedView = zoomViewAtPoint({
			image,
			nextScale: 1,
			point,
			view: initialView,
			viewport,
		});
		const worldAfter = viewportPointToImagePoint(point, zoomedView);

		expect(worldAfter.x).toBeCloseTo(worldBefore.x);
		expect(worldAfter.y).toBeCloseTo(worldBefore.y);
	});

	it("keeps the cursor anchor while an image axis remains letterboxed", () => {
		const viewport = { width: 1_000, height: 600 };
		const image = { width: 2_000, height: 1_000 };
		const point = { x: 500, y: 100 };
		const initialView = fitView(viewport, image);
		const worldBefore = viewportPointToImagePoint(point, initialView);
		const zoomedView = zoomViewAtPoint({
			image,
			nextScale: 0.55,
			point,
			view: initialView,
			viewport,
		});
		const worldAfter = viewportPointToImagePoint(point, zoomedView);

		expect(worldAfter.x).toBeCloseTo(worldBefore.x);
		expect(worldAfter.y).toBeCloseTo(worldBefore.y);
	});

	it("centers an image axis that is smaller than the viewport", () => {
		expect(
			constrainView(
				{ scale: 0.5, x: -100, y: -100 },
				{ width: 1_000, height: 800 },
				{ width: 1_000, height: 1_000 },
			),
		).toEqual({ scale: 0.5, x: 250, y: 150 });
	});

	it("keeps a selected point visible when the image edge prevents centering", () => {
		const point = { x: 1_850, y: 100 };
		const viewport = { width: 1_000, height: 600 };
		const view = focusViewOnImagePoint({
			image: { width: 2_000, height: 1_000 },
			point,
			scale: 1,
			viewport,
		});
		const visiblePoint = {
			x: point.x * view.scale + view.x,
			y: point.y * view.scale + view.y,
		};

		expect(visiblePoint.x).toBeGreaterThanOrEqual(0);
		expect(visiblePoint.x).toBeLessThanOrEqual(viewport.width);
		expect(visiblePoint.y).toBeGreaterThanOrEqual(0);
		expect(visiblePoint.y).toBeLessThanOrEqual(viewport.height);
		expect(visiblePoint.x).not.toBe(viewport.width / 2);
	});

	it("prevents a zoomed image from being panned beyond its edges", () => {
		expect(
			constrainView(
				{ scale: 1, x: 200, y: -900 },
				{ width: 1_000, height: 800 },
				{ width: 2_000, height: 1_000 },
			),
		).toEqual({ scale: 1, x: 0, y: -200 });
	});
});
