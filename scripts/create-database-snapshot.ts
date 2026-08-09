import { createHash } from "node:crypto";
import { createReadStream, type Stats } from "node:fs";
import {
	lstat,
	mkdir,
	mkdtemp,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

import { connect, type Database } from "@tursodatabase/database";

import { getDatabasePath } from "../src/server/db/path";

const PROJECT_ROOT = resolve(process.cwd());
const PUBLIC_ROOT = resolve(PROJECT_ROOT, "public");
const BACKUP_ROOT = resolve(PROJECT_ROOT, "data", "backups");
const TABLES = [
	"maps",
	"map_images",
	"documents",
	"document_maps",
	"locations",
	"location_documents",
	"screenshots",
] as const;
const FOREIGN_KEY_CHECKS = [
	{
		name: "map_images.map_id -> maps.id",
		sql: `
			SELECT COUNT(*) AS count
			FROM map_images AS child
			LEFT JOIN maps AS parent ON parent.id = child.map_id
			WHERE parent.id IS NULL
		`,
	},
	{
		name: "document_maps.document_id -> documents.id",
		sql: `
			SELECT COUNT(*) AS count
			FROM document_maps AS child
			LEFT JOIN documents AS parent ON parent.id = child.document_id
			WHERE parent.id IS NULL
		`,
	},
	{
		name: "document_maps.map_id -> maps.id",
		sql: `
			SELECT COUNT(*) AS count
			FROM document_maps AS child
			LEFT JOIN maps AS parent ON parent.id = child.map_id
			WHERE parent.id IS NULL
		`,
	},
	{
		name: "locations.map_image_id -> map_images.id",
		sql: `
			SELECT COUNT(*) AS count
			FROM locations AS child
			LEFT JOIN map_images AS parent ON parent.id = child.map_image_id
			WHERE parent.id IS NULL
		`,
	},
	{
		name: "location_documents.location_id -> locations.id",
		sql: `
			SELECT COUNT(*) AS count
			FROM location_documents AS child
			LEFT JOIN locations AS parent ON parent.id = child.location_id
			WHERE parent.id IS NULL
		`,
	},
	{
		name: "location_documents.document_id -> documents.id",
		sql: `
			SELECT COUNT(*) AS count
			FROM location_documents AS child
			LEFT JOIN documents AS parent ON parent.id = child.document_id
			WHERE parent.id IS NULL
		`,
	},
	{
		name: "screenshots.location_id -> locations.id",
		sql: `
			SELECT COUNT(*) AS count
			FROM screenshots AS child
			LEFT JOIN locations AS parent ON parent.id = child.location_id
			WHERE parent.id IS NULL
		`,
	},
] as const;

type MigrationRecord = {
	appliedAt: string | null;
	createdAt: number | null;
	hash: string;
	id: number;
	name: string | null;
};

type SnapshotVerification = {
	assets: {
		mapFiles: number;
		referencedFiles: string[];
		screenshotFiles: number;
	};
	errors: string[];
	foreignKeyViolations: number;
	integrityCheck: string[];
	migrations: MigrationRecord[];
	tableCounts: Record<(typeof TABLES)[number], number>;
	valid: boolean;
};

type SnapshotManifest = {
	completedAt: string;
	formatVersion: 1;
	snapshot: {
		file: string;
		sha256: string;
		sizeBytes: number;
	};
	source: {
		file: string;
	};
	startedAt: string;
	verification: SnapshotVerification;
};

async function main() {
	const sourcePath = getDatabasePath();
	await requireExistingFile(sourcePath, "Source database");
	await mkdir(BACKUP_ROOT, { recursive: true });

	const startedAt = new Date();
	const stem = `tarkov-season-docs-${formatTimestamp(startedAt)}`;
	const finalDirectory = resolve(BACKUP_ROOT, stem);
	await requireMissingPath(finalDirectory);

	const stagingDirectory = await mkdtemp(resolve(BACKUP_ROOT, ".snapshot-"));
	const snapshotPath = resolve(stagingDirectory, "database.sqlite");
	const manifestPath = resolve(stagingDirectory, "manifest.json");
	let published = false;

	try {
		console.info(
			`Creating a consistent snapshot from ${displayPath(sourcePath)}...`,
		);

		try {
			await createSnapshot(sourcePath, snapshotPath);
		} catch (error) {
			throw new Error(
				`Could not create the snapshot. Stop the development server and editor before retrying. Driver error: ${toErrorMessage(error)}`,
				{ cause: error },
			);
		}

		let verification: SnapshotVerification;

		try {
			verification = await verifySnapshot(snapshotPath);
		} catch (error) {
			verification = createFailedVerification(toErrorMessage(error));
		}

		const snapshotStats = await stat(snapshotPath);
		const manifest: SnapshotManifest = {
			completedAt: new Date().toISOString(),
			formatVersion: 1,
			snapshot: {
				file: basename(snapshotPath),
				sha256: await hashFile(snapshotPath),
				sizeBytes: snapshotStats.size,
			},
			source: {
				file: displayPath(sourcePath),
			},
			startedAt: startedAt.toISOString(),
			verification,
		};

		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx",
		});
		await rename(stagingDirectory, finalDirectory);
		published = true;

		const finalSnapshotPath = resolve(finalDirectory, "database.sqlite");
		const finalManifestPath = resolve(finalDirectory, "manifest.json");
		console.info(`Snapshot: ${displayPath(finalSnapshotPath)}`);
		console.info(`Manifest: ${displayPath(finalManifestPath)}`);
		console.info(`SHA-256: ${manifest.snapshot.sha256}`);
		console.info(
			`Preserved ${verification.tableCounts.locations} locations and ${verification.tableCounts.screenshots} screenshot records.`,
		);

		if (!verification.valid) {
			throw new Error(
				`Snapshot created, but verification failed:\n${verification.errors.map((error) => `- ${error}`).join("\n")}`,
			);
		}

		console.info(
			"Snapshot integrity, known relationships, and referenced file existence verified.",
		);
		console.info(
			"Copy this backup directory to another device before changing migrations.",
		);
	} finally {
		if (!published) {
			await rm(stagingDirectory, { force: true, recursive: true });
		}
	}
}

