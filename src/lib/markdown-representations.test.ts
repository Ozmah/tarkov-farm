import { describe, expect, it } from "vitest";

import {
	type MarkdownCatalog,
	type MarkdownMapData,
	renderDocumentsMarkdown,
	renderHomeMarkdown,
	renderMapMarkdown,
} from "./markdown-representations";

const catalog = {
	maps: [
		{ id: "customs", name: "Customs" },
		{ id: "shoreline", name: "Shoreline" },
	],
	documents: [
		{
			id: "financial",
			name: "Financial documents",
			description: "Financial reports from TerraGroup.",
			imagePath: "/documents/financial.webp",
			isFilterable: true,
			isWildcard: false,
			acquisitionType: "raid",
			acquisitionSource: null,
		},
		{
			id: "classified",
			name: "Classified documents",
			description: "A wildcard document.",
			imagePath: "/documents/classified.webp",
			isFilterable: false,
			isWildcard: true,
			acquisitionType: "store",
			acquisitionSource: "Expansion Hub",
		},
	],
	documentMaps: [
		{ documentId: "financial", mapId: "customs" },
		{ documentId: "financial", mapId: "shoreline" },
	],
	documentLocations: [
		{
			id: "location-1",
			documentId: "financial",
			mapId: "customs",
			mapImageId: "customs-main",
		},
		{
			id: "location-2",
			documentId: "financial",
			mapId: "customs",
			mapImageId: "customs-main",
		},
	],
} satisfies MarkdownCatalog;

const mapData = {
	map: { id: "customs", name: "Customs", description: "Customs map." },
	images: [{ id: "customs-main", viewKey: "main", name: "Main map" }],
	locations: [
		{
			id: "location-1",
			mapImageId: "customs-main",
			documentId: "financial",
			documentName: "Financial documents",
			name: "Big Red office",
			description: "On the desk next to the laptop.",
			xBasisPoints: 1000,
			yBasisPoints: 1000,
			requiredKeys: [
				{
					id: "customs-office-key",
					name: "Customs office key",
					wikiUrl:
						"https://escapefromtarkov.fandom.com/wiki/Customs_office_key",
				},
			],
		},
		{
			id: "location-2",
			mapImageId: "customs-main",
			documentId: "financial",
			documentName: "Financial documents",
			name: "Trailer",
			description: "On the floor.",
			xBasisPoints: 2000,
			yBasisPoints: 1000,
			requiredKeys: [],
		},
	],
	screenshots: [
		{
			id: "screenshot-1",
			locationId: "location-1",
			path: "/screenshots/location-1/full.webp",
			altText: "Document on the office desk",
			caption: null,
			sortOrder: 0,
		},
	],
} satisfies MarkdownMapData;

describe("Markdown representations", () => {
	it("renders a compact site index from catalog totals", () => {
		const markdown = renderHomeMarkdown(catalog);

		expect(markdown).toContain(
			"Why? I just wanted to have everything on the same page, not 10 wiki tabs.",
		);
		expect(markdown).toContain("- Maps: 2");
		expect(markdown).toContain("- Published document locations: 2");
		expect(markdown).toContain(
			"[Shoreline](https://tarkov.farm/maps/shoreline): 0 locations",
		);
		expect(markdown).toContain("Accept: text/markdown");
		expect(markdown.endsWith("\n")).toBe(true);
	});

	it("renders document descriptions and filtered map links", () => {
		const markdown = renderDocumentsMarkdown(catalog);

		expect(markdown).toContain("# Battle Pass documents");
		expect(markdown).toContain(
			"https://tarkov.farm/maps/customs?documents=financial",
		);
		expect(markdown).toContain("- Acquisition: Expansion Hub");
	});

	it("renders compact map locations with stable detail links", () => {
		const markdown = renderMapMarkdown(
			catalog,
			mapData,
			new URL("https://tarkov.farm/maps/customs"),
		);

		expect(markdown).toContain("# Customs document locations");
		expect(markdown).toContain(
			"[1. Big Red office](https://tarkov.farm/maps/customs?location=location-1&view=main): On the desk next to the laptop.",
		);
		expect(markdown).toContain(
			"[2. Trailer](https://tarkov.farm/maps/customs?location=location-2&view=main): On the floor.",
		);
	});

	it("renders one selected location with keys and screenshots", () => {
		const markdown = renderMapMarkdown(
			catalog,
			mapData,
			new URL("https://tarkov.farm/maps/customs?location=location-1&view=main"),
		);

		expect(markdown).toContain("# Big Red office");
		expect(markdown).toContain("- Marker: 1");
		expect(markdown).toContain(
			"[Customs office key](https://escapefromtarkov.fandom.com/wiki/Customs_office_key)",
		);
		expect(markdown).toContain(
			"[Document on the office desk](https://tarkov.farm/screenshots/location-1/full.webp)",
		);
	});

	it("does not create executable links from untrusted catalog URLs", () => {
		const unsafeMapData = {
			...mapData,
			locations: [
				{
					...mapData.locations[0],
					requiredKeys: [
						{
							id: "unsafe",
							name: "Unsafe key",
							wikiUrl: "javascript:alert(1)",
						},
					],
				},
			],
		} satisfies MarkdownMapData;
		const markdown = renderMapMarkdown(
			catalog,
			unsafeMapData,
			new URL("https://tarkov.farm/maps/customs?location=location-1"),
		);

		expect(markdown).toContain("- Required keys: Unsafe key");
		expect(markdown).not.toContain("javascript:");
	});
});
