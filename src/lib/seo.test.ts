import { describe, expect, it } from "vitest";

import { createCanonicalUrl, createSeoHead } from "./seo";

describe("SEO metadata", () => {
	it("removes search state and fragments from canonical URLs", () => {
		expect(
			createCanonicalUrl("/maps/reserve?location=secret&view=main#marker"),
		).toBe("https://tarkov.farm/maps/reserve");
	});

	it("rejects canonical URLs on another origin", () => {
		expect(createCanonicalUrl("https://example.com/maps/reserve")).toBe(
			"https://tarkov.farm/",
		);
	});

	it("uses matching canonical and social metadata", () => {
		const head = createSeoHead({
			description: "Reserve document locations.",
			pathname: "/maps/reserve",
			title: "Reserve Document Locations | Tarkov Farm",
		});

		expect(head.links).toEqual([
			{ rel: "canonical", href: "https://tarkov.farm/maps/reserve" },
		]);
		expect(head.meta).toContainEqual({
			property: "og:url",
			content: "https://tarkov.farm/maps/reserve",
		});
		expect(head.meta).toContainEqual({
			name: "twitter:card",
			content: "summary",
		});
	});
});
