import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { connect } from "@tursodatabase/database";
import { drizzle } from "drizzle-orm/tursodatabase/database";

export async function openDatabase(
	databasePath: string,
	options: { create: boolean },
) {
	if (options.create) {
		mkdirSync(dirname(databasePath), { recursive: true });
	}

	const client = await connect(databasePath, {
		fileMustExist: !options.create,
		timeout: 5_000,
	});

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
		await client.close();
		throw error;
	}
}
