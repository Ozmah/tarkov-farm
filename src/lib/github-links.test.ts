import { describe, expect, it } from "vitest";

import {
	buildContributionBundleIssueUrl,
	buildLocationIssueUrl,
	buildProblemIssueUrl,
} from "./github-links";

describe("GitHub contribution links", () => {
	it("prefills map and page context for problem reports", () => {
		const url = new URL(
			buildProblemIssueUrl({
				currentHref: "/maps/reserve?location=location-1&view=main",
				mapName: "Reserve",
			}),
		);

		expect(url.pathname).toBe("/Ozmah/tarkov-farm/issues/new");
		expect(url.searchParams.get("template")).toBe("report-a-problem.yml");
		expect(url.searchParams.get("map")).toBe("Reserve");
		expect(url.searchParams.get("page")).toBe(
			"https://tarkov.farm/maps/reserve?location=location-1&view=main",
		);
		expect(url.searchParams.get("title")).toBe("[Problem][Reserve] ");
	});

	it("rejects external page context", () => {
		const url = new URL(
			buildLocationIssueUrl({
				currentHref: "https://example.com/not-tarkov-farm",
				mapName: "Factory",
			}),
		);

		expect(url.searchParams.get("template")).toBe("new-location.yml");
		expect(url.searchParams.has("page")).toBe(false);
	});

	it("opens the dedicated multi-location bundle form", () => {
		const url = new URL(buildContributionBundleIssueUrl());

		expect(url.pathname).toBe("/Ozmah/tarkov-farm/issues/new");
		expect(url.searchParams.get("template")).toBe("contribution-bundle.yml");
		expect(url.searchParams.has("map")).toBe(false);
	});
});
