import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { connect } from "@tursodatabase/database";

import { getDatabasePath } from "../src/server/db/path";
import { writePublicationManifest } from "../src/server/db/publication-manifest";
import {
	assertPublicationReferences,
	readPublicationDataFromDatabase,
} from "../src/server/db/publication-store";
import {
	verifyMapMasterAssets,
	verifyPublicationAssets,
} from "./lib/publication-assets";

const projectRoot = resolve(process.cwd());
const outputDirectory = resolve(projectRoot, "data", "publication");
const outputPath = resolve(outputDirectory, "locations.json");
const client = await connect(getDatabasePath(), {
	fileMustExist: true,
	readonly: true,
	timeout: 5_000,
});

try {
	const data = await readPublicationDataFromDatabase(client);
	await assertPublicationReferences(client, data);
	await Promise.all([
		verifyPublicationAssets(data, {
			projectRoot,
			rejectOrphans: true,
		}),
		verifyMapMasterAssets(projectRoot),
	]);
	await writePublicationManifest(data, outputPath);

	const screenshotCount = data.locations.reduce(
		(count, location) => count + location.screenshots.length,
		0,
	);
	console.info(
		`Updated publication manifest with ${data.locations.length} locations and ${screenshotCount} screenshots.`,
	);
} finally {
	await client.close();
}

// Ensure accidental partial writes cannot leave unreadable JSON behind.
JSON.parse(await readFile(outputPath, "utf8"));
