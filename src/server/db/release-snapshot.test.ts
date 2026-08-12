import { describe, expect, it } from "vitest";

import type { PublicationData } from "../../lib/publication-data";
import { buildReleaseSnapshotFromPublication } from "./release-snapshot";

const hash = (character: string) => character.repeat(64);
const catalog = {
	maps: [
		{
			id: "customs",
			name: "Customs",
			description: null,
			isActive: true,
		},
	],
	mapImages: [
		{
			id: "customs-main",
			mapId: "customs",
			viewKey: "main",
			name: "Main map",
			path: "/maps/customs.webp",
			altText: "Customs map",
			width: 1000,
			height: 800,
			contentHash: hash("a"),
			isCurrent: true,
		},
	],
	documents: [
		{
			id: "financial",
			name: "Financial documents",
			description: null,
			acquisitionType: "raid" as const,
			acquisitionSource: null,
			isFilterable: true,
			isWildcard: false,
			isActive: true,
		},
	],
	documentMaps: [
		{
			documentId: "financial",
			mapId: "customs",
			notes: null,
		},
	],
};
const screenshot = (id: string, sortOrder: number, active = true) => ({
	id,
	altText: `${id} alt text`,
	caption: null,
	full: {
		height: 1080,
		path: `/screenshots/location/${hash("b")}-1920.webp`,
		sha256: hash(id === "one" ? "c" : "d"),
		width: 1920,
	},
	isActive: active,
	preview: {
		height: 562,
		path: `/screenshots/location/${hash("b")}-1000.webp`,
		sha256: hash(id === "one" ? "e" : "f"),
		width: 1000,
	},
	sortOrder,
	sourceSha256: hash("b"),
});
const publication = (
	screenshots = [screenshot("one", 0)],
): PublicationData => ({
	formatVersion: 1,
	locations: [
		{
			description: "Visible description",
			documentId: "financial",
			id: "location",
			isActive: true,
			mapImageId: "customs-main",
			name: "Location",
			screenshots,
			xBasisPoints: 100,
			yBasisPoints: 200,
		},
		{
			description: null,
			documentId: "financial",
			id: "inactive-location",
			isActive: false,
			mapImageId: "customs-main",
			name: "Inactive",
			screenshots: [screenshot("inactive-screen", 0)],
			xBasisPoints: 0,
			yBasisPoints: 0,
		},
	],
});

describe("release snapshot builder", () => {
	it("includes only active publication state", () => {
		const snapshot = buildReleaseSnapshotFromPublication(
			publication([
				screenshot("one", 0),
				screenshot("inactive-screen", 1, false),
			]),
			catalog,
		);

		expect(snapshot.locations.map(({ id }) => id)).toEqual(["location"]);
		expect(snapshot.locations[0]?.screenshotIds).toEqual(["one"]);
	});

	it("fingerprints visible fields, content hashes, and publication order", () => {
		const first = buildReleaseSnapshotFromPublication(
			publication([screenshot("one", 0), screenshot("two", 1)]),
			catalog,
		).locations[0]?.fingerprint;
		const contentChanged = buildReleaseSnapshotFromPublication(
			publication([
				{
					...screenshot("one", 0),
					full: { ...screenshot("one", 0).full, sha256: hash("f") },
				},
				screenshot("two", 1),
			]),
			catalog,
		).locations[0]?.fingerprint;
		const reordered = buildReleaseSnapshotFromPublication(
			publication([screenshot("two", 0), screenshot("one", 1)]),
			catalog,
		).locations[0]?.fingerprint;
		const renamed = buildReleaseSnapshotFromPublication(
			{
				...publication(),
				locations: publication().locations.map((location) =>
					location.id === "location"
						? { ...location, name: "Renamed location" }
						: location,
				),
			},
			catalog,
		).locations[0]?.fingerprint;

		expect(new Set([first, contentChanged, reordered, renamed])).toHaveLength(
			4,
		);
	});
});
