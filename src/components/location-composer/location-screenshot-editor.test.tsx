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

it("opens screenshots full screen and offers marking only for local files", async () => {
	vi.mocked(createLocationContributionThumbnail).mockResolvedValue(
		new Blob(["thumbnail"]),
	);
	const createObjectURL = vi.fn(
		(source: Blob) => `blob:${source instanceof File ? source.name : "thumb"}`,
	);
	vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
	const file = new File(["original"], "local.png", { type: "image/png" });

	render(
		<LocationScreenshotEditor
			disabled={false}
			maxScreenshots={10}
			screenshots={[
				{ file, key: "local" },
				{ id: "saved", key: "saved", previewUrl: "/screenshots/saved.webp" },
			]}
			title="Crackhouse Library"
			onFilesAdded={vi.fn()}
			onMove={vi.fn()}
			onRemove={vi.fn()}
			onReplace={vi.fn()}
		/>,
	);

	// Published screenshots have no original file to mark.
	expect(
		screen.getAllByRole("button", { name: /^Mark screenshot/ }),
	).toHaveLength(1);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "View screenshot 1 full screen" }),
		).toBeTruthy(),
	);
	act(() =>
		screen
			.getByRole("button", { name: "View screenshot 1 full screen" })
			.click(),
	);
	// The viewer shows the full-resolution file, not the thumbnail.
	await waitFor(() =>
		expect(
			screen
				.getByRole("img", { name: "Crackhouse Library screenshot 1" })
				.getAttribute("src"),
		).toBe("blob:local.png"),
	);
});

it("hides marking when the form does not accept replacements", () => {
	render(editor([{ id: "saved", key: "saved", previewUrl: "/a.webp" }]));
	expect(screen.queryByRole("button", { name: /^Mark screenshot/ })).toBeNull();
});
