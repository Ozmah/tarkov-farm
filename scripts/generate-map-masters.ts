import {
	copyFile,
	mkdir,
	open,
	readdir,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { basename, extname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRECTORY = "assets/maps/originals";
const OUTPUT_DIRECTORY = "public/maps/masters";
const MAX_DIMENSION = 6_144;
const MAX_INPUT_PIXELS = 120_000_000;
const WEBP_QUALITY = 90;
const SUPPORTED_EXTENSIONS = new Set([".jpeg", ".jpg", ".png", ".webp"]);
const scriptPath = fileURLToPath(import.meta.url);

type ManifestImage = {
	file: string;
	height: number;
	original: string;
	passthrough: boolean;
	sha256: string;
	size: number;
	width: number;
};

if (Bun.argv[2] === "--worker") {
	await runWorker(Bun.argv[3], Bun.argv[4]);
} else {
	await generateMasters();
}

async function generateMasters() {
	const lockPath = `${OUTPUT_DIRECTORY}.lock`;
	const lock = await acquireLock(lockPath);
	const temporaryDirectory = `${OUTPUT_DIRECTORY}.tmp-${process.pid}`;
	const backupDirectory = `${OUTPUT_DIRECTORY}.backup-${process.pid}`;

	try {
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

		await rm(temporaryDirectory, { recursive: true, force: true });
		await mkdir(temporaryDirectory, { recursive: true });

		const images: ManifestImage[] = [];

		for (const sourceFile of sourceFiles) {
			const subprocess = Bun.spawn(
				[
					process.execPath,
					scriptPath,
					"--worker",
					join(SOURCE_DIRECTORY, sourceFile),
					temporaryDirectory,
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

			const image = JSON.parse(output) as ManifestImage;
			images.push(image);
			console.info(
				`${image.original} -> ${image.file} (${image.width}x${image.height}, ${formatBytes(image.size)})`,
			);
		}

		const manifest = {
			version: 1,
			settings: {
				backend: "bun",
				format: "webp",
				maxDimension: MAX_DIMENSION,
				quality: WEBP_QUALITY,
			},
			images,
		};

		await writeFile(
			join(temporaryDirectory, "manifest.json"),
			`${JSON.stringify(manifest, null, "\t")}\n`,
			"utf8",
		);
		await replaceDirectory(
			temporaryDirectory,
			OUTPUT_DIRECTORY,
			backupDirectory,
		);

		console.info(`Generated ${images.length} map masters`);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
		await rm(backupDirectory, { recursive: true, force: true });
		await lock.close();
		await rm(lockPath, { force: true });
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

	const outputFileHandle = Bun.file(outputPath);
	const outputMetadata = await new Bun.Image(outputPath, {
		maxPixels: MAX_INPUT_PIXELS,
	}).metadata();
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(await outputFileHandle.arrayBuffer());

	const result: ManifestImage = {
		file: outputFile,
		height: outputMetadata.height,
		original: basename(sourcePath),
		passthrough,
		sha256: hasher.digest("hex"),
		size: outputFileHandle.size,
		width: outputMetadata.width,
	};

	process.stdout.write(JSON.stringify(result));
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
