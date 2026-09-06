import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function getDatabasePath({
	projectRoot = process.cwd(),
	isContainer = existsSync("/etc/tarkov-farm-container"),
} = {}) {
	// Only the runner image installs this marker; local production builds stay local.
	return isContainer
		? "/hideout/tarkov.sqlite"
		: resolve(projectRoot, "hideout", "tarkov.sqlite");
}
