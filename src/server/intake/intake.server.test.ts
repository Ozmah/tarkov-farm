import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SaveLocationFormInput } from "@/lib/editor-validation";

const { store, saveEditorLocation, readEditorData } = vi.hoisted(() => ({
	store: { get: vi.fn(), setStatus: vi.fn(), list: vi.fn() },
	saveEditorLocation: vi.fn(),
	readEditorData: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/editor/access.server", () => ({
	assertLocalEditorAccess: vi.fn(),
}));
vi.mock("@/server/editor/editor.server", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/editor/editor.server")>();
	return {
		LocationAlreadyExistsError: actual.LocationAlreadyExistsError,
		readEditorData,
		saveEditorLocation,
	};
});
vi.mock("./draft-store", () => ({ createIntakeDraftStore: () => store }));

import { LocationAlreadyExistsError } from "@/server/editor/editor.server";
import { saveIntakeDraftLocation } from "./intake.server";

const draft = { id: "draft-1", locationId: "loc-1", status: "pending" };
const target = { id: "loc-1", mapId: "customs", mapImageId: "customs-v1" };
const input = {} as SaveLocationFormInput;

beforeEach(() => {
	vi.clearAllMocks();
	store.get.mockResolvedValue(draft);
});

describe("saveIntakeDraftLocation", () => {
	it("saves the location and publishes the draft", async () => {
		saveEditorLocation.mockResolvedValue(target);

		await expect(saveIntakeDraftLocation(draft.id, input)).resolves.toEqual({
			target,
			acknowledgedOnly: false,
		});
		expect(saveEditorLocation).toHaveBeenCalledWith(input, {
			newLocationId: draft.locationId,
		});
		expect(store.setStatus).toHaveBeenCalledWith(draft.id, "published");
	});

	it("only acknowledges a location an earlier attempt already saved, and says so", async () => {
		saveEditorLocation.mockRejectedValue(
			new LocationAlreadyExistsError(draft.locationId),
		);
		readEditorData.mockResolvedValue({
			locations: [{ id: target.id, mapImageId: target.mapImageId }],
			mapImages: [{ id: target.mapImageId, mapId: target.mapId }],
		});

		await expect(saveIntakeDraftLocation(draft.id, input)).resolves.toEqual({
			target,
			acknowledgedOnly: true,
		});
		expect(store.setStatus).toHaveBeenCalledWith(draft.id, "published");
	});

	it("does not publish the draft when the save fails for another reason", async () => {
		saveEditorLocation.mockRejectedValue(new Error("disk full"));

		await expect(saveIntakeDraftLocation(draft.id, input)).rejects.toThrow(
			"disk full",
		);
		expect(store.setStatus).not.toHaveBeenCalled();
	});
});
