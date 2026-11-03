// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MapWorkspace } from "@/components/map/map-workspace";
import { Popover } from "@/components/ui/popover";
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
					requiredKeyCount: 2,
					xBasisPoints: 1_000,
					yBasisPoints: 2_000,
				}}
				image={{
					altText: "Map",
					height: 1_000,
					path: "/map.webp",
					sources: [{ height: 1_000, path: "/map.webp", width: 1_000 }],
					width: 1_000,
				}}
				locations={[
					{
						id: "location-c",
						isActive: true,
						markerLabel: "4",
						name: "Location C",
						requiredKeyCount: 1,
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
				onEditLocation={vi.fn()}
			/>,
		);

		const props = vi.mocked(MapWorkspace).mock.calls.at(-1)?.[0];
		expect(props?.selectedMarkerPosition).toMatchObject({
			xBasisPoints: 7_000,
			yBasisPoints: 8_000,
		});
		expect(props?.markers.map(({ label }) => label)).toEqual(["4", "9"]);
		expect(
			props?.markers.map(({ id, requiredKeyCount }) => ({
				id,
				requiredKeyCount,
			})),
		).toEqual([
			{ id: "location-c", requiredKeyCount: 1 },
			{ id: "location-d", requiredKeyCount: 2 },
		]);
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
					sources: [{ height: 1_000, path: "/map.webp", width: 1_000 }],
					width: 1_000,
				}}
				locations={[]}
				onPositionChange={vi.fn()}
				onEditLocation={vi.fn()}
			/>,
		);

		const props = vi.mocked(MapWorkspace).mock.calls.at(-1)?.[0];
		expect(props?.markers).toEqual([
			expect.objectContaining({
				clusterable: false,
				focusOnSelect: false,
				id: "new-location",
			}),
		]);
	});
});

describe("MapCanvas inspection", () => {
	it("inspects every location but the one in the form, and offers Edit only when allowed", () => {
		const onEditLocation = vi.fn();
		const onPositionChange = vi.fn();
		render(
			<MapCanvas
				draftMarker={{
					isActive: true,
					name: "Draft",
					xBasisPoints: 5_000,
					yBasisPoints: 5_000,
				}}
				image={{
					altText: "Map",
					height: 1_000,
					path: "/map.webp",
					sources: [{ height: 1_000, path: "/map.webp", width: 1_000 }],
					width: 1_000,
				}}
				locations={[
					{
						description: "Behind the desk",
						documentName: "Project documentation",
						editable: true,
						id: "own",
						isActive: true,
						name: "Crackhouse Library",
						xBasisPoints: 5_811,
						yBasisPoints: 3_451,
					},
					{
						appearance: "reference",
						id: "published",
						isActive: true,
						name: "Published shelf",
						xBasisPoints: 1_000,
						yBasisPoints: 2_000,
					},
					{
						id: "selected",
						isActive: true,
						name: "Being edited",
						xBasisPoints: 9_000,
						yBasisPoints: 9_000,
					},
				]}
				selectedLocationId="selected"
				onEditLocation={onEditLocation}
				onPositionChange={onPositionChange}
			/>,
		);

		const props = vi.mocked(MapWorkspace).mock.calls.at(-1)?.[0];
		expect(
			props?.markers.map(({ id, inspectable }) => [id, inspectable ?? false]),
		).toEqual([
			["own", true],
			["published", true],
			["selected", false],
		]);

		const close = vi.fn();
		const own = render(
			<Popover open>{props?.renderMarkerInspector?.("own", close)}</Popover>,
		);
		expect(own.getByText("#1 · Project documentation")).toBeTruthy();
		fireEvent.click(own.getByRole("button", { name: "Use position" }));
		expect(close).toHaveBeenCalledOnce();
		expect(onPositionChange).toHaveBeenCalledWith({
			xBasisPoints: 5_811,
			yBasisPoints: 3_451,
		});
		fireEvent.click(own.getByRole("button", { name: "Edit" }));
		expect(onEditLocation).toHaveBeenCalledWith("own");
		own.unmount();

		const published = render(
			<Popover open>
				{props?.renderMarkerInspector?.("published", close)}
			</Popover>,
		);
		expect(published.queryByRole("button", { name: "Edit" })).toBeNull();
		expect(
			published.getByRole("button", { name: "Copy position" }),
		).toBeTruthy();
	});
});
