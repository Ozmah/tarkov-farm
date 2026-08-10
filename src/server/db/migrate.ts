import { migrate } from "drizzle-orm/tursodatabase/migrator";

import { getDatabase } from "./client.server";

type MigrationDatabase = Awaited<ReturnType<typeof getDatabase>>["db"];

export async function migrateDatabase(
	db: MigrationDatabase,
	migrationsFolder = "./drizzle",
) {
	const result = await migrate(db, { migrationsFolder });

	if (result && "error" in result) {
		throw result.error;
	}
}

if (import.meta.main) {
	const { client, db } = await getDatabase();

	try {
		await migrateDatabase(db);
		await client.exec("PRAGMA optimize;");

		console.info("Database migrations applied");
	} finally {
		await client.close();
	}
}
