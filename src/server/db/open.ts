import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { connect } from "@tursodatabase/database";
import { drizzle } from "drizzle-orm/tursodatabase/database";

export async function openDatabase(
	databasePath: string,
	options: { create: boolean },
) {
	const databaseDirectory = dirname(databasePath);
	const replacementLock = resolve(
		databaseDirectory,
		".database-replacement.lock",
	);
	const recoveryMarker = resolve(
		databaseDirectory,
		".database-replacement-state.json",
	);

	if (existsSync(replacementLock) || existsSync(recoveryMarker)) {
		throw new Error("Database replacement is in progress");
	}

	if (options.create) {
		mkdirSync(databaseDirectory, { recursive: true });
	}

	const usageLockPath = resolve(
		databaseDirectory,
		`.database-usage-${process.pid}-${randomUUID()}.lock`,
	);
	const usageLock = await open(usageLockPath, "wx");
	await usageLock.writeFile(`${process.pid}\n`, "utf8");
	const cleanupUsageLock = () => {
		rmSync(usageLockPath, { force: true });
	};
	process.once("exit", cleanupUsageLock);

	if (existsSync(replacementLock) || existsSync(recoveryMarker)) {
		await usageLock.close();
		await rm(usageLockPath, { force: true });
		process.off("exit", cleanupUsageLock);
		throw new Error("Database replacement is in progress");
	}

	try {
		const client = await connect(databasePath, {
			fileMustExist: !options.create,
			timeout: 5_000,
		});
		const closeClient = client.close.bind(client);
		let closed = false;

		client.close = async () => {
			if (closed) return;
			closed = true;

			try {
				await closeClient();
			} finally {
				process.off("exit", cleanupUsageLock);
				await usageLock.close();
				await rm(usageLockPath, { force: true });
			}
		};

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
	} catch (error) {
		process.off("exit", cleanupUsageLock);
		await usageLock.close().catch(() => undefined);
		await rm(usageLockPath, { force: true });
		throw error;
	}
}
