import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const MAX_INPUT_PIXELS = 40_000_000;
const PREVIEW_MAX_DIMENSION = 1_000;
const FULL_MAX_DIMENSION = 1_920;
const PREVIEW_QUALITY = 84;
const FULL_QUALITY = 88;
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);

const [sourcePath, previewPath, fullPath] = Bun.argv.slice(2);

if (!sourcePath || !previewPath || !fullPath) {
	throw new Error(
		"Screenshot processor requires source, preview, and full paths",
	);
}

Bun.Image.backend = "bun";

const sourceMetadata = await new Bun.Image(sourcePath, {
	autoOrient: true,
	maxPixels: MAX_INPUT_PIXELS,
}).metadata();

if (!SUPPORTED_FORMATS.has(sourceMetadata.format)) {
	throw new Error("Screenshot content must be JPEG, PNG, or WebP");
}

await Promise.all([
	mkdir(dirname(previewPath), { recursive: true }),
	mkdir(dirname(fullPath), { recursive: true }),
]);

await transformScreenshot(
	sourcePath,
	previewPath,
	PREVIEW_MAX_DIMENSION,
	PREVIEW_QUALITY,
);
await transformScreenshot(
	sourcePath,
	fullPath,
	FULL_MAX_DIMENSION,
	FULL_QUALITY,
);

const [previewMetadata, fullMetadata] = await Promise.all([
	readOutputMetadata(previewPath),
	readOutputMetadata(fullPath),
]);

process.stdout.write(
	JSON.stringify({
		format: sourceMetadata.format,
		preview: previewMetadata,
		full: fullMetadata,
	}),
);

async function transformScreenshot(
	inputPath: string,
	outputPath: string,
	maxDimension: number,
	quality: number,
) {
	await new Bun.Image(inputPath, {
		autoOrient: true,
		maxPixels: MAX_INPUT_PIXELS,
	})
		.resize(maxDimension, maxDimension, {
			fit: "inside",
			withoutEnlargement: true,
			filter: "lanczos3",
		})
		.webp({ quality })
		.write(outputPath);
}

async function readOutputMetadata(path: string) {
	const metadata = await new Bun.Image(path, {
		maxPixels: MAX_INPUT_PIXELS,
	}).metadata();

	if (metadata.format !== "webp") {
		throw new Error("Screenshot output validation failed");
	}

	return {
		height: metadata.height,
		sha256: await hashFile(path),
		size: Bun.file(path).size,
		width: metadata.width,
	};
}

async function hashFile(path: string) {
	const hash = createHash("sha256");

	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}

	return hash.digest("hex");
}
