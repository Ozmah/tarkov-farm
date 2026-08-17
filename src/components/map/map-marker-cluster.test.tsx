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

	it("previews a limited number of nearby location names", async () => {
		render(
			<MapMarkerCluster
				markers={Array.from({ length: 6 }, (_, index) => ({
					id: `location-${index + 1}`,
					label: `${index + 1}`,
					name: `Location ${index + 1}`,
				}))}
				onSelect={vi.fn()}
				position={{ x: 500, y: 500 }}
			/>,
		);
		const trigger = screen.getByRole("button", {
			name: "Choose among 6 nearby locations",
		});

		fireEvent.focus(trigger);

		await waitFor(() =>
			expect(
				document.querySelector('[data-slot="tooltip-content"]'),
			).not.toBeNull(),
		);
		const tooltip = document.querySelector('[data-slot="tooltip-content"]');
		if (!tooltip) {
			throw new Error("Expected the cluster tooltip to open");
		}
		expect(tooltip.textContent).toContain("Location 1");
		expect(tooltip.textContent).toContain("Location 4");
		expect(tooltip.textContent).not.toContain("Location 5");
		expect(tooltip.textContent).toContain("And 2 more…");
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
