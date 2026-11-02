import type { ScreenshotDraft } from "@/components/location-composer/location-screenshot-editor";

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

/** What the composer showed when it was last opened, reset or saved. */
export type LocationComposerSnapshot<
	Draft extends LocationComposerDraft = LocationComposerDraft,
> = {
	draft: Draft;
	screenshots: ScreenshotDraft[];
};

/** Key order is irrelevant; screenshot order and annotated files are changes. */
export function hasLocationComposerChanges<Draft extends LocationComposerDraft>(
	baseline: LocationComposerSnapshot<Draft>,
	current: LocationComposerSnapshot<Draft>,
) {
	const keys = Object.keys(baseline.draft) as Array<keyof Draft>;
	const draftChanged = keys.some((key) => {
		const before = baseline.draft[key];
		const after = current.draft[key];
		return Array.isArray(before) && Array.isArray(after)
			? !haveSameMembers(before, after)
			: before !== after;
	});

	return (
		draftChanged ||
		baseline.screenshots.length !== current.screenshots.length ||
		baseline.screenshots.some((screenshot, index) => {
			const other = current.screenshots[index];
			return (
				other?.key !== screenshot.key ||
				other.id !== screenshot.id ||
				other.file !== screenshot.file
			);
		})
	);
}

function haveSameMembers(left: readonly unknown[], right: readonly unknown[]) {
	const members = new Set(left);
	return (
		left.length === right.length && right.every((item) => members.has(item))
	);
}
