import { isAbsolute, resolve } from "node:path";

const DEVELOPMENT_DATABASE_PATH = "data/tarkov-season-docs.sqlite";

export function getDatabasePath() {
	const configuredPath = process.env.DATABASE_PATH?.trim();

	if (!configuredPath) {
		if (process.env.NODE_ENV === "production") {
			throw new Error("DATABASE_PATH is required in production");
		}

		return resolve(process.cwd(), DEVELOPMENT_DATABASE_PATH);
	}

	if (process.env.NODE_ENV === "production" && !isAbsolute(configuredPath)) {
		throw new Error("DATABASE_PATH must be absolute in production");
	}

	return isAbsolute(configuredPath)
		? configuredPath
		: resolve(process.cwd(), configuredPath);
}
