import { describe, expect, it } from "vitest";

import { createSitemapXml } from "./sitemap";

describe("sitemap", () => {
	it("includes static pages and unique map URLs", () => {
		const sitemap = createSitemapXml(["reserve", "customs", "reserve"]);

		expect(sitemap).toContain("<loc>https://tarkov.farm/</loc>");
		expect(sitemap).toContain("<loc>https://tarkov.farm/contribute</loc>");
		expect(sitemap).toContain("<loc>https://tarkov.farm/maps/reserve</loc>");
		expect(sitemap.match(/maps\/reserve/g)).toHaveLength(1);
		expect(sitemap).not.toContain("/editor");
		expect(sitemap).not.toContain("/health");
	});
});
