import { describe, expect, it } from "vitest";

import { getLocationScreenshotAltText } from "./location-screenshot-text";

describe("location screenshot text", () => {
	it("prefers existing metadata, then the location description and name", () => {
		const location = { description: "On the desk", name: "White Pawn" };

		expect(getLocationScreenshotAltText(location, "Document by the lamp")).toBe(
			"Document by the lamp",
		);
		expect(getLocationScreenshotAltText(location, "")).toBe("On the desk");
		expect(
			getLocationScreenshotAltText(
				{ description: null, name: "White Pawn" },
				"",
			),
		).toBe("White Pawn screenshot");
	});
});
