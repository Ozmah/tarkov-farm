import { describe, expect, it } from "vitest";

import {
	type PublicationUpdatesData,
	parsePublicationUpdatesData,
	serializePublicationUpdatesData,
} from "./publication-updates";

const snapshot = {
	formatVersion: 1 as const,
	locations: [],
};

const validData: PublicationUpdatesData = {
	formatVersion: 1,
	updates: [
		{
			description: "Added the first set of document locations.",
			id: "first-update",
			publishedAt: "2026-08-10T15:30:00.000Z",
			snapshot,
			title: "Initial locations",
		},
	],
};

describe("publication updates", () => {
	it("parses and serializes canonical data deterministically", () => {
		const first = serializePublicationUpdatesData(validData);
		const second = serializePublicationUpdatesData(JSON.parse(first));

		expect(second).toBe(first);
		expect(parsePublicationUpdatesData(JSON.parse(first))).toEqual(validData);
		expect(first.endsWith("\n")).toBe(true);
		expect(first).toContain('\t"updates"');
		expect(first.indexOf('"id"')).toBeLessThan(first.indexOf('"publishedAt"'));
		expect(first.indexOf('"publishedAt"')).toBeLessThan(
			first.indexOf('"title"'),
		);
		expect(first.indexOf('"title"')).toBeLessThan(
			first.indexOf('"description"'),
		);
		expect(first.indexOf('"description"')).toBeLessThan(
			first.indexOf('"snapshot"'),
		);
	});

	it("sorts newest first and breaks date ties by identifier code point", () => {
		const parsed = parsePublicationUpdatesData({
			formatVersion: 1,
			updates: [
				validData.updates[0],
				{
					...validData.updates[0],
					id: "A-update",
				},
				{
					...validData.updates[0],
					id: "newest-update",
					publishedAt: "2026-08-11T00:00:00.000Z",
				},
			],
		});

		expect(parsed.updates.map(({ id }) => id)).toEqual([
			"newest-update",
			"A-update",
			"first-update",
		]);
	});

	it.each([
		"2026-08-10T15:30:00Z",
		"2026-08-10T17:30:00.000+02:00",
		"+010000-01-01T00:00:00.000Z",
		"not-a-date",
	])("rejects noncanonical publication date %s", (publishedAt) => {
		expect(() =>
			parsePublicationUpdatesData({
				...validData,
				updates: [{ ...validData.updates[0], publishedAt }],
			}),
		).toThrow("canonical UTC timestamp");
	});

	it("rejects unexpected fields and duplicate identifiers", () => {
		expect(() =>
			parsePublicationUpdatesData({
				...validData,
				unexpected: true,
			}),
		).toThrow("unexpected field unexpected");

		expect(() =>
			parsePublicationUpdatesData({
				formatVersion: 1,
				updates: [validData.updates[0], validData.updates[0]],
			}),
		).toThrow("Update identifiers contain duplicates");
	});

	it("requires and strictly parses each update snapshot", () => {
		const { snapshot: _snapshot, ...withoutSnapshot } = validData.updates[0];
		expect(() =>
			parsePublicationUpdatesData({
				formatVersion: 1,
				updates: [withoutSnapshot],
			}),
		).toThrow("Release snapshot must be an object");
		expect(() =>
			parsePublicationUpdatesData({
				formatVersion: 1,
				updates: [
					{
						...validData.updates[0],
						snapshot: { ...snapshot, unexpected: true },
					},
				],
			}),
		).toThrow("unexpected field unexpected");
	});

	it.each([
		{ field: "title", value: "  title  " },
		{ field: "title", value: "" },
		{ field: "title", value: "t".repeat(121) },
		{ field: "description", value: "  description  " },
		{ field: "description", value: "" },
		{ field: "description", value: "d".repeat(2_001) },
	])("rejects noncanonical $field", ({ field, value }) => {
		expect(() =>
			parsePublicationUpdatesData({
				...validData,
				updates: [{ ...validData.updates[0], [field]: value }],
			}),
		).toThrow("is not canonical");
	});
});
