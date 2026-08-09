import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { asc } from "drizzle-orm";

import { getDatabase } from "../src/server/db/client.server";
import { locations, screenshots } from "../src/server/db/schema";

const PUBLIC_ROOT = resolve(process.cwd(), "public");
const SCREENSHOT_ROOT = resolve(PUBLIC_ROOT, "screenshots");
const ORIGINAL_ROOT = resolve(process.cwd(), "assets/screenshots/originals");
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
				fullHash: screenshots.fullHash,
				previewHash: screenshots.previewHash,
				sourceHash: screenshots.sourceHash,
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

	for (const screenshot of screenshotRows) {
		if (
			![
				screenshot.sourceHash,
				screenshot.fullHash,
				screenshot.previewHash,
			].every((hash) => hash.match(CONTENT_HASH_PATTERN))
		) {
			errors.push(`${screenshot.id} has invalid SHA-256 metadata`);
			continue;
		}

		await checkOriginal(
			screenshot.id,
			screenshot.locationId,
			screenshot.sourceHash,
		);

		await checkVariant(
			screenshot.id,
			screenshot.locationId,
			screenshot.path,
			screenshot.width,
			screenshot.height,
			`${screenshot.sourceHash}-1920.webp`,
			screenshot.fullHash,
			1_920,
		);
		await checkVariant(
			screenshot.id,
			screenshot.locationId,
			screenshot.previewPath,
			screenshot.previewWidth,
			screenshot.previewHeight,
			`${screenshot.sourceHash}-1000.webp`,
			screenshot.previewHash,
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
	expectedHash: string,
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

		if ((await hashFile(absolutePath)) !== expectedHash) {
			errors.push(`${screenshotId} hash does not match ${publicPath}`);
		}
	} catch (error) {
		errors.push(
			`${screenshotId} could not decode ${publicPath}: ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}

async function checkOriginal(
	screenshotId: string,
	locationId: string,
	sourceHash: string,
) {
	const directory = resolve(ORIGINAL_ROOT, locationId);
	let entries: string[];

	try {
		entries = await readdir(directory);
	} catch {
		errors.push(`${screenshotId} has no original source directory`);
		return;
	}

	const matches = entries.filter((entry) =>
		[`${sourceHash}.jpg`, `${sourceHash}.png`, `${sourceHash}.webp`].includes(
			entry,
		),
	);

	if (matches.length !== 1) {
		errors.push(`${screenshotId} must have exactly one original source`);
		return;
	}

	if ((await hashFile(resolve(directory, matches[0]))) !== sourceHash) {
		errors.push(`${screenshotId} original source hash does not match`);
	}
}

async function hashFile(path: string) {
	const hash = createHash("sha256");

	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}

	return hash.digest("hex");
}
