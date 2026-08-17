import { describe, expect, it } from "vitest";

import { groupOverlappingMapMarkers } from "./map-marker-groups";

const markers = [
	{ id: "one", xBasisPoints: 1000, yBasisPoints: 1000 },
	{ id: "two", xBasisPoints: 1300, yBasisPoints: 1000 },
	{ id: "three", xBasisPoints: 1600, yBasisPoints: 1000 },
	{ id: "four", xBasisPoints: 5000, yBasisPoints: 5000 },
];
const image = { height: 1000, width: 1000 };

describe("groupOverlappingMapMarkers", () => {
	it("combines transitive screen-space overlaps", () => {
		const groups = groupOverlappingMapMarkers(markers, image, 1);

		expect(groups).toHaveLength(2);
		expect(groups[0]).toMatchObject({
			markers: markers.slice(0, 3),
			xBasisPoints: 1300,
			yBasisPoints: 1000,
		});
		expect(groups[1]?.markers).toEqual([markers[3]]);
	});

	it("separates markers when zoom makes them individually selectable", () => {
		const groups = groupOverlappingMapMarkers(markers, image, 2);

		expect(groups).toHaveLength(4);
		expect(
			groups.every(({ markers: groupMarkers }) => groupMarkers.length === 1),
		).toBe(true);
	});
});
