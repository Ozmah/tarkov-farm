import { describe, expect, it } from "vitest";
import {
	MAX_CONTRIBUTION_BUNDLE_BYTES,
	MAX_CONTRIBUTION_LOCATIONS,
	MAX_CONTRIBUTION_SCREENSHOT_BYTES,
} from "./location-contribution";
import {
	type ContributionLocationInput,
	createLocationContributionWorkspace,
	getLocationContributionWorkspaceBundle,
	getLocationContributionWorkspaceBytes,
	removeStagedContributionLocation,
	stageContributionLocation,
} from "./location-contribution-workspace";

const MAP_SHA256 = "a".repeat(64);

describe("location contribution workspace", () => {
	it("keeps files in memory but excludes them from the bundle", async () => {
		const file = createFile("pawn.png", "image/png", 4);
		const workspace = await stageContributionLocation(
			createLocationContributionWorkspace(),
			createInput(file, { name: "  White Pawn  " }),
		);
		const bundle = getLocationContributionWorkspaceBundle(workspace);

		expect(workspace.locations[0]?.name).toBe("White Pawn");
		expect(workspace.locations[0]?.screenshots[0]?.file).toBe(file);
		expect(getLocationContributionWorkspaceBytes(workspace)).toBe(4);
		expect("file" in (bundle.locations[0]?.screenshots[0] ?? {})).toBe(false);
	});

	it("replaces and removes a staged location without changing its id", async () => {
		let workspace = await stageContributionLocation(
			createLocationContributionWorkspace(),
			createInput(createFile("first.png", "image/png", 4)),
		);
		const locationId = workspace.locations[0]?.id;

		if (!locationId) throw new Error("Expected a staged location");

		workspace = await stageContributionLocation(
			workspace,
			createInput(createFile("replacement.webp", "image/webp", 5), {
				name: "Replacement",
			}),
			locationId,
		);

		expect(workspace.locations[0]).toMatchObject({
			id: locationId,
			name: "Replacement",
		});
		expect(
			removeStagedContributionLocation(workspace, locationId).locations,
		).toEqual([]);
	});

	it("rejects invalid files and duplicate contents within one location", async () => {
		const empty = createLocationContributionWorkspace();
		const file = createFile("unused.png", "image/png", 1);

		await expect(
			stageContributionLocation(empty, createInput(file, { screenshots: [] })),
		).rejects.toThrow("between 1 and 10 screenshots");
		await expect(
			stageContributionLocation(
				empty,
				createInput(file, {
					screenshots: Array.from({ length: 11 }, () => ({
						file,
					})),
				}),
			),
		).rejects.toThrow("between 1 and 10 screenshots");

		await expect(
			stageContributionLocation(
				empty,
				createInput(createFile("script.svg", "image/svg+xml", 4)),
			),
		).rejects.toThrow("JPEG, PNG, or WebP");

		const firstFile = new File(["same"], "one.png", { type: "image/png" });
		const duplicateFiles = [
			firstFile,
			new File(["same"], "two.png", { type: "image/png" }),
		];
		await expect(
			stageContributionLocation(
				empty,
				createInput(firstFile, {
					screenshots: duplicateFiles.map((file) => ({
						file,
					})),
				}),
			),
		).rejects.toThrow("source hashes contain duplicates");
	});

	it("enforces file, bundle, and location limits", async () => {
		await expect(
			stageContributionLocation(
				createLocationContributionWorkspace(),
				createInput(
					createFile(
						"oversized.png",
						"image/png",
						MAX_CONTRIBUTION_SCREENSHOT_BYTES + 1,
					),
				),
			),
		).rejects.toThrow("under 20 MiB");

		let workspace = createLocationContributionWorkspace();
		workspace = await stageLimitFile(workspace, "one.png");
		workspace = await stageLimitFile(workspace, "two.png");
		workspace = await stageLimitFile(workspace, "three.png");
		workspace = await stageLimitFile(workspace, "four.png");
		workspace = await stageLimitFile(workspace, "five.png");

		expect(getLocationContributionWorkspaceBytes(workspace)).toBe(
			MAX_CONTRIBUTION_BUNDLE_BYTES,
		);
		await expect(
			stageContributionLocation(
				workspace,
				createInput(createFile("overflow.png", "image/png", 1)),
			),
		).rejects.toThrow(`cannot exceed ${MAX_CONTRIBUTION_BUNDLE_BYTES} bytes`);

		const seedLocation = workspace.locations[0];
		if (!seedLocation) throw new Error("Expected a staged location");
		const fullWorkspace = {
			...workspace,
			locations: Array.from({ length: MAX_CONTRIBUTION_LOCATIONS }, () => ({
				...seedLocation,
				id: crypto.randomUUID(),
			})),
		};
		await expect(
			stageContributionLocation(
				fullWorkspace,
				createInput(createFile("extra.png", "image/png", 1)),
			),
		).rejects.toThrow(`at most ${MAX_CONTRIBUTION_LOCATIONS} locations`);
	});
});

function stageLimitFile(
	workspace: ReturnType<typeof createLocationContributionWorkspace>,
	name: string,
) {
	return stageContributionLocation(
		workspace,
		createInput(
			createFile(name, "image/png", MAX_CONTRIBUTION_SCREENSHOT_BYTES),
		),
	);
}

function createInput(
	file: File,
	overrides: Partial<ContributionLocationInput> = {},
): ContributionLocationInput {
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
		...overrides,
	};
}

function createFile(name: string, type: string, size: number) {
	const file = new File([name], name, { type });
	Object.defineProperty(file, "size", { value: size });
	return file;
}
