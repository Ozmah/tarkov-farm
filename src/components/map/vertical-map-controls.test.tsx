// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	PendingVerticalLocationsControl,
	VerticalDocumentFilters,
	VerticalLocationsControl,
} from "./vertical-map-controls";

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

describe("VerticalDocumentFilters", () => {
	it("keeps document filters visible and toggles them directly", () => {
		const onSelectedDocumentsChange = vi.fn();
		render(
			<VerticalDocumentFilters
				documents={documents}
				selectedDocumentIds={["financial", "medical"]}
				onSelectedDocumentsChange={onSelectedDocumentsChange}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Medical, 1 location" }),
		);
		expect(onSelectedDocumentsChange).toHaveBeenCalledWith(["financial"]);
		expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
	});

	it("prevents removing the final visible document", () => {
		const onSelectedDocumentsChange = vi.fn();
		render(
			<VerticalDocumentFilters
				documents={documents}
				selectedDocumentIds={["financial"]}
				onSelectedDocumentsChange={onSelectedDocumentsChange}
			/>,
		);

		const financial = screen.getByRole("button", {
			name: "Financial, 2 locations",
		});
		expect(financial.hasAttribute("disabled")).toBe(true);
		fireEvent.click(financial);
		expect(onSelectedDocumentsChange).not.toHaveBeenCalled();
	});
});

describe("VerticalLocationsControl", () => {
	it("reserves the location control while the next map loads", () => {
		render(<PendingVerticalLocationsControl mapName="Customs" />);

		const control = screen.getByRole("button", {
			name: "Loading Customs locations",
		});
		expect(control.hasAttribute("disabled")).toBe(true);
	});

	it("opens a location list and closes it after selection", async () => {
		const onLocationSelect = vi.fn();
		render(
			<VerticalLocationsControl
				locations={[
					{
						documentId: "financial",
						documentName: "Financial",
						id: "one",
						markerLabel: "3",
						name: "First location",
						requiredKeyCount: 1,
					},
				]}
				selectedLocationId="one"
				onLocationSelect={onLocationSelect}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Locations" }));
		const location = await screen.findByRole("button", {
			name: "Open First location, requires key access",
		});
		expect(
			location.querySelectorAll("[data-key-requirement-indicator]"),
		).toHaveLength(1);
		fireEvent.click(location);

		expect(onLocationSelect).toHaveBeenCalledWith("one");
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: /First location/ }),
			).toBeNull(),
		);
	});
});
