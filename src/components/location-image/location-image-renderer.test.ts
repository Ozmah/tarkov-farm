import { describe, expect, it } from "vitest";

import {
	calculateMapCrop,
	calculateMarkerGeometry,
	createLocationReplyImageFileName,
} from "@/components/location-image/location-image-renderer";

describe("location reply image renderer", () => {
	it("centers the selected location in a moderate map crop", () => {
		const crop = calculateMapCrop({
			imageHeight: 2_000,
			imageWidth: 4_000,
			markerXBasisPoints: 5_000,
			markerYBasisPoints: 5_000,
			outputHeight: 382,
			outputWidth: 680,
			zoom: 2,
		});

		expect(crop.markerX).toBeCloseTo(340);
		expect(crop.markerY).toBeCloseTo(191);
		expect(crop.x).toBeCloseTo(1_000);
	});

	it("keeps the crop inside the map near an edge", () => {
		const crop = calculateMapCrop({
			imageHeight: 2_000,
			imageWidth: 4_000,
			markerXBasisPoints: 100,
			markerYBasisPoints: 100,
			outputHeight: 382,
			outputWidth: 680,
			zoom: 2,
		});

		expect(crop.x).toBe(0);
		expect(crop.y).toBe(0);
		expect(crop.markerX).toBeGreaterThanOrEqual(0);
		expect(crop.markerY).toBeGreaterThanOrEqual(0);
	});

	it("creates a filesystem-safe PNG name", () => {
		expect(createLocationReplyImageFileName("Ground Zero", "17")).toBe(
			"tarkov-farm-ground-zero-17.png",
		);
		expect(createLocationReplyImageFileName("The Lab / Level 2", "#8")).toBe(
			"tarkov-farm-the-lab-level-2-8.png",
		);
	});

	it.each([
		{ markerX: 728, markerY: 148 },
		{ markerX: 1_408, markerY: 148 },
		{ markerX: 728, markerY: 530 },
		{ markerX: 1_408, markerY: 530 },
	])(
		"keeps the marker tip at its exact map position: $markerX,$markerY",
		(point) => {
			const geometry = calculateMarkerGeometry({
				...point,
				maxX: 1_408,
				maxY: 530,
				minX: 728,
				minY: 148,
				radius: 25,
			});

			expect(geometry.tipX).toBe(point.markerX);
			expect(geometry.tipY).toBe(point.markerY);
			expect(geometry.centerX).toBeGreaterThanOrEqual(753);
			expect(geometry.centerX).toBeLessThanOrEqual(1_383);
			expect(geometry.centerY).toBeGreaterThanOrEqual(173);
			expect(geometry.centerY).toBeLessThanOrEqual(505);
		},
	);
});
