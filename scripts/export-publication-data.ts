import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";

import { connect, type Database } from "@tursodatabase/database";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";

import {
	type PublicationAsset,
	type PublicationData,
	serializePublicationData,
} from "../src/lib/publication-data";
import { getDatabasePath } from "../src/server/db/path";
import {
	documentMaps,
	documents,
	locationDocuments,
	locations,
	mapImages,
	maps,
	screenshots,
} from "../src/server/db/schema";
import {
	createSnapshot,
	verifyKnownForeignKeys,
} from "./create-database-snapshot";

const PROJECT_ROOT = resolve(process.cwd());
const PUBLIC_ROOT = resolve(PROJECT_ROOT, "public");
const ORIGINAL_ROOT = resolve(
	PROJECT_ROOT,
	"assets",
	"screenshots",
	"originals",
);
const DATA_DIRECTORY = resolve(PROJECT_ROOT, "data");
const OUTPUT_DIRECTORY = resolve(PROJECT_ROOT, "data", "publication");
const OUTPUT_PATH = resolve(OUTPUT_DIRECTORY, "locations.json");
const MAX_SCREENSHOT_PIXELS = 40_000_000;

async function main() {
	const temporaryDirectory = await mkdtemp(
		resolve(tmpdir(), "tarkov-publication-export-"),
	);
	const snapshotPath = resolve(temporaryDirectory, "source.sqlite");

	try {
		try {
			await createSnapshot(getDatabasePath(), snapshotPath);
		} catch (error) {
			throw new Error(
				`Could not freeze the source database. Stop the development server and editor before retrying. Driver error: ${toErrorMessage(error)}`,
				{ cause: error },
			);
		}

		const client = await connect(snapshotPath, {
			defaultQueryTimeout: 30_000,
			fileMustExist: true,
			readonly: true,
			timeout: 5_000,
		});

		try {
			await verifyDatabase(client);
			const data = await readPublicationData(client);
			const serialized = serializePublicationData(data);
			const changed = await writePublicationData(serialized);

			const screenshotCount = data.locations.reduce(
				(count, location) => count + location.screenshots.length,
				0,
			);
			console.info(
				`${changed ? "Exported" : "Validated"} ${data.locations.length} locations, ${screenshotCount} screenshots, and ${screenshotCount * 2} hashed assets in data/publication/locations.json.`,
			);
		} finally {
			await client.close();
		}
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true });
	}
}

async function verifyDatabase(client: Database) {
	const integrityRows = await client.all("PRAGMA integrity_check");
	const integrityMessages = integrityRows.map((row) =>
		readString(row, "integrity_check"),
	);

	if (integrityMessages.length !== 1 || integrityMessages[0] !== "ok") {
		throw new Error(
			`Database integrity check failed: ${integrityMessages.join(", ")}`,
		);
	}

	const relationshipErrors: string[] = [];
	await verifyKnownForeignKeys(client, relationshipErrors);

	if (relationshipErrors.length > 0) {
		throw new Error(
			`Database relationships are invalid: ${relationshipErrors.join(", ")}`,
		);
	}
}

