import { randomUUID } from "node:crypto";
import {
	copyFile,
	lstat,
	mkdir,
	mkdtemp,
	open,
	readdir,
	readFile,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import {
	basename,
	dirname,
	isAbsolute,
	relative,
	resolve,
	sep,
} from "node:path";

import { connect, type Database } from "@tursodatabase/database";

import {
	type PublicationData,
	parsePublicationData,
	serializePublicationData,
} from "../src/lib/publication-data";
import { readPublicationDataFromDatabase } from "../src/server/db/publication-store";
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
const BACKUP_ROOT = resolve(DATA_ROOT, "backups");
const PUBLICATION_PATH = resolve(DATA_ROOT, "publication", "locations.json");
const TARGET_PATH = resolve(DATA_ROOT, "tarkov-season-docs.sqlite");
const LOCK_PATH = resolve(DATA_ROOT, ".database-replacement.lock");
const RECOVERY_PATH = resolve(DATA_ROOT, ".database-replacement-state.json");
const EXPECTED_CONFIRMATION = "data/tarkov-season-docs.sqlite";

async function main() {
	const [manifestArgument, flag, confirmation] = process.argv.slice(2);
	const checkOnly = flag === "--check" && confirmation === undefined;
	const confirmed =
		flag === "--confirm" && confirmation === EXPECTED_CONFIRMATION;

	if (!manifestArgument || (!checkOnly && !confirmed)) {
		throw new Error(
			`Usage: bun run db:replace -- <candidate-manifest> --check\n   or: bun run db:replace -- <candidate-manifest> --confirm ${EXPECTED_CONFIRMATION}`,
		);
	}

	const manifestPath = resolve(PROJECT_ROOT, manifestArgument);
	const lock = await acquireLock();

	try {
		const canonicalBytes = await readFile(PUBLICATION_PATH, "utf8");
		const publication = parsePublicationData(JSON.parse(canonicalBytes));

		if (serializePublicationData(publication) !== canonicalBytes) {
			throw new Error("Publication data is not canonical");
		}

		const candidate = await validateCandidate(
			manifestPath,
			publication,
			canonicalBytes,
		);
		const sourceClient = await connect(TARGET_PATH, {
			fileMustExist: true,
			readonly: true,
		});

		try {
			await assertLegacySourceMatches(sourceClient, publication);
		} finally {
			await sourceClient.close();
		}

		if (checkOnly) {
			console.info("Replacement preflight passed; no files were modified.");
			return;
		}

		const staged = await stageCandidate(candidate);

		try {
			const backupDirectory = await createReplacementBackup(candidate.sha256);
			console.info(`Verified source backup: ${projectPath(backupDirectory)}`);
			console.info(
				"Beginning offline replacement; automatic rollback is armed.",
			);
			await checkpointSourceDatabase();
			await assertCurrentSourceMatches(publication);
			await assertStagedCandidate(
				staged,
				candidate.sha256,
				candidate.publicationSha256,
			);
			const replacement = await installWithRollback(
				staged,
				publication,
				canonicalBytes,
				candidate.sha256,
			);

			console.info(`Replacement complete: ${EXPECTED_CONFIRMATION}`);
			console.info(`Installed SHA-256: ${replacement.sha256}`);
			console.info(`Previous database backup: ${projectPath(backupDirectory)}`);
			console.info(
				`Rollback database retained at: ${projectPath(replacement.rollbackPath)}`,
			);
		} finally {
			await rm(staged.path, { force: true });
			await rm(staged.walPath, { force: true });
		}
	} finally {
		await lock.close();

		if (!(await pathExists(RECOVERY_PATH))) {
			await rm(LOCK_PATH, { force: true });
		} else {
			console.error(
				`Recovery marker retained; database access remains locked: ${projectPath(RECOVERY_PATH)}`,
			);
		}
	}
}

async function validateCandidate(
	manifestPath: string,
	publication: PublicationData,
	canonicalBytes: string,
) {
	await assertPathInside(manifestPath, resolve(DATA_ROOT, "rebuild"));
	const manifest = parseCandidateManifest(
		JSON.parse(await readFile(manifestPath, "utf8")),
	);
	const candidatePath = resolve(dirname(manifestPath), manifest.candidate.file);
	const candidateWalPath = resolve(
		dirname(manifestPath),
		manifest.candidate.wal.file,
	);

	if (manifest.target !== EXPECTED_CONFIRMATION) {
		throw new Error("Candidate targets a different database");
	}

	if ((await hashFile(PUBLICATION_PATH)) !== manifest.publication.sha256) {
		throw new Error("Candidate publication hash is stale");
	}

	const candidateStats = await lstat(candidatePath);
	const candidateWalStats = await lstat(candidateWalPath);
	const candidateHash = await hashFile(candidatePath);

	if (
		!candidateStats.isFile() ||
		candidateStats.isSymbolicLink() ||
		!candidateWalStats.isFile() ||
		candidateWalStats.isSymbolicLink() ||
		candidateStats.size !== manifest.candidate.sizeBytes ||
		candidateHash !== manifest.candidate.sha256 ||
		candidateWalStats.size !== 0 ||
		candidateWalStats.size !== manifest.candidate.wal.sizeBytes ||
		(await hashFile(candidateWalPath)) !== manifest.candidate.wal.sha256
	) {
		throw new Error("Candidate database does not match its manifest");
	}

	const entries = await readdir(dirname(manifestPath));

	if (
		entries.length !== 3 ||
		!entries.includes("database.sqlite") ||
		!entries.includes("database.sqlite-wal") ||
		!entries.includes("manifest.json")
	) {
		throw new Error(
			"Candidate directory contains unexpected files or sidecars",
		);
	}

	await Promise.all([
		verifyPublicationAssets(publication, {
			projectRoot: PROJECT_ROOT,
			rejectOrphans: true,
			requireOriginals: true,
		}),
		verifyMapMasterAssets(PROJECT_ROOT),
	]);
	await assertNewDatabaseMatches(candidatePath, canonicalBytes);

	return {
		path: candidatePath,
		publicationSha256: manifest.publication.sha256,
		sha256: candidateHash,
		walPath: candidateWalPath,
	};
}

async function stageCandidate(candidate: {
	path: string;
	publicationSha256: string;
	sha256: string;
	walPath: string;
}) {
	const token = randomUUID();
	const stagedPath = resolve(DATA_ROOT, `.baseline-candidate-${token}.sqlite`);
	const stagedWalPath = `${stagedPath}-wal`;

	try {
		await copyFile(candidate.path, stagedPath);
		await copyFile(candidate.walPath, stagedWalPath);
		await syncFile(stagedPath);
		await syncFile(stagedWalPath);
		await syncDirectory(DATA_ROOT);
		await assertStagedCandidate(
			{ path: stagedPath, walPath: stagedWalPath },
			candidate.sha256,
			candidate.publicationSha256,
		);
		return { path: stagedPath, walPath: stagedWalPath };
	} catch (error) {
		await rm(stagedPath, { force: true });
		await rm(stagedWalPath, { force: true });
		throw error;
	}
}

async function assertStagedCandidate(
	staged: { path: string; walPath: string },
	expectedHash: string,
	expectedPublicationHash: string,
) {
	if (
		(await hashFile(staged.path)) !== expectedHash ||
		(await stat(staged.walPath)).size !== 0
	) {
		throw new Error("Staged candidate changed before replacement");
	}

	if ((await hashFile(PUBLICATION_PATH)) !== expectedPublicationHash) {
		throw new Error("Publication data changed during replacement");
	}
}

async function installWithRollback(
	staged: { path: string; walPath: string },
	publication: PublicationData,
	canonicalBytes: string,
	expectedHash: string,
) {
	const suffix = formatTimestamp(new Date());
	const rollbackPath = resolve(
		DATA_ROOT,
		`tarkov-season-docs.pre-baseline-${suffix}.sqlite`,
	);
	const rollbackWalPath = `${rollbackPath}-wal`;
	const recoveryPath = RECOVERY_PATH;
	let sourceMoved = false;

	await requireMissingPath(rollbackPath);
	await requireMissingPath(recoveryPath);
	await writeFile(
		recoveryPath,
		`${JSON.stringify(
			{
				candidate: basename(staged.path),
				formatVersion: 1,
				rollback: basename(rollbackPath),
				target: basename(TARGET_PATH),
			},
			null,
			"\t",
		)}\n`,
		{ encoding: "utf8", flag: "wx" },
	);
	await syncFile(recoveryPath);
	await syncDirectory(DATA_ROOT);

	try {
		await rename(TARGET_PATH, rollbackPath);
		sourceMoved = true;
		await writeFile(rollbackWalPath, new Uint8Array(), { flag: "wx" });
		await rename(staged.walPath, `${TARGET_PATH}-wal`);
		await rename(staged.path, TARGET_PATH);
		await syncDirectory(DATA_ROOT);

		const replacement = await validateReplacement(
			publication,
			canonicalBytes,
			expectedHash,
		);
		await assertReversibleWrite();
		await rm(recoveryPath);
		await syncDirectory(DATA_ROOT);
		return { ...replacement, rollbackPath };
	} catch (error) {
		if (sourceMoved) {
			await rm(TARGET_PATH, { force: true });
			await rm(`${TARGET_PATH}-wal`, { force: true });
			await rm(`${TARGET_PATH}-shm`, { force: true });
			await rename(rollbackPath, TARGET_PATH);
			await rm(rollbackWalPath, { force: true });
			await writeFile(`${TARGET_PATH}-wal`, new Uint8Array(), { flag: "wx" });
			await syncFile(TARGET_PATH);
			await syncFile(`${TARGET_PATH}-wal`);
			await syncDirectory(DATA_ROOT);
			await assertCurrentSourceMatches(publication);
		}

		await rm(recoveryPath, { force: true });
		await syncDirectory(DATA_ROOT);
		throw new Error(
			`Database replacement failed and was rolled back: ${toErrorMessage(error)}`,
			{
				cause: error,
			},
		);
	}
}

async function createReplacementBackup(candidateHash: string) {
	await mkdir(BACKUP_ROOT, { recursive: true });
	const startedAt = new Date();
	const finalDirectory = resolve(
		BACKUP_ROOT,
		`before-baseline-${formatTimestamp(startedAt)}`,
	);
	await requireMissingPath(finalDirectory);
	const stagingDirectory = await mkdtemp(resolve(BACKUP_ROOT, ".replacement-"));
	const snapshotPath = resolve(stagingDirectory, "database.sqlite");
	const manifestPath = resolve(stagingDirectory, "manifest.json");
	let published = false;

	try {
		await createSnapshot(TARGET_PATH, snapshotPath);
		const snapshotClient = await connect(snapshotPath, {
			fileMustExist: true,
			readonly: true,
		});
		let counts: Record<string, number>;

		try {
			await assertLegacySourceMatches(
				snapshotClient,
				await readCanonicalData(),
			);
			await assertDatabaseIntegrity(snapshotClient);
			counts = await readTableCounts(snapshotClient);
		} finally {
			await snapshotClient.close();
		}

		const snapshotStats = await stat(snapshotPath);
		await writeFile(
			manifestPath,
			`${JSON.stringify(
				{
					candidateSha256: candidateHash,
					completedAt: new Date().toISOString(),
					counts,
					formatVersion: 1,
					snapshot: {
						file: "database.sqlite",
						sha256: await hashFile(snapshotPath),
						sizeBytes: snapshotStats.size,
					},
					startedAt: startedAt.toISOString(),
				},
				null,
				"\t",
			)}\n`,
			{ encoding: "utf8", flag: "wx" },
		);
		await syncFile(snapshotPath);
		await syncFile(manifestPath);
		await syncDirectory(stagingDirectory);
		await rename(stagingDirectory, finalDirectory);
		await syncDirectory(BACKUP_ROOT);
		published = true;
		return finalDirectory;
	} finally {
		if (!published) {
			await rm(stagingDirectory, { force: true, recursive: true });
		}
	}
}

async function checkpointSourceDatabase() {
	const client = await connect(TARGET_PATH, {
		fileMustExist: true,
		timeout: 5_000,
	});

	try {
		const rows = await client.all("PRAGMA wal_checkpoint(TRUNCATE)");
		const row = rows[0];

		if (!row || readNumber(row, "busy") !== 0) {
			throw new Error("Source database is busy; stop every process and retry");
		}
	} finally {
		await client.close();
	}

	const walPath = `${TARGET_PATH}-wal`;

	try {
		if ((await stat(walPath)).size !== 0) {
			throw new Error("Source WAL was not fully checkpointed");
		}
	} catch (error) {
		if (!isMissingPathError(error)) throw error;
	}

	await rm(walPath, { force: true });
	await rm(`${TARGET_PATH}-shm`, { force: true });
}

async function assertCurrentSourceMatches(publication: PublicationData) {
	const client = await connect(TARGET_PATH, {
		fileMustExist: true,
		readonly: true,
	});

	try {
		await assertLegacySourceMatches(client, publication);
	} finally {
		await client.close();
	}
}

async function assertReversibleWrite() {
	const client = await connect(TARGET_PATH, { fileMustExist: true });
	const expectedRollback = new Error("replacement-write-probe");
	const probeId = `replacement-probe-${randomUUID()}`;
	const transaction = client.transactionAsync(async (database) => {
		await database.run(
			"INSERT INTO maps (id, name, is_active) VALUES (?, ?, 0)",
			probeId,
			probeId,
		);
		throw expectedRollback;
	});

	try {
		try {
			await transaction.immediate();
		} catch (error) {
			if (error !== expectedRollback) throw error;
		}

		if (await client.get("SELECT id FROM maps WHERE id = ?", probeId)) {
			throw new Error("Replacement write probe did not roll back");
		}

		const rows = await client.all("PRAGMA wal_checkpoint(TRUNCATE)");

		if (!rows[0] || readNumber(rows[0], "busy") !== 0) {
			throw new Error("Replacement write probe could not checkpoint its WAL");
		}
	} finally {
		await client.close();
	}
}

async function validateReplacement(
	publication: PublicationData,
	canonicalBytes: string,
	expectedHash: string,
) {
	const actualHash = await hashFile(TARGET_PATH);

	if (actualHash !== expectedHash) {
		throw new Error(
			"Installed database hash differs from the verified candidate",
		);
	}

	await assertNewDatabaseMatches(TARGET_PATH, canonicalBytes);
	const writableClient = await connect(TARGET_PATH, { fileMustExist: true });

	try {
		await writableClient.get("SELECT COUNT(*) AS count FROM locations");
	} finally {
		await writableClient.close();
	}
	await verifyPublicationAssets(publication, {
		projectRoot: PROJECT_ROOT,
		rejectOrphans: true,
		requireOriginals: true,
	});

	return { sha256: actualHash };
}

async function assertNewDatabaseMatches(path: string, canonicalBytes: string) {
	const client = await connect(path, { fileMustExist: true, readonly: true });

	try {
		await assertDatabaseIntegrity(client);
		const data = await readPublicationDataFromDatabase(client);

		if (serializePublicationData(data) !== canonicalBytes) {
			throw new Error(
				"Database content does not match canonical publication data",
			);
		}
	} finally {
		await client.close();
	}
}

async function assertLegacySourceMatches(
	client: Database,
	publication: PublicationData,
) {
	await assertDatabaseIntegrity(client);
	const locationRows = await client.all(`
		SELECT id, map_image_id AS mapImageId, name, description,
			x_basis_points AS xBasisPoints, y_basis_points AS yBasisPoints,
			is_active AS isActive
		FROM locations ORDER BY id
	`);
	const relationRows = await client.all(`
		SELECT location_id AS locationId, document_id AS documentId
		FROM location_documents ORDER BY location_id
	`);
	const screenshotRows = await client.all(`
		SELECT id, location_id AS locationId, path, preview_path AS previewPath,
			alt_text AS altText, caption, width, height,
			preview_width AS previewWidth, preview_height AS previewHeight,
			content_hash AS sourceHash, sort_order AS sortOrder, is_active AS isActive
		FROM screenshots ORDER BY id
	`);
	const expectedLocations = new Map(
		publication.locations.map((row) => [row.id, row]),
	);
	const expectedScreenshots = new Map(
		publication.locations.flatMap((location) =>
			location.screenshots.map(
				(screenshot) =>
					[screenshot.id, { locationId: location.id, screenshot }] as const,
			),
		),
	);

	if (
		locationRows.length !== publication.locations.length ||
		relationRows.length !== publication.locations.length ||
		screenshotRows.length !== expectedScreenshots.size
	) {
		throw new Error(
			"Authoring database counts differ from canonical publication data",
		);
	}

	for (const row of locationRows) {
		const id = readString(row, "id");
		const expected = expectedLocations.get(id);

		if (
			!expected ||
			readString(row, "mapImageId") !== expected.mapImageId ||
			readString(row, "name") !== expected.name ||
			readNullableString(row, "description") !== expected.description ||
			readNumber(row, "xBasisPoints") !== expected.xBasisPoints ||
			readNumber(row, "yBasisPoints") !== expected.yBasisPoints ||
			Boolean(readNumber(row, "isActive")) !== expected.isActive
		) {
			throw new Error(`Authoring location ${id} differs from canonical data`);
		}
	}

	for (const row of relationRows) {
		const locationId = readString(row, "locationId");

		if (
			readString(row, "documentId") !==
			expectedLocations.get(locationId)?.documentId
		) {
			throw new Error(`Authoring document relation differs for ${locationId}`);
		}
	}

	for (const row of screenshotRows) {
		const id = readString(row, "id");
		const expected = expectedScreenshots.get(id);

		if (!expected || !legacyScreenshotMatches(row, expected)) {
			throw new Error(`Authoring screenshot ${id} differs from canonical data`);
		}
	}
}

function legacyScreenshotMatches(
	row: unknown,
	expected: {
		locationId: string;
		screenshot: PublicationData["locations"][number]["screenshots"][number];
	},
) {
	const screenshot = expected.screenshot;
	return (
		readString(row, "locationId") === expected.locationId &&
		readString(row, "path") === screenshot.full.path &&
		readString(row, "previewPath") === screenshot.preview.path &&
		readString(row, "altText") === screenshot.altText &&
		readNullableString(row, "caption") === screenshot.caption &&
		readNumber(row, "width") === screenshot.full.width &&
		readNumber(row, "height") === screenshot.full.height &&
		readNumber(row, "previewWidth") === screenshot.preview.width &&
		readNumber(row, "previewHeight") === screenshot.preview.height &&
		readString(row, "sourceHash") === screenshot.sourceSha256 &&
		readNumber(row, "sortOrder") === screenshot.sortOrder &&
		Boolean(readNumber(row, "isActive")) === screenshot.isActive
	);
}

async function assertDatabaseIntegrity(client: Database) {
	const integrityRows = await client.all("PRAGMA integrity_check");
	const messages = integrityRows.map((row) =>
		readString(row, "integrity_check"),
	);

	if (messages.length !== 1 || messages[0] !== "ok") {
		throw new Error(`Database integrity check failed: ${messages.join(", ")}`);
	}

	const relationshipErrors: string[] = [];
	await verifyKnownForeignKeys(client, relationshipErrors);

	if (relationshipErrors.length > 0) {
		throw new Error(
			`Database relationships are invalid: ${relationshipErrors.join(", ")}`,
		);
	}
}

async function readTableCounts(client: Database) {
	const counts: Record<string, number> = {};

	for (const table of [
		"maps",
		"map_images",
		"documents",
		"document_maps",
		"locations",
		"location_documents",
		"screenshots",
	]) {
		counts[table] = readNumber(
			await client.get(`SELECT COUNT(*) AS count FROM "${table}"`),
			"count",
		);
	}

	return counts;
}

async function readCanonicalData() {
	return parsePublicationData(
		JSON.parse(await readFile(PUBLICATION_PATH, "utf8")),
	);
}

async function acquireLock() {
	try {
		const handle = await open(LOCK_PATH, "wx");
		await handle.writeFile(`${process.pid}\n`, "utf8");
		await handle.sync();
		const usageLocks = (await readdir(DATA_ROOT)).filter(
			(entry) =>
				entry.startsWith(".database-usage-") && entry.endsWith(".lock"),
		);
		const activeUsageLocks: string[] = [];

		for (const usageLock of usageLocks) {
			const usagePath = resolve(DATA_ROOT, usageLock);
			const ownerPid = Number.parseInt(
				(await readFile(usagePath, "utf8")).trim(),
				10,
			);

			if (Number.isSafeInteger(ownerPid) && isProcessAlive(ownerPid)) {
				activeUsageLocks.push(usageLock);
			} else {
				await rm(usagePath, { force: true });
			}
		}

		if (activeUsageLocks.length > 0) {
			await handle.close();
			await rm(LOCK_PATH, { force: true });
			throw new Error(
				`Database is still in use (${activeUsageLocks.length} active usage lock(s))`,
			);
		}

		return handle;
	} catch (error) {
		if (isAlreadyExistsError(error)) {
			throw new Error(`Database replacement lock already exists: ${LOCK_PATH}`);
		}

		throw error;
	}
}

async function syncFile(path: string) {
	const handle = await open(path, "r+");

	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function syncDirectory(path: string) {
	let handle: Awaited<ReturnType<typeof open>> | undefined;

	try {
		handle = await open(path, "r");
		await handle.sync();
	} catch (error) {
		if (!isUnsupportedDirectorySyncError(error)) throw error;
	} finally {
		await handle?.close();
	}
}

async function assertPathInside(path: string, root: string) {
	const resolvedPath = resolve(path);
	const resolvedRoot = resolve(root);
	const relativePath = relative(resolvedRoot, resolvedPath);

	if (
		relativePath.startsWith(`..${sep}`) ||
		relativePath === ".." ||
		isAbsolute(relativePath)
	) {
		throw new Error("Candidate manifest is outside data/rebuild");
	}

	const [rootStats, directoryStats, fileStats] = await Promise.all([
		lstat(resolvedRoot),
		lstat(dirname(resolvedPath)),
		lstat(resolvedPath),
	]);

	if (
		!rootStats.isDirectory() ||
		rootStats.isSymbolicLink() ||
		!directoryStats.isDirectory() ||
		directoryStats.isSymbolicLink() ||
		!fileStats.isFile() ||
		fileStats.isSymbolicLink()
	) {
		throw new Error("Candidate manifest must be a regular file");
	}

	const [realRoot, realDirectory] = await Promise.all([
		realpath(resolvedRoot),
		realpath(dirname(resolvedPath)),
	]);

	if (!realDirectory.startsWith(`${realRoot}${sep}`)) {
		throw new Error("Candidate directory resolves outside data/rebuild");
	}
}

function parseCandidateManifest(input: unknown) {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("Candidate manifest is invalid");
	}

	const value = input as Record<string, unknown>;
	const candidate = value.candidate;
	const publication = value.publication;

	if (
		value.formatVersion !== 1 ||
		value.target !== EXPECTED_CONFIRMATION ||
		!candidate ||
		typeof candidate !== "object" ||
		Array.isArray(candidate) ||
		!publication ||
		typeof publication !== "object" ||
		Array.isArray(publication)
	) {
		throw new Error("Candidate manifest is invalid");
	}

	const candidateValue = candidate as Record<string, unknown>;
	const publicationValue = publication as Record<string, unknown>;

	if (
		candidateValue.file !== "database.sqlite" ||
		typeof candidateValue.sha256 !== "string" ||
		!/^[a-f0-9]{64}$/.test(candidateValue.sha256) ||
		typeof candidateValue.sizeBytes !== "number" ||
		!Number.isSafeInteger(candidateValue.sizeBytes) ||
		!candidateValue.wal ||
		typeof candidateValue.wal !== "object" ||
		Array.isArray(candidateValue.wal) ||
		typeof publicationValue.sha256 !== "string" ||
		!/^[a-f0-9]{64}$/.test(publicationValue.sha256)
	) {
		throw new Error("Candidate manifest hashes are invalid");
	}

	const walValue = candidateValue.wal as Record<string, unknown>;

	if (
		walValue.file !== "database.sqlite-wal" ||
		walValue.sizeBytes !== 0 ||
		typeof walValue.sha256 !== "string" ||
		!/^[a-f0-9]{64}$/.test(walValue.sha256)
	) {
		throw new Error("Candidate WAL manifest is invalid");
	}

	return {
		candidate: {
			file: candidateValue.file,
			sha256: candidateValue.sha256,
			sizeBytes: candidateValue.sizeBytes,
			wal: {
				file: walValue.file,
				sha256: walValue.sha256,
				sizeBytes: walValue.sizeBytes,
			},
		},
		publication: { sha256: publicationValue.sha256 },
		target: value.target,
	};
}

async function requireMissingPath(path: string) {
	try {
		await lstat(path);
	} catch (error) {
		if (isMissingPathError(error)) return;
		throw error;
	}

	throw new Error(`Refusing to overwrite ${path}`);
}

async function pathExists(path: string) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (isMissingPathError(error)) return false;
		throw error;
	}
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

function readValue(row: unknown, key: string) {
	if (!row || typeof row !== "object" || !(key in row)) {
		throw new TypeError(`Database row is missing ${key}`);
	}

	return (row as Record<string, unknown>)[key];
}

function formatTimestamp(date: Date) {
	return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

function projectPath(path: string) {
	return path.startsWith(PROJECT_ROOT)
		? path.slice(PROJECT_ROOT.length + 1)
		: basename(path);
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
	return isNodeError(error) && error.code === "ENOENT";
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
	return isNodeError(error) && error.code === "EEXIST";
}

function isUnsupportedDirectorySyncError(
	error: unknown,
): error is NodeJS.ErrnoException {
	return (
		isNodeError(error) &&
		["EINVAL", "EISDIR", "ENOTSUP", "EPERM"].includes(error.code ?? "")
	);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}

function isProcessAlive(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return isNodeError(error) && error.code === "EPERM";
	}
}

function toErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Unknown replacement error";
}

if (import.meta.main) {
	await main().catch((error) => {
		console.error(
			error instanceof Error ? error.message : "Unknown replacement error",
		);
		process.exitCode = 1;
	});
}
