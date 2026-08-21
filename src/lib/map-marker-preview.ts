export type MapMarkerPreview = {
	altText: string;
	height: number;
	path: string;
	width: number;
};

type ScreenshotPreviewSource = {
	altText: string;
	id: string;
	locationId: string;
	previewHeight: number;
	previewPath: string;
	previewWidth: number;
	sortOrder: number;
};

export function indexFirstScreenshotPreviews(
	screenshots: readonly ScreenshotPreviewSource[],
) {
	const indexed = new Map<
		string,
		{ id: string; preview: MapMarkerPreview; sortOrder: number }
	>();

	for (const screenshot of screenshots) {
		const current = indexed.get(screenshot.locationId);

		if (
			!current ||
			screenshot.sortOrder < current.sortOrder ||
			(screenshot.sortOrder === current.sortOrder &&
				compareCodePoints(screenshot.id, current.id) < 0)
		) {
			indexed.set(screenshot.locationId, {
				id: screenshot.id,
				preview: {
					altText: screenshot.altText,
					height: screenshot.previewHeight,
					path: screenshot.previewPath,
					width: screenshot.previewWidth,
				},
				sortOrder: screenshot.sortOrder,
			});
		}
	}

	return new Map(
		[...indexed].map(([locationId, { preview }]) => [locationId, preview]),
	);
}

function compareCodePoints(left: string, right: string) {
	return left < right ? -1 : left > right ? 1 : 0;
}
