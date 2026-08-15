import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseDocumentCatalog } from "./document-catalog";

const source = await readFile(
	resolve(process.cwd(), "data/catalog/documents.json"),
	"utf8",
);

describe("document catalog", () => {
	it("validates the canonical Battle Pass document catalog", () => {
		const catalog = parseDocumentCatalog(JSON.parse(source));

		expect(catalog.documents.map(({ id }) => id)).toEqual([
			"blueprints-technical",
			"classified",
			"financial",
			"medical",
			"pmc-personnel",
			"project",
			"technical",
			"test",
			"user",
		]);
		expect(
			Object.fromEntries(
				catalog.documents.map(({ id, mapIds }) => [id, mapIds]),
			),
		).toEqual({
			"blueprints-technical": ["factory", "interchange", "the-labyrinth"],
			classified: [],
			financial: ["customs", "interchange", "streets-of-tarkov"],
			medical: ["ground-zero", "the-lab", "the-labyrinth"],
			"pmc-personnel": ["icebreaker", "lighthouse", "reserve"],
			project: ["customs", "factory", "reserve"],
			technical: ["lighthouse", "shoreline", "woods"],
			test: ["icebreaker", "shoreline", "woods"],
			user: ["ground-zero", "streets-of-tarkov", "the-lab"],
		});
	});

	it("keeps Classified separate from farmable documents", () => {
		const catalog = parseDocumentCatalog(JSON.parse(source));
		const classified = catalog.documents.find(({ id }) => id === "classified");

		expect(classified).toMatchObject({
			acquisitionSource: "Expansion Hub",
			acquisitionType: "store",
			isFilterable: false,
			isWildcard: true,
			mapIds: [],
		});
		expect(
			catalog.documents.filter(({ isFilterable }) => isFilterable),
		).toHaveLength(8);
	});

	it("rejects map assignments on wildcard documents", () => {
		const invalid = JSON.parse(source);
		invalid.documents[1].mapIds = ["customs"];

		expect(() => parseDocumentCatalog(invalid)).toThrow(
			"Wildcard document classified cannot have map assignments",
		);
	});

	it("rejects document images that are not content-addressed", () => {
		const invalid = JSON.parse(source);
		invalid.documents[0].image.path = "/documents/untrusted.webp";

		expect(() => parseDocumentCatalog(invalid)).toThrow(
			"Document blueprints-technical image path is invalid",
		);
	});
});
