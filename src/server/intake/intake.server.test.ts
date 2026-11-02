import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SaveLocationFormInput } from "@/lib/editor-validation";

const { store, saveEditorLocation, readEditorData, republishEditorLocation } =
	vi.hoisted(() => ({
		store: { get: vi.fn(), publish: vi.fn(), dismiss: vi.fn(), list: vi.fn() },
		saveEditorLocation: vi.fn(),
		readEditorData: vi.fn(),
		republishEditorLocation: vi.fn(),
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
		republishEditorLocation,
		saveEditorLocation,
	};
});
vi.mock("./draft-store", () => ({ createIntakeDraftStore: () => store }));

import { LocationAlreadyExistsError } from "@/server/editor/editor.server";
import {
	dismissIntakeDraft,
	listPendingIntakeDrafts,
	saveIntakeDraftLocation,
} from "./intake.server";

const draft = {
	id: "6c2f176f-31a9-4156-aa23-d86c65a2f4b1",
	locationId: "loc-1",
	status: "pending",
};
const target = { id: "loc-1", mapId: "customs", mapImageId: "customs-v1" };
const input = {} as SaveLocationFormInput;

beforeEach(() => {
	vi.clearAllMocks();
	store.get.mockResolvedValue(draft);
});

describe("saveIntakeDraftLocation", () => {
	it("saves the location and publishes the draft", async () => {
		saveEditorLocation.mockResolvedValue(target);

		await expect(
			saveIntakeDraftLocation(draft.id, input, "@fixed"),
		).resolves.toEqual({
			target,
			acknowledgedOnly: false,
		});
		expect(saveEditorLocation).toHaveBeenCalledWith(input, {
			newLocationId: draft.locationId,
		});
		expect(store.publish).toHaveBeenCalledWith(draft.id, {
			contributor: "@fixed",
		});
	});

	it("only acknowledges a location an earlier attempt already saved, and says so", async () => {
		saveEditorLocation.mockRejectedValue(
			new LocationAlreadyExistsError(draft.locationId),
		);
		readEditorData.mockResolvedValue({
			locations: [{ id: target.id, mapImageId: target.mapImageId }],
			mapImages: [{ id: target.mapImageId, mapId: target.mapId }],
		});

		await expect(
			saveIntakeDraftLocation(draft.id, input, "@fixed"),
		).resolves.toEqual({
			target,
			acknowledgedOnly: true,
		});
		// Repairs a manifest the first attempt may not have written.
		expect(republishEditorLocation).toHaveBeenCalledWith(target);
		expect(store.publish).toHaveBeenCalledWith(draft.id, {
			contributor: "@fixed",
		});
	});

	it("does not publish the draft when the save fails for another reason", async () => {
		saveEditorLocation.mockRejectedValue(new Error("disk full"));

		await expect(
			saveIntakeDraftLocation(draft.id, input, "@fixed"),
		).rejects.toThrow("disk full");
		expect(store.publish).not.toHaveBeenCalled();
	});

	it("does not let a dismissal slip in between the pending check and the publish", async () => {
		let finishSave = () => {};
		saveEditorLocation.mockReturnValue(
			new Promise((resolve) => {
				finishSave = () => resolve(target);
			}),
		);
		const saving = saveIntakeDraftLocation(draft.id, input);
		const dismissing = dismissIntakeDraft(draft.id);
		await Promise.resolve();
		expect(store.dismiss).not.toHaveBeenCalled();

		finishSave();
		await saving;
		await dismissing;
		expect(store.publish.mock.invocationCallOrder[0]).toBeLessThan(
			store.dismiss.mock.invocationCallOrder[0] ?? 0,
		);
	});
});

describe("listPendingIntakeDrafts", () => {
	it("reports problems instead of failing the editor loader", async () => {
		store.list.mockRejectedValue(new Error("EACCES"));
		await expect(listPendingIntakeDrafts()).resolves.toEqual({
			drafts: [],
			problem: "Drafts could not be listed: EACCES",
		});
	});
});
