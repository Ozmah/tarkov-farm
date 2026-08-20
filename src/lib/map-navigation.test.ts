import { describe, expect, it } from "vitest";

import { getMapNavigationLabel } from "./map-navigation";

describe("map navigation labels", () => {
	it("uses deterministic compact labels for every public map", () => {
		const maps = [
			["customs", "Customs", "Customs"],
			["factory", "Factory", "Factory"],
			["ground-zero", "Ground Zero", "GZero"],
			["icebreaker", "Icebreaker", "Icebreaker"],
			["interchange", "Interchange", "Inter"],
			["lighthouse", "Lighthouse", "Lighthouse"],
			["reserve", "Reserve", "Reserve"],
			["shoreline", "Shoreline", "Shoreline"],
			["streets-of-tarkov", "Streets of Tarkov", "Streets"],
			["the-lab", "The Lab", "Labs"],
			["the-labyrinth", "The Labyrinth", "Labyrinth"],
			["woods", "Woods", "Woods"],
		] as const;

		for (const [id, name, expected] of maps) {
			expect(getMapNavigationLabel({ id, name })).toBe(expected);
		}
	});

	it("keeps an explicit catalog name when a new map has no compact label yet", () => {
		expect(getMapNavigationLabel({ id: "new-map", name: "A New Map" })).toBe(
			"A New Map",
		);
	});
});
