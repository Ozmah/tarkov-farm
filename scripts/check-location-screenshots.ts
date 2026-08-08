import { resolve, sep } from "node:path";
import { asc } from "drizzle-orm";

import { getDatabase } from "../src/server/db/client.server";
import { locations, screenshots } from "../src/server/db/schema";

const PUBLIC_ROOT = resolve(process.cwd(), "public");
const SCREENSHOT_ROOT = resolve(PUBLIC_ROOT, "screenshots");
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_INPUT_PIXELS = 40_000_000;
const errors: string[] = [];
const { client, db } = await getDatabase();

try {
	const [locationRows, screenshotRows] = await Promise.all([
		db
			.select({ id: locations.id, name: locations.name })
			.from(locations)
			.orderBy(asc(locations.name))
			.all(),
		db
			.select({
				id: screenshots.id,
				locationId: screenshots.locationId,
				path: screenshots.path,
				previewPath: screenshots.previewPath,
				width: screenshots.width,
				height: screenshots.height,
				previewWidth: screenshots.previewWidth,
				previewHeight: screenshots.previewHeight,
				contentHash: screenshots.contentHash,
				isActive: screenshots.isActive,
			})
			.from(screenshots)
			.all(),
	]);

	for (const location of locationRows) {
		if (
			!screenshotRows.some(
				(screenshot) =>
					screenshot.locationId === location.id && screenshot.isActive,
			)
		) {
			errors.push(
				`${location.name} (${location.id}) has no active screenshots`,
			);
		}
	}

	for (const screenshot of screenshotRows.filter(({ isActive }) => isActive)) {
		if (!screenshot.contentHash?.match(CONTENT_HASH_PATTERN)) {
			errors.push(`${screenshot.id} has no valid SHA-256 content hash`);
		}

		if (
			!screenshot.previewPath ||
			!screenshot.previewWidth ||
			!screenshot.previewHeight
		) {
			errors.push(`${screenshot.id} has no complete preview variant`);
			continue;
		}

		await checkVariant(
			screenshot.id,
			screenshot.locationId,
			screenshot.path,
			screenshot.width,
			screenshot.height,
			`${screenshot.contentHash}-1920.webp`,
			1_920,
		);
		await checkVariant(
			screenshot.id,
			screenshot.locationId,
			screenshot.previewPath,
			screenshot.previewWidth,
			screenshot.previewHeight,
			`${screenshot.contentHash}-1000.webp`,
			1_000,
		);
	}

	if (errors.length > 0) {
		throw new Error(
			`Screenshot validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
		);
	}

	console.info(
		`Validated ${screenshotRows.length} screenshots across ${locationRows.length} locations`,
	);
} finally {
	client.close();
}

async function checkVariant(
	screenshotId: string,
	locationId: string,
	publicPath: string,
	expectedWidth: number,
	expectedHeight: number,
	expectedFilename: string,
	maxDimension: number,
) {
	const expectedRoot = resolve(SCREENSHOT_ROOT, locationId);
	const absolutePath = resolve(PUBLIC_ROOT, publicPath.replace(/^\/+/, ""));

	if (!absolutePath.startsWith(`${expectedRoot}${sep}`)) {
		errors.push(`${screenshotId} points outside its location directory`);
		return;
	}

	if (absolutePath !== resolve(expectedRoot, expectedFilename)) {
		errors.push(`${screenshotId} does not use its content-addressed filename`);
		return;
	}

	const file = Bun.file(absolutePath);

	if (!(await file.exists())) {
		errors.push(`${screenshotId} references missing file ${publicPath}`);
		return;
	}

	try {
		const metadata = await new Bun.Image(absolutePath, {
			maxPixels: MAX_INPUT_PIXELS,
		}).metadata();

		if (
			metadata.format !== "webp" ||
			metadata.width !== expectedWidth ||
			metadata.height !== expectedHeight ||
			metadata.width > maxDimension ||
			metadata.height > maxDimension
		) {
			errors.push(
				`${screenshotId} metadata does not match ${publicPath} (${metadata.width}x${metadata.height})`,
			);
		}
	} catch (error) {
		errors.push(
			`${screenshotId} could not decode ${publicPath}: ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}
