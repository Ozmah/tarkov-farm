// @vitest-environment node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rename,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MapMasterManifest } from "../src/lib/map-master-manifest";

const executeFile = promisify(execFile);
const script = fileURLToPath(
	new URL("./generate-map-masters.ts", import.meta.url),
);
const png =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
let root: string;
let originals: string;
let masters: string;

async function run(...args: string[]) {
	return executeFile("bun", ["--no-env-file", script, ...args], {
		cwd: root,
		timeout: 30_000,
	});
}

async function writeOriginal(file: string, width = 1400, height = 700) {
	await executeFile("bun", [
		"--no-env-file",
		"-e",
		`await new Bun.Image(Buffer.from(${JSON.stringify(png)}, "base64")).resize(${width}, ${height}).png().write(${JSON.stringify(join(originals, file))});`,
	]);
}

async function manifest(): Promise<MapMasterManifest> {
	return JSON.parse(await readFile(join(masters, "manifest.json"), "utf8"));
}

async function snapshot() {
	const files = (await readdir(masters)).sort();
	return Promise.all(
		files.map(async (file) => [
			file,
			createHash("sha256")
				.update(await readFile(join(masters, file)))
				.digest("hex"),
		]),
	);
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "map-master-test-"));
	originals = join(root, "assets/maps/originals");
	masters = join(root, "public/maps/masters");
	await mkdir(originals, { recursive: true });
	await mkdir(join(root, "public/maps"), { recursive: true });
	await writeOriginal("lighthouse.png");
	await writeOriginal("other.png");
	await run();
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("map generation CLI", () => {
	it("refuses incomplete full regeneration without touching published assets", async () => {
		const before = await snapshot();
		await rm(join(originals, "other.png"));
		await expect(run()).rejects.toThrow("Missing originals for: other.webp");
		expect(await snapshot()).toEqual(before);
		expect(await readdir(join(root, "public/maps"))).toEqual(["masters"]);
	});

	it("updates one map, preserving unrelated bytes and metadata and removing obsolete variants", async () => {
		const before = await manifest();
		const beforeFiles = await snapshot();
		await rm(join(originals, "other.png"));
		await writeOriginal("lighthouse.png", 1600, 900);
		await run("--only", "lighthouse.png");
		const after = await manifest();
		const afterFiles = await snapshot();
		const previous = before.images.find(
			(image) => image.file === "lighthouse.webp",
		);
		const updated = after.images.find(
			(image) => image.file === "lighthouse.webp",
		);
		const other = before.images.find((image) => image.file === "other.webp");
		expect(previous).toBeDefined();
		expect(updated?.width).toBe(1600);
		expect(updated?.height).toBe(900);
		expect(updated?.sha256).not.toBe(previous?.sha256);
		expect(after.images.find((image) => image.file === "other.webp")).toEqual(
			other,
		);
		expect(after.settings).toEqual(before.settings);
		for (const asset of [other, ...(other?.variants ?? [])]) {
			expect(afterFiles.find(([file]) => file === asset?.file)).toEqual(
				beforeFiles.find(([file]) => file === asset?.file),
			);
		}
		for (const asset of previous?.variants ?? []) {
			expect(afterFiles.some(([file]) => file === asset.file)).toBe(false);
		}
		expect(after.images.map((image) => image.file)).toEqual(
			before.images.map((image) => image.file),
		);
	});

	it("keeps the old collection when image processing fails", async () => {
		const before = await snapshot();
		await writeFile(join(originals, "lighthouse.png"), "not an image");
		await expect(run("--only", "lighthouse.png")).rejects.toThrow(
			"Failed to process lighthouse.png",
		);
		expect(await snapshot()).toEqual(before);
		expect(await readdir(join(root, "public/maps"))).toEqual(["masters"]);
	});

	it.each(["corrupt", "missing", "orphan", "manifest", "settings"])(
		"rejects %s published data without replacing the collection",
		async (problem) => {
			if (problem === "corrupt") {
				await writeFile(join(masters, "other.webp"), "corrupt");
			} else if (problem === "missing") {
				await rm(join(masters, "other.webp"));
			} else if (problem === "orphan") {
				await writeFile(join(masters, "orphan.webp"), "orphan");
			} else if (problem === "manifest") {
				await writeFile(join(masters, "manifest.json"), "{}");
			} else {
				const data = await manifest();
				data.settings.quality = 80;
				await writeFile(join(masters, "manifest.json"), JSON.stringify(data));
			}
			const before = await snapshot();
			await expect(run("--only", "lighthouse.png")).rejects.toThrow();
			expect(await snapshot()).toEqual(before);
		},
	);

	it("rejects an existing output directory with no manifest", async () => {
		await rm(join(masters, "manifest.json"));
		const before = await snapshot();
		await expect(run()).rejects.toThrow();
		expect(await snapshot()).toEqual(before);
	});

	it("refuses concurrent generation without deleting another run's lock", async () => {
		const before = await snapshot();
		await writeFile(`${masters}.lock`, "existing lock");
		await expect(run("--only", "lighthouse.png")).rejects.toThrow(
			"already running",
		);
		expect(await readFile(`${masters}.lock`, "utf8")).toBe("existing lock");
		expect(await snapshot()).toEqual(before);
	});

	it("regenerates responsive assets without any originals", async () => {
		const before = await manifest();
		await rm(originals, { recursive: true });
		await run("--responsive-only");
		const after = await manifest();
		expect(
			after.images.map(({ variants: _variants, ...master }) => master),
		).toEqual(
			before.images.map(({ variants: _variants, ...master }) => master),
		);
	});

	it.skipIf(process.platform === "win32")(
		"rejects symlinked originals and output roots",
		async () => {
			const before = await snapshot();
			await rm(join(originals, "lighthouse.png"));
			await symlink(
				join(originals, "other.png"),
				join(originals, "lighthouse.png"),
			);
			await expect(run("--only", "lighthouse.png")).rejects.toThrow(
				"regular files",
			);
			expect(await snapshot()).toEqual(before);
			await rename(masters, `${masters}.real`);
			await symlink(`${masters}.real`, masters, "dir");
			await expect(run()).rejects.toThrow("regular directory");
			expect(await snapshot()).toEqual(before);
		},
	);
});
