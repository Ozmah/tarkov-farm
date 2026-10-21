import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseDocumentCatalog } from "../../lib/document-catalog";
import { parseKeyCatalog } from "../../lib/key-catalog";
import { mapImageDefinitions, mapSeed } from "../../lib/map-catalog-seed";
import { getDatabase } from "./client.server";
import { readMapMasterManifest } from "./map-master-manifest.server";
import {
	documentMaps,
	documents,
	keyMaps,
	keys,
	mapImages,
	maps,
} from "./schema";

const masterManifest = await readMapMasterManifest();
const mastersByFile = new Map(
	masterManifest.images.map((master) => [master.file, master]),
);
const mapImageSeed = mapImageDefinitions.map(({ file, ...image }) => {
	const master = mastersByFile.get(file);

	if (!master) {
		throw new Error(`Missing generated map master: ${file}`);
	}

	return {
		...image,
		path: `/maps/masters/${file}`,
		width: master.width,
		height: master.height,
		contentHash: master.sha256,
	};
});

const documentCatalog = parseDocumentCatalog(
	JSON.parse(
		await readFile(
			resolve(process.cwd(), "data/catalog/documents.json"),
			"utf8",
		),
	),
);
const documentSeed = documentCatalog.documents.map(
	({ image, mapIds: _mapIds, ...document }) => ({
		...document,
		imageHash: image.sha256,
		imageHeight: image.height,
		imagePath: image.path,
		imageWidth: image.width,
	}),
);
const documentMapSeed = documentCatalog.documents.flatMap((document) =>
	document.mapIds.map((mapId) => ({ documentId: document.id, mapId })),
);

const keyCatalog = parseKeyCatalog(
	JSON.parse(
		await readFile(resolve(process.cwd(), "data/catalog/keys.json"), "utf8"),
	),
);

type CatalogDatabase = Awaited<ReturnType<typeof getDatabase>>["db"];

export async function seedCatalog(db: CatalogDatabase) {
	await db.transaction(async (transaction) => {
		await transaction
			.insert(maps)
			.values([...mapSeed])
			.onConflictDoNothing()
			.run();
		await transaction.update(mapImages).set({ isCurrent: false }).run();
		for (const image of mapImageSeed) {
			const currentImage = { ...image, isCurrent: true };
			await transaction
				.insert(mapImages)
				.values(currentImage)
				.onConflictDoUpdate({ target: mapImages.id, set: currentImage })
				.run();
		}
		for (const document of documentSeed) {
			await transaction
				.insert(documents)
				.values(document)
				.onConflictDoUpdate({ target: documents.id, set: document })
				.run();
		}
		await transaction
			.insert(documentMaps)
			.values(documentMapSeed)
			.onConflictDoNothing()
			.run();
		await transaction
			.insert(keys)
			.values(
				keyCatalog.keys.map((key) => ({
					id: key.id,
					imageHash: key.image.sha256,
					imageHeight: key.image.height,
					imagePath: key.image.path,
					imageWidth: key.image.width,
					name: key.name,
					usedInQuest: key.usedInQuest,
					wikiUrl: key.wikiUrl,
				})),
			)
			.onConflictDoNothing()
			.run();
		const keyMapValues = keyCatalog.keys.flatMap((key) =>
			key.mapIds.map((mapId) => ({ keyId: key.id, mapId })),
		);
		if (keyMapValues.length > 0) {
			await transaction
				.insert(keyMaps)
				.values(keyMapValues)
				.onConflictDoNothing()
				.run();
		}
	});

	return {
		documentMaps: documentMapSeed.length,
		documents: documentSeed.length,
		keys: keyCatalog.keys.length,
		mapImages: mapImageSeed.length,
		maps: mapSeed.length,
	};
}

if (import.meta.main) {
	const { client, db } = await getDatabase();

	try {
		await seedCatalog(db);
		await client.exec("PRAGMA optimize;");

		console.info("Initial catalog seed applied");
	} finally {
		await client.close();
	}
}
