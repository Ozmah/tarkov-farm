import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parsePublicationData } from "../src/lib/publication-data";
import {
	verifyDocumentAssets,
	verifyKeyAssets,
	verifyMapMasterAssets,
	verifyPublicationAssets,
} from "./lib/publication-assets";

const projectRoot = resolve(process.cwd());
const publicationPath = resolve(
	projectRoot,
	"data",
	"publication",
	"locations.json",
);
const publication = parsePublicationData(
	JSON.parse(await readFile(publicationPath, "utf8")),
);
const [screenshotAssets, mapAssets, keyAssets, documentAssets] =
	await Promise.all([
		verifyPublicationAssets(publication, {
			projectRoot,
			rejectOrphans: true,
		}),
		verifyMapMasterAssets(projectRoot),
		verifyKeyAssets(projectRoot),
		verifyDocumentAssets(projectRoot),
	]);
const screenshotCount = publication.locations.reduce(
	(count, location) => count + location.screenshots.length,
	0,
);

console.info(
	`Validated ${publication.locations.length} locations, ${screenshotCount} screenshots, ${screenshotAssets.referencedFiles} screenshot assets, ${mapAssets.mapFiles} map masters, ${mapAssets.responsiveMapFiles} responsive map variants, ${keyAssets.keyFiles} key images, and ${documentAssets.documentFiles} document images.`,
);
