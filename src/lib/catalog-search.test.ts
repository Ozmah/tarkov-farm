import { describe, expect, it } from "vitest";

import {
	encodeDocumentFilters,
	encodeMapDocumentFilters,
	readSelectedDocumentIds,
	resolveMapDocumentIds,
	validateCatalogSearch,
} from "./catalog-search";

describe("catalog search", () => {
	it("normalizes, deduplicates, and validates document ids", () => {
		expect(
			readSelectedDocumentIds(
				" medical,financial,medical,<script>,project documentation ",
			),
		).toEqual(["medical", "financial"]);
	});

	it("resolves document filters within the current map", () => {
		const availableIds = ["financial", "medical", "project"];

		expect(resolveMapDocumentIds(undefined, availableIds)).toEqual(
			availableIds,
		);
		expect(
			resolveMapDocumentIds("project,unknown,financial", availableIds),
		).toEqual(["financial", "project"]);
		expect(resolveMapDocumentIds("unknown", availableIds)).toEqual(
			availableIds,
		);
	});

	it("omits the document query when every map document is selected", () => {
		const availableIds = ["financial", "medical", "project"];

		expect(
			encodeMapDocumentFilters(
				["project", "financial", "medical"],
				availableIds,
			),
		).toBeUndefined();
		expect(
			encodeMapDocumentFilters(["project", "financial"], availableIds),
		).toBe("financial,project");
	});

	it("rejects unsupported input and limits filter count", () => {
		expect(readSelectedDocumentIds(["medical"])).toEqual([]);
		expect(
			readSelectedDocumentIds(
				Array.from({ length: 25 }, (_, index) => `document-${index}`).join(","),
			),
		).toHaveLength(20);
	});

	it("produces canonical route search values", () => {
		expect(
			validateCatalogSearch({
				documents: "medical,medical,financial",
				location: "location-1",
				view: "main",
			}),
		).toEqual({
			documents: "medical,financial",
			location: "location-1",
			view: "main",
		});
		expect(validateCatalogSearch({ documents: "<invalid>" })).toEqual({
			documents: undefined,
			location: undefined,
			view: undefined,
		});
		expect(encodeDocumentFilters([])).toBeUndefined();
	});
});
