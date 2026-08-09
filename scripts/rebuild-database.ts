import { createHash } from "node:crypto";
import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { basename, resolve } from "node:path";

import { connect } from "@tursodatabase/database";

import {
	parsePublicationData,
	serializePublicationData,
} from "../src/lib/publication-data";
import { migrateDatabase } from "../src/server/db/migrate";
import { openDatabase } from "../src/server/db/open";
import {
	assertPublicationImportCounts,
	importPublicationData,
	readPublicationDataFromDatabase,
} from "../src/server/db/publication-store";
import { seedCatalog } from "../src/server/db/seed";
import {
	createSnapshot,
	verifyKnownForeignKeys,
} from "./create-database-snapshot";
import {
	hashFile,
	verifyMapMasterAssets,
	verifyPublicationAssets,
} from "./lib/publication-assets";

const PROJECT_ROOT = resolve(process.cwd());
const DATA_ROOT = resolve(PROJECT_ROOT, "data");
const REBUILD_ROOT = resolve(DATA_ROOT, "rebuild");
const PUBLICATION_PATH = resolve(DATA_ROOT, "publication", "locations.json");
const MIGRATIONS_ROOT = resolve(PROJECT_ROOT, "drizzle");

async function main() {
	await assertRegularDirectory(DATA_ROOT, "Data directory");
	await mkdir(REBUILD_ROOT, { recursive: true });
	await assertRegularDirectory(REBUILD_ROOT, "Rebuild directory");

	const sourceBytes = await readFile(PUBLICATION_PATH, "utf8");
	const publication = parsePublicationData(JSON.parse(sourceBytes));
	const canonicalBytes = serializePublicationData(publication);

	if (sourceBytes !== canonicalBytes) {
		throw new Error(
			"Publication data is not in canonical form; run bun run db:export",
		);
	}

	const assetResult = await verifyPublicationAssets(publication, {
		projectRoot: PROJECT_ROOT,
		rejectOrphans: true,
		requireOriginals: true,
	});
	const mapAssetResult = await verifyMapMasterAssets(PROJECT_ROOT);
	const startedAt = new Date();
	const finalDirectory = resolve(
		REBUILD_ROOT,
		`tarkov-season-docs-${formatTimestamp(startedAt)}`,
	);
	await requireMissingPath(finalDirectory);
	const stagingDirectory = await mkdtemp(resolve(REBUILD_ROOT, ".candidate-"));
	const workingPath = resolve(stagingDirectory, "working.sqlite");
	const candidatePath = resolve(stagingDirectory, "database.sqlite");
	const manifestPath = resolve(stagingDirectory, "manifest.json");
	let published = false;

	try {
		const { client, db } = await openDatabase(workingPath, { create: true });

		try {
			await migrateDatabase(db, MIGRATIONS_ROOT);
			const staticCounts = await seedCatalog(db);
			const importCounts = await importPublicationData(client, publication);
			await assertPublicationImportCounts(client, importCounts);
			await assertDatabaseMatches(client, canonicalBytes);
			await client.exec("PRAGMA optimize;");

			console.info(
				`Built working database with ${staticCounts.maps} maps and ${importCounts.locations} locations.`,
			);
		} finally {
			await client.close();
		}

		await createSnapshot(workingPath, candidatePath);
		await removeDatabaseFiles(workingPath);

		const verificationClient = await connect(candidatePath, {
			fileMustExist: true,
			readonly: true,
		});
		let migrationRows: unknown[];

		try {
			await assertDatabaseMatches(verificationClient, canonicalBytes);
			migrationRows = await verificationClient.all(`
				SELECT id, hash, created_at AS createdAt, name, applied_at AS appliedAt
				FROM __drizzle_migrations
				ORDER BY id
			`);
		} finally {
			await verificationClient.close();
		}

		await prepareWritableCandidate(candidatePath);
		const candidateStats = await stat(candidatePath);
		const walPath = `${candidatePath}-wal`;
		const walStats = await stat(walPath);
		const manifest = {
			assets: {
				mapFiles: mapAssetResult.mapFiles,
				referencedFiles: assetResult.referencedFiles,
			},
			candidate: {
				file: basename(candidatePath),
				sha256: await hashFile(candidatePath),
				sizeBytes: candidateStats.size,
				wal: {
					file: basename(walPath),
					sha256: await hashFile(walPath),
					sizeBytes: walStats.size,
				},
			},
			completedAt: new Date().toISOString(),
			formatVersion: 1,
			migrations: migrationRows,
			publication: {
				file: "data/publication/locations.json",
				sha256: createHash("sha256").update(canonicalBytes).digest("hex"),
			},
			startedAt: startedAt.toISOString(),
			target: "data/tarkov-season-docs.sqlite",
		};

		await writeFile(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`, {
			encoding: "utf8",
			flag: "wx",
		});
		await rename(stagingDirectory, finalDirectory);
		published = true;

		console.info(`Verified candidate: ${relativeProjectPath(finalDirectory)}`);
		console.info(`Candidate SHA-256: ${manifest.candidate.sha256}`);
		console.info("The active authoring database was not modified.");
	} finally {
		if (!published) {
			await rm(stagingDirectory, { force: true, recursive: true });
		}
	}
}

async function assertDatabaseMatches(
	client: Awaited<ReturnType<typeof connect>>,
	canonical: string,
) {
	const integrityRows = await client.all("PRAGMA integrity_check");
	const integrityMessages = integrityRows.map((row) =>
		readString(row, "integrity_check"),
	);

	if (integrityMessages.length !== 1 || integrityMessages[0] !== "ok") {
		throw new Error(
			`Candidate integrity check failed: ${integrityMessages.join(", ")}`,
		);
	}

	const relationshipErrors: string[] = [];
	await verifyKnownForeignKeys(client, relationshipErrors);

	if (relationshipErrors.length > 0) {
		throw new Error(
			`Candidate relationships are invalid: ${relationshipErrors.join(", ")}`,
		);
	}

	const databaseData = await readPublicationDataFromDatabase(client);

	if (serializePublicationData(databaseData) !== canonical) {
		throw new Error("Candidate rows do not match canonical publication data");
	}
}

async function removeDatabaseFiles(databasePath: string) {
	await Promise.all(
		[databasePath, `${databasePath}-wal`, `${databasePath}-shm`].map((path) =>
			rm(path, { force: true }),
		),
	);
}

async function prepareWritableCandidate(databasePath: string) {
	const walPath = `${databasePath}-wal`;

	try {
		const walStats = await stat(walPath);

		if (walStats.size !== 0) {
			throw new Error("Candidate WAL must be empty after snapshot creation");
		}
	} catch (error) {
		if (!isMissingPathError(error)) throw error;
		await writeFile(walPath, new Uint8Array(), { flag: "wx" });
	}

	await rm(`${databasePath}-shm`, { force: true });
	const client = await connect(databasePath, { fileMustExist: true });

	try {
		await client.get("SELECT COUNT(*) AS count FROM locations");
	} finally {
		await client.close();
	}

	if ((await stat(walPath)).size !== 0) {
		throw new Error(
			"Writable candidate validation produced unexpected WAL data",
		);
	}

	await rm(`${databasePath}-shm`, { force: true });
}

async function assertRegularDirectory(path: string, label: string) {
	const stats = await lstat(path);

	if (!stats.isDirectory() || stats.isSymbolicLink()) {
		throw new Error(`${label} must be a regular directory`);
	}
}

async function requireMissingPath(path: string) {
	try {
		await lstat(path);
	} catch (error) {
		if (isMissingPathError(error)) return;
		throw error;
	}

	throw new Error(`Refusing to overwrite rebuild output ${path}`);
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

function formatTimestamp(date: Date) {
	return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

function relativeProjectPath(path: string) {
	return path.startsWith(PROJECT_ROOT)
		? path.slice(PROJECT_ROOT.length + 1)
		: basename(path);
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
		console.error(
			error instanceof Error ? error.message : "Unknown rebuild error",
		);
		process.exitCode = 1;
	});
}
