// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MapWorkspace } from "@/components/map/map-workspace";
import { MapCanvas } from "./map-canvas";

vi.mock("@/components/map/map-workspace", () => ({
	MapWorkspace: vi.fn(() => null),
}));

describe("MapCanvas selection centering", () => {
	it("centers from the selected location instead of the stale draft", () => {
		render(
			<MapCanvas
				draftMarker={{
					isActive: true,
					name: "Previous draft",
					xBasisPoints: 1_000,
					yBasisPoints: 2_000,
				}}
				image={{
					altText: "Map",
					height: 1_000,
					path: "/map.webp",
					width: 1_000,
				}}
				locations={[
					{
						id: "location-c",
						isActive: true,
						markerLabel: "4",
						name: "Location C",
						xBasisPoints: 1_000,
						yBasisPoints: 2_000,
					},
					{
						id: "location-d",
						isActive: true,
						markerLabel: "9",
						name: "Location D",
						xBasisPoints: 7_000,
						yBasisPoints: 8_000,
					},
				]}
				selectedLocationId="location-d"
				onPositionChange={vi.fn()}
				onSelectLocation={vi.fn()}
			/>,
		);

		const props = vi.mocked(MapWorkspace).mock.calls.at(-1)?.[0];
		expect(props?.selectedMarkerPosition).toMatchObject({
			xBasisPoints: 7_000,
			yBasisPoints: 8_000,
		});
		expect(props?.markers.map(({ label }) => label)).toEqual(["4", "9"]);
	});

	it("keeps the new-location draft outside overlap groups", () => {
		render(
			<MapCanvas
				draftMarker={{
					isActive: true,
					name: "New location",
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				}}
				image={{
					altText: "Map",
					height: 1_000,
					path: "/map.webp",
					width: 1_000,
				}}
				locations={[]}
				onPositionChange={vi.fn()}
				onSelectLocation={vi.fn()}
			/>,
		);

		const props = vi.mocked(MapWorkspace).mock.calls.at(-1)?.[0];
		expect(props?.markers).toEqual([
			expect.objectContaining({
				clusterable: false,
				id: "new-location",
			}),
		]);
	});
});
