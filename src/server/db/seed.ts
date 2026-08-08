import { getDatabase } from "./client.server";
import { documentMaps, documents, mapImages, maps } from "./schema";

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
		id: "interchange-ultra",
		mapId: "interchange",
		viewKey: "ultra",
		name: "ULTRA interior",
		file: "re3mrULTRA3Dmap.webp",
		altText: "Detailed illustrated map of the ULTRA shopping mall",
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

const masterManifest = (await Bun.file(
	"public/maps/masters/manifest.json",
).json()) as { images: MapMaster[] };
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

const documentSeed = [
	{
		id: "blueprints-technical",
		name: "Blueprints and technical documentation",
	},
	{
		id: "classified",
		name: "Classified documents",
		acquisitionType: "store" as const,
		acquisitionSource: "Expansion Hub",
		isFilterable: false,
		isWildcard: true,
	},
	{ id: "financial", name: "Financial documents" },
	{ id: "medical", name: "Medical documents" },
	{ id: "pmc-personnel", name: "PMC personnel files" },
	{ id: "project", name: "Project documentation" },
	{ id: "technical", name: "Technical documentation" },
	{ id: "test", name: "Test documentation" },
	{ id: "user", name: "User documentation" },
] as const;

const documentMapSeed = [
	["blueprints-technical", "factory"],
	["blueprints-technical", "interchange"],
	["blueprints-technical", "the-labyrinth"],
	["financial", "customs"],
	["financial", "interchange"],
	["financial", "streets-of-tarkov"],
	["medical", "ground-zero"],
	["medical", "the-lab"],
	["medical", "the-labyrinth"],
	["pmc-personnel", "icebreaker"],
	["pmc-personnel", "lighthouse"],
	["pmc-personnel", "reserve"],
	["project", "customs"],
	["project", "factory"],
	["project", "reserve"],
	["technical", "lighthouse"],
	["technical", "shoreline"],
	["technical", "woods"],
	["test", "icebreaker"],
	["test", "shoreline"],
	["test", "woods"],
	["user", "ground-zero"],
	["user", "streets-of-tarkov"],
	["user", "the-lab"],
] as const;

const { client, db } = await getDatabase();

try {
	await db.transaction(async (transaction) => {
		await transaction
			.insert(maps)
			.values([...mapSeed])
			.onConflictDoNothing()
			.run();
		for (const image of mapImageSeed) {
			await transaction
				.insert(mapImages)
				.values(image)
				.onConflictDoUpdate({ target: mapImages.id, set: image })
				.run();
		}
		await transaction
			.insert(documents)
			.values([...documentSeed])
			.onConflictDoNothing()
			.run();
		await transaction
			.insert(documentMaps)
			.values(
				documentMapSeed.map(([documentId, mapId]) => ({
					documentId,
					mapId,
				})),
			)
			.onConflictDoNothing()
			.run();
	});

	await client.exec("PRAGMA optimize;");

	console.info("Initial catalog seed applied");
} finally {
	client.close();
}
