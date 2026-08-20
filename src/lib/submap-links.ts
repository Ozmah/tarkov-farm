export type SubmapLink = {
	mapId: string;
	name: string;
	navigationName: string;
	targetViewKey: string;
	xBasisPoints: number;
	yBasisPoints: number;
};

export const SUBMAP_LINKS: readonly SubmapLink[] = [
	{
		mapId: "customs",
		name: "Dorms",
		navigationName: "Dorms",
		targetViewKey: "dorms",
		xBasisPoints: 4_935,
		yBasisPoints: 6_822,
	},
	{
		mapId: "reserve",
		name: "Tunnels",
		navigationName: "Tunnels",
		targetViewKey: "tunnels",
		xBasisPoints: 7_337,
		yBasisPoints: 3_381,
	},
	{
		mapId: "shoreline",
		name: "Health Resort",
		navigationName: "Resort",
		targetViewKey: "resort",
		xBasisPoints: 5_135,
		yBasisPoints: 2_058,
	},
];
