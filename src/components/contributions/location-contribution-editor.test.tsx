// @vitest-environment jsdom

import { useBlocker } from "@tanstack/react-router";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationComposerForm } from "@/components/location-composer/location-composer-form";
import { MapCanvas } from "@/components/location-composer/map-canvas";
import { ContributionTray } from "./contribution-tray";
import { LocationContributionEditor } from "./location-contribution-editor";

vi.mock("@/components/location-composer/location-composer-form", () => ({
	LocationComposerForm: vi.fn(() => null),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useBlocker: vi.fn(() => ({ status: "idle" })),
}));

vi.mock("@/components/location-composer/map-canvas", () => ({
	MapCanvas: vi.fn(() => null),
}));

vi.mock("./contribution-tray", () => ({
	ContributionTray: vi.fn(() => null),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(cleanup);

describe("LocationContributionEditor", () => {
	it("stages, edits, and removes a location without persistence", async () => {
		render(
			<LocationContributionEditor catalog={catalog} initialMapId="woods" />,
		);

		expect(latestComposerProps().draft.mapImageId).toBe("woods-main");
		expect(latestMapProps().image.path).toBe("/woods.webp");
		expect(latestMapProps().locations).toContainEqual(
			expect.objectContaining({
				appearance: "reference",
				clusterable: false,
				id: "published:published-location",
				markerLabel: "",
				selectable: false,
			}),
		);

		act(() => {
			latestComposerProps().onDraftChange("name", "USEC camp");
			latestComposerProps().onScreenshotFilesAdded([createScreenshot()]);
		});

		act(() => latestComposerProps().onSubmit());

		await waitFor(() => expect(latestTrayProps().locations).toHaveLength(1));
		const [staged] = latestTrayProps().locations;
		expect(staged?.name).toBe("USEC camp");
		expect(latestComposerProps().draft.name).toBe("");

		act(() => latestTrayProps().onEdit(staged?.id ?? ""));
		expect(latestComposerProps().draft.name).toBe("USEC camp");
		expect(latestComposerProps().submitLabel).toBe("Update tray");

		act(() => {
			latestComposerProps().onDraftChange("name", "USEC camp convoy");
		});
		act(() => latestComposerProps().onSubmit());

		await waitFor(() =>
			expect(latestTrayProps().locations[0]?.name).toBe("USEC camp convoy"),
		);
		expect(latestTrayProps().locations[0]?.id).toBe(staged?.id);

		act(() => latestTrayProps().onRemove(staged?.id ?? ""));
		expect(latestTrayProps().locations).toHaveLength(0);
	});

	it("rejects invalid files before adding them to the composer", () => {
		render(<LocationContributionEditor catalog={catalog} />);

		act(() => {
			latestComposerProps().onScreenshotFilesAdded([
				new File(["not an image"], "payload.txt", { type: "text/plain" }),
			]);
		});

		expect(latestComposerProps().screenshots).toHaveLength(0);
		expect(latestComposerProps().error).toContain("JPEG, PNG, or WebP");
	});

	it("enables navigation protection only after in-memory work begins", () => {
		render(<LocationContributionEditor catalog={catalog} />);

		expect(latestBlockerOptions().disabled).toBe(true);

		act(() => {
			latestComposerProps().onDraftChange("name", "Unsaved location");
		});

		expect(latestBlockerOptions().disabled).toBe(false);
		const enableBeforeUnload = latestBlockerOptions().enableBeforeUnload;
		expect(
			typeof enableBeforeUnload === "function"
				? enableBeforeUnload()
				: enableBeforeUnload,
		).toBe(true);
		expect(
			latestBlockerOptions().shouldBlockFn({
				action: "PUSH",
				current: { pathname: "/contribute/editor" },
				next: { pathname: "/maps/customs" },
			} as never),
		).toBe(true);
	});
});

const catalog: React.ComponentProps<
	typeof LocationContributionEditor
>["catalog"] = {
	documentMaps: [{ documentId: "technical", mapId: "woods" }],
	documents: [{ id: "technical", name: "Technical manual" }],
	keyMaps: [],
	keys: [],
	locations: [
		{
			id: "published-location",
			mapImageId: "woods-main",
			name: "Published location",
			xBasisPoints: 4_000,
			yBasisPoints: 6_000,
		},
	],
	mapImages: [
		{
			altText: "Woods map",
			height: 1_000,
			id: "woods-main",
			mapId: "woods",
			name: "Main",
			path: "/woods.webp",
			sha256: "a".repeat(64),
			sources: [{ height: 1_000, path: "/woods.webp", width: 1_000 }],
			width: 1_000,
		},
	],
	maps: [{ id: "woods", name: "Woods" }],
};

function latestComposerProps() {
	const props = vi.mocked(LocationComposerForm).mock.calls.at(-1)?.[0];
	if (!props) throw new Error("LocationComposerForm was not rendered");
	return props;
}

function latestMapProps() {
	const props = vi.mocked(MapCanvas).mock.calls.at(-1)?.[0];
	if (!props) throw new Error("MapCanvas was not rendered");
	return props;
}

function latestTrayProps() {
	const props = vi.mocked(ContributionTray).mock.calls.at(-1)?.[0];
	if (!props) throw new Error("ContributionTray was not rendered");
	return props;
}

function latestBlockerOptions() {
	const options = vi.mocked(useBlocker).mock.calls.at(-1)?.[0];
	if (!options) throw new Error("useBlocker was not called");
	return options as unknown as {
		disabled?: boolean;
		enableBeforeUnload?: boolean | (() => boolean);
		shouldBlockFn: (options: unknown) => boolean | Promise<boolean>;
	};
}

function createScreenshot() {
	const file = new File(["screenshot"], "location.png", {
		type: "image/png",
	});

	if (!("arrayBuffer" in file)) {
		Object.defineProperty(file, "arrayBuffer", {
			value: async () => new TextEncoder().encode("screenshot").buffer,
		});
	}

	return file;
}
