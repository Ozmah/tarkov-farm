import { describe, expect, it } from "vitest";

import {
	parseSaveLocationFormData,
	parseSaveLocationInput,
} from "./editor-validation";

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

describe("parseSaveLocationFormData", () => {
	it("accepts one uploaded screenshot with metadata", () => {
		const file = new File(["image"], "view.png", { type: "image/png" });
		const formData = createLocationFormData(
			[
				{
					uploadIndex: 0,
					altText: "  Shelf beside the bed  ",
					caption: "  Enter through the window  ",
				},
			],
			[file],
		);

		expect(parseSaveLocationFormData(formData)).toEqual({
			location: parseSaveLocationInput(validLocation),
			screenshots: [
				{
					uploadIndex: 0,
					altText: "Shelf beside the bed",
					caption: "Enter through the window",
				},
			],
			files: [file],
		});
	});

	it("accepts retaining an existing screenshot without a new upload", () => {
		const formData = createLocationFormData([
			{
				id: "existing-screenshot",
				altText: "Shelf beside the bed",
				caption: null,
			},
		]);

		expect(parseSaveLocationFormData(formData).files).toEqual([]);
	});

	it("allows empty alt text when the location description is sufficient", () => {
		const formData = createLocationFormData([
			{
				id: "existing-screenshot",
				altText: "  ",
				caption: null,
			},
		]);

		expect(parseSaveLocationFormData(formData).screenshots[0]?.altText).toBe(
			"",
		);
	});

	it("rejects locations without screenshots", () => {
		expect(() => parseSaveLocationFormData(createLocationFormData([]))).toThrow(
			"A location requires between 1 and 10 screenshots",
		);
	});

	it("rejects uploads whose metadata is missing", () => {
		const file = new File(["image"], "view.png", { type: "image/png" });

		expect(() =>
			parseSaveLocationFormData(
				createLocationFormData(
					[
						{
							id: "existing-screenshot",
							altText: "Shelf beside the bed",
							caption: null,
						},
					],
					[file],
				),
			),
		).toThrow("Screenshot uploads do not match their metadata");
	});
});

function createLocationFormData(screenshots: unknown[], files: File[] = []) {
	const formData = new FormData();
	formData.set(
		"payload",
		JSON.stringify({ location: validLocation, screenshots }),
	);

	for (const file of files) {
		formData.append("screenshots", file);
	}

	return formData;
}
