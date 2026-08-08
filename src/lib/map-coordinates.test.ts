import { describe, expect, it } from "vitest";

import { pointerToBasisPoints } from "./map-coordinates";

describe("pointerToBasisPoints", () => {
	it("normalizes the center of a rendered map", () => {
		expect(
			pointerToBasisPoints({
				pointerX: 400,
				pointerY: 250,
				width: 800,
				height: 500,
			}),
		).toEqual({ xBasisPoints: 5_000, yBasisPoints: 5_000 });
	});

	it("clamps coordinates to the map boundaries", () => {
		expect(
			pointerToBasisPoints({
				pointerX: -20,
				pointerY: 600,
				width: 800,
				height: 500,
			}),
		).toEqual({ xBasisPoints: 0, yBasisPoints: 10_000 });
	});

	it("rejects invalid map bounds", () => {
		expect(() =>
			pointerToBasisPoints({
				pointerX: 0,
				pointerY: 0,
				width: 0,
				height: 500,
			}),
		).toThrow("Map bounds must be positive");
	});
});
