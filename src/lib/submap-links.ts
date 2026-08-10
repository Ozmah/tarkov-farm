export type SubmapLink = {
	mapId: string;
	name: string;
	targetViewKey: string;
	xBasisPoints: number;
	yBasisPoints: number;
};

export const SUBMAP_LINKS: readonly SubmapLink[] = [
	{
		mapId: "customs",
		name: "Dorms",
		targetViewKey: "dorms",
		xBasisPoints: 4_935,
		yBasisPoints: 6_822,
	},
	{
		mapId: "reserve",
		name: "Tunnels",
		targetViewKey: "tunnels",
		xBasisPoints: 7_337,
		yBasisPoints: 3_381,
	},
	{
		mapId: "shoreline",
		name: "Health Resort",
		targetViewKey: "resort",
		xBasisPoints: 5_135,
		yBasisPoints: 2_058,
	},
];
