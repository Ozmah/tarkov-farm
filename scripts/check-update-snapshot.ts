import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
	type PublicationUpdatesData,
	parsePublicationUpdatesData,
} from "../src/lib/publication-updates";
import {
	compareReleaseSnapshots,
	serializeReleaseSnapshot,
} from "../src/lib/release-context";
import { openDatabase } from "../src/server/db/open";
import { writePublicationUpdatesManifest } from "../src/server/db/publication-manifest";
import { readCurrentReleaseSnapshot } from "../src/server/db/release-snapshot";
import { setupDatabase } from "../src/server/db/setup";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const PUBLICATION_PATH = resolve(
	PROJECT_ROOT,
	"data",
	"publication",
	"locations.json",
);
const UPDATES_PUBLICATION_PATH = resolve(
	PROJECT_ROOT,
	"data",
	"publication",
	"updates.json",
);
const MIGRATIONS_PATH = resolve(PROJECT_ROOT, "drizzle");
const writeSnapshot = parseArguments(Bun.argv.slice(2));
const temporaryDirectory = await mkdtemp(
	join(tmpdir(), "tarkov-update-snapshot-"),
);
const temporaryDatabasePath = join(temporaryDirectory, "snapshot.sqlite");

try {
	await setupDatabase(temporaryDatabasePath, {
		migrationsPath: MIGRATIONS_PATH,
		publicationPath: PUBLICATION_PATH,
		updatesPublicationPath: UPDATES_PUBLICATION_PATH,
	});

	const database = await openDatabase(temporaryDatabasePath, { create: false });
	const currentSnapshot = await database.db
		.transaction((transaction) => readCurrentReleaseSnapshot(transaction))
		.finally(() => database.client.close());
	const source = await readFile(UPDATES_PUBLICATION_PATH, "utf8");
	const updates = parsePublicationUpdatesData(JSON.parse(source));
	const latestUpdate = updates.updates[0];

	if (!latestUpdate) {
		throw new Error(
			"Cannot verify a release without a published update snapshot",
		);
	}

	if (
		serializeReleaseSnapshot(latestUpdate.snapshot) ===
		serializeReleaseSnapshot(currentSnapshot)
	) {
		console.info(
			`Latest update snapshot matches ${currentSnapshot.locations.length} published locations.`,
		);
	} else if (writeSnapshot) {
		const synchronized: PublicationUpdatesData = {
			...updates,
			updates: updates.updates.map((update) =>
				update.id === latestUpdate.id
					? { ...update, snapshot: currentSnapshot }
					: update,
			),
		};

		await writePublicationUpdatesManifest(
			synchronized,
			UPDATES_PUBLICATION_PATH,
		);
		console.info(
			`Synchronized update ${latestUpdate.id} with ${currentSnapshot.locations.length} published locations.`,
		);
	} else {
		const context = compareReleaseSnapshots(
			latestUpdate.snapshot,
			currentSnapshot,
			"latest-update",
		);
		const changedLocations =
			context.deltas.locationsAdded +
			context.deltas.locationsModified +
			context.deltas.locationsRemoved;

		throw new Error(
			`Latest update snapshot is stale: ${changedLocations} changed locations (${context.deltas.locationsAdded} added, ${context.deltas.locationsModified} modified, ${context.deltas.locationsRemoved} removed). Synchronize it only after confirming the publication manifests match production.`,
		);
	}
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}

function parseArguments(args: string[]) {
	if (args.length === 0) return false;
	if (args.length === 1 && args[0] === "--write") return true;

	throw new Error(`Unsupported arguments: ${args.join(" ")}`);
}
