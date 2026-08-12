import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { connect } from "@tursodatabase/database";

import { serializePublicationData } from "../src/lib/publication-data";
import { serializePublicationUpdatesData } from "../src/lib/publication-updates";
import { getDatabasePath } from "../src/server/db/path";
import {
	writePublicationManifest,
	writePublicationUpdatesManifest,
} from "../src/server/db/publication-manifest";
import {
	assertPublicationReferences,
	readPublicationDataFromDatabase,
} from "../src/server/db/publication-store";
import { readPublicationUpdatesFromDatabase } from "../src/server/db/publication-updates-store";
import {
	verifyMapMasterAssets,
	verifyPublicationAssets,
} from "./lib/publication-assets";

const projectRoot = resolve(process.cwd());
const outputDirectory = resolve(projectRoot, "data", "publication");
const locationsOutputPath = resolve(outputDirectory, "locations.json");
const updatesOutputPath = resolve(outputDirectory, "updates.json");
const client = await connect(getDatabasePath(), {
	fileMustExist: true,
	readonly: true,
	timeout: 5_000,
});

try {
	const [data, updatesData] = await Promise.all([
		readPublicationDataFromDatabase(client),
		readPublicationUpdatesFromDatabase(client),
	]);
	await assertPublicationReferences(client, data);
	await Promise.all([
		verifyPublicationAssets(data, {
			projectRoot,
			rejectOrphans: true,
		}),
		verifyMapMasterAssets(projectRoot),
	]);
	await Promise.all([
		writePublicationManifest(data, locationsOutputPath),
		writePublicationUpdatesManifest(updatesData, updatesOutputPath),
	]);
	const [locationsSource, updatesSource] = await Promise.all([
		readFile(locationsOutputPath, "utf8"),
		readFile(updatesOutputPath, "utf8"),
	]);

	if (
		locationsSource !== serializePublicationData(data) ||
		updatesSource !== serializePublicationUpdatesData(updatesData)
	) {
		throw new Error("Exported publication manifests failed verification");
	}

	const screenshotCount = data.locations.reduce(
		(count, location) => count + location.screenshots.length,
		0,
	);
	console.info(
		`Updated publication manifests with ${data.locations.length} locations, ${screenshotCount} screenshots, and ${updatesData.updates.length} updates.`,
	);
} finally {
	await client.close();
}
