import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { serializeLocationContributionBundle } from "./location-contribution";
import { createLocationContributionArchive } from "./location-contribution-archive";
import {
	createLocationContributionWorkspace,
	getLocationContributionWorkspaceBundle,
	stageContributionLocation,
} from "./location-contribution-workspace";

const MAP_SHA256 = "a".repeat(64);
const PNG_BYTES = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	),
);

describe("location contribution archive", () => {
	it("writes the canonical manifest and original screenshot bytes", async () => {
		const file = createPngFile("personal-name.png", "first screenshot");
		const workspace = await stageContributionLocation(
			createLocationContributionWorkspace(),
			createInput(file),
		);
		const bundle = getLocationContributionWorkspaceBundle(workspace);
		const archive = await createLocationContributionArchive(workspace);
		const entries = unzipSync(new Uint8Array(await archive.blob.arrayBuffer()));
		const screenshot = bundle.locations[0]?.screenshots[0];

		if (!screenshot) throw new Error("Expected a screenshot");
		expect(Object.keys(entries)).toEqual(["manifest.json", screenshot.entry]);
		expect(new TextDecoder().decode(entries["manifest.json"])).toBe(
			serializeLocationContributionBundle(bundle),
		);
		expect(entries[screenshot.entry]).toEqual(
			new Uint8Array(await file.arrayBuffer()),
		);
		expect(archive.filename).toBe(
			`tarkov-farm-location-contribution-${bundle.bundleId}.zip`,
		);
		expect(
			new TextDecoder().decode(await archive.blob.arrayBuffer()),
		).not.toContain(file.name);
	});

	it("creates deterministic archives", async () => {
		const workspace = await stageContributionLocation(
			createLocationContributionWorkspace(),
			createInput(createPngFile("location.png", "deterministic")),
		);
		const first = await createLocationContributionArchive(workspace);
		const second = await createLocationContributionArchive(workspace);

		expect(new Uint8Array(await first.blob.arrayBuffer())).toEqual(
			new Uint8Array(await second.blob.arrayBuffer()),
		);
	});

	it("rejects empty workspaces and changed or spoofed files", async () => {
		await expect(
			createLocationContributionArchive(createLocationContributionWorkspace()),
		).rejects.toThrow("between 1 and 20 locations");

		const workspace = await stageContributionLocation(
			createLocationContributionWorkspace(),
			createInput(createPngFile("location.png", "trusted")),
		);
		const screenshot = workspace.locations[0]?.screenshots[0];
		if (!screenshot) throw new Error("Expected a screenshot");

		await expect(
			createLocationContributionArchive({
				...workspace,
				locations: [
					{
						...workspace.locations[0],
						screenshots: [{ ...screenshot, sourceSha256: "0".repeat(64) }],
					},
				],
			}),
		).rejects.toThrow("integrity verification");

		const spoofedFile = new File(["not a png"], "spoofed.png", {
			type: "image/png",
		});
		const spoofedWorkspace = await stageContributionLocation(
			createLocationContributionWorkspace(),
			createInput(spoofedFile),
		);
		await expect(
			createLocationContributionArchive(spoofedWorkspace),
		).rejects.toThrow("contents do not match");
	});
});

function createInput(file: File) {
	return {
		description: "On the desk",
		documentId: "technical",
		mapImageId: "reserve-main",
		mapImageSha256: MAP_SHA256,
		name: "White Pawn",
		requiredKeyIds: [],
		screenshots: [{ file }],
		xBasisPoints: 3_193,
		yBasisPoints: 1_527,
	};
}

function createPngFile(name: string, _content: string) {
	return new File([PNG_BYTES], name, { type: "image/png" });
}
