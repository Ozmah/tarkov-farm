// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentFilter } from "./document-filter";

afterEach(cleanup);

describe("document filter", () => {
	it("uses the current map view counts and updates the global selection", () => {
		const onSelectedDocumentsChange = vi.fn();

		render(
			<DocumentFilter
				currentMapId="customs"
				currentMapImageId="customs-main"
				documents={[
					{ id: "financial", name: "Financial documents", isFilterable: true },
					{ id: "project", name: "Project documentation", isFilterable: true },
					{ id: "internal", name: "Internal", isFilterable: false },
				]}
				documentLocations={[
					{
						documentId: "financial",
						mapId: "customs",
						mapImageId: "customs-main",
					},
					{
						documentId: "financial",
						mapId: "customs",
						mapImageId: "customs-dorms",
					},
					{
						documentId: "project",
						mapId: "customs",
						mapImageId: "customs-main",
					},
					{
						documentId: "project",
						mapId: "reserve",
						mapImageId: "reserve-main",
					},
				]}
				selectedDocumentIds={["financial"]}
				onSelectedDocumentsChange={onSelectedDocumentsChange}
			/>,
		);

		expect(screen.getByText("1 selected · 1 result")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /Documents/i }));

		const financialRow = screen
			.getByText("Financial documents")
			.closest("label");
		const projectRow = screen
			.getByText("Project documentation")
			.closest("label");
		expect(financialRow).not.toBeNull();
		expect(projectRow).not.toBeNull();
		expect(
			within(financialRow as HTMLLabelElement).getByText("1"),
		).toBeTruthy();
		expect(within(projectRow as HTMLLabelElement).getByText("1")).toBeTruthy();

		fireEvent.click(
			within(projectRow as HTMLLabelElement).getByRole("checkbox"),
		);
		expect(onSelectedDocumentsChange).toHaveBeenLastCalledWith([
			"financial",
			"project",
		]);

		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(onSelectedDocumentsChange).toHaveBeenLastCalledWith([]);
	});
});
