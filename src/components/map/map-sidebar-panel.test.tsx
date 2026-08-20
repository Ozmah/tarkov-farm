// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapSidebarPanel } from "./map-sidebar-panel";

afterEach(cleanup);

const documents = [
	{
		count: 8,
		id: "financial",
		imageHeight: 559,
		imagePath: "/documents/financial.webp",
		imageWidth: 689,
		name: "Financial",
	},
	{
		count: 3,
		id: "medical",
		imageHeight: 602,
		imagePath: "/documents/medical.webp",
		imageWidth: 487,
		name: "Medical",
	},
	{
		count: 4,
		id: "project",
		imageHeight: 377,
		imagePath: "/documents/project.webp",
		imageWidth: 530,
		name: "Project",
	},
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
		expect(screen.queryByText("All · 15")).toBeNull();
		expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
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

	it("prevents an empty selection without rendering a redundant bulk reset", () => {
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
		expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Financial, 8 locations" }),
		);
		expect(onSelectedDocumentsChange).not.toHaveBeenCalled();
	});

	it("uses the matching document artwork in filters and location rows", () => {
		const { container } = renderPanel({
			selectedDocumentIds: documents.map((document) => document.id),
		});
		const financialImages = container.querySelectorAll<HTMLImageElement>(
			'img[src="/documents/financial.webp"]',
		);

		expect(financialImages).toHaveLength(2);
		for (const image of financialImages) {
			expect(image.alt).toBe("");
			expect(image.width).toBe(689);
			expect(image.height).toBe(559);
			expect(image.getAttribute("loading")).toBe("lazy");
			expect(image.getAttribute("decoding")).toBe("async");
		}
	});

	it("shows stable marker labels without renumbering filtered results", () => {
		renderPanel({
			selectedDocumentIds: documents.map((document) => document.id),
		});

		expect(
			within(screen.getByRole("button", { name: /First location/ })).getByText(
				"3",
			),
		).toBeTruthy();
		expect(
			within(screen.getByRole("button", { name: /Second location/ })).getByText(
				"9",
			),
		).toBeTruthy();
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
				{
					documentId: "financial",
					documentName: "Financial",
					id: "one",
					markerLabel: "3",
					name: "First location",
				},
				{
					documentId: "project",
					documentName: "Project",
					id: "two",
					markerLabel: "9",
					name: "Second location",
				},
			]}
			selectedDocumentIds={selectedDocumentIds}
			onBack={vi.fn()}
			onLocationSelect={vi.fn()}
			onSelectedDocumentsChange={onSelectedDocumentsChange}
		/>,
	);
}
