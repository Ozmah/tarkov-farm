// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationComposerForm } from "./location-composer-form";
import type { LocationComposerDraft } from "./location-draft";

afterEach(cleanup);

const draft: LocationComposerDraft = {
	description: "Second floor office",
	documentId: "technical",
	mapImageId: "reserve-main",
	name: "White Pawn",
	requiredKeyIds: [],
	xBasisPoints: 3_193,
	yBasisPoints: 1_527,
};

describe("LocationComposerForm", () => {
	it("emits neutral draft changes and delegates submission", () => {
		const changes: Array<[keyof LocationComposerDraft, unknown]> = [];
		const onSubmit = vi.fn();

		renderComposer({
			onDraftChange: (key, value) => changes.push([key, value]),
			onSubmit,
		});

		fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
			target: { value: "Black Pawn" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save location" }));

		expect(changes).toContainEqual(["name", "Black Pawn"]);
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it("renders caller-owned fields, actions, and screenshot instructions", () => {
		renderComposer({
			additionalFields: <p>Administrative field</p>,
			screenshotDescription: "Original images remain in this browser.",
			secondaryActions: <button type="button">Secondary action</button>,
		});

		expect(screen.getByText("Administrative field")).toBeTruthy();
		expect(screen.getByText("Secondary action")).toBeTruthy();
		expect(
			screen.getByText("Original images remain in this browser."),
		).toBeTruthy();
	});

	it("offers a clear screenshot button and accepts dropped files", () => {
		const onScreenshotFilesAdded = vi.fn();
		renderComposer({ onScreenshotFilesAdded });
		const file = new File(["image"], "location.png", { type: "image/png" });

		expect(
			screen.getByRole("button", { name: "Choose screenshots" }),
		).toBeTruthy();
		fireEvent.drop(screen.getByRole("region", { name: "Screenshot upload" }), {
			dataTransfer: { dropEffect: "none", files: [file] },
		});

		expect(onScreenshotFilesAdded).toHaveBeenCalledWith([file]);
		expect(screen.queryByRole("textbox", { name: /alt text/i })).toBeNull();
		expect(screen.queryByRole("textbox", { name: /caption/i })).toBeNull();
	});

	it("disables every composer control while an operation is pending", () => {
		renderComposer({ disabled: true, submitting: true });

		expect(
			screen
				.getByRole("form", { name: "White Pawn" })
				.getAttribute("aria-busy"),
		).toBe("true");
		expect(
			screen.getByRole("textbox", { name: "Name" }).matches(":disabled"),
		).toBe(true);
		expect(
			screen
				.getByRole("radio", { name: "Technical" })
				.getAttribute("aria-disabled"),
		).toBe("true");
		expect(
			screen.getByRole("button", { name: "Processing…" }).matches(":disabled"),
		).toBe(true);
	});
});

function renderComposer(
	overrides: Partial<React.ComponentProps<typeof LocationComposerForm>> = {},
) {
	return render(
		<LocationComposerForm
			availableDocuments={[{ id: "technical", name: "Technical" }]}
			availableKeys={[]}
			disabled={false}
			draft={draft}
			draftMapId="reserve"
			eyebrow="Edit location"
			keyboardSubmitHint="Use Ctrl+Enter to save from this field."
			mapImages={[{ id: "reserve-main", name: "Main" }]}
			maps={[{ id: "reserve", name: "Reserve" }]}
			maxScreenshots={10}
			screenshots={[]}
			submitLabel="Save location"
			submitting={false}
			submittingLabel="Processing…"
			title="White Pawn"
			onDraftChange={vi.fn()}
			onMapChange={vi.fn()}
			onScreenshotFilesAdded={vi.fn()}
			onScreenshotMove={vi.fn()}
			onScreenshotRemove={vi.fn()}
			onSubmit={vi.fn()}
			{...overrides}
		/>,
	);
}
