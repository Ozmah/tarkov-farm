import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
	access,
	copyFile,
	mkdir,
	mkdtemp,
	readdir,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

const SCREENSHOT_PROCESSOR = resolve(
	process.cwd(),
	"scripts/process-location-screenshot.ts",
);
const PUBLIC_ROOT = resolve(process.cwd(), "public");
const SCREENSHOT_ROOT = resolve(PUBLIC_ROOT, "screenshots");
const ORIGINAL_ROOT = resolve(process.cwd(), "assets/screenshots/originals");
const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;

type WorkerResult = {
	format: "jpeg" | "png" | "webp";
	preview: ImageVariant;
	full: ImageVariant;
};

type ImageVariant = {
	height: number;
	size: number;
	width: number;
};

export type ProcessedScreenshot = {
	contentHash: string;
	height: number;
	path: string;
	previewHeight: number;
	previewPath: string;
	previewWidth: number;
	width: number;
};

export async function processScreenshotFiles(
	locationId: string,
	files: File[],
) {
	assertSafeSegment(locationId);

	const temporaryDirectory = await mkdtemp(
		join(tmpdir(), "tarkov-location-screenshots-"),
	);
	const createdFiles: string[] = [];
	const screenshots: ProcessedScreenshot[] = [];

	try {
		for (const [index, file] of files.entries()) {
			const bytes = await file.arrayBuffer();
			const contentHash = createHash("sha256")
				.update(new Uint8Array(bytes))
				.digest("hex");
			const sourcePath = join(temporaryDirectory, `${index}.source`);
			const previewOutputPath = join(temporaryDirectory, `${index}-1000.webp`);
			const fullOutputPath = join(temporaryDirectory, `${index}-1920.webp`);

			await writeFile(sourcePath, new Uint8Array(bytes));

			const workerResult = await runProcessor(
				sourcePath,
				previewOutputPath,
				fullOutputPath,
			);
			const outputDirectory = resolve(SCREENSHOT_ROOT, locationId);
			const previewFilename = `${contentHash}-1000.webp`;
			const fullFilename = `${contentHash}-1920.webp`;
			const previewDestination = resolve(outputDirectory, previewFilename);
			const fullDestination = resolve(outputDirectory, fullFilename);
			const originalDestination = resolve(
				ORIGINAL_ROOT,
				locationId,
				`${contentHash}.${extensionForFormat(workerResult.format)}`,
			);

			for (const [source, destination] of [
				[previewOutputPath, previewDestination],
				[fullOutputPath, fullDestination],
				[sourcePath, originalDestination],
			] as const) {
				if (await publishFile(source, destination)) {
					createdFiles.push(destination);
				}
			}

			screenshots.push({
				contentHash,
				height: workerResult.full.height,
				path: `/screenshots/${locationId}/${fullFilename}`,
				previewHeight: workerResult.preview.height,
				previewPath: `/screenshots/${locationId}/${previewFilename}`,
				previewWidth: workerResult.preview.width,
				width: workerResult.full.width,
			});
		}

		return { createdFiles, screenshots };
	} catch (error) {
		await discardPublishedFiles(createdFiles);
		throw error;
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
}

export async function discardPublishedFiles(paths: string[]) {
	await Promise.all(paths.map((path) => rm(path, { force: true })));
}

export async function removeScreenshotFiles(
	locationId: string,
	records: ReadonlyArray<{
		contentHash: string | null;
		path: string;
		previewPath: string | null;
	}>,
) {
	assertSafeSegment(locationId);

	for (const record of records) {
		await removePublicScreenshot(locationId, record.path);

		if (record.previewPath) {
			await removePublicScreenshot(locationId, record.previewPath);
		}

		if (record.contentHash) {
			await removeOriginalByHash(locationId, record.contentHash);
		}
	}
}

export async function removeLocationScreenshotDirectories(locationId: string) {
	assertSafeSegment(locationId);

	await Promise.all([
		rm(resolve(SCREENSHOT_ROOT, locationId), { recursive: true, force: true }),
		rm(resolve(ORIGINAL_ROOT, locationId), { recursive: true, force: true }),
	]);
}

async function runProcessor(
	sourcePath: string,
	previewPath: string,
	fullPath: string,
) {
	const { output } = await executeBunProcessor([
		SCREENSHOT_PROCESSOR,
		sourcePath,
		previewPath,
		fullPath,
	]);

	try {
		return JSON.parse(output) as WorkerResult;
	} catch {
		throw new Error("The screenshot processor returned invalid metadata");
	}
}

function executeBunProcessor(arguments_: string[]) {
	return new Promise<{ diagnostics: string; output: string }>(
		(resolve, reject) => {
			const subprocess = spawn("bun", arguments_, {
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true,
			});
			let output = "";
			let diagnostics = "";

			subprocess.stdout.setEncoding("utf8");
			subprocess.stderr.setEncoding("utf8");
			subprocess.stdout.on("data", (chunk: string) => {
				output += chunk;
			});
			subprocess.stderr.on("data", (chunk: string) => {
				diagnostics += chunk;
			});
			subprocess.on("error", (error) => {
				reject(
					new Error(
						`Unable to start Bun screenshot processor: ${error.message}`,
					),
				);
			});
			subprocess.on("close", (exitCode) => {
				if (exitCode !== 0) {
					reject(
						new Error(
							diagnostics.trim() || "The screenshot could not be processed",
						),
					);
					return;
				}

				resolve({ diagnostics, output });
			});
		},
	);
}

async function publishFile(sourcePath: string, destinationPath: string) {
	try {
		await access(destinationPath);
		return false;
	} catch (error) {
		if (!isNodeError(error) || error.code !== "ENOENT") {
			throw error;
		}
	}

	await mkdir(dirname(destinationPath), { recursive: true });

	const temporaryPath = `${destinationPath}.tmp-${randomUUID()}`;

	try {
		await copyFile(sourcePath, temporaryPath);
		await rename(temporaryPath, destinationPath);
		return true;
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

async function removePublicScreenshot(locationId: string, publicPath: string) {
	const expectedRoot = resolve(SCREENSHOT_ROOT, locationId);
	const absolutePath = resolve(PUBLIC_ROOT, publicPath.replace(/^\/+/, ""));

	if (
		absolutePath !== expectedRoot &&
		!absolutePath.startsWith(`${expectedRoot}${sep}`)
	) {
		throw new Error("Refusing to remove a screenshot outside its location");
	}

	await rm(absolutePath, { force: true });
}

async function removeOriginalByHash(locationId: string, contentHash: string) {
	const directory = resolve(ORIGINAL_ROOT, locationId);
	let entries: string[];

	try {
		entries = await readdir(directory);
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") {
			return;
		}

		throw error;
	}

	await Promise.all(
		entries
			.filter((entry) => entry.startsWith(`${contentHash}.`))
			.map((entry) => rm(resolve(directory, entry), { force: true })),
	);
}

function extensionForFormat(format: WorkerResult["format"]) {
	return format === "jpeg" ? "jpg" : format;
}

function assertSafeSegment(value: string) {
	if (!SAFE_SEGMENT_PATTERN.test(value)) {
		throw new Error("Screenshot location identifier is invalid");
	}
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
