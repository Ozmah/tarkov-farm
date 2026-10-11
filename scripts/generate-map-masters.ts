import {
	copyFile,
	lstat,
	mkdtemp,
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
import {
	isMapOriginalFilename,
	type MapGenerationOptions,
	parseMapGenerationArguments,
	planMapMasterSources,
	replaceMapMasterDirectory,
} from "./lib/map-master-generation";
import { verifyMapMasterDirectory } from "./lib/publication-assets";

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
	await generateMasters(parseMapGenerationArguments(Bun.argv.slice(2)));
}

async function generateMasters({ responsiveOnly, only }: MapGenerationOptions) {
	const lockPath = `${OUTPUT_DIRECTORY}.lock`;
	const lock = await acquireLock(lockPath);
	let temporaryDirectory: string | undefined;

	try {
		const manifestInput = await readExistingManifest();
		const existingImages =
			manifestInput === undefined ? [] : readExistingImages(manifestInput);
		if (responsiveOnly && manifestInput === undefined) {
			throw new Error(
				"Responsive generation requires an existing map manifest",
			);
		}
		const sources = responsiveOnly
			? []
			: planMapMasterSources(await readOriginalFiles(), existingImages, only);
		const selectedManifest = only
			? parseMapMasterManifest(manifestInput)
			: undefined;
		if (selectedManifest) assertCompatibleSettings(selectedManifest);

		temporaryDirectory = await mkdtemp(`${OUTPUT_DIRECTORY}.tmp-`);
		const backupDirectory = `${temporaryDirectory}.backup`;
		const images = responsiveOnly
			? await generateFromExistingMasters(temporaryDirectory, existingImages)
			: await generateFromOriginals(
					temporaryDirectory,
					sources,
					selectedManifest,
				);
		const manifest: MapMasterManifest = {
			version: MAP_MASTER_MANIFEST_VERSION,
			settings: selectedManifest?.settings ?? {
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
		await verifyMapMasterDirectory(temporaryDirectory);
		await replaceMapMasterDirectory(
			temporaryDirectory,
			OUTPUT_DIRECTORY,
			backupDirectory,
		);

		console.info(
			`Generated ${images.length} map masters and ${images.reduce((count, image) => count + image.variants.length, 0)} responsive variants`,
		);
	} finally {
		try {
			if (temporaryDirectory) {
				await rm(temporaryDirectory, { recursive: true, force: true });
			}
		} finally {
			try {
				await lock.close();
			} finally {
				await rm(lockPath, { force: true });
			}
		}
	}
}

async function readOriginalFiles() {
	await assertRegularDirectory(SOURCE_DIRECTORY);
	const sourceEntries = await readdir(SOURCE_DIRECTORY, {
		withFileTypes: true,
	});
	const images = sourceEntries.filter((entry) =>
		SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase()),
	);
	if (images.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
		throw new Error(
			"Map originals must be regular files, not links or directories",
		);
	}
	return images
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right, "en"));
}

async function generateFromOriginals(
	outputDirectory: string,
	sourceFiles: string[],
	existingManifest?: MapMasterManifest,
) {
	const generated = new Map<string, MapMasterImage>();
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
		generated.set(image.file, image);
		logGeneratedImage(image);
	}

	if (!existingManifest) return [...generated.values()];
	const images: MapMasterImage[] = [];
	for (const existing of existingManifest.images) {
		const replacement = generated.get(existing.file);
		if (replacement) {
			images.push(replacement);
			continue;
		}
		for (const asset of [existing, ...existing.variants]) {
			await copyPublishedAsset(asset.file, outputDirectory);
		}
		images.push(existing);
	}
	return images;
}

async function generateFromExistingMasters(
	outputDirectory: string,
	existingImages: ReturnType<typeof readExistingImages>,
) {
	const images: MapMasterImage[] = [];

	for (const existing of existingImages) {
		const outputPath = join(outputDirectory, existing.file);
		await copyPublishedAsset(existing.file, outputDirectory);
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

async function copyPublishedAsset(file: string, outputDirectory: string) {
	const sourcePath = join(OUTPUT_DIRECTORY, file);
	const stats = await lstat(sourcePath);
	if (!stats.isFile() || stats.isSymbolicLink()) {
		throw new Error(`Published map must be a regular file: ${file}`);
	}
	await copyFile(sourcePath, join(outputDirectory, file));
}

async function readExistingManifest(): Promise<unknown> {
	try {
		await assertRegularDirectory(OUTPUT_DIRECTORY);
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return undefined;
		throw error;
	}
	const manifestPath = join(OUTPUT_DIRECTORY, "manifest.json");
	const stats = await lstat(manifestPath);
	if (!stats.isFile() || stats.isSymbolicLink()) {
		throw new Error("Existing map manifest must be a regular file");
	}
	const input: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
	// Keep v1 responsive regeneration available; selective copying requires v2.
	if (isRecord(input) && input.version === MAP_MASTER_MANIFEST_VERSION) {
		parseMapMasterManifest(input);
		await verifyMapMasterDirectory(OUTPUT_DIRECTORY);
	}
	return input;
}

async function assertRegularDirectory(path: string) {
	const stats = await lstat(path);
	if (!stats.isDirectory() || stats.isSymbolicLink()) {
		throw new Error(`Map directory must be a regular directory: ${path}`);
	}
}

function assertCompatibleSettings(manifest: MapMasterManifest) {
	const { backend, maxDimension, quality, responsiveWidths } =
		manifest.settings;
	if (
		backend !== "bun" ||
		maxDimension !== MAX_DIMENSION ||
		quality !== WEBP_QUALITY ||
		JSON.stringify(responsiveWidths) !== JSON.stringify(MAP_RESPONSIVE_WIDTHS)
	) {
		throw new Error("Selective generation cannot change collection settings");
	}
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

	const files = new Set<string>();
	return input.images.map((value, index) => {
		if (
			!isRecord(value) ||
			typeof value.file !== "string" ||
			!isMapOriginalFilename(value.file) ||
			extname(value.file).toLowerCase() !== ".webp" ||
			typeof value.original !== "string" ||
			!isMapOriginalFilename(value.original) ||
			typeof value.passthrough !== "boolean"
		) {
			throw new Error(`Existing map manifest image ${index} is invalid`);
		}
		const file = value.file.toLowerCase();
		if (files.has(file)) throw new Error(`Duplicate map master: ${value.file}`);
		files.add(file);

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

function formatBytes(bytes: number) {
	return `${(bytes / 1_048_576).toFixed(2)} MiB`;
}

function isRecord(input: unknown): input is Record<string, unknown> {
	return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
