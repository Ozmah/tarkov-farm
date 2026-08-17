// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapMarkerCluster } from "./map-marker-cluster";

afterEach(cleanup);

describe("MapMarkerCluster", () => {
	it("offers nearby locations and selects the requested marker", async () => {
		const onKeyDown = vi.fn();
		const onSelect = vi.fn();
		const onPointerDown = vi.fn();
		render(
			<div
				role="application"
				aria-label="Map"
				onKeyDown={onKeyDown}
				onPointerDown={onPointerDown}
			>
				<MapMarkerCluster
					markers={[
						{
							id: "one",
							label: "7",
							name: "First location",
							secondaryLabel: "Financial",
						},
						{
							id: "two",
							label: "11",
							name: "Second location",
							secondaryLabel: "Medical",
						},
					]}
					onSelect={onSelect}
					position={{ x: 500, y: 500 }}
				/>
			</div>,
		);

		const trigger = screen.getByRole("button", {
			name: "Choose among 2 nearby locations",
		});
		expect(trigger.style.transform).toBe("translate(-50%, -100%)");
		fireEvent.click(trigger);
		expect(await screen.findByText("Nearby locations")).toBeTruthy();

		const option = screen.getByRole("button", {
			name: "Open location 11: Second location, Medical",
		});
		fireEvent.pointerDown(option);
		expect(onPointerDown).not.toHaveBeenCalled();
		fireEvent.keyDown(option, { key: "ArrowDown" });
		expect(onKeyDown).not.toHaveBeenCalled();
		fireEvent.click(option);

		expect(onSelect).toHaveBeenCalledOnce();
		expect(onSelect).toHaveBeenCalledWith("two");
		await waitFor(() =>
			expect(screen.queryByText("Nearby locations")).toBeNull(),
		);
	});

	it("closes with Escape and restores focus to the hotspot", async () => {
		renderCluster();
		const trigger = screen.getByRole("button", {
			name: "Choose among 2 nearby locations",
		});

		fireEvent.click(trigger);
		expect(
			await screen.findByRole("dialog", { name: "Nearby locations" }),
		).toBeTruthy();
		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Nearby locations" }),
			).toBeNull(),
		);
		expect(document.activeElement).toBe(trigger);
	});
});

function renderCluster(onSelect = vi.fn()) {
	return render(
		<MapMarkerCluster
			markers={[
				{ id: "one", label: "7", name: "First location" },
				{ id: "two", label: "11", name: "Second location" },
			]}
			onSelect={onSelect}
			position={{ x: 500, y: 500 }}
		/>,
	);
}
