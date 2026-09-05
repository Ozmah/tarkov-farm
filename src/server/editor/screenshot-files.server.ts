import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
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

import { getPublicationScreenshotAssetPath } from "@/lib/publication-data";

const SCREENSHOT_PROCESSOR = resolve(
	process.cwd(),
	"scripts/process-location-screenshot.ts",
);
const PUBLIC_ROOT = resolve(process.cwd(), "public");
const SCREENSHOT_ROOT = resolve(PUBLIC_ROOT, "screenshots");
const ORIGINAL_ROOT = resolve(process.cwd(), "assets/screenshots/originals");
const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;
const PROCESSOR_TIMEOUT_MS = 120_000;
const PROCESSOR_SHUTDOWN_GRACE_MS = 5_000;
const MAX_PROCESSOR_TEXT_LENGTH = 64 * 1024;
const TRUNCATION_MARKER = "\n[truncated]";

type WorkerResult = {
	format: "jpeg" | "png" | "webp";
	preview: ImageVariant;
	full: ImageVariant;
};

type ImageVariant = {
	height: number;
	sha256: string;
	size: number;
	width: number;
};

export type ProcessedScreenshot = {
	fullHash: string;
	height: number;
	path: string;
	previewHash: string;
	previewHeight: number;
	previewPath: string;
	previewWidth: number;
	sourceHash: string;
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
			const sourceHash = createHash("sha256")
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
			const previewPath = getPublicationScreenshotAssetPath(
				locationId,
				workerResult.preview.sha256,
				1_000,
			);
			const fullPath = getPublicationScreenshotAssetPath(
				locationId,
				workerResult.full.sha256,
				1_920,
			);
			const previewDestination = resolve(PUBLIC_ROOT, previewPath.slice(1));
			const fullDestination = resolve(PUBLIC_ROOT, fullPath.slice(1));
			const originalDestination = resolve(
				ORIGINAL_ROOT,
				locationId,
				`${sourceHash}.${extensionForFormat(workerResult.format)}`,
			);

			for (const [source, destination, expectedHash] of [
				[previewOutputPath, previewDestination, workerResult.preview.sha256],
				[fullOutputPath, fullDestination, workerResult.full.sha256],
				[sourcePath, originalDestination, sourceHash],
			] as const) {
				if (await publishFile(source, destination, expectedHash)) {
					createdFiles.push(destination);
				}
			}

			screenshots.push({
				fullHash: workerResult.full.sha256,
				height: workerResult.full.height,
				path: fullPath,
				previewHash: workerResult.preview.sha256,
				previewHeight: workerResult.preview.height,
				previewPath,
				previewWidth: workerResult.preview.width,
				sourceHash,
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

export async function removeObsoleteScreenshotFiles(
	locationId: string,
	records: ReadonlyArray<{
		path: string;
		previewPath: string;
		sourceHash: string;
	}>,
	retainedPublicPaths: ReadonlySet<string>,
	retainedSourceHashes: ReadonlySet<string>,
) {
	assertSafeSegment(locationId);

	for (const record of records) {
		if (!retainedPublicPaths.has(record.path)) {
			await removePublicScreenshot(locationId, record.path);
		}
		if (!retainedPublicPaths.has(record.previewPath)) {
			await removePublicScreenshot(locationId, record.previewPath);
		}
		if (!retainedSourceHashes.has(record.sourceHash)) {
			await removeOriginalByHash(locationId, record.sourceHash);
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
		return parseWorkerResult(JSON.parse(output));
	} catch {
		throw new Error("The screenshot processor returned invalid metadata");
	}
}

export function executeBunProcessor(arguments_: string[]) {
	return new Promise<{ diagnostics: string; output: string }>(
		(resolve, reject) => {
			const subprocess = spawn("bun", arguments_, {
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true,
			});
			let output = "";
			let diagnostics = "";
			let outputLimitExceeded = false;
			let settled = false;
			let terminationError: Error | undefined;
			let terminationFallback: ReturnType<typeof setTimeout> | undefined;
			const timeoutError = new Error(
				`The screenshot processor timed out after ${PROCESSOR_TIMEOUT_MS / 1000} seconds`,
			);
			const timeout = setTimeout(() => {
				terminate(timeoutError);
			}, PROCESSOR_TIMEOUT_MS);

			function rejectOnce(error: Error) {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				clearTimeout(terminationFallback);
				reject(error);
			}

			function resolveOnce() {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				clearTimeout(terminationFallback);
				resolve({ diagnostics, output });
			}

			function terminate(error: Error) {
				if (terminationError) return;
				terminationError = error;
				terminationFallback = setTimeout(() => {
					rejectOnce(error);
				}, PROCESSOR_SHUTDOWN_GRACE_MS);
				try {
					if (!subprocess.kill("SIGKILL")) rejectOnce(error);
				} catch {
					rejectOnce(error);
				}
			}

			subprocess.stdout.setEncoding("utf8");
			subprocess.stderr.setEncoding("utf8");
			subprocess.stdout.on("data", (chunk: string) => {
				if (outputLimitExceeded) return;
				const result = appendBoundedText(output, chunk);
				output = result.text;
				outputLimitExceeded = result.truncated;
				if (outputLimitExceeded) {
					terminate(
						new Error("The screenshot processor returned too much data"),
					);
				}
			});
			subprocess.stderr.on("data", (chunk: string) => {
				diagnostics = appendBoundedText(diagnostics, chunk).text;
			});
			subprocess.once("error", (error) => {
				if (terminationError) return;
				rejectOnce(
					new Error(`Bun screenshot processor error: ${error.message}`),
				);
			});
			subprocess.once("close", (exitCode) => {
				if (terminationError) {
					rejectOnce(terminationError);
					return;
				}
				if (exitCode !== 0) {
					rejectOnce(
						new Error(
							diagnostics.trim() || "The screenshot could not be processed",
						),
					);
					return;
				}

				resolveOnce();
			});
		},
	);
}

function appendBoundedText(current: string, chunk: string) {
	const contentLimit = MAX_PROCESSOR_TEXT_LENGTH - TRUNCATION_MARKER.length;
	if (current.endsWith(TRUNCATION_MARKER)) {
		return { text: current, truncated: true };
	}
	if (current.length + chunk.length <= MAX_PROCESSOR_TEXT_LENGTH) {
		return { text: current + chunk, truncated: false };
	}
	const content =
		current.length >= contentLimit
			? current.slice(0, contentLimit)
			: current + chunk.slice(0, contentLimit - current.length);
	return {
		text: `${content}${TRUNCATION_MARKER}`,
		truncated: true,
	};
}

async function publishFile(
	sourcePath: string,
	destinationPath: string,
	expectedHash: string,
) {
	try {
		await access(destinationPath);

		if ((await hashFile(destinationPath)) !== expectedHash) {
			throw new Error(
				`Existing screenshot asset does not match ${destinationPath}`,
			);
		}

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

function parseWorkerResult(input: unknown): WorkerResult {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("The screenshot processor returned invalid metadata");
	}

	const value = input as Record<string, unknown>;
	const format = value.format;

	if (format !== "jpeg" && format !== "png" && format !== "webp") {
		throw new Error("The screenshot processor returned an invalid format");
	}

	return {
		format,
		full: parseImageVariant(value.full),
		preview: parseImageVariant(value.preview),
	};
}

function parseImageVariant(input: unknown): ImageVariant {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error(
			"The screenshot processor returned an invalid image variant",
		);
	}

	const value = input as Record<string, unknown>;

	if (
		!Number.isSafeInteger(value.width) ||
		(value.width as number) <= 0 ||
		!Number.isSafeInteger(value.height) ||
		(value.height as number) <= 0 ||
		!Number.isSafeInteger(value.size) ||
		(value.size as number) <= 0 ||
		typeof value.sha256 !== "string" ||
		!/^[a-f0-9]{64}$/.test(value.sha256)
	) {
		throw new Error("The screenshot processor returned invalid image metadata");
	}

	return {
		height: value.height as number,
		sha256: value.sha256,
		size: value.size as number,
		width: value.width as number,
	};
}

async function hashFile(path: string) {
	const hash = createHash("sha256");

	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}

	return hash.digest("hex");
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
