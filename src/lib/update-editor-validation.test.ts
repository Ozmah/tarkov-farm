import { describe, expect, it } from "vitest";

import {
	parseDeleteUpdateInput,
	parseSaveUpdateInput,
} from "./update-editor-validation";

const validUpdate = {
	description: "  Added new locations.  ",
	publishedAt: "2026-08-11T12:00:00.000Z",
	title: "  New locations  ",
};

describe("update editor validation", () => {
	it("normalizes valid save input", () => {
		expect(parseSaveUpdateInput(validUpdate)).toEqual({
			...validUpdate,
			description: "Added new locations.",
			title: "New locations",
		});
	});

	it("accepts a safe identifier when editing", () => {
		expect(parseSaveUpdateInput({ ...validUpdate, id: "update_1" }).id).toBe(
			"update_1",
		);
		expect(parseDeleteUpdateInput({ id: "update_1" })).toEqual({
			id: "update_1",
		});
	});

	it("rejects noncanonical dates, unsafe identifiers, and unexpected fields", () => {
		expect(() =>
			parseSaveUpdateInput({
				...validUpdate,
				publishedAt: "2026-08-11T12:00:00Z",
			}),
		).toThrow("canonical UTC timestamp");
		expect(() =>
			parseSaveUpdateInput({
				...validUpdate,
				publishedAt: "+010000-01-01T00:00:00.000Z",
			}),
		).toThrow("canonical UTC timestamp");
		expect(() => parseDeleteUpdateInput({ id: "../update" })).toThrow(
			"Update identifier is invalid",
		);
		expect(() =>
			parseSaveUpdateInput({ ...validUpdate, isPublished: true }),
		).toThrow("unexpected field isPublished");
	});

	it("enforces title and description lengths", () => {
		expect(() =>
			parseSaveUpdateInput({ ...validUpdate, title: " ".repeat(10) }),
		).toThrow("Update title must contain between 1 and 120 characters");
		expect(() =>
			parseSaveUpdateInput({
				...validUpdate,
				description: "d".repeat(2_001),
			}),
		).toThrow("Update description must contain between 1 and 2000 characters");
	});
});
