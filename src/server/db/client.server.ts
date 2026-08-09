import "@tanstack/react-start/server-only";

import type { Database } from "@tursodatabase/database";
import type { drizzle } from "drizzle-orm/tursodatabase/database";

import { openDatabase } from "./open";
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
	return openDatabase(databasePath, { create: true });
}
