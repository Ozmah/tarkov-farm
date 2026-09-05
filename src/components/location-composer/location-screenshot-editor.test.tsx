// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createLocationContributionThumbnail } from "@/lib/location-contribution-image";
import {
	LocationScreenshotEditor,
	type ScreenshotDraft,
} from "./location-screenshot-editor";

vi.mock("@/lib/location-contribution-image", () => ({
	createLocationContributionThumbnail: vi.fn(),
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function editor(screenshots: ScreenshotDraft[]) {
	return (
		<LocationScreenshotEditor
			disabled={false}
			maxScreenshots={10}
			screenshots={screenshots}
			onFilesAdded={vi.fn()}
			onMove={vi.fn()}
			onRemove={vi.fn()}
		/>
	);
}

it("only attaches thumbnail blobs and revokes them on removal", async () => {
	const blob = new Blob(["thumbnail"]);
	vi.mocked(createLocationContributionThumbnail).mockResolvedValue(blob);
	const createObjectURL = vi.fn(() => "blob:thumbnail");
	const revokeObjectURL = vi.fn();
	vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
	const file = new File(["original"], "original.png");
	const { container, rerender } = render(editor([{ file, key: "one" }]));
	expect(container.querySelector("img")).toBeNull();
	await waitFor(() =>
		expect(container.querySelector("img")?.getAttribute("src")).toBe(
			"blob:thumbnail",
		),
	);
	expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(blob);
	rerender(editor([]));
	expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:thumbnail");
});

it("cancels replaced files, ignores stale results, and displays errors", async () => {
	let finish!: (blob: Blob) => void;
	vi.mocked(createLocationContributionThumbnail)
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		)
		.mockRejectedValueOnce(new Error("Screenshot is not a valid PNG image"));
	const createObjectURL = vi.fn();
	vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
	const { container, rerender } = render(
		editor([{ file: new File(["first"], "first.png"), key: "one" }]),
	);
	const signal = vi
		.mocked(createLocationContributionThumbnail)
		.mock.calls.at(-1)?.[1];
	rerender(editor([{ file: new File(["second"], "second.png"), key: "one" }]));
	expect(signal?.aborted).toBe(true);
	await act(async () => finish(new Blob(["stale"])));
	expect((await screen.findByRole("alert")).textContent).toContain(
		"not a valid PNG",
	);
	expect(createObjectURL).not.toHaveBeenCalled();
	expect(container.querySelector("img")).toBeNull();
});

it("keeps published previews without decoding an original", () => {
	const { container } = render(
		editor([{ key: "saved", previewUrl: "/preview.webp" }]),
	);
	expect(container.querySelector("img")?.getAttribute("src")).toBe(
		"/preview.webp",
	);
});

it("does not attach a completed thumbnail after unmount", async () => {
	let finish!: (blob: Blob) => void;
	vi.mocked(createLocationContributionThumbnail).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	);
	const createObjectURL = vi.fn();
	vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
	const { unmount } = render(
		editor([{ key: "one", file: new File(["file"], "file.png") }]),
	);
	const signal = vi
		.mocked(createLocationContributionThumbnail)
		.mock.calls.at(-1)?.[1];
	unmount();
	expect(signal?.aborted).toBe(true);
	await act(async () => finish(new Blob(["thumbnail"])));
	expect(createObjectURL).not.toHaveBeenCalled();
});
