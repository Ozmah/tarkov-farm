// @vitest-environment jsdom

import { useBlocker } from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapWorkspace } from "@/components/map/map-workspace";
import { getEditorData, importContributionLocation } from "@/functions/editor";
import { readLocationContributionArchive } from "@/lib/location-contribution-archive-reader";
import { LocalContributionImporter } from "./local-contribution-importer";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useBlocker: vi.fn(() => ({ status: "idle" })),
}));

vi.mock("@/components/map/map-workspace", () => ({
	MapWorkspace: vi.fn(() => <div>Map position review</div>),
}));

vi.mock("@/functions/editor", () => ({
	getEditorData: vi.fn(),
	importContributionLocation: vi.fn(),
}));

vi.mock("@/lib/location-contribution-archive-reader", () => ({
	readLocationContributionArchive: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getEditorData).mockResolvedValue(editorData);
	vi.mocked(readLocationContributionArchive).mockResolvedValue(reviewedArchive);
	vi.mocked(importContributionLocation).mockResolvedValue({
		id: "local-location",
		mapId: "reserve",
		mapImageId: "reserve-main",
	});
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		value: vi.fn(() => "blob:review"),
	});
	Object.defineProperty(URL, "revokeObjectURL", {
		configurable: true,
		value: vi.fn(),
	});
});

afterEach(cleanup);

describe("LocalContributionImporter", () => {
	it("requires explicit approval and saves through the contribution wrapper", async () => {
		const onImported = vi.fn().mockResolvedValue(undefined);
		render(
			<LocalContributionImporter data={editorData} onImported={onImported} />,
		);

		fireEvent.change(screen.getByLabelText("Choose ZIP bundle"), {
			target: {
				files: [new File(["archive"], "contribution.zip")],
			},
		});

		await waitFor(() =>
			expect(screen.getAllByText("White Pawn").length).toBeGreaterThan(0),
		);
		const mapProps = vi.mocked(MapWorkspace).mock.calls.at(-1)?.[0];
		expect(mapProps?.markers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "existing:existing-location",
					requiredKeyCount: 1,
				}),
				expect.objectContaining({
					id: "review:00000000-0000-4000-8000-000000000002",
					requiredKeyCount: 1,
				}),
			]),
		);
		expect(
			screen.getByRole("button", { name: "Import approved (0)" }),
		).toHaveProperty("disabled", true);

		fireEvent.click(
			screen.getAllByRole("checkbox", { name: "Approve White Pawn" })[0],
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Import approved (1)" }),
		);

		await waitFor(() =>
			expect(importContributionLocation).toHaveBeenCalledOnce(),
		);
		const importCall = vi.mocked(importContributionLocation).mock.calls[0];
		const importArguments = importCall?.[0];
		const formData = importArguments?.data;
		if (!(formData instanceof FormData)) throw new Error("Expected FormData");
		const payload = JSON.parse(String(formData.get("payload")));

		expect(formData.get("mapImageSha256")).toBe("a".repeat(64));
		expect(payload.location).toMatchObject({
			isActive: true,
			mapImageId: "reserve-main",
			name: "White Pawn",
		});
		expect(payload.location).not.toHaveProperty("id");
		expect(payload.screenshots).toEqual([
			{ altText: "Desk", caption: null, uploadIndex: 0 },
		]);
		expect(formData.getAll("screenshots")).toHaveLength(1);
		expect(onImported).toHaveBeenCalledOnce();
		expect(screen.getByText("Saved locally")).toBeTruthy();
	});

	it("protects navigation only while verified locations remain in memory", async () => {
		render(
			<LocalContributionImporter
				data={editorData}
				onImported={vi.fn().mockResolvedValue(undefined)}
			/>,
		);
		expect(latestBlockerOptions().disabled).toBe(true);

		fireEvent.change(screen.getByLabelText("Choose ZIP bundle"), {
			target: { files: [new File(["archive"], "contribution.zip")] },
		});
		await waitFor(() => expect(latestBlockerOptions().disabled).toBe(false));
		expect(latestBlockerOptions().enableBeforeUnload()).toBe(true);
	});
});

const screenshotFile = new File(["image"], "screenshot.png", {
	type: "image/png",
});

const reviewedArchive = {
	bundleId: "00000000-0000-4000-8000-000000000001",
	locations: [
		{
			description: "On the desk",
			documentId: "technical",
			id: "00000000-0000-4000-8000-000000000002",
			mapImageId: "reserve-main",
			mapImageSha256: "a".repeat(64),
			name: "White Pawn",
			requiredKeyIds: ["reserve-key"],
			screenshots: [
				{
					altText: "Desk",
					caption: null,
					file: screenshotFile,
					id: "00000000-0000-4000-8000-000000000003",
				},
			],
			xBasisPoints: 3_193,
			yBasisPoints: 1_527,
		},
	],
	warnings: [],
};

const editorData = {
	documentMaps: [{ documentId: "technical", mapId: "reserve" }],
	documents: [
		{
			id: "technical",
			imageHeight: 100,
			imagePath: "/technical.webp",
			imageWidth: 100,
			name: "Technical manual",
		},
	],
	keyMaps: [{ keyId: "reserve-key", mapId: "reserve" }],
	keys: [
		{
			id: "reserve-key",
			imageHeight: 64,
			imagePath: "/keys/reserve.webp",
			imageWidth: 64,
			name: "Reserve key",
			usedInQuest: false,
		},
	],
	locationDocuments: [],
	locationRequiredKeys: [
		{ keyId: "reserve-key", locationId: "existing-location" },
	],
	locations: [
		{
			description: "Existing reference",
			id: "existing-location",
			isActive: true,
			mapImageId: "reserve-main",
			name: "Existing location",
			xBasisPoints: 3_000,
			yBasisPoints: 1_500,
		},
	],
	mapImages: [
		{
			altText: "Reserve map",
			contentHash: "a".repeat(64),
			height: 1_000,
			id: "reserve-main",
			mapId: "reserve",
			name: "Main",
			path: "/reserve.webp",
			sources: [{ height: 1_000, path: "/reserve.webp", width: 1_000 }],
			viewKey: "main",
			width: 1_000,
		},
	],
	maps: [
		{ description: "Reserve", id: "reserve", isActive: true, name: "Reserve" },
	],
	screenshots: [],
};

function latestBlockerOptions() {
	const options = vi.mocked(useBlocker).mock.calls.at(-1)?.[0];
	if (!options) throw new Error("useBlocker was not called");
	return options as unknown as {
		disabled?: boolean;
		enableBeforeUnload: () => boolean;
	};
}