async function readPublicationData(client: Database): Promise<PublicationData> {
	const db = drizzle({ client });
	const locationRows = await db
		.select()
		.from(locations)
		.orderBy(asc(locations.id))
		.all();
	const relationRows = await db
		.select()
		.from(locationDocuments)
		.orderBy(asc(locationDocuments.locationId))
		.all();
	const screenshotRows = await db
		.select()
		.from(screenshots)
		.orderBy(
			asc(screenshots.locationId),
			asc(screenshots.sortOrder),
			asc(screenshots.id),
		)
		.all();
	const mapRows = await db
		.select({ id: maps.id, isActive: maps.isActive })
		.from(maps)
		.all();
	const mapImageRows = await db
		.select({
			id: mapImages.id,
			isCurrent: mapImages.isCurrent,
			mapId: mapImages.mapId,
		})
		.from(mapImages)
		.all();
	const documentRows = await db
		.select({
			id: documents.id,
			isActive: documents.isActive,
			isFilterable: documents.isFilterable,
		})
		.from(documents)
		.all();
	const documentMapRows = await db
		.select({
			documentId: documentMaps.documentId,
			mapId: documentMaps.mapId,
		})
		.from(documentMaps)
		.all();
	const locationIds = new Set(locationRows.map(({ id }) => id));
	const activeMapIds = new Set(
		mapRows.filter(({ isActive }) => isActive).map(({ id }) => id),
	);
	const mapImageById = new Map(mapImageRows.map((image) => [image.id, image]));
	const documentById = new Map(
		documentRows.map((document) => [document.id, document]),
	);
	const allowedDocumentMaps = new Set(
		documentMapRows.map(({ documentId, mapId }) =>
			relationKey(documentId, mapId),
		),
	);
	const documentByLocation = new Map<string, string>();
	const screenshotsByLocation = new Map<string, typeof screenshotRows>();

	for (const relation of relationRows) {
		if (!locationIds.has(relation.locationId)) {
			throw new Error(
				`Document relation references missing location ${relation.locationId}`,
			);
		}

		if (!documentById.has(relation.documentId)) {
			throw new Error(
				`Location ${relation.locationId} references missing document ${relation.documentId}`,
			);
		}

		if (documentByLocation.has(relation.locationId)) {
			throw new Error(
				`Location ${relation.locationId} has more than one document`,
			);
		}

		documentByLocation.set(relation.locationId, relation.documentId);
	}

	for (const screenshot of screenshotRows) {
		if (!locationIds.has(screenshot.locationId)) {
			throw new Error(
				`Screenshot ${screenshot.id} references a missing location`,
			);
		}

		const locationScreenshots =
			screenshotsByLocation.get(screenshot.locationId) ?? [];
		locationScreenshots.push(screenshot);
		screenshotsByLocation.set(screenshot.locationId, locationScreenshots);
	}

	const publicationLocations: PublicationData["locations"] = [];

	for (const location of locationRows) {
		const mapImage = mapImageById.get(location.mapImageId);

		if (!mapImage) {
			throw new Error(
				`Location ${location.id} references missing map image ${location.mapImageId}`,
			);
		}

		if (!mapImage.isCurrent || !activeMapIds.has(mapImage.mapId)) {
			throw new Error(
				`Location ${location.id} references an unpublished map image`,
			);
		}

		const documentId = documentByLocation.get(location.id);

		if (!documentId) {
			throw new Error(`Location ${location.id} has no document relation`);
		}

		const document = documentById.get(documentId);

		if (!document?.isActive || !document.isFilterable) {
			throw new Error(
				`Location ${location.id} references an unpublished document`,
			);
		}

		if (!allowedDocumentMaps.has(relationKey(documentId, mapImage.mapId))) {
			throw new Error(
				`Location ${location.id} document ${documentId} is not available on map ${mapImage.mapId}`,
			);
		}

		const locationScreenshots = screenshotsByLocation.get(location.id) ?? [];
		const publicationScreenshots = [];

		for (const screenshot of locationScreenshots) {
			if (
				!screenshot.contentHash ||
				!screenshot.previewPath ||
				!screenshot.previewWidth ||
				!screenshot.previewHeight
			) {
				throw new Error(
					`Screenshot ${screenshot.id} has incomplete publication metadata`,
				);
			}

			await verifyOriginalSourceAtRoot(
				ORIGINAL_ROOT,
				location.id,
				screenshot.contentHash,
			);

			const [full, preview] = await Promise.all([
				readAsset(screenshot.path, screenshot.width, screenshot.height),
				readAsset(
					screenshot.previewPath,
					screenshot.previewWidth,
					screenshot.previewHeight,
				),
			]);

			publicationScreenshots.push({
				altText: screenshot.altText,
				caption: screenshot.caption,
				full,
				id: screenshot.id,
				isActive: screenshot.isActive,
				preview,
				sortOrder: screenshot.sortOrder,
				sourceSha256: screenshot.contentHash,
			});
		}

		publicationLocations.push({
			description: location.description,
			documentId,
			id: location.id,
			isActive: location.isActive,
			mapImageId: location.mapImageId,
			name: location.name,
			screenshots: publicationScreenshots,
			xBasisPoints: location.xBasisPoints,
			yBasisPoints: location.yBasisPoints,
		});
	}

	return { formatVersion: 1, locations: publicationLocations };
}

