import "@tanstack/react-start/server-only";

import type { Database } from "@tursodatabase/database";
import type { drizzle } from "drizzle-orm/tursodatabase/database";

import { openDatabase } from "./open";
import { getDatabasePath } from "./path";
import { createSerializedExecutor } from "./serialized-executor";

type DatabaseState = {
	client: Database;
	db: ReturnType<typeof drizzle>;
};

type DatabaseTransaction = Parameters<
	Parameters<DatabaseState["db"]["transaction"]>[0]
>[0];

const globalDatabase = globalThis as typeof globalThis & {
	__tarkovDatabase?: Promise<DatabaseState>;
	__tarkovRunTransaction?: ReturnType<typeof createSerializedExecutor>;
};

globalDatabase.__tarkovRunTransaction ??= createSerializedExecutor();

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

export async function runDatabaseTransaction<Result>(
	operation: (transaction: DatabaseTransaction) => Promise<Result>,
) {
	return (
		globalDatabase.__tarkovRunTransaction?.(async () => {
			const { db } = await getDatabase();
			return db.transaction(operation);
		}) ?? Promise.reject(new Error("Database transaction queue is unavailable"))
	);
}

async function initializeDatabase() {
	const databasePath = getDatabasePath();
	return openDatabase(databasePath, { create: false });
}
