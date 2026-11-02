import { describe, expect, it } from "vitest";

import {
	annotationStrokeWidth,
	extendPenStroke,
	isVisibleShape,
	shapeFromDrag,
} from "./screenshot-annotation";

describe("shapeFromDrag", () => {
	it("normalizes drags in any direction", () => {
		expect(
			shapeFromDrag("rectangle", { x: 100, y: 80 }, { x: 40, y: 20 }),
		).toEqual({ kind: "rectangle", x: 40, y: 20, width: 60, height: 60 });
		expect(
			shapeFromDrag("ellipse", { x: 10, y: 10 }, { x: 210, y: 60 }),
		).toEqual({ kind: "ellipse", x: 10, y: 10, width: 200, height: 50 });
	});

	it("constrains to a square or circle from the drag origin", () => {
		expect(
			shapeFromDrag("ellipse", { x: 100, y: 100 }, { x: 40, y: 130 }, true),
		).toEqual({ kind: "ellipse", x: 40, y: 100, width: 60, height: 60 });
	});
});

describe("annotation helpers", () => {
	it("ignores accidental clicks", () => {
		expect(
			isVisibleShape(
				shapeFromDrag("rectangle", { x: 5, y: 5 }, { x: 6, y: 40 }),
			),
		).toBe(false);
		expect(
			isVisibleShape(
				shapeFromDrag("rectangle", { x: 5, y: 5 }, { x: 30, y: 40 }),
			),
		).toBe(true);
	});

	it("scales the stroke with the image", () => {
		expect(annotationStrokeWidth(1920, 1080)).toBe(5);
		expect(annotationStrokeWidth(3840, 2160)).toBe(10);
		expect(annotationStrokeWidth(200, 100)).toBe(2);
	});
});

describe("arrows and freehand", () => {
	it("points the arrow from drag start to drag end, snapping to 45° with Shift", () => {
		expect(shapeFromDrag("arrow", { x: 10, y: 10 }, { x: 110, y: 20 })).toEqual(
			{ kind: "arrow", from: { x: 10, y: 10 }, to: { x: 110, y: 20 } },
		);
		const snapped = shapeFromDrag(
			"arrow",
			{ x: 0, y: 0 },
			{ x: 100, y: 10 },
			true,
		);
		if (snapped.kind !== "arrow") throw new Error("expected an arrow");
		expect(snapped.to.y).toBeCloseTo(0);
		expect(snapped.to.x).toBeCloseTo(Math.hypot(100, 10));
	});

	it("skips freehand jitter and ignores dots", () => {
		let points = [{ x: 0, y: 0 }];
		points = extendPenStroke(points, { x: 1, y: 1 }, 3);
		expect(points).toHaveLength(1);
		points = extendPenStroke(points, { x: 10, y: 0 }, 3);
		expect(points).toHaveLength(2);
		expect(isVisibleShape({ kind: "pen", points })).toBe(true);
		expect(isVisibleShape({ kind: "pen", points: [{ x: 0, y: 0 }] })).toBe(
			false,
		);
		expect(
			isVisibleShape({
				kind: "arrow",
				from: { x: 0, y: 0 },
				to: { x: 3, y: 0 },
			}),
		).toBe(false);
	});
});
