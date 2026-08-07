import { migrate } from "drizzle-orm/tursodatabase/migrator";

import { getDatabase } from "./client.server";

const { client, db } = await getDatabase();

try {
	const result = await migrate(db, { migrationsFolder: "./drizzle" });

	if (result && "error" in result) {
		throw result.error;
	}

	await client.exec("PRAGMA optimize;");

	console.info("Database migrations applied");
} finally {
	client.close();
}
