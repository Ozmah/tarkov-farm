import { parseImportContributionLocationFormData } from "./editor-validation";
import type {
	ReviewedContributionLocation,
	ReviewedContributionScreenshot,
} from "./location-contribution-archive-reader";

export type ContributionReviewCatalog = {
	documentMaps: Array<{ documentId: string; mapId: string }>;
	documents: Array<{ id: string; name: string }>;
	keyMaps: Array<{ keyId: string; mapId: string }>;
	keys: Array<{ id: string; name: string }>;
	mapImages: Array<{
		contentHash: string;
		id: string;
		mapId: string;
		name: string;
	}>;
	maps: Array<{ id: string; name: string }>;
};

export type ContributionLocationReviewValues = {
	description: string;
	documentId: string;
	mapImageId: string;
	name: string;
	requiredKeyIds: string[];
	xBasisPoints: number;
	yBasisPoints: number;
};

export type ContributionScreenshotReplacement = {
	file: File;
	sourceSha256: string;
};

export type ContributionScreenshotReviewDraft = {
	included: boolean;
	isCheckingReplacement: boolean;
	replacement?: ContributionScreenshotReplacement;
	replacementError?: string;
	sourceId: string;
};

export type ContributionLocationReviewDraft = {
	included: boolean;
	screenshots: ContributionScreenshotReviewDraft[];
	sourceId: string;
	values: ContributionLocationReviewValues;
};

export type ContributionLocationImportState = {
	error?: string;
	localId?: string;
	status: "failed" | "imported" | "importing";
};

export type ContributionReviewField = keyof ContributionLocationReviewValues;

export function createContributionLocationReviewDraft(
	location: ReviewedContributionLocation,
): ContributionLocationReviewDraft {
	return {
		included: false,
		screenshots: location.screenshots.map(({ id }) => ({
			included: true,
			isCheckingReplacement: false,
			sourceId: id,
		})),
		sourceId: location.id,
		values: sourceValues(location),
	};
}

export function restoreContributionLocationReviewDraft(
	draft: ContributionLocationReviewDraft,
	location: ReviewedContributionLocation,
) {
	return {
		...createContributionLocationReviewDraft(location),
		included: draft.included,
	} satisfies ContributionLocationReviewDraft;
}

export function getContributionLocationChangedFields(
	draft: ContributionLocationReviewDraft,
	location: ReviewedContributionLocation,
) {
	const original = sourceValues(location);
	return REVIEW_FIELDS.filter(
		(field) => !areReviewValuesEqual(draft.values[field], original[field]),
	);
}

export function isContributionScreenshotDraftChanged(
	draft: ContributionScreenshotReviewDraft,
) {
	return !draft.included || draft.replacement !== undefined;
}

export function getContributionLocationChangeCount(
	draft: ContributionLocationReviewDraft,
	location: ReviewedContributionLocation,
) {
	const changedFields = getContributionLocationChangedFields(draft, location);
	const changedScreenshots = draft.screenshots.filter(
		isContributionScreenshotDraftChanged,
	).length;
	const orderChanged = draft.screenshots.some(
		(screenshot, index) =>
			screenshot.sourceId !== location.screenshots[index]?.id,
	);

	return changedFields.length + changedScreenshots + Number(orderChanged);
}

