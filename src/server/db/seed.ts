import { getDatabase } from "./client.server";
import { documentMaps, documents, maps } from "./schema";

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
