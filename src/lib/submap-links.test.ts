import { describe, expect, it } from "vitest";

import { SUBMAP_LINKS } from "./submap-links";

describe("submap links", () => {
	it("defines the supported main-map navigation markers", () => {
		expect(SUBMAP_LINKS).toEqual([
			{
				mapId: "customs",
				name: "Dorms",
				targetViewKey: "dorms",
				xBasisPoints: 4_935,
				yBasisPoints: 6_822,
			},
			{
				mapId: "reserve",
				name: "Tunnels",
				targetViewKey: "tunnels",
				xBasisPoints: 7_337,
				yBasisPoints: 3_381,
			},
			{
				mapId: "shoreline",
				name: "Health Resort",
				targetViewKey: "resort",
				xBasisPoints: 5_135,
				yBasisPoints: 2_058,
			},
		]);
	});
});
