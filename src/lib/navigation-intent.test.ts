import { describe, expect, it } from "vitest";

import { isPlainNavigationClick } from "./navigation-intent";

const plainClick = {
	altKey: false,
	button: 0,
	ctrlKey: false,
	defaultPrevented: false,
	metaKey: false,
	shiftKey: false,
};

describe("navigation intent", () => {
	it("accepts an unmodified primary click", () => {
		expect(isPlainNavigationClick(plainClick)).toBe(true);
	});

	it("rejects modified, secondary, and prevented clicks", () => {
		expect(isPlainNavigationClick({ ...plainClick, ctrlKey: true })).toBe(
			false,
		);
		expect(isPlainNavigationClick({ ...plainClick, button: 1 })).toBe(false);
		expect(
			isPlainNavigationClick({ ...plainClick, defaultPrevented: true }),
		).toBe(false);
	});
});
