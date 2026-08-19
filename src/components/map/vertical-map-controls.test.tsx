// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerticalMapControls } from "./vertical-map-controls";

const documents = [
	{
		count: 2,
		id: "financial",
		imageHeight: 559,
		imagePath: "/documents/financial.webp",
		imageWidth: 689,
		name: "Financial",
	},
	{
		count: 1,
		id: "medical",
		imageHeight: 602,
		imagePath: "/documents/medical.webp",
		imageWidth: 487,
		name: "Medical",
	},
];

afterEach(cleanup);

describe("VerticalMapControls", () => {
	it("filters documents from a compact disclosure", async () => {
		const onSelectedDocumentsChange = vi.fn();
		renderControls({ onSelectedDocumentsChange });
		fireEvent.click(screen.getByRole("button", { name: /Documents/ }));
		const medicalFilter = await screen.findByRole("button", {
			name: "Medical, 1 location",
		});
		fireEvent.click(medicalFilter);
		expect(onSelectedDocumentsChange).toHaveBeenCalledWith(["financial"]);
	});

	it("selects a location and dismisses the location disclosure", async () => {
		const onLocationSelect = vi.fn();
		renderControls({ onLocationSelect });
		fireEvent.click(screen.getByRole("button", { name: /Locations/ }));
		await screen.findAllByRole("button", { name: /First location/ });
		const locationButton = screen
			.getAllByRole("button", { name: /First location/ })
			.find((button) => button.hasAttribute("aria-pressed"));
		expect(locationButton).toBeTruthy();
		fireEvent.click(locationButton as HTMLButtonElement);
		expect(onLocationSelect).toHaveBeenCalledWith("one");
		await waitFor(() =>
			expect(document.querySelector('button[aria-pressed="true"]')).toBeNull(),
		);
	});

	it("keeps textual details and safe key links outside the screenshot inspector", async () => {
		renderControls();
		fireEvent.click(screen.getByRole("button", { name: /First location/ }));
		const keyLink = await screen.findByRole("link", {
			name: "Dorm room 206 key",
		});
		expect(keyLink.getAttribute("target")).toBe("_blank");
		expect(keyLink.getAttribute("rel")).toBe("noopener noreferrer");
		expect(screen.getByText("Near the truck")).toBeTruthy();
	});
});

function renderControls({
	onLocationSelect = vi.fn(),
	onSelectedDocumentsChange = vi.fn(),
}: {
	onLocationSelect?: (locationId: string) => void;
	onSelectedDocumentsChange?: (documentIds: string[]) => void;
} = {}) {
	return render(
		<VerticalMapControls
			documents={documents}
			locations={[
				{
					documentId: "financial",
					documentName: "Financial",
					id: "one",
					markerLabel: "3",
					name: "First location",
				},
			]}
			maps={[{ id: "customs", name: "Customs" }]}
			mapViews={[{ id: "main", name: "Main map" }]}
			selectedDocumentIds={["financial", "medical"]}
			selectedLocationId="one"
			selectedLocation={{
				description: "Near the truck",
				documentName: "Financial",
				name: "First location",
				requiredKeys: [
					{
						id: "dorm-206",
						imageHeight: 64,
						imagePath: "/keys/dorm-206.webp",
						imageWidth: 64,
						name: "Dorm room 206 key",
						wikiUrl:
							"https://escapefromtarkov.fandom.com/wiki/Dorm_room_206_key",
					},
				],
			}}
			selectedMapId="customs"
			selectedMapViewId="main"
			onLocationSelect={onLocationSelect}
			onMapChange={vi.fn()}
			onMapViewChange={vi.fn()}
			onSelectedDocumentsChange={onSelectedDocumentsChange}
		/>,
	);
}