export async function createSnapshot(sourcePath: string, snapshotPath: string) {
	const database = await connect(sourcePath, {
		defaultQueryTimeout: 30_000,
		experimental: ["vacuum"],
		fileMustExist: true,
		timeout: 5_000,
	});

	try {
		await database.exec(`
			PRAGMA foreign_keys = ON;
			PRAGMA busy_timeout = 5000;
		`);
		await database.exec(`VACUUM INTO ${toSqlString(snapshotPath)}`);
	} finally {
		await database.close();
	}
}

async function verifySnapshot(
	snapshotPath: string,
): Promise<SnapshotVerification> {
	const database = await connect(snapshotPath, {
		defaultQueryTimeout: 30_000,
		fileMustExist: true,
		readonly: true,
		timeout: 5_000,
	});

	try {
		await database.exec("PRAGMA foreign_keys = ON;");

		const errors: string[] = [];
		const integrityCheck = (await database.all("PRAGMA integrity_check")).map(
			(row) => readString(row, "integrity_check"),
		);

		if (integrityCheck.length !== 1 || integrityCheck[0] !== "ok") {
			errors.push(`Integrity check returned: ${integrityCheck.join(", ")}`);
		}

		const tableCounts = createEmptyTableCounts();

		for (const table of TABLES) {
			const row = await database.get(
				`SELECT COUNT(*) AS count FROM "${table}"`,
			);
			tableCounts[table] = readNumber(row, "count");
		}

		const migrations = await readMigrations(database);
		const foreignKeyViolations = await verifyKnownForeignKeys(database, errors);
		const assets = await verifyReferencedAssets(database, errors);

		return {
			assets,
			errors,
			foreignKeyViolations,
			integrityCheck,
			migrations,
			tableCounts,
			valid: errors.length === 0,
		};
	} finally {
		await database.close();
	}
}

export async function verifyKnownForeignKeys(
	database: Database,
	errors: string[],
) {
	let totalViolations = 0;

	for (const check of FOREIGN_KEY_CHECKS) {
		const row = await database.get(check.sql);
		const violations = readNumber(row, "count");
		totalViolations += violations;

		if (violations > 0) {
			errors.push(`${check.name} has ${violations} orphaned row(s)`);
		}
	}

	return totalViolations;
}

async function readMigrations(database: Database): Promise<MigrationRecord[]> {
	const rows = await database.all(`
		SELECT
			id,
			hash,
			created_at AS createdAt,
			name,
			applied_at AS appliedAt
		FROM __drizzle_migrations
		ORDER BY id
	`);

	return rows.map((row) => ({
		appliedAt: readNullableString(row, "appliedAt"),
		createdAt: readNullableNumber(row, "createdAt"),
		hash: readString(row, "hash"),
		id: readNumber(row, "id"),
		name: readNullableString(row, "name"),
	}));
}

