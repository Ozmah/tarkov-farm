import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
	type PublicationData,
	serializePublicationData,
} from "../../lib/publication-data";

export async function writePublicationManifest(
	data: PublicationData,
	outputPath: string,
) {
	const outputDirectory = dirname(outputPath);
	const temporaryPath = resolve(
		outputDirectory,
		`.locations-${randomUUID()}.tmp`,
	);

	await mkdir(outputDirectory, { recursive: true });

	try {
		await writeFile(temporaryPath, serializePublicationData(data), {
			encoding: "utf8",
			flag: "wx",
		});
		await rename(temporaryPath, outputPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}
