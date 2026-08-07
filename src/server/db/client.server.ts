import "@tanstack/react-start/server-only";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { connect, type Database } from "@tursodatabase/database";
import { drizzle } from "drizzle-orm/tursodatabase/database";

import { getDatabasePath } from "./path";

type DatabaseState = {
	client: Database;
	db: ReturnType<typeof drizzle>;
};

const globalDatabase = globalThis as typeof globalThis & {
	__tarkovDatabase?: Promise<DatabaseState>;
};

export function getDatabase() {
	if (globalDatabase.__tarkovDatabase) {
		return globalDatabase.__tarkovDatabase;
	}

	const initialization = initializeDatabase();
	globalDatabase.__tarkovDatabase = initialization;

	void initialization.catch(() => {
		if (globalDatabase.__tarkovDatabase === initialization) {
			globalDatabase.__tarkovDatabase = undefined;
		}
	});

	return initialization;
}

async function initializeDatabase() {
	const databasePath = getDatabasePath();
	mkdirSync(dirname(databasePath), { recursive: true });

	const client = await connect(databasePath);

	try {
		await client.exec(`
			PRAGMA foreign_keys = ON;
			PRAGMA synchronous = NORMAL;
			PRAGMA busy_timeout = 5000;
		`);

		return {
			client,
			db: drizzle({ client }),
		};
	} catch (error) {
		client.close();
		throw error;
	}
}
