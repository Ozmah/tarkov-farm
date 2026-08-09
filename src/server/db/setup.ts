import { lstat, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
	parsePublicationData,
	serializePublicationData,
} from "../../lib/publication-data";
import { migrateDatabase } from "./migrate";
import { openDatabase } from "./open";
import { getDatabasePath } from "./path";
import {
	importPublicationData,
	readPublicationDataFromDatabase,
} from "./publication-store";
import { seedCatalog } from "./seed";

const PROJECT_ROOT = resolve(process.cwd());
const PUBLICATION_PATH = resolve(
	PROJECT_ROOT,
	"data",
	"publication",
	"locations.json",
);
const MIGRATIONS_PATH = resolve(PROJECT_ROOT, "drizzle");

export async function setupDatabase(
	databasePath: string,
	options: { migrationsPath: string; publicationPath: string },
) {
	if (await databaseExists(databasePath)) {
		return { status: "existing" as const };
	}

	await mkdir(dirname(databasePath), { recursive: true });
	const setupLockPath = `${databasePath}.setup.lock`;
	const setupLock = await acquireSetupLock(setupLockPath);

	let database: Awaited<ReturnType<typeof openDatabase>> | undefined;
	let ownsDatabase = false;

	try {
		if (await databaseExists(databasePath)) {
			return { status: "existing" as const };
		}

		if (
			(await pathExists(`${databasePath}-wal`)) ||
			(await pathExists(`${databasePath}-shm`))
		) {
			throw new Error(
				"Database sidecars exist without their main database file",
			);
		}

		const source = await readFile(options.publicationPath, "utf8");
		const publication = parsePublicationData(JSON.parse(source));

		if (serializePublicationData(publication) !== source) {
			throw new Error("Publication manifest is not canonical");
		}

		ownsDatabase = true;
		database = await openDatabase(databasePath, { create: true });
		await migrateDatabase(database.db, options.migrationsPath);
		await seedCatalog(database.db);
		const counts = await importPublicationData(database.client, publication);
		const restored = serializePublicationData(
			await readPublicationDataFromDatabase(database.client),
		);

		if (restored !== source) {
			throw new Error(
				"Created database does not match the publication manifest",
			);
		}

		const integrity = await database.client.all("PRAGMA integrity_check");

		if (
			integrity.length !== 1 ||
			!("integrity_check" in integrity[0]) ||
			integrity[0].integrity_check !== "ok"
		) {
			throw new Error("Created database failed its integrity check");
		}

		await database.client.close();
		database = undefined;

		return { counts, status: "created" as const };
	} catch (error) {
		await database?.client.close().catch(() => undefined);

		if (ownsDatabase) {
			await Promise.all(
				[databasePath, `${databasePath}-wal`, `${databasePath}-shm`].map(
					(path) => rm(path, { force: true }),
				),
			);
		}

		throw error;
	} finally {
		await setupLock.close();
		await rm(setupLockPath, { force: true });
	}
}

async function acquireSetupLock(path: string) {
	try {
		return await open(path, "wx");
	} catch (error) {
		if (isNodeError(error) && error.code === "EEXIST") {
			throw new Error("Database setup is already running");
		}

		throw error;
	}
}

async function databaseExists(path: string) {
	try {
		const stats = await lstat(path);

		if (!stats.isFile() || stats.isSymbolicLink()) {
			throw new Error("Configured database path is not a regular file");
		}

		return true;
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return false;
		throw error;
	}
}

async function pathExists(path: string) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return false;
		throw error;
	}
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}

if (import.meta.main) {
	const result = await setupDatabase(getDatabasePath(), {
		migrationsPath: MIGRATIONS_PATH,
		publicationPath: PUBLICATION_PATH,
	});

	if (result.status === "existing") {
		console.info("Database already exists; leaving it untouched.");
	} else {
		console.info(
			`Created database with ${result.counts.locations} locations and ${result.counts.screenshots} screenshots.`,
		);
	}
}
