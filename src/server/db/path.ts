import { isAbsolute, resolve } from "node:path";
import { getServerEnvironment } from "../env";

export function getDatabasePath() {
	const { appEnvironment, databasePath } = getServerEnvironment();
	const isProduction =
		appEnvironment === "production" || process.env.NODE_ENV === "production";

	if (isProduction && !isAbsolute(databasePath)) {
		throw new Error("DATABASE_PATH must be absolute in production");
	}

	return isAbsolute(databasePath)
		? databasePath
		: resolve(process.cwd(), databasePath);
}
