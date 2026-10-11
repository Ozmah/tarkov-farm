// @vitest-environment node
import { rename, rm } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	parseMapGenerationArguments,
	planMapMasterSources,
	replaceMapMasterDirectory,
} from "./map-master-generation";

vi.mock("node:fs/promises", () => ({ rename: vi.fn(), rm: vi.fn() }));

afterEach(() => vi.resetAllMocks());

describe("map generation planning", () => {
	it("requires complete originals for full generation", () => {
		expect(() =>
			planMapMasterSources(["a.png"], [{ file: "a.webp" }, { file: "b.webp" }]),
		).toThrow("Missing originals for: b.webp");
	});

	it("selects exactly one existing map without requiring unrelated originals", () => {
		expect(
			planMapMasterSources(
				["a.png"],
				[{ file: "a.webp" }, { file: "b.webp" }],
				"a.png",
			),
		).toEqual(["a.png"]);
	});

	it.each([
		["a.png", "a.jpg"],
		["a.png", "A.PNG"],
		["../a.png"],
		["a-1280w.tmp.webp"],
		["a-1280w-0123456789ab.webp"],
	])("rejects unsafe or colliding sources: %j", (...files) => {
		expect(() => planMapMasterSources(files, [])).toThrow();
	});

	it.each([
		["--only"],
		["--only", "../a.png"],
		["--only", "a.png", "--responsive-only"],
		["--responsive-only", "unexpected"],
		["--unknown"],
	])("rejects invalid CLI arguments: %j", (...args) => {
		expect(() => parseMapGenerationArguments(args)).toThrow("Usage:");
	});

	it("rejects missing selected originals and unknown maps", () => {
		expect(() => planMapMasterSources([], [], "a.png")).toThrow("missing");
		expect(() => planMapMasterSources(["a.png"], [], "a.png")).toThrow(
			"existing map",
		);
	});
});

describe("map publication recovery", () => {
	it("discards the backup only after publication succeeds", async () => {
		await replaceMapMasterDirectory("stage", "output", "backup");
		expect(vi.mocked(rename).mock.calls).toEqual([
			["output", "backup"],
			["stage", "output"],
		]);
		expect(rm).toHaveBeenCalledWith("backup", { recursive: true, force: true });
	});

	it("restores existing assets on publication failure", async () => {
		const failure = new Error("publication failed");
		vi.mocked(rename)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(failure)
			.mockResolvedValueOnce(undefined);
		await expect(
			replaceMapMasterDirectory("stage", "output", "backup"),
		).rejects.toBe(failure);
		expect(rename).toHaveBeenLastCalledWith("backup", "output");
		expect(rm).not.toHaveBeenCalled();
	});

	it("preserves the backup if restoration also fails", async () => {
		vi.mocked(rename)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("publication failed"))
			.mockRejectedValueOnce(new Error("restoration failed"));
		await expect(
			replaceMapMasterDirectory("stage", "output", "backup"),
		).rejects.toThrow("Previous assets are preserved at backup");
		expect(rm).not.toHaveBeenCalled();
	});

	it("does not publish or delete anything when moving existing output fails", async () => {
		vi.mocked(rename).mockRejectedValueOnce(new Error("access denied"));
		await expect(
			replaceMapMasterDirectory("stage", "output", "backup"),
		).rejects.toThrow("access denied");
		expect(rename).toHaveBeenCalledTimes(1);
		expect(rm).not.toHaveBeenCalled();
	});
});
