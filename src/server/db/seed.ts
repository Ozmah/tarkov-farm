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

const mapImageSeed = [
	{
		id: "customs-main",
		mapId: "customs",
		viewKey: "main",
		name: "Main map",
		path: "/maps/re3mrCustoms2.png",
		altText: "Illustrated overview map of Customs",
		width: 7832,
		height: 5016,
	},
	{
		id: "customs-dorms",
		mapId: "customs",
		viewKey: "dorms",
		name: "Dorms",
		path: "/maps/re3mrCustomsDorms.png",
		altText: "Detailed illustrated map of the Customs dorms",
		width: 4301,
		height: 4904,
	},
	{
		id: "factory-main",
		mapId: "factory",
		viewKey: "main",
		name: "Main map",
		path: "/maps/FactorybyRe3mr.png",
		altText: "Illustrated overview map of Factory",
		width: 13440,
		height: 6656,
	},
	{
		id: "ground-zero-main",
		mapId: "ground-zero",
		viewKey: "main",
		name: "Main map",
		path: "/maps/GroundZero.png",
		altText: "Illustrated overview map of Ground Zero",
		width: 2656,
		height: 2160,
	},
	{
		id: "icebreaker-main",
		mapId: "icebreaker",
		viewKey: "main",
		name: "Main map",
		path: "/maps/re3mrIcebreaker.png",
		altText: "Illustrated overview map of Icebreaker",
		width: 7680,
		height: 4320,
	},
	{
		id: "interchange-main",
		mapId: "interchange",
		viewKey: "main",
		name: "Main map",
		path: "/maps/re3mrInterchange.jpg",
		altText: "Illustrated overview map of Interchange",
		width: 9600,
		height: 5400,
	},
	{
		id: "interchange-ultra",
		mapId: "interchange",
		viewKey: "ultra",
		name: "ULTRA interior",
		path: "/maps/re3mrULTRA3Dmap.png",
		altText: "Detailed illustrated map of the ULTRA shopping mall",
		width: 12241,
		height: 8380,
	},
	{
		id: "lighthouse-main",
		mapId: "lighthouse",
		viewKey: "main",
		name: "Main map",
		path: "/maps/re3mrLighthouseVERT.png",
		altText: "Illustrated overview map of Lighthouse",
		width: 8259,
		height: 7560,
	},
	{
		id: "the-lab-main",
		mapId: "the-lab",
		viewKey: "main",
		name: "Main map",
		path: "/maps/The_Lab_Interactive_Map_Base.webp",
		altText: "Interactive map base of The Lab",
		width: 3820,
		height: 2189,
	},
	{
		id: "reserve-main",
		mapId: "reserve",
		viewKey: "main",
		name: "Main map",
		path: "/maps/Re3mrReserveLossless.png",
		altText: "Illustrated overview map of Reserve",
		width: 5760,
		height: 3240,
	},
	{
		id: "reserve-tunnels",
		mapId: "reserve",
		viewKey: "tunnels",
		name: "Tunnels",
		path: "/maps/re3mrReserveTunnels.png",
		altText: "Detailed illustrated map of the Reserve tunnels",
		width: 3240,
		height: 5760,
	},
	{
		id: "shoreline-main",
		mapId: "shoreline",
		viewKey: "main",
		name: "Main map",
		path: "/maps/re3mrShoreline2.png",
		altText: "Illustrated overview map of Shoreline",
		width: 5760,
		height: 3240,
	},
	{
		id: "shoreline-resort",
		mapId: "shoreline",
		viewKey: "resort",
		name: "Health Resort",
		path: "/maps/re3mrShorelineResort.png",
		altText: "Detailed illustrated map of the Shoreline Health Resort",
		width: 10694,
		height: 6016,
	},
	{
		id: "streets-of-tarkov-main",
		mapId: "streets-of-tarkov",
		viewKey: "main",
		name: "Main map",
		path: "/maps/re3mrStreetsofTarkov.png",
		altText: "Illustrated overview map of Streets of Tarkov",
		width: 7605,
		height: 4841,
	},
	{
		id: "the-labyrinth-main",
		mapId: "the-labyrinth",
		viewKey: "main",
		name: "Main map",
		path: "/maps/re3mrLabyrinthPNG.png",
		altText: "Illustrated overview map of The Labyrinth",
		width: 4800,
		height: 4320,
	},
	{
		id: "woods-main",
		mapId: "woods",
		viewKey: "main",
		name: "Main map",
		path: "/maps/WoodsRe3mrPNG.png",
		altText: "Illustrated overview map of Woods",
		width: 7680,
		height: 5168,
	},
] as const;

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
		await transaction
			.insert(mapImages)
			.values([...mapImageSeed])
			.onConflictDoNothing()
			.run();
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
