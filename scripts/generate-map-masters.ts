import {
	copyFile,
	mkdir,
	open,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { basename, extname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

import {
	MAP_MASTER_MANIFEST_VERSION,
	MAP_RESPONSIVE_WIDTHS,
	type MapMasterImage,
	type MapMasterManifest,
	type MapMasterVariant,
	parseMapMasterManifest,
} from "../src/lib/map-master-manifest";

const SOURCE_DIRECTORY = "assets/maps/originals";
const OUTPUT_DIRECTORY = "public/maps/masters";
const MAX_DIMENSION = 6_144;
const MAX_INPUT_PIXELS = 120_000_000;
const WEBP_QUALITY = 90;
const SUPPORTED_EXTENSIONS = new Set([".jpeg", ".jpg", ".png", ".webp"]);
const scriptPath = fileURLToPath(import.meta.url);
const command = Bun.argv[2];

if (command === "--worker") {
	await runWorker(Bun.argv[3], Bun.argv[4]);
} else {
	if (command && command !== "--responsive-only") {
		throw new Error(`Unknown map generation option: ${command}`);
	}

	await generateMasters({ responsiveOnly: command === "--responsive-only" });
}

async function generateMasters({
	responsiveOnly,
}: {
	responsiveOnly: boolean;
}) {
	const lockPath = `${OUTPUT_DIRECTORY}.lock`;
	const lock = await acquireLock(lockPath);
	const temporaryDirectory = `${OUTPUT_DIRECTORY}.tmp-${process.pid}`;
	const backupDirectory = `${OUTPUT_DIRECTORY}.backup-${process.pid}`;

	try {
		await rm(temporaryDirectory, { recursive: true, force: true });
		await mkdir(temporaryDirectory, { recursive: true });
		const images = responsiveOnly
			? await generateFromExistingMasters(temporaryDirectory)
			: await generateFromOriginals(temporaryDirectory);
		const manifest: MapMasterManifest = {
			version: MAP_MASTER_MANIFEST_VERSION,
			settings: {
				backend: "bun",
				format: "webp",
				maxDimension: MAX_DIMENSION,
				quality: WEBP_QUALITY,
				responsiveWidths: [...MAP_RESPONSIVE_WIDTHS],
			},
			images,
		};

		parseMapMasterManifest(manifest);
		await writeFile(
			join(temporaryDirectory, "manifest.json"),
			serializeManifest(manifest),
			"utf8",
		);
		await replaceDirectory(
			temporaryDirectory,
			OUTPUT_DIRECTORY,
			backupDirectory,
		);

		console.info(
			`Generated ${images.length} map masters and ${images.reduce((count, image) => count + image.variants.length, 0)} responsive variants`,
		);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
		await rm(backupDirectory, { recursive: true, force: true });
		await lock.close();
		await rm(lockPath, { force: true });
	}
}

async function generateFromOriginals(outputDirectory: string) {
	const sourceEntries = await readdir(SOURCE_DIRECTORY, {
		withFileTypes: true,
	});
	const sourceFiles = sourceEntries
		.filter(
			(entry) =>
				entry.isFile() &&
				SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase()),
		)
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right, "en"));

	if (sourceFiles.length === 0) {
		throw new Error(`No source images found in ${SOURCE_DIRECTORY}`);
	}

	const images: MapMasterImage[] = [];

	for (const sourceFile of sourceFiles) {
		const subprocess = Bun.spawn(
			[
				process.execPath,
				scriptPath,
				"--worker",
				join(SOURCE_DIRECTORY, sourceFile),
				outputDirectory,
			],
			{
				stdout: "pipe",
				stderr: "inherit",
			},
		);
		const output = await new Response(subprocess.stdout).text();
		const exitCode = await subprocess.exited;

		if (exitCode !== 0) {
			throw new Error(`Failed to process ${sourceFile}`);
		}

		const image = parseWorkerImage(JSON.parse(output));
		images.push(image);
		logGeneratedImage(image);
	}

	return images;
}

async function generateFromExistingMasters(outputDirectory: string) {
	const manifestInput = JSON.parse(
		await readFile(join(OUTPUT_DIRECTORY, "manifest.json"), "utf8"),
	);
	const existingImages = readExistingImages(manifestInput);
	const images: MapMasterImage[] = [];

	for (const existing of existingImages) {
		const sourcePath = join(OUTPUT_DIRECTORY, existing.file);
		const outputPath = join(outputDirectory, existing.file);
		await copyFile(sourcePath, outputPath);
		const master = await readGeneratedAsset(outputPath, existing.file);
		const variants = await generateVariants(
			master,
			outputPath,
			outputDirectory,
		);
		const image = {
			...master,
			original: existing.original,
			passthrough: existing.passthrough,
			variants,
		};
		images.push(image);
		logGeneratedImage(image);
	}

	return images;
}

