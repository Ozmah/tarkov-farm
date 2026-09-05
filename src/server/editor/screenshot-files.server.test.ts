import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import {
	executeBunProcessor,
	removeObsoleteScreenshotFiles,
} from "./screenshot-files.server";

beforeEach(() => spawnMock.mockReset());

afterEach(() => vi.useRealTimers());

describe("screenshot processor", () => {
	it("kills processors that run for more than two minutes", async () => {
		vi.useFakeTimers();
		const subprocess = createSubprocess({ closeOnKill: false });
		spawnMock.mockReturnValue(subprocess);
		const result = executeBunProcessor(["worker.ts"]);
		const rejection = expect(result).rejects.toThrow(
			"timed out after 120 seconds",
		);

		await vi.advanceTimersByTimeAsync(120_000);

		expect(subprocess.kill).toHaveBeenCalledWith("SIGKILL");
		await vi.advanceTimersByTimeAsync(5_000);
		await rejection;
	});

	it("caps diagnostics returned by a failed processor", async () => {
		const subprocess = createSubprocess();
		spawnMock.mockReturnValue(subprocess);
		const result = executeBunProcessor(["worker.ts"]);

		subprocess.stderr.write("x".repeat(70_000));
		subprocess.emit("close", 1);

		const error = await result.catch((reason: unknown) => reason);
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toMatch(/\[truncated\]$/);
		expect((error as Error).message.length).toBeLessThanOrEqual(64 * 1024);
	});

	it("kills processors that return unbounded metadata", async () => {
		const subprocess = createSubprocess();
		spawnMock.mockReturnValue(subprocess);
		const result = executeBunProcessor(["worker.ts"]);

		subprocess.stdout.write("x".repeat(70_000));

		expect(subprocess.kill).toHaveBeenCalledWith("SIGKILL");
		await expect(result).rejects.toThrow("returned too much data");
	});

	it("removes only screenshot files that are no longer retained", async () => {
		const locationId = `test-${randomUUID()}`;
		const publicDirectory = resolve("public/screenshots", locationId);
		const originalDirectory = resolve(
			"assets/screenshots/originals",
			locationId,
		);
		const removedSourceHash = "a".repeat(64);
		const retainedSourceHash = "b".repeat(64);
		const removedFullPath = `/screenshots/${locationId}/removed-full.webp`;
		const removedPreviewPath = `/screenshots/${locationId}/removed-preview.webp`;
		const retainedFullPath = `/screenshots/${locationId}/retained-full.webp`;
		const obsoletePreviewPath = `/screenshots/${locationId}/obsolete-preview.webp`;

		try {
			await Promise.all([
				mkdir(publicDirectory, { recursive: true }),
				mkdir(originalDirectory, { recursive: true }),
			]);
			await Promise.all([
				writeFile(resolve(publicDirectory, "removed-full.webp"), "removed"),
				writeFile(resolve(publicDirectory, "removed-preview.webp"), "removed"),
				writeFile(resolve(publicDirectory, "retained-full.webp"), "retained"),
				writeFile(resolve(publicDirectory, "obsolete-preview.webp"), "removed"),
				writeFile(
					resolve(originalDirectory, `${removedSourceHash}.png`),
					"removed",
				),
				writeFile(
					resolve(originalDirectory, `${retainedSourceHash}.png`),
					"retained",
				),
			]);

			await removeObsoleteScreenshotFiles(
				locationId,
				[
					{
						path: removedFullPath,
						previewPath: removedPreviewPath,
						sourceHash: removedSourceHash,
					},
					{
						path: retainedFullPath,
						previewPath: obsoletePreviewPath,
						sourceHash: retainedSourceHash,
					},
				],
				new Set([retainedFullPath]),
				new Set([retainedSourceHash]),
			);

			expect(
				await fileExists(resolve(publicDirectory, "removed-full.webp")),
			).toBe(false);
			expect(
				await fileExists(resolve(publicDirectory, "removed-preview.webp")),
			).toBe(false);
			expect(
				await fileExists(resolve(publicDirectory, "obsolete-preview.webp")),
			).toBe(false);
			expect(
				await fileExists(
					resolve(originalDirectory, `${removedSourceHash}.png`),
				),
			).toBe(false);
			expect(
				await fileExists(resolve(publicDirectory, "retained-full.webp")),
			).toBe(true);
			expect(
				await fileExists(
					resolve(originalDirectory, `${retainedSourceHash}.png`),
				),
			).toBe(true);
		} finally {
			await Promise.all([
				rm(publicDirectory, { recursive: true, force: true }),
				rm(originalDirectory, { recursive: true, force: true }),
			]);
		}
	});
});

async function fileExists(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function createSubprocess({ closeOnKill = true } = {}) {
	const subprocess = Object.assign(new EventEmitter(), {
		kill: vi.fn(),
		stderr: new PassThrough(),
		stdout: new PassThrough(),
	});
	subprocess.kill.mockImplementation(() => {
		if (closeOnKill) subprocess.emit("close", null, "SIGKILL");
		return true;
	});
	return subprocess;
}
