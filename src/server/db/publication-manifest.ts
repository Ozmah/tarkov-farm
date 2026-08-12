import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
	type PublicationData,
	serializePublicationData,
} from "../../lib/publication-data";
import {
	type PublicationUpdatesData,
	serializePublicationUpdatesData,
} from "../../lib/publication-updates";

export async function writePublicationManifest(
	data: PublicationData,
	outputPath: string,
) {
	return writeAtomicManifest(serializePublicationData(data), outputPath);
}

export async function writePublicationUpdatesManifest(
	data: PublicationUpdatesData,
	outputPath: string,
) {
	return writeAtomicManifest(serializePublicationUpdatesData(data), outputPath);
}

async function writeAtomicManifest(serialized: string, outputPath: string) {
	const outputDirectory = dirname(outputPath);
	const temporaryPath = resolve(
		outputDirectory,
		`.${basename(outputPath)}-${randomUUID()}.tmp`,
	);

	await mkdir(outputDirectory, { recursive: true });

	try {
		await writeFile(temporaryPath, serialized, {
			encoding: "utf8",
			flag: "wx",
		});
		await rename(temporaryPath, outputPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}
