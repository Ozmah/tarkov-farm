const MAP_NAVIGATION_LABELS: Readonly<Record<string, string>> = {
	customs: "Customs",
	factory: "Factory",
	"ground-zero": "GZero",
	icebreaker: "Icebreaker",
	interchange: "Inter",
	lighthouse: "Lighthouse",
	reserve: "Reserve",
	shoreline: "Shoreline",
	"streets-of-tarkov": "Streets",
	"the-lab": "Labs",
	"the-labyrinth": "Labyrinth",
	woods: "Woods",
};

export function getMapNavigationLabel(map: { id: string; name: string }) {
	return MAP_NAVIGATION_LABELS[map.id] ?? map.name;
}
