import { describe, expect, it } from "vitest";

import { parseImportRoots } from "./tarkov-farm";

describe("parseImportRoots", () => {
	it("always allows the repo inbox and adds optional folders", () => {
		expect(parseImportRoots([], "/repo")).toEqual([
			"/repo/assets/intake/inbox",
		]);
		expect(parseImportRoots(["--import-root", "/shots"], "/repo")).toEqual([
			"/repo/assets/intake/inbox",
			"/shots",
		]);
	});

	it("rejects relative folders and unknown arguments", () => {
		expect(() => parseImportRoots(["--import-root", "shots"], "/repo")).toThrow(
			"Usage",
		);
		expect(() => parseImportRoots(["--other", "/shots"], "/repo")).toThrow(
			"Usage",
		);
	});
});
