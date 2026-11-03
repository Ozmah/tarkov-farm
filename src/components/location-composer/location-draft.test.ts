import { describe, expect, it } from "vitest";

import { hasLocationComposerChanges } from "./location-draft";

const draft = {
	description: "Behind the desk",
	documentId: "project",
	mapImageId: "customs-main",
	name: "Crackhouse Library",
	requiredKeyIds: ["a", "b"],
	xBasisPoints: 5_811,
	yBasisPoints: 3_451,
};
const file = new File(["png"], "shot.png", { type: "image/png" });
const saved = { id: "saved", key: "saved" };
const baseline = { draft, screenshots: [saved, { file, key: "new" }] };

describe("hasLocationComposerChanges", () => {
	it("ignores key order and treats an untouched composer as unchanged", () => {
		expect(
			hasLocationComposerChanges(baseline, {
				draft: { ...draft, requiredKeyIds: ["b", "a"] },
				screenshots: [...baseline.screenshots],
			}),
		).toBe(false);
	});

	it("detects field, position, key, screenshot order, and annotation changes", () => {
		const changes = [
			{ draft: { ...draft, name: "Library" } },
			{ draft: { ...draft, xBasisPoints: 5_812 } },
			{ draft: { ...draft, requiredKeyIds: ["a"] } },
			{ screenshots: [...baseline.screenshots].reverse() },
			{
				screenshots: [
					saved,
					{ file: new File(["png"], "annotated.png"), key: "new" },
				],
			},
		];

		for (const change of changes) {
			expect(
				hasLocationComposerChanges(baseline, { ...baseline, ...change }),
			).toBe(true);
		}
	});
});