async function verifyReferencedAssets(database: Database, errors: string[]) {
	const mapImageRows = await database.all(`
		SELECT id, path, content_hash AS contentHash
		FROM map_images
		ORDER BY id
	`);
	const screenshotRows = await database.all(`
		SELECT id, path, preview_path AS previewPath,
			full_hash AS fullHash, preview_hash AS previewHash
		FROM screenshots
		ORDER BY id
	`);
	const referencedFiles = new Set<string>();

	for (const row of mapImageRows) {
		await verifyPublicFile(
			readString(row, "path"),
			readString(row, "contentHash"),
			`Map image ${readString(row, "id")}`,
			referencedFiles,
			errors,
		);
	}

	for (const row of screenshotRows) {
		const screenshotId = readString(row, "id");
		await verifyPublicFile(
			readString(row, "path"),
			readString(row, "fullHash"),
			`Screenshot ${screenshotId}`,
			referencedFiles,
			errors,
		);

		await verifyPublicFile(
			readString(row, "previewPath"),
			readString(row, "previewHash"),
			`Screenshot preview ${screenshotId}`,
			referencedFiles,
			errors,
		);
	}

	return {
		mapFiles: mapImageRows.length,
		referencedFiles: [...referencedFiles].sort(),
		screenshotFiles: screenshotRows.length * 2,
	};
}

async function verifyPublicFile(
	publicPath: string,
	expectedHash: string,
	label: string,
	referencedFiles: Set<string>,
	errors: string[],
) {
	if (!publicPath.startsWith("/") || publicPath.includes("\\")) {
		errors.push(`${label} has an invalid public path: ${publicPath}`);
		return;
	}

	const absolutePath = resolve(PUBLIC_ROOT, publicPath.replace(/^\/+/, ""));

	if (!absolutePath.startsWith(`${PUBLIC_ROOT}${sep}`)) {
		errors.push(`${label} points outside the public directory: ${publicPath}`);
		return;
	}

	try {
		const fileStats = await stat(absolutePath);

		if (!fileStats.isFile()) {
			errors.push(`${label} does not reference a file: ${publicPath}`);
			return;
		}
	} catch (error) {
		errors.push(
			`${label} could not be read at ${publicPath}: ${toErrorMessage(error)}`,
		);
		return;
	}

	if ((await hashFile(absolutePath)) !== expectedHash) {
		errors.push(`${label} hash does not match ${publicPath}`);
		return;
	}

	referencedFiles.add(publicPath);
}

async function hashFile(path: string) {
	const hash = createHash("sha256");

	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}

	return hash.digest("hex");
}

async function requireExistingFile(path: string, label: string) {
	let fileStats: Stats;

	try {
		fileStats = await stat(path);
	} catch (error) {
		if (!isMissingPathError(error)) throw error;
		throw new Error(`${label} does not exist: ${displayPath(path)}`);
	}

	if (!fileStats.isFile()) {
		throw new Error(`${label} is not a file: ${displayPath(path)}`);
	}
}

async function requireMissingPath(path: string) {
	try {
		await lstat(path);
	} catch (error) {
		if (!isMissingPathError(error)) throw error;
		return;
	}

	throw new Error(
		`Refusing to overwrite existing backup: ${displayPath(path)}`,
	);
}

function createFailedVerification(error: string): SnapshotVerification {
	return {
		assets: { mapFiles: 0, referencedFiles: [], screenshotFiles: 0 },
		errors: [error],
		foreignKeyViolations: 0,
		integrityCheck: [],
		migrations: [],
		tableCounts: createEmptyTableCounts(),
		valid: false,
	};
}

function createEmptyTableCounts() {
	return Object.fromEntries(TABLES.map((table) => [table, 0])) as Record<
		(typeof TABLES)[number],
		number
	>;
}

function readString(row: unknown, key: string) {
	const value = readValue(row, key);

	if (typeof value !== "string") {
		throw new TypeError(`Expected ${key} to be a string`);
	}

	return value;
}

function readNullableString(row: unknown, key: string) {
	const value = readValue(row, key);

	if (value === null) return null;
	if (typeof value !== "string") {
		throw new TypeError(`Expected ${key} to be a string or null`);
	}

	return value;
}

function readNumber(row: unknown, key: string) {
	const value = readValue(row, key);

	if (typeof value !== "number" || !Number.isSafeInteger(value)) {
		throw new TypeError(`Expected ${key} to be a safe integer`);
	}

	return value;
}

function readNullableNumber(row: unknown, key: string) {
	const value = readValue(row, key);

	if (value === null) return null;
	if (typeof value !== "number" || !Number.isSafeInteger(value)) {
		throw new TypeError(`Expected ${key} to be a safe integer or null`);
	}

	return value;
}

function readValue(row: unknown, key: string) {
	if (!row || typeof row !== "object" || !(key in row)) {
		throw new TypeError(`Database row is missing ${key}`);
	}

	return (row as Record<string, unknown>)[key];
}

function formatTimestamp(date: Date) {
	return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

function toSqlString(value: string) {
	return `'${value.replaceAll("'", "''")}'`;
}

function displayPath(path: string) {
	const relativePath = relative(PROJECT_ROOT, path);

	if (!relativePath.startsWith("..") && !isAbsolute(relativePath)) {
		return relativePath.split(sep).join("/");
	}

	return basename(path);
}

function toErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Unknown snapshot error";
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
