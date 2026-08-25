export type LocationComposerDraft = {
	description: string;
	documentId: string;
	mapImageId: string;
	name: string;
	requiredKeyIds: string[];
	xBasisPoints: number;
	yBasisPoints: number;
};

export type LocationDraftChange = <Key extends keyof LocationComposerDraft>(
	key: Key,
	value: LocationComposerDraft[Key],
) => void;