async function runWorker(sourcePath?: string, outputDirectory?: string) {
	if (!sourcePath || !outputDirectory) {
		throw new Error("Worker requires a source path and output directory");
	}

	Bun.Image.backend = "bun";

	const sourceImage = new Bun.Image(sourcePath, {
		autoOrient: true,
		maxPixels: MAX_INPUT_PIXELS,
	});
	const sourceMetadata = await sourceImage.metadata();
	const outputFile = `${parse(sourcePath).name}.webp`;
	const outputPath = join(outputDirectory, outputFile);
	const passthrough =
		sourceMetadata.format === "webp" &&
		sourceMetadata.width <= MAX_DIMENSION &&
		sourceMetadata.height <= MAX_DIMENSION;

	if (passthrough) {
		await copyFile(sourcePath, outputPath);
	} else {
		await sourceImage
			.resize(MAX_DIMENSION, MAX_DIMENSION, {
				fit: "inside",
				withoutEnlargement: true,
				filter: "lanczos3",
			})
			.webp({ quality: WEBP_QUALITY })
			.write(outputPath);
	}

	const master = await readGeneratedAsset(outputPath, outputFile);
	const variants = await generateVariants(master, outputPath, outputDirectory);
	const result: MapMasterImage = {
		...master,
		original: basename(sourcePath),
		passthrough,
		variants,
	};

	process.stdout.write(JSON.stringify(result));
}

async function generateVariants(
	master: MapMasterVariant,
	masterPath: string,
	outputDirectory: string,
) {
	const variants: MapMasterVariant[] = [];

	for (const width of MAP_RESPONSIVE_WIDTHS) {
		if (width >= master.width) continue;

		const height = Math.max(
			1,
			Math.round((master.height * width) / master.width),
		);
		const base = `${parse(master.file).name}-${width}w`;
		const temporaryFile = `${base}.tmp.webp`;
		const temporaryPath = join(outputDirectory, temporaryFile);
		await new Bun.Image(masterPath, { maxPixels: MAX_INPUT_PIXELS })
			.resize(width, height, { filter: "lanczos3" })
			.webp({ quality: WEBP_QUALITY })
			.write(temporaryPath);
		const generated = await readGeneratedAsset(temporaryPath, temporaryFile);
		const file = `${base}-${generated.sha256.slice(0, 12)}.webp`;
		await rename(temporaryPath, join(outputDirectory, file));
		variants.push({ ...generated, file });
	}

	return variants;
}

async function readGeneratedAsset(path: string, file: string) {
	const output = Bun.file(path);
	const metadata = await new Bun.Image(path, {
		maxPixels: MAX_INPUT_PIXELS,
	}).metadata();
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(await output.arrayBuffer());

	return {
		file,
		height: metadata.height,
		sha256: hasher.digest("hex"),
		size: output.size,
		width: metadata.width,
	};
}

function parseWorkerImage(input: unknown) {
	const manifest = parseMapMasterManifest({
		version: MAP_MASTER_MANIFEST_VERSION,
		settings: {
			backend: "bun",
			format: "webp",
			maxDimension: MAX_DIMENSION,
			quality: WEBP_QUALITY,
			responsiveWidths: [...MAP_RESPONSIVE_WIDTHS],
		},
		images: [input],
	});

	return manifest.images[0] as MapMasterImage;
}

function readExistingImages(input: unknown) {
	if (
		!isRecord(input) ||
		(input.version !== 1 && input.version !== MAP_MASTER_MANIFEST_VERSION) ||
		!Array.isArray(input.images)
	) {
		throw new Error("Existing map manifest is invalid");
	}

	return input.images.map((value, index) => {
		if (
			!isRecord(value) ||
			typeof value.file !== "string" ||
			value.file.length === 0 ||
			value.file.includes("/") ||
			value.file.includes("\\") ||
			typeof value.original !== "string" ||
			value.original.length === 0 ||
			typeof value.passthrough !== "boolean"
		) {
			throw new Error(`Existing map manifest image ${index} is invalid`);
		}

		return {
			file: value.file,
			original: value.original,
			passthrough: value.passthrough,
		};
	});
}

function logGeneratedImage(image: MapMasterImage) {
	console.info(
		`${image.original} -> ${image.file} (${image.width}x${image.height}, ${formatBytes(image.size)}) + ${image.variants.length} responsive`,
	);
}

function serializeManifest(manifest: MapMasterManifest) {
	const source = JSON.stringify(manifest, null, "\t");
	const multilineWidths = `\t\t"responsiveWidths": [\n${manifest.settings.responsiveWidths.map((width) => `\t\t\t${width}`).join(",\n")}\n\t\t]`;
	const inlineWidths = `\t\t"responsiveWidths": [${manifest.settings.responsiveWidths.join(", ")}]`;

	return `${source.replace(multilineWidths, inlineWidths)}\n`;
}

async function acquireLock(lockPath: string) {
	try {
		return await open(lockPath, "wx");
	} catch (error) {
		if (isNodeError(error) && error.code === "EEXIST") {
			throw new Error("Map master generation is already running");
		}

		throw error;
	}
}

async function replaceDirectory(
	temporaryDirectory: string,
	outputDirectory: string,
	backupDirectory: string,
) {
	let existingOutputMoved = false;

	await rm(backupDirectory, { recursive: true, force: true });

	try {
		await rename(outputDirectory, backupDirectory);
		existingOutputMoved = true;
	} catch (error) {
		if (!isNodeError(error) || error.code !== "ENOENT") {
			throw error;
		}
	}

	try {
		await rename(temporaryDirectory, outputDirectory);
	} catch (error) {
		if (existingOutputMoved) {
			await rename(backupDirectory, outputDirectory);
		}

		throw error;
	}

	if (existingOutputMoved) {
		await rm(backupDirectory, { recursive: true, force: true });
	}
}

function formatBytes(bytes: number) {
	return `${(bytes / 1_048_576).toFixed(2)} MiB`;
}

function isRecord(input: unknown): input is Record<string, unknown> {
	return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
