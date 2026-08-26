type ScreenshotTextLocation = {
	description: string | null;
	name: string;
};

export function getLocationScreenshotAltText(
	location: ScreenshotTextLocation,
	screenshotAltText: string,
) {
	return (
		screenshotAltText.trim() ||
		location.description?.trim() ||
		`${location.name} screenshot`
	);
}
