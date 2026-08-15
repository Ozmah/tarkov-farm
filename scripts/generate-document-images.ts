import { constants } from "node:fs";
import {
	copyFile,
	lstat,
	mkdir,
	open,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

import { parseDocumentCatalog } from "../src/lib/document-catalog";

const SOURCE_DIRECTORY = resolve("assets/documents/originals");
const OUTPUT_DIRECTORY = resolve("public/documents");
const CATALOG_PATH = resolve("data/catalog/documents.json");
const MAX_INPUT_PIXELS = 4_000_000;
const MAX_DIMENSION = 768;
const WEBP_QUALITY = 90;

await generateDocumentImages();

async function generateDocumentImages() {
	const lockPath = `${CATALOG_PATH}.lock`;
	const lock = await acquireLock(lockPath);
	const temporaryOutput = `${OUTPUT_DIRECTORY}.tmp-${process.pid}`;
	const temporaryCatalog = resolve(
		"data/catalog",
		`documents.${process.pid}.json`,
	);

	try {
		const catalogInput = JSON.parse(
			await readFile(CATALOG_PATH, "utf8"),
		) as unknown;
		const catalogRecord = readRecord(catalogInput, "Document catalog");
		if (!Array.isArray(catalogRecord.documents)) {
			throw new Error("Document catalog documents must be an array");
		}

		const documentRecords = catalogRecord.documents.map((document) =>
			readRecord(document, "Document"),
		);
		const documentIds = documentRecords.map((document) => readId(document.id));
		await assertSourceInventory(documentIds);
		await rm(temporaryOutput, { force: true, recursive: true });
		await mkdir(temporaryOutput, { recursive: true });

		for (const [index, document] of documentRecords.entries()) {
			const id = documentIds[index];
			const sourcePath = join(SOURCE_DIRECTORY, `${id}.png`);
			const sourceStats = await lstat(sourcePath);

			if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
				throw new Error(`Document source must be a regular file: ${id}.png`);
			}

			const sourceImage = new Bun.Image(sourcePath, {
				autoOrient: true,
				maxPixels: MAX_INPUT_PIXELS,
			});
			const sourceMetadata = await sourceImage.metadata();
			if (sourceMetadata.format !== "png") {
				throw new Error(`Document source must be PNG: ${id}.png`);
			}

			const temporaryImagePath = join(temporaryOutput, `${id}.webp`);
			await sourceImage
				.resize(MAX_DIMENSION, MAX_DIMENSION, {
					filter: "lanczos3",
					fit: "inside",
					withoutEnlargement: true,
				})
				.webp({ quality: WEBP_QUALITY })
				.write(temporaryImagePath);

			const imageMetadata = await new Bun.Image(temporaryImagePath, {
				maxPixels: MAX_INPUT_PIXELS,
			}).metadata();
			const sha256 = await hashFile(temporaryImagePath);
			const outputFile = `${id}-${sha256.slice(0, 12)}.webp`;
			await rename(temporaryImagePath, join(temporaryOutput, outputFile));

			document.image = {
				path: `/documents/${outputFile}`,
				width: imageMetadata.width,
				height: imageMetadata.height,
				sha256,
				sourceSha256: await hashFile(sourcePath),
			};
			console.info(
				`${id}.png -> ${outputFile} (${imageMetadata.width}x${imageMetadata.height})`,
			);
		}

		const catalog = parseDocumentCatalog(catalogRecord);
		await writeFile(
			temporaryCatalog,
			`${JSON.stringify(catalog, null, "\t")}\n`,
			"utf8",
		);
		await formatJson(temporaryCatalog);
		parseDocumentCatalog(JSON.parse(await readFile(temporaryCatalog, "utf8")));
		await publishImages(temporaryOutput, OUTPUT_DIRECTORY);
		await rename(temporaryCatalog, CATALOG_PATH);
		await pruneObsoleteImages(
			OUTPUT_DIRECTORY,
			new Set(
				catalog.documents.map((document) =>
					document.image.path.replace(/^\/documents\//, ""),
				),
			),
		);
		console.info(`Generated ${documentRecords.length} document images`);
	} finally {
		await rm(temporaryOutput, { force: true, recursive: true });
		await rm(temporaryCatalog, { force: true });
		await lock.close();
		await rm(lockPath, { force: true });
	}
}

async function assertSourceInventory(documentIds: string[]) {
	const expected = new Set(documentIds.map((id) => `${id}.png`));
	const entries = await readdir(SOURCE_DIRECTORY, { withFileTypes: true });

	if (
		entries.length !== expected.size ||
		entries.some(
			(entry) =>
				!entry.isFile() || entry.isSymbolicLink() || !expected.has(entry.name),
		)
	) {
		throw new Error(
			"Document source inventory must contain exactly one PNG per catalog document",
		);
	}
}

async function publishImages(
	temporaryDirectory: string,
	outputDirectory: string,
) {
	await mkdir(outputDirectory, { recursive: true });
	const outputStats = await lstat(outputDirectory);
	if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) {
		throw new Error("Document image output must be a regular directory");
	}
	const entries = await readdir(temporaryDirectory, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isFile() || entry.isSymbolicLink()) {
			throw new Error("Generated document image inventory is invalid");
		}

		const sourcePath = join(temporaryDirectory, entry.name);
		const destinationPath = join(outputDirectory, entry.name);
		const sourceHash = await hashFile(sourcePath);
		const destinationStats = await readStats(destinationPath);

		if (destinationStats) {
			if (!destinationStats.isFile() || destinationStats.isSymbolicLink()) {
				throw new Error(`Document image destination is unsafe: ${entry.name}`);
			}
			if ((await hashFile(destinationPath)) === sourceHash) continue;
		}

		const temporaryPath = join(
			outputDirectory,
			`.${entry.name}.tmp-${process.pid}`,
		);
		try {
			await copyFile(sourcePath, temporaryPath, constants.COPYFILE_EXCL);
			if ((await hashFile(temporaryPath)) !== sourceHash) {
				throw new Error(`Document image copy failed validation: ${entry.name}`);
			}
			await rename(temporaryPath, destinationPath);
		} finally {
			await rm(temporaryPath, { force: true });
		}
	}
}

async function pruneObsoleteImages(
	outputDirectory: string,
	expectedFiles: Set<string>,
) {
	const entries = await readdir(outputDirectory, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isFile() || entry.isSymbolicLink()) {
			throw new Error("Document image output contains a non-regular file");
		}
		if (!expectedFiles.has(entry.name)) {
			await rm(join(outputDirectory, entry.name), { force: true });
		}
	}
}

async function formatJson(path: string) {
	const formatter = Bun.spawn(
		[process.execPath, "x", "biome", "format", "--write", path],
		{ stderr: "inherit", stdout: "ignore" },
	);
	if ((await formatter.exited) !== 0) {
		throw new Error("Failed to format the document catalog");
	}
}

async function acquireLock(path: string) {
	try {
		return await open(path, "wx");
	} catch (error) {
		if (isNodeError(error) && error.code === "EEXIST") {
			throw new Error("Document image generation is already running");
		}
		throw error;
	}
}

async function hashFile(path: string) {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(await Bun.file(path).arrayBuffer());
	return hasher.digest("hex");
}

async function readStats(path: string) {
	try {
		return await lstat(path);
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return undefined;
		throw error;
	}
}

function readRecord(value: unknown, label: string) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

function readId(value: unknown) {
	if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
		throw new Error("Document identifier is invalid");
	}
	return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
