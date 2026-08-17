import { describe, expect, it } from "vitest";

import { numberMapLocations } from "./map-location-order";

describe("numberMapLocations", () => {
	it("numbers locations by spatial rows instead of name", () => {
		const numbered = numberMapLocations([
			{ id: "alpha", name: "Alpha", xBasisPoints: 8000, yBasisPoints: 100 },
			{ id: "charlie", name: "Charlie", xBasisPoints: 500, yBasisPoints: 900 },
			{ id: "bravo", name: "Bravo", xBasisPoints: 1000, yBasisPoints: 250 },
		]);

		expect(numbered.map(({ id, markerLabel }) => [id, markerLabel])).toEqual([
			["bravo", "1"],
			["alpha", "2"],
			["charlie", "3"],
		]);
	});

	it("keeps assigned numbers stable when locations are filtered", () => {
		const numbered = numberMapLocations([
			{ id: "one", xBasisPoints: 100, yBasisPoints: 100 },
			{ id: "two", xBasisPoints: 200, yBasisPoints: 100 },
			{ id: "three", xBasisPoints: 300, yBasisPoints: 100 },
		]);

		expect(
			numbered
				.filter(({ id }) => id !== "two")
				.map(({ id, markerLabel }) => [id, markerLabel]),
		).toEqual([
			["one", "1"],
			["three", "3"],
		]);
	});
});
