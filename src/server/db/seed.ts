import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseDocumentCatalog } from "../../lib/document-catalog";
import { parseKeyCatalog } from "../../lib/key-catalog";
import { getDatabase } from "./client.server";
import {
	documentMaps,
	documents,
	keyMaps,
	keys,
	mapImages,
	maps,
} from "./schema";

const mapSeed = [
	{ id: "customs", name: "Customs" },
	{ id: "factory", name: "Factory" },
	{ id: "ground-zero", name: "Ground Zero" },
	{ id: "icebreaker", name: "Icebreaker" },
	{ id: "interchange", name: "Interchange" },
	{ id: "lighthouse", name: "Lighthouse" },
	{ id: "reserve", name: "Reserve" },
	{ id: "shoreline", name: "Shoreline" },
	{ id: "streets-of-tarkov", name: "Streets of Tarkov" },
	{ id: "the-lab", name: "The Lab" },
	{ id: "the-labyrinth", name: "The Labyrinth" },
	{ id: "woods", name: "Woods" },
] as const;

const mapImageDefinitions = [
	{
		id: "customs-main",
		mapId: "customs",
		viewKey: "main",
		name: "Main map",
		file: "re3mrCustoms2.webp",
		altText: "Illustrated overview map of Customs",
	},
	{
		id: "customs-dorms",
		mapId: "customs",
		viewKey: "dorms",
		name: "Dorms",
		file: "re3mrCustomsDorms.webp",
		altText: "Detailed illustrated map of the Customs dorms",
	},
	{
		id: "factory-main",
		mapId: "factory",
		viewKey: "main",
		name: "Main map",
		file: "FactorybyRe3mr.webp",
		altText: "Illustrated overview map of Factory",
	},
	{
		id: "ground-zero-main",
		mapId: "ground-zero",
		viewKey: "main",
		name: "Main map",
		file: "GroundZero.webp",
		altText: "Illustrated overview map of Ground Zero",
	},
	{
		id: "icebreaker-main",
		mapId: "icebreaker",
		viewKey: "main",
		name: "Main map",
		file: "re3mrIcebreaker.webp",
		altText: "Illustrated overview map of Icebreaker",
	},
	{
		id: "interchange-main",
		mapId: "interchange",
		viewKey: "main",
		name: "Main map",
		file: "re3mrInterchange.webp",
		altText: "Illustrated overview map of Interchange",
	},
	{
		id: "lighthouse-main",
		mapId: "lighthouse",
		viewKey: "main",
		name: "Main map",
		file: "re3mrLighthouseVERT.webp",
		altText: "Illustrated overview map of Lighthouse",
	},
	{
		id: "the-lab-main",
		mapId: "the-lab",
		viewKey: "main",
		name: "Main map",
		file: "The_Lab_Interactive_Map_Base.webp",
		altText: "Interactive map base of The Lab",
	},
	{
		id: "reserve-main",
		mapId: "reserve",
		viewKey: "main",
		name: "Main map",
		file: "Re3mrReserveLossless.webp",
		altText: "Illustrated overview map of Reserve",
	},
	{
		id: "reserve-tunnels",
		mapId: "reserve",
		viewKey: "tunnels",
		name: "Tunnels",
		file: "re3mrReserveTunnels.webp",
		altText: "Detailed illustrated map of the Reserve tunnels",
	},
	{
		id: "shoreline-main",
		mapId: "shoreline",
		viewKey: "main",
		name: "Main map",
		file: "re3mrShoreline2.webp",
		altText: "Illustrated overview map of Shoreline",
	},
	{
		id: "shoreline-resort",
		mapId: "shoreline",
		viewKey: "resort",
		name: "Health Resort",
		file: "re3mrShorelineResort.webp",
		altText: "Detailed illustrated map of the Shoreline Health Resort",
	},
	{
		id: "streets-of-tarkov-main",
		mapId: "streets-of-tarkov",
		viewKey: "main",
		name: "Main map",
		file: "re3mrStreetsofTarkov.webp",
		altText: "Illustrated overview map of Streets of Tarkov",
	},
	{
		id: "the-labyrinth-main",
		mapId: "the-labyrinth",
		viewKey: "main",
		name: "Main map",
		file: "re3mrLabyrinthPNG.webp",
		altText: "Illustrated overview map of The Labyrinth",
	},
	{
		id: "woods-main",
		mapId: "woods",
		viewKey: "main",
		name: "Main map",
		file: "WoodsRe3mrPNG.webp",
		altText: "Illustrated overview map of Woods",
	},
] as const;

type MapMaster = {
	file: string;
	height: number;
	sha256: string;
	width: number;
};

const masterManifest = JSON.parse(
	await readFile(
		resolve(process.cwd(), "public/maps/masters/manifest.json"),
		"utf8",
	),
) as { images: MapMaster[] };
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
	({ mapIds: _mapIds, ...document }) => document,
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
		await transaction
			.insert(documents)
			.values([...documentSeed])
			.onConflictDoNothing()
			.run();
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
