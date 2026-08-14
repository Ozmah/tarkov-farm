import { createHash } from "node:crypto";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SOURCE_PAGE = "Keys & Intel";
const SOURCE_REVISION = 353_194;
const SOURCE_URL = "https://escapefromtarkov.fandom.com/wiki/Keys_%26_Intel";
const API_URL = "https://escapefromtarkov.fandom.com/api.php";
const OUTPUT_DIRECTORY = "public/keys";
const CATALOG_PATH = "data/catalog/keys.json";
const MAX_ICON_PIXELS = 128 * 128;
const mapIds = new Map([
	["Customs", "customs"],
	["Factory", "factory"],
	["Ground Zero", "ground-zero"],
	["Icebreaker", "icebreaker"],
	["Interchange", "interchange"],
	["Lighthouse", "lighthouse"],
	["Reserve", "reserve"],
	["Shoreline", "shoreline"],
	["Streets of Tarkov", "streets-of-tarkov"],
	["The Lab", "the-lab"],
	["The Labyrinth", "the-labyrinth"],
	["Woods", "woods"],
]);

type ImageInfo = {
	height: number;
	mime: string;
	sha1: string;
	size: number;
	url: string;
	width: number;
};
type KeyRow = {
	file: string;
	mapName: string;
	name: string;
	usedInQuest: boolean;
};

await importCatalog();

async function importCatalog() {
	const lockPath = `${CATALOG_PATH}.lock`;
	await mkdir("data/catalog", { recursive: true });
	const lock = await acquireLock(lockPath);
	const temporaryDirectory = `${OUTPUT_DIRECTORY}.tmp-${process.pid}`;
	const backupDirectory = `${OUTPUT_DIRECTORY}.backup-${process.pid}`;

	try {
		const source = await fetchSourceRevision();
		const rows = parseKeyRows(source);
		const imageInfoByFile = await fetchImageInfo(rows.map(({ file }) => file));
		const keysByName = new Map<string, KeyRow[]>();

		for (const row of rows) {
			const existing = keysByName.get(row.name) ?? [];
			existing.push(row);
			keysByName.set(row.name, existing);
		}

		await rm(temporaryDirectory, { recursive: true, force: true });
		await mkdir(temporaryDirectory, { recursive: true });
		const keys = [];

		for (const [name, entries] of [...keysByName].sort(([left], [right]) =>
			compareCodePoints(left, right),
		)) {
			const id = slugify(name);
			const file = entries[0]?.file;
			const imageInfo = file
				? imageInfoByFile.get(normalizeFileName(file))
				: undefined;

			if (!file || !imageInfo) {
				throw new Error(`Missing image metadata for ${name}`);
			}

			const sourceUrl = new URL(imageInfo.url);
			sourceUrl.searchParams.set("format", "original");
			const sourceResponse = await fetchWithRetry(sourceUrl.href);
			const sourceBytes = await sourceResponse.arrayBuffer();
			const sourceSha1 = createHash("sha1")
				.update(new Uint8Array(sourceBytes))
				.digest("hex");
			const sourceSha256 = createHash("sha256")
				.update(new Uint8Array(sourceBytes))
				.digest("hex");
			const temporaryOutputPath = join(temporaryDirectory, `${id}.webp`);
			await new Bun.Image(sourceBytes, { maxPixels: MAX_ICON_PIXELS })
				.webp({ lossless: true })
				.write(temporaryOutputPath);
			const output = Bun.file(temporaryOutputPath);
			const outputMetadata = await new Bun.Image(temporaryOutputPath, {
				maxPixels: MAX_ICON_PIXELS,
			}).metadata();
			const outputSha256 = createHash("sha256")
				.update(new Uint8Array(await output.arrayBuffer()))
				.digest("hex");
			const outputFile = `${id}-${outputSha256.slice(0, 12)}.webp`;
			await rename(temporaryOutputPath, join(temporaryDirectory, outputFile));
			const mapIdSet = new Set<string>();

			for (const entry of entries) {
				const mapId = mapIds.get(entry.mapName);
				if (mapId) mapIdSet.add(mapId);
			}

			keys.push({
				id,
				name,
				wikiUrl: `https://escapefromtarkov.fandom.com/wiki/${encodeURIComponent(name).replaceAll("%20", "_")}`,
				image: {
					path: `/keys/${outputFile}`,
					width: outputMetadata.width,
					height: outputMetadata.height,
					sha256: outputSha256,
				},
				mapIds: [...mapIdSet].sort(compareCodePoints),
				usedInQuest: entries.some(({ usedInQuest }) => usedInQuest),
				source: {
					file,
					sha1: sourceSha1,
					sha256: sourceSha256,
					url: sourceUrl.href,
					wikiSha1: imageInfo.sha1,
				},
			});
			console.info(`Processed ${keys.length}/${keysByName.size}: ${name}`);
		}

		await replaceDirectory(
			temporaryDirectory,
			OUTPUT_DIRECTORY,
			backupDirectory,
		);
		await writeFile(
			CATALOG_PATH,
			`${JSON.stringify(
				{
					formatVersion: 1,
					source: {
						page: SOURCE_PAGE,
						revision: SOURCE_REVISION,
						url: SOURCE_URL,
					},
					keys,
				},
				null,
				"\t",
			)}\n`,
			"utf8",
		);
		console.info(
			`Imported ${keys.length} keys from wiki revision ${SOURCE_REVISION}`,
		);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
		await rm(backupDirectory, { recursive: true, force: true });
		await lock.close();
		await rm(lockPath, { force: true });
	}
}