async function readAsset(
	publicPath: string,
	expectedWidth: number,
	expectedHeight: number,
): Promise<PublicationAsset> {
	if (!publicPath.startsWith("/") || publicPath.includes("\\")) {
		throw new Error(`Invalid public asset path: ${publicPath}`);
	}

	const absolutePath = resolve(PUBLIC_ROOT, publicPath.replace(/^\/+/, ""));

	if (!absolutePath.startsWith(`${PUBLIC_ROOT}${sep}`)) {
		throw new Error(`Asset points outside the public directory: ${publicPath}`);
	}

	const fileStats = await lstat(absolutePath);

	if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
		throw new Error(`Asset is not a regular file: ${publicPath}`);
	}

	await assertRealPathWithin(absolutePath, PUBLIC_ROOT, "Public asset");

	const metadata = await new Bun.Image(absolutePath, {
		maxPixels: MAX_SCREENSHOT_PIXELS,
	}).metadata();

	if (
		metadata.format !== "webp" ||
		metadata.width !== expectedWidth ||
		metadata.height !== expectedHeight
	) {
		throw new Error(
			`Asset metadata does not match ${publicPath}: expected ${expectedWidth}x${expectedHeight} WebP, received ${metadata.width}x${metadata.height} ${metadata.format}`,
		);
	}

	return {
		height: expectedHeight,
		path: publicPath,
		sha256: await hashFile(absolutePath),
		width: expectedWidth,
	};
}

export async function verifyOriginalSourceAtRoot(
	originalRoot: string,
	locationId: string,
	sourceSha256: string,
) {
	const directory = resolve(originalRoot, locationId);
	await assertRealPathWithin(
		directory,
		originalRoot,
		"Original screenshot directory",
	);
	const expectedFilenames = new Set([
		`${sourceSha256}.jpg`,
		`${sourceSha256}.png`,
		`${sourceSha256}.webp`,
	]);
	const matches = (await readdir(directory)).filter((entry) =>
		expectedFilenames.has(entry),
	);

	if (matches.length !== 1) {
		throw new Error(
			`Screenshot source ${sourceSha256} for location ${locationId} must resolve to exactly one original file`,
		);
	}

	const sourcePath = resolve(directory, matches[0]);
	const sourceStats = await lstat(sourcePath);

	if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
		throw new Error(`Screenshot source is not a regular file: ${matches[0]}`);
	}

	await assertRealPathWithin(sourcePath, originalRoot, "Original screenshot");

	if ((await hashFile(sourcePath)) !== sourceSha256) {
		throw new Error(`Screenshot source hash does not match ${matches[0]}`);
	}
}

async function writePublicationData(serialized: string) {
	await prepareOutputDirectory();
	await assertRealPathWithin(
		OUTPUT_DIRECTORY,
		PROJECT_ROOT,
		"Publication directory",
	);

	try {
		const outputStats = await lstat(OUTPUT_PATH);

		if (!outputStats.isFile() || outputStats.isSymbolicLink()) {
			throw new Error("Publication output must be a regular file");
		}

		if ((await readFile(OUTPUT_PATH, "utf8")) === serialized) {
			return false;
		}
	} catch (error) {
		if (!isMissingPathError(error)) throw error;
	}

	const temporaryPath = resolve(
		OUTPUT_DIRECTORY,
		`.locations-${randomUUID()}.tmp`,
	);

	try {
		await writeFile(temporaryPath, serialized, {
			encoding: "utf8",
			flag: "wx",
		});
		await rename(temporaryPath, OUTPUT_PATH);
		return true;
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

async function prepareOutputDirectory() {
	const dataStats = await lstat(DATA_DIRECTORY);

	if (!dataStats.isDirectory() || dataStats.isSymbolicLink()) {
		throw new Error("Data directory must be a regular directory");
	}

	try {
		const outputStats = await lstat(OUTPUT_DIRECTORY);

		if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) {
			throw new Error("Publication directory must be a regular directory");
		}
	} catch (error) {
		if (!isMissingPathError(error)) throw error;
		await mkdir(OUTPUT_DIRECTORY);
	}
}

async function assertRealPathWithin(path: string, root: string, label: string) {
	const [resolvedPath, resolvedRoot] = await Promise.all([
		realpath(path),
		realpath(root),
	]);

	if (
		resolvedPath !== resolvedRoot &&
		!resolvedPath.startsWith(`${resolvedRoot}${sep}`)
	) {
		throw new Error(`${label} resolves outside its allowed directory`);
	}
}

async function hashFile(path: string) {
	const hash = createHash("sha256");

	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}

	return hash.digest("hex");
}

function readString(row: unknown, key: string) {
	if (!row || typeof row !== "object" || !(key in row)) {
		throw new TypeError(`Database row is missing ${key}`);
	}

	const value = (row as Record<string, unknown>)[key];

	if (typeof value !== "string") {
		throw new TypeError(`Expected ${key} to be a string`);
	}

	return value;
}

function toErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "Unknown publication export error";
}

function relationKey(left: string, right: string) {
	return `${left}\u0000${right}`;
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ENOENT"
	);
}

if (import.meta.main) {
	await main().catch((error) => {
		console.error(toErrorMessage(error));
		process.exitCode = 1;
	});
}
