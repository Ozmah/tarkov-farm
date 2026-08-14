import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseKeyCatalog } from "./key-catalog";

const source = await readFile(
	resolve(process.cwd(), "data/catalog/keys.json"),
	"utf8",
);

describe("key catalog", () => {
	it("validates the versioned static catalog", () => {
		const catalog = parseKeyCatalog(JSON.parse(source));
		expect(catalog.source.revision).toBe(353_194);
		expect(catalog.keys).toHaveLength(233);
	});

	it("rejects a path that is not content-addressed", () => {
		const invalid = JSON.parse(source);
		invalid.keys[0].image.path = "/keys/untrusted.webp";
		expect(() => parseKeyCatalog(invalid)).toThrow("Key image path is invalid");
	});
});
