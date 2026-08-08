import { describe, expect, it } from "vitest";

import { parseSaveLocationInput } from "./editor-validation";

const validLocation = {
	mapImageId: "customs-main",
	name: "  Dorm room 214  ",
	description: "  On the desk  ",
	xBasisPoints: 2_500,
	yBasisPoints: 7_500,
	isActive: true,
	documentId: "financial",
};

describe("parseSaveLocationInput", () => {
	it("normalizes valid editor input", () => {
		expect(parseSaveLocationInput(validLocation)).toEqual({
			...validLocation,
			name: "Dorm room 214",
			description: "On the desk",
		});
	});

	it("rejects out-of-bounds coordinates", () => {
		expect(() =>
			parseSaveLocationInput({ ...validLocation, xBasisPoints: 10_001 }),
		).toThrow("X coordinate must be an integer between 0 and 10000");
	});

	it("requires a document identifier", () => {
		expect(() =>
			parseSaveLocationInput({
				...validLocation,
				documentId: undefined,
			}),
		).toThrow("Document identifier is invalid");
	});

	it("rejects multiple document identifiers", () => {
		expect(() =>
			parseSaveLocationInput({
				...validLocation,
				documentId: ["financial", "journal"],
			}),
		).toThrow("Document identifier is invalid");
	});

	it("rejects unsafe identifiers", () => {
		expect(() =>
			parseSaveLocationInput({
				...validLocation,
				mapImageId: "../../database",
			}),
		).toThrow("Map image is invalid");
	});
});
