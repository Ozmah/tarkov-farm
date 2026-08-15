// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapSidebarPanel } from "./map-sidebar-panel";

afterEach(cleanup);

const documents = [
	{ count: 8, id: "financial", name: "Financial" },
	{ count: 3, id: "medical", name: "Medical" },
	{ count: 4, id: "project", name: "Project" },
];

describe("MapSidebarPanel document filters", () => {
	it("shows every map document as selected by default", () => {
		renderPanel({
			selectedDocumentIds: documents.map((document) => document.id),
		});

		for (const document of documents) {
			expect(
				screen
					.getByRole("button", {
						name: `${document.name}, ${document.count} locations`,
					})
					.getAttribute("aria-pressed"),
			).toBe("true");
		}
		expect(screen.getByText("All · 15")).toBeTruthy();
	});

	it("removes one document without changing the flat location list", () => {
		const onSelectedDocumentsChange = vi.fn();
		renderPanel({
			onSelectedDocumentsChange,
			selectedDocumentIds: documents.map((document) => document.id),
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Medical, 3 locations" }),
		);

		expect(onSelectedDocumentsChange).toHaveBeenCalledWith([
			"financial",
			"project",
		]);
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it("restores every document and prevents an empty selection", () => {
		const onSelectedDocumentsChange = vi.fn();
		renderPanel({
			onSelectedDocumentsChange,
			selectedDocumentIds: ["financial"],
		});

		expect(
			screen
				.getByRole("button", { name: "Financial, 8 locations" })
				.hasAttribute("disabled"),
		).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Show all" }));
		expect(onSelectedDocumentsChange).toHaveBeenCalledWith([
			"financial",
			"medical",
			"project",
		]);
	});
});

function renderPanel({
	onSelectedDocumentsChange = vi.fn(),
	selectedDocumentIds,
}: {
	onSelectedDocumentsChange?: (documentIds: string[]) => void;
	selectedDocumentIds: string[];
}) {
	return render(
		<MapSidebarPanel
			documents={documents}
			locations={[
				{ documentName: "Financial", id: "one", name: "First location" },
				{ documentName: "Project", id: "two", name: "Second location" },
			]}
			maps={[{ id: "factory", name: "Factory" }]}
			mapViews={[{ id: "main", name: "Main map" }]}
			selectedDocumentIds={selectedDocumentIds}
			selectedMapId="factory"
			selectedMapViewId="main"
			onBack={vi.fn()}
			onLocationSelect={vi.fn()}
			onMapChange={vi.fn()}
			onMapViewChange={vi.fn()}
			onSelectedDocumentsChange={onSelectedDocumentsChange}
		/>,
	);
}
