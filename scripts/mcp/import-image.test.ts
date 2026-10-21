import { execFileSync } from "node:child_process";
import {
	mkdir,
	mkdtemp,
	rm,
	symlink,
	truncate,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MAX_INTAKE_SCREENSHOT_BYTES } from "../../src/lib/intake-draft";
import { importImage } from "./import-image";

// Smallest valid 1x1 PNG.
const PNG = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	),
	(character) => character.charCodeAt(0),
);
const decode = async () => ({ width: 1, height: 1 });

describe("importImage", () => {
	let base: string;
	let allowed: string;

	beforeEach(async () => {
		base = await mkdtemp(join(tmpdir(), "tarkov-import-"));
		allowed = join(base, "allowed");
		await mkdir(allowed);
	});
	afterEach(async () => {
		await rm(base, { recursive: true, force: true });
	});

	it("imports a valid image inside an allowed root", async () => {
		await writeFile(join(allowed, "shot.png"), PNG);
		const image = await importImage(
			join(allowed, "shot.png"),
			[allowed],
			decode,
		);
		expect(image).toMatchObject({
			mediaType: "image/png",
			width: 1,
			height: 1,
		});
	});

	it("rejects files outside the allowed roots, including via traversal and symlinks", async () => {
		await writeFile(join(base, "outside.png"), PNG);
		await symlink(join(base, "outside.png"), join(allowed, "link.png"));

		for (const path of [
			join(base, "outside.png"),
			join(allowed, "..", "outside.png"),
			join(allowed, "link.png"),
		])
			await expect(importImage(path, [allowed], decode)).rejects.toThrow(
				"outside the allowed",
			);
	});

	it("rejects files over the size limit without reading them", async () => {
		const path = join(allowed, "huge.png");
		await writeFile(path, PNG);
		// Sparse: reports MAX + 1 bytes without using the disk space.
		await truncate(path, MAX_INTAKE_SCREENSHOT_BYTES + 1);
		await expect(importImage(path, [allowed], decode)).rejects.toThrow(
			"up to 20 MiB",
		);
	});

	it("rejects a FIFO without blocking on it", async () => {
		const path = join(allowed, "pipe.png");
		execFileSync("mkfifo", [path]);
		await expect(importImage(path, [allowed], decode)).rejects.toThrow(
			"up to 20 MiB",
		);
	});

	it("rejects relative paths and content that is not an image", async () => {
		await expect(importImage("shot.png", [allowed], decode)).rejects.toThrow(
			"absolute",
		);
		await writeFile(join(allowed, "fake.png"), "not an image");
		await expect(
			importImage(join(allowed, "fake.png"), [allowed], decode),
		).rejects.toThrow("PNG, JPEG, or WebP");
	});
});