async function fetchSourceRevision() {
	const parameters = new URLSearchParams({
		action: "query",
		format: "json",
		formatversion: "2",
		prop: "revisions",
		revids: String(SOURCE_REVISION),
		rvprop: "content|ids",
		rvslots: "main",
	});
	const response = await fetchWithRetry(`${API_URL}?${parameters}`);
	const result = (await response.json()) as {
		query?: {
			pages?: Array<{
				revisions?: Array<{
					revid: number;
					slots?: { main?: { content?: string } };
				}>;
			}>;
		};
	};
	const revision = result.query?.pages?.[0]?.revisions?.[0];

	if (revision?.revid !== SOURCE_REVISION || !revision.slots?.main?.content) {
		throw new Error(`Wiki revision ${SOURCE_REVISION} is unavailable`);
	}

	return revision.slots.main.content;
}

function parseKeyRows(source: string) {
	const sections = [
		...source.matchAll(
			/(?:<tabber>|^\|-\|)([^=\n]+)=\n([\s\S]*?)(?=^\|-\|[^=\n]+=\n|^<\/tabber>)/gm,
		),
	];
	const rows: KeyRow[] = [];

	for (const [, mapName, body] of sections) {
		if (!mapName || !body) continue;

		for (const tableRow of body.split("\n|-\n").slice(1)) {
			const file = tableRow
				.match(/\[\[File:\s*([^\]|]+?)(?:\s*\|[^\]]*)?\]\]/i)?.[1]
				?.trim();
			const name = [...tableRow.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)]
				.map((match) => match[1])
				.find((target) => target && !target.toLowerCase().startsWith("file:"))
				?.trim();

			if (file && name) {
				rows.push({ file, mapName, name, usedInQuest: tableRow.includes("✔") });
			}
		}
	}

	if (rows.length !== 234) {
		throw new Error(`Expected 234 key associations, parsed ${rows.length}`);
	}

	return rows;
}

async function fetchImageInfo(files: string[]) {
	const originalFileByNormalizedName = new Map<string, string>();
	for (const file of files) {
		originalFileByNormalizedName.set(normalizeFileName(file), file.trim());
	}
	const uniqueFiles = [...originalFileByNormalizedName.values()];
	const result = new Map<string, ImageInfo>();

	for (let index = 0; index < uniqueFiles.length; index += 50) {
		const batch = uniqueFiles.slice(index, index + 50);
		const parameters = new URLSearchParams({
			action: "query",
			format: "json",
			formatversion: "2",
			iiprop: "url|size|mime|sha1",
			prop: "imageinfo",
			redirects: "1",
			titles: batch.map((file) => `File:${file}`).join("|"),
		});
		const response = await fetchWithRetry(`${API_URL}?${parameters}`);
		const payload = (await response.json()) as {
			query?: { pages?: Array<{ title: string; imageinfo?: ImageInfo[] }> };
		};

		for (const page of payload.query?.pages ?? []) {
			const info = page.imageinfo?.[0];
			if (info)
				result.set(normalizeFileName(page.title.replace(/^File:/i, "")), info);
		}
	}

	if (result.size !== originalFileByNormalizedName.size) {
		throw new Error(
			`Expected metadata for ${uniqueFiles.length} images, received ${result.size}`,
		);
	}

	return result;
}

async function fetchWithRetry(url: string) {
	let lastError: unknown;

	for (let attempt = 1; attempt <= 4; attempt++) {
		try {
			const response = await fetch(url, {
				headers: { "user-agent": "TarkovFarmKeyCatalog/1.0" },
				signal: AbortSignal.timeout(30_000),
			});

			if (response.ok) return response;
			lastError = new Error(`HTTP ${response.status}`);
		} catch (error) {
			lastError = error;
		}

		await Bun.sleep(attempt * 500);
	}

	throw new Error(`Failed to fetch ${new URL(url).origin}`, {
		cause: lastError,
	});
}

function normalizeFileName(value: string) {
	return value.trim().replaceAll("_", " ").toLowerCase();
}

function slugify(value: string) {
	return value
		.normalize("NFKD")
		.replace(/[’']/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();
}

function compareCodePoints(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

async function acquireLock(path: string) {
	try {
		return await open(path, "wx");
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "EEXIST") {
			throw new Error("Key catalog import is already running");
		}
		throw error;
	}
}

async function replaceDirectory(
	temporary: string,
	output: string,
	backup: string,
) {
	let movedExisting = false;
	await rm(backup, { recursive: true, force: true });

	try {
		await rename(output, backup);
		movedExisting = true;
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
			throw error;
	}

	try {
		await rename(temporary, output);
	} catch (error) {
		if (movedExisting) await rename(backup, output);
		throw error;
	}

	if (movedExisting) await rm(backup, { recursive: true, force: true });
}
