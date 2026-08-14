// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationDetailsPanel } from "./location-details-panel";

const screenshot = {
	altText: "Document on a desk",
	caption: "Second floor",
	height: 1080,
	id: "screenshot-1",
	path: "/screenshots/full.webp",
	previewHeight: 563,
	previewPath: "/screenshots/preview.webp",
	previewWidth: 1000,
	width: 1920,
};

afterEach(cleanup);

describe("LocationDetailsPanel screenshot lightbox", () => {
	it("shows every required key with a safe external wiki link", () => {
		render(
			<LocationDetailsPanel
				location={{
					description: null,
					documentName: "Test document",
					name: "Locked room",
					requiredKeys: [
						{
							id: "factory-emergency-exit-key",
							imageHeight: 64,
							imagePath: "/keys/factory.webp",
							imageWidth: 64,
							name: "Factory emergency exit key",
							wikiUrl:
								"https://escapefromtarkov.fandom.com/wiki/Factory_emergency_exit_key",
						},
					],
				}}
				onClose={vi.fn()}
				screenshots={[screenshot]}
			/>,
		);

		const link = screen.getByRole("link", {
			name: "Factory emergency exit key",
		});
		expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		expect(link.getAttribute("target")).toBe("_blank");
	});

	it("closes the location from the sheet backdrop", async () => {
		const onClose = vi.fn();
		renderPanel(onClose);
		const backdrop = document.querySelector<HTMLElement>(
			'[data-slot="sheet-overlay"]',
		);
		expect(backdrop).not.toBeNull();

		fireEvent.pointerDown(backdrop as HTMLElement);
		fireEvent.pointerUp(backdrop as HTMLElement);
		fireEvent.click(backdrop as HTMLElement);

		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it("opens in place and closes with its close button", async () => {
		renderPanel();
		fireEvent.click(
			screen.getByRole("button", {
				name: "View Document on a desk screenshot",
			}),
		);

		expect(
			screen.getByRole("dialog", { name: screenshot.altText }),
		).toBeTruthy();
		expect(
			screen.getByRole("img", { name: screenshot.altText }),
		).toHaveProperty("src", expect.stringContaining(screenshot.path));

		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshot.altText }),
			).toBeNull(),
		);
	});

	it("closes from the backdrop without closing the location panel", async () => {
		const onClose = vi.fn();
		renderPanel(onClose);
		fireEvent.click(
			screen.getByRole("button", {
				name: "View Document on a desk screenshot",
			}),
		);

		const backdrop = document.querySelector<HTMLElement>(
			'[data-slot="dialog-overlay"]',
		);
		expect(backdrop).not.toBeNull();
		fireEvent.pointerDown(backdrop as HTMLElement);
		fireEvent.pointerUp(backdrop as HTMLElement);
		fireEvent.click(backdrop as HTMLElement);

		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshot.altText }),
			).toBeNull(),
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes with Escape without closing the location panel", async () => {
		const onClose = vi.fn();
		renderPanel(onClose);
		fireEvent.click(
			screen.getByRole("button", {
				name: "View Document on a desk screenshot",
			}),
		);

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: screenshot.altText }),
			).toBeNull(),
		);
		expect(onClose).not.toHaveBeenCalled();
	});
});

function renderPanel(onClose = vi.fn()) {
	return render(
		<LocationDetailsPanel
			location={{
				description: "Near the stairs",
				documentName: "Test document",
				name: "Sawmill",
				requiredKeys: [],
			}}
			onClose={onClose}
			screenshots={[screenshot]}
		/>,
	);
}
