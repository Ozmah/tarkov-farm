// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { type ComponentProps, useState } from "react";
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
				<ControlledCluster
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

	it("summarizes keyed locations and identifies them in the chooser", async () => {
		render(
			<ControlledCluster
				markers={[
					{
						id: "locked",
						label: "2",
						name: "Locked location",
						requiredKeyCount: 1,
					},
					{ id: "open", label: "3", name: "Open location" },
				]}
				onSelect={vi.fn()}
				position={{ x: 500, y: 500 }}
			/>,
		);

		const trigger = screen.getByRole("button", {
			name: "Choose among 2 nearby locations, 1 location requires key access",
		});
		expect(
			trigger.querySelectorAll("[data-key-requirement-indicator]"),
		).toHaveLength(1);
		fireEvent.click(trigger);

		const keyedOption = await screen.findByRole("button", {
			name: "Open location 2: Locked location, requires key access",
		});
		const unkeyedOption = screen.getByRole("button", {
			name: "Open location 3: Open location",
		});
		expect(
			keyedOption.querySelectorAll("[data-key-requirement-indicator]"),
		).toHaveLength(1);
		expect(
			unkeyedOption.querySelector("[data-key-requirement-indicator]"),
		).toBeNull();
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

	it("inspects a location in place and steps through the cluster with the arrow keys", async () => {
		const onSelect = vi.fn();
		render(
			<ControlledCluster
				markers={clusterMarkers.map((marker) => ({
					...marker,
					inspectable: true,
				}))}
				onSelect={onSelect}
				position={{ x: 500, y: 500 }}
				renderInspector={(markerId) => <p>Inspecting {markerId}</p>}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Choose among 2 nearby locations" }),
		);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Open location 7: First location",
			}),
		);

		expect(screen.getByText("Inspecting one")).toBeTruthy();
		expect(screen.getByText("1 of 2")).toBeTruthy();
		expect(onSelect).not.toHaveBeenCalled();

		fireEvent.keyDown(screen.getByText("Inspecting one"), {
			key: "ArrowRight",
		});
		expect(screen.getByText("Inspecting two")).toBeTruthy();
		fireEvent.keyDown(screen.getByText("Inspecting two"), {
			key: "ArrowRight",
		});
		expect(screen.getByText("Inspecting one")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Nearby locations" }));
		expect(
			screen.getByRole("button", { name: "Open location 11: Second location" }),
		).toBeTruthy();
	});

	it("previews the first cluster location when none is selected", async () => {
		render(
			<ControlledCluster
				markers={clusterMarkers}
				onSelect={vi.fn()}
				position={{ x: 500, y: 500 }}
			/>,
		);
		const trigger = screen.getByRole("button", {
			name: "Choose among 2 nearby locations",
		});

		fireEvent.focus(trigger);
		const preview = await findMarkerPreview();
		expect(preview.textContent).toContain("First location");
		expect(preview.textContent).toContain("1/2");
		expect(preview.querySelector("img")?.getAttribute("src")).toBe(
			"/screenshots/first.webp",
		);
	});

	it("previews the selected cluster location using its stable position", async () => {
		render(
			<ControlledCluster
				markers={clusterMarkers}
				onSelect={vi.fn()}
				position={{ x: 500, y: 500 }}
				selectedMarkerId="two"
			/>,
		);
		fireEvent.focus(
			screen.getByRole("button", {
				name: /Choose among 2 nearby locations, including the selected location/,
			}),
		);

		const preview = await findMarkerPreview();
		expect(preview.textContent).toContain("Second location");
		expect(preview.textContent).toContain("2/2");
		expect(preview.querySelector("img")?.getAttribute("src")).toBe(
			"/screenshots/second.webp",
		);
	});
});

const clusterMarkers = [
	{
		id: "one",
		label: "7",
		name: "First location",
		preview: {
			altText: "First location preview",
			height: 600,
			path: "/screenshots/first.webp",
			width: 1_000,
		},
	},
	{
		id: "two",
		label: "11",
		name: "Second location",
		preview: {
			altText: "Second location preview",
			height: 700,
			path: "/screenshots/second.webp",
			width: 1_000,
		},
	},
];

async function findMarkerPreview() {
	await waitFor(() =>
		expect(
			document.querySelector('[data-slot="map-marker-preview"]'),
		).not.toBeNull(),
	);
	const preview = document.querySelector('[data-slot="map-marker-preview"]');
	if (!(preview instanceof HTMLElement)) {
		throw new Error("Expected the marker preview to open");
	}

	return preview;
}

function renderCluster(onSelect = vi.fn()) {
	return render(
		<ControlledCluster
			markers={[
				{ id: "one", label: "7", name: "First location" },
				{ id: "two", label: "11", name: "Second location" },
			]}
			onSelect={onSelect}
			position={{ x: 500, y: 500 }}
		/>,
	);
}

/** Mirrors MapWorkspace, which owns the open state and closes on selection. */
function ControlledCluster(
	props: Omit<ComponentProps<typeof MapMarkerCluster>, "open" | "onOpenChange">,
) {
	const [open, setOpen] = useState(false);

	return (
		<MapMarkerCluster
			{...props}
			open={open}
			onOpenChange={setOpen}
			onSelect={(markerId) => {
				setOpen(false);
				props.onSelect(markerId);
			}}
		/>
	);
}
