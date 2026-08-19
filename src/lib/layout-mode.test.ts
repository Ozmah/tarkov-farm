import { describe, expect, it } from "vitest";

import {
	createLayoutModeCookie,
	parseLayoutModeInput,
	readLayoutModeCookie,
} from "./layout-mode";

describe("layout mode preference", () => {
	it("accepts only the supported mutation values", () => {
		expect(parseLayoutModeInput({ layoutMode: "vertical" })).toEqual({
			layoutMode: "vertical",
		});
		expect(() => parseLayoutModeInput({ layoutMode: "portrait" })).toThrow(
			"Invalid layout mode",
		);
		expect(() => parseLayoutModeInput(null)).toThrow("Invalid layout mode");
	});

	it("falls back safely for missing or invalid cookies", () => {
		expect(readLayoutModeCookie(null)).toBe("standard");
		expect(
			readLayoutModeCookie("other=value; tarkov-farm-layout=vertical"),
		).toBe("vertical");
		expect(readLayoutModeCookie("tarkov-farm-layout=unexpected")).toBe(
			"standard",
		);
	});

	it("creates an HTTP-only same-site preference cookie", () => {
		const cookie = createLayoutModeCookie("vertical", true);

		expect(cookie).toContain("tarkov-farm-layout=vertical");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Secure");
	});
});
