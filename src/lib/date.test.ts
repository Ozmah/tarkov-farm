import { describe, expect, it } from "vitest";

import {
	datetimeLocalToInstantString,
	formatInstantDate,
	instantStringToDatetimeLocal,
	parseCanonicalInstant,
} from "./date";

describe("date utilities", () => {
	it("round-trips Mexico City wall time through a UTC instant", () => {
		const instant = datetimeLocalToInstantString("2026-08-11T21:15");

		expect(instant).toBe("2026-08-12T03:15:00.000Z");
		expect(instantStringToDatetimeLocal(instant)).toBe("2026-08-11T21:15");
	});

	it("validates canonical instants with real calendar dates", () => {
		expect(parseCanonicalInstant("2028-02-29T12:00:00.000Z").toString()).toBe(
			"2028-02-29T12:00:00Z",
		);
		expect(() => parseCanonicalInstant("2026-02-29T12:00:00.000Z")).toThrow(
			"canonical UTC instant",
		);
		expect(() => parseCanonicalInstant("2026-08-12T03:15:00Z")).toThrow(
			"canonical UTC instant",
		);
	});

	it("formats in the application timezone", () => {
		expect(
			formatInstantDate("2026-08-12T03:15:00.000Z", {
				dateStyle: "medium",
				timeStyle: "short",
			}),
		).toContain("Aug 11, 2026");
	});
});
