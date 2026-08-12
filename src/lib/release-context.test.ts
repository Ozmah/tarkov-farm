import { describe, expect, it } from "vitest";

import {
	compareReleaseSnapshots,
	parseReleaseSnapshot,
	type ReleaseSnapshot,
} from "./release-context";

const hash = (character: string) => character.repeat(64);
const location = (
	id: string,
	overrides: Partial<ReleaseSnapshot["locations"][number]> = {},
): ReleaseSnapshot["locations"][number] => ({
	id,
	name: `Location ${id}`,
	mapId: "customs",
	mapName: "Customs",
	documentId: "financial",
	documentName: "Financial documents",
	fingerprint: hash("a"),
	screenshotIds: [`${id}-screen`],
	...overrides,
});
const snapshot = (
	locations: ReleaseSnapshot["locations"],
): ReleaseSnapshot => ({ formatVersion: 1, locations });

describe("release context", () => {
	it("canonicalizes locations and screenshot IDs by code point", () => {
		const parsed = parseReleaseSnapshot(
			snapshot([
				location("z", { screenshotIds: ["z-screen", "B-screen"] }),
				location("A"),
			]),
		);

		expect(parsed.locations.map(({ id }) => id)).toEqual(["A", "z"]);
		expect(parsed.locations[1]?.screenshotIds).toEqual([
			"B-screen",
			"z-screen",
		]);
	});

	it("rejects unexpected fields, unsafe values, and duplicate IDs", () => {
		expect(() =>
			parseReleaseSnapshot({ ...snapshot([]), extra: true }),
		).toThrow("unexpected field extra");
		expect(() => parseReleaseSnapshot(snapshot([location("bad id")]))).toThrow(
			"identifier is invalid",
		);
		expect(() =>
			parseReleaseSnapshot(snapshot([location("same"), location("same")])),
		).toThrow("location identifiers contain duplicates");
		expect(() =>
			parseReleaseSnapshot(
				snapshot([
					location("one", { screenshotIds: ["shared"] }),
					location("two", { screenshotIds: ["shared"] }),
				]),
			),
		).toThrow("screenshot identifiers contain duplicates");
		expect(() =>
			parseReleaseSnapshot(
				snapshot([location("one", { fingerprint: "A".repeat(64) })]),
			),
		).toThrow("lowercase SHA-256");
	});

	it("keeps the maximum structural snapshot below the persistence limit", () => {
		const maximum = parseReleaseSnapshot(
			snapshot(
				Array.from({ length: 500 }, (_, index) =>
					location(`location-${index}`, {
						name: "n".repeat(120),
						mapName: "m".repeat(120),
						documentName: "d".repeat(120),
						screenshotIds: Array.from(
							{ length: 10 },
							(_, screenshotIndex) =>
								`location-${index}-screenshot-${screenshotIndex}-${"x".repeat(60)}`,
						),
					}),
				),
			),
		);

		expect(
			new TextEncoder().encode(JSON.stringify(maximum)).byteLength,
		).toBeLessThan(1_048_576);
	});

	it("partitions additions, modifications, and removals and counts screenshots", () => {
		const context = compareReleaseSnapshots(
			snapshot([
				location("removed", { screenshotIds: ["gone"] }),
				location("modified", { screenshotIds: ["kept", "removed-screen"] }),
			]),
			snapshot([
				location("added", { screenshotIds: ["new-one", "new-two"] }),
				location("modified", {
					fingerprint: hash("b"),
					screenshotIds: ["kept", "added-screen"],
				}),
			]),
			"git-head",
		);

		expect(context.baselineSource).toBe("git-head");
		expect(context.currentTotals).toEqual({
			locations: 2,
			screenshots: 4,
			maps: 1,
		});
		expect(context.deltas).toEqual({
			locationsAdded: 1,
			locationsModified: 1,
			locationsRemoved: 1,
			screenshotsAdded: 3,
			screenshotsRemoved: 2,
		});
		expect(context.locations.added.map(({ id }) => id)).toEqual(["added"]);
		expect(context.locations.modified.map(({ id }) => id)).toEqual([
			"modified",
		]);
		expect(context.locations.removed.map(({ id }) => id)).toEqual(["removed"]);
	});

	it("treats snapshot absence as inactive and unions both sides of moves", () => {
		const context = compareReleaseSnapshots(
			snapshot([
				location("moved", {
					mapId: "customs",
					mapName: "Customs",
					documentId: "financial",
					documentName: "Financial documents",
				}),
				location("inactive", { mapId: "customs", mapName: "Customs" }),
			]),
			snapshot([
				location("moved", {
					mapId: "reserve",
					mapName: "Reserve",
					documentId: "project",
					documentName: "Project documentation",
					fingerprint: hash("b"),
				}),
			]),
			"latest-update",
		);

		expect(context.affectedMaps.map(({ id }) => id)).toEqual([
			"customs",
			"reserve",
		]);
		expect(context.affectedDocuments.map(({ id }) => id)).toEqual([
			"financial",
			"project",
		]);
		expect(
			context.affectedMaps.filter(({ id }) => id === "customs"),
		).toHaveLength(1);
		expect(context.locations.removed.map(({ id }) => id)).toEqual(["inactive"]);
	});
});
