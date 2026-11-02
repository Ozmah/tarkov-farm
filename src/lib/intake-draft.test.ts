import { describe, expect, it } from "vitest";

import {
	parseIntakeContributor,
	parseIntakeDraftValues,
	parseIntakeNotes,
} from "./intake-draft";

describe("intake draft values", () => {
	it("fills omitted fields and normalizes keys", () => {
		expect(
			parseIntakeDraftValues({ requiredKeyIds: ["b-key", "a-key", "b-key"] }),
		).toEqual({
			name: "",
			description: "",
			mapImageId: null,
			documentId: null,
			requiredKeyIds: ["a-key", "b-key"],
		});
	});

	it("treats empty identifiers as omitted", () => {
		expect(parseIntakeDraftValues({ documentId: "" }).documentId).toBeNull();
	});

	it("rejects unknown fields, unsafe IDs, and control characters", () => {
		expect(() => parseIntakeDraftValues({ point: { x: 1 } })).toThrow(
			"unsupported fields: point",
		);
		expect(() => parseIntakeDraftValues({ documentId: "../user" })).toThrow(
			"identifier is invalid",
		);
		expect(() => parseIntakeNotes("bell\u0007")).toThrow("control characters");
		expect(parseIntakeNotes("line\nnext\ttab")).toBe("line\nnext\ttab");
	});

	it("accepts a one-line contributor handle", () => {
		expect(parseIntakeContributor(undefined)).toBe("");
		expect(parseIntakeContributor("Some Name")).toBe("Some Name");
		expect(() => parseIntakeContributor("@a\n@b")).toThrow("single line");
		expect(() => parseIntakeContributor("x".repeat(101))).toThrow("at most");
	});
});