export function createContributionLocationImportFormData(
	draft: ContributionLocationReviewDraft,
	location: ReviewedContributionLocation,
	catalog: ContributionReviewCatalog,
) {
	if (!draft.included) {
		throw new Error(
			`${draft.values.name || location.name} is not selected for import`,
		);
	}

	const image = catalog.mapImages.find(
		({ id }) => id === draft.values.mapImageId,
	);
	if (!image)
		throw new Error(`${draft.values.name || location.name} has no map image`);
	if (!catalog.maps.some(({ id }) => id === image.mapId)) {
		throw new Error(
			`${draft.values.name || location.name} has no available map`,
		);
	}
	if (
		!catalog.documents.some(({ id }) => id === draft.values.documentId) ||
		!catalog.documentMaps.some(
			({ documentId, mapId }) =>
				documentId === draft.values.documentId && mapId === image.mapId,
		)
	) {
		throw new Error(
			`${draft.values.name || location.name} has no available document`,
		);
	}
	for (const keyId of draft.values.requiredKeyIds) {
		if (
			!catalog.keys.some(({ id }) => id === keyId) ||
			!catalog.keyMaps.some(
				({ keyId: assignedKeyId, mapId }) =>
					assignedKeyId === keyId && mapId === image.mapId,
			)
		) {
			throw new Error(
				`${draft.values.name || location.name} has an unavailable required key`,
			);
		}
	}

	const sourceById = new Map(
		location.screenshots.map((screenshot) => [screenshot.id, screenshot]),
	);
	const screenshots = draft.screenshots.flatMap((screenshot) => {
		if (!screenshot.included) return [];
		if (screenshot.isCheckingReplacement) {
			throw new Error(
				`${draft.values.name || location.name} is still checking a replacement screenshot`,
			);
		}
		const source = sourceById.get(screenshot.sourceId);
		if (!source)
			throw new Error("A reviewed screenshot is no longer available");
		return [{ draft: screenshot, source }];
	});
	if (screenshots.length === 0) {
		throw new Error(
			`${draft.values.name || location.name} requires at least one screenshot`,
		);
	}
	const sourceHashes = screenshots.map(
		({ draft: screenshot, source }) =>
			screenshot.replacement?.sourceSha256 ?? source.sourceSha256,
	);
	if (new Set(sourceHashes).size !== sourceHashes.length) {
		throw new Error(
			`${draft.values.name || location.name} contains duplicate screenshots`,
		);
	}

	const formData = new FormData();
	formData.set("mapImageSha256", image.contentHash);
	formData.set(
		"payload",
		JSON.stringify({
			location: {
				description: draft.values.description || null,
				documentId: draft.values.documentId,
				isActive: true,
				mapImageId: draft.values.mapImageId,
				name: draft.values.name,
				requiredKeyIds: draft.values.requiredKeyIds,
				xBasisPoints: draft.values.xBasisPoints,
				yBasisPoints: draft.values.yBasisPoints,
			},
			screenshots: screenshots.map(({ source }, uploadIndex) => ({
				altText: source.altText,
				caption: source.caption,
				uploadIndex,
			})),
		}),
	);
	for (const { draft: screenshot, source } of screenshots) {
		formData.append("screenshots", screenshot.replacement?.file ?? source.file);
	}

	parseImportContributionLocationFormData(formData);
	return formData;
}

export function getAvailableReviewOptions(
	mapImageId: string,
	catalog: ContributionReviewCatalog,
) {
	const image = catalog.mapImages.find(({ id }) => id === mapImageId);
	const mapId = image?.mapId ?? "";
	const documentIds = new Set(
		catalog.documentMaps
			.filter((assignment) => assignment.mapId === mapId)
			.map(({ documentId }) => documentId),
	);
	const keyIds = new Set(
		catalog.keyMaps
			.filter((assignment) => assignment.mapId === mapId)
			.map(({ keyId }) => keyId),
	);

	return {
		documents: catalog.documents.filter(({ id }) => documentIds.has(id)),
		keys: catalog.keys.filter(({ id }) => keyIds.has(id)),
		mapId,
		mapImages: catalog.mapImages.filter(
			(candidate) => candidate.mapId === mapId,
		),
	};
}

function sourceValues(
	location: ReviewedContributionLocation,
): ContributionLocationReviewValues {
	return {
		description: location.description ?? "",
		documentId: location.documentId,
		mapImageId: location.mapImageId,
		name: location.name,
		requiredKeyIds: [...location.requiredKeyIds],
		xBasisPoints: location.xBasisPoints,
		yBasisPoints: location.yBasisPoints,
	};
}

function areReviewValuesEqual(
	left: ContributionLocationReviewValues[ContributionReviewField],
	right: ContributionLocationReviewValues[ContributionReviewField],
) {
	if (Array.isArray(left) && Array.isArray(right)) {
		return (
			left.length === right.length &&
			left.every((value) => right.includes(value))
		);
	}
	return left === right;
}

const REVIEW_FIELDS: ContributionReviewField[] = [
	"name",
	"description",
	"mapImageId",
	"documentId",
	"requiredKeyIds",
	"xBasisPoints",
	"yBasisPoints",
];

export function findReviewedScreenshot(
	location: ReviewedContributionLocation,
	screenshotId: string,
): ReviewedContributionScreenshot {
	const screenshot = location.screenshots.find(({ id }) => id === screenshotId);
	if (!screenshot)
		throw new Error("A reviewed screenshot is no longer available");
	return screenshot;
}
