import { describe, expect, it } from "vitest";

import {
	getMapImageSources,
	MAP_MASTER_MANIFEST_VERSION,
	parseMapMasterManifest,
} from "./map-master-manifest";

const HASH = "a".repeat(64);

function manifestInput() {
	return {
		version: MAP_MASTER_MANIFEST_VERSION,
		settings: {
			backend: "bun",
			format: "webp",
			maxDimension: 6_144,
			quality: 90,
			responsiveWidths: [1_280, 2_560, 4_096],
		},
		images: [
			{
				file: "customs.webp",
				height: 3_000,
				original: "customs.png",
				passthrough: false,
				sha256: HASH,
				size: 10_000,
				width: 6_000,
				variants: [
					{
						file: "customs-1280w-aaaaaaaaaaaa.webp",
						height: 640,
						sha256: HASH,
						size: 1_000,
						width: 1_280,
					},
					{
						file: "customs-2560w-aaaaaaaaaaaa.webp",
						height: 1_280,
						sha256: HASH,
						size: 2_000,
						width: 2_560,
					},
					{
						file: "customs-4096w-aaaaaaaaaaaa.webp",
						height: 2_048,
						sha256: HASH,
						size: 4_000,
						width: 4_096,
					},
				],
			},
		],
	};
}

describe("map master manifest", () => {
	it("parses canonical responsive variants and exposes ordered public sources", () => {
		const manifest = parseMapMasterManifest(manifestInput());

		expect(getMapImageSources(manifest, "/maps/masters/customs.webp")).toEqual([
			{
				height: 640,
				path: "/maps/masters/customs-1280w-aaaaaaaaaaaa.webp",
				width: 1_280,
			},
			{
				height: 1_280,
				path: "/maps/masters/customs-2560w-aaaaaaaaaaaa.webp",
				width: 2_560,
			},
			{
				height: 2_048,
				path: "/maps/masters/customs-4096w-aaaaaaaaaaaa.webp",
				width: 4_096,
			},
			{ height: 3_000, path: "/maps/masters/customs.webp", width: 6_000 },
		]);
	});

	it("rejects missing responsive widths", () => {
		const input = manifestInput();
		input.images[0]?.variants.pop();

		expect(() => parseMapMasterManifest(input)).toThrow(
			"variants are incomplete",
		);
	});

	it("rejects variants that change the master aspect ratio", () => {
		const input = manifestInput();
		const variant = input.images[0]?.variants[0];
		if (variant) variant.height = 641;

		expect(() => parseMapMasterManifest(input)).toThrow(
			"variant dimensions are invalid",
		);
	});

	it("rejects unexpected fields", () => {
		const input = manifestInput() as ReturnType<typeof manifestInput> & {
			unsafe?: boolean;
		};
		input.unsafe = true;

		expect(() => parseMapMasterManifest(input)).toThrow(
			"Map manifest fields are invalid",
		);
	});
});
