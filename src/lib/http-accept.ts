type MediaRange = {
	quality: number;
	type: string;
	subtype: string;
};

export function prefersMarkdown(accept: string | null) {
	if (!accept) return false;

	const ranges = accept.split(",").flatMap(parseMediaRange);
	const markdownRanges = ranges.filter(
		(range) => range.type === "text" && range.subtype === "markdown",
	);

	if (markdownRanges.length === 0) return false;

	const markdownQuality = Math.max(
		...markdownRanges.map((range) => range.quality),
	);
	const htmlQuality = qualityFor(ranges, "text", "html");

	return markdownQuality > 0 && markdownQuality >= htmlQuality;
}

function parseMediaRange(value: string): MediaRange[] {
	const [rawMediaType, ...rawParameters] = value.split(";");
	const [type, subtype, ...extraParts] = rawMediaType
		.trim()
		.toLocaleLowerCase("en")
		.split("/");

	if (!type || !subtype || extraParts.length > 0) return [];

	let quality = 1;
	for (const rawParameter of rawParameters) {
		const [rawName, rawValue] = rawParameter.split("=", 2);
		if (rawName?.trim().toLocaleLowerCase("en") !== "q") continue;

		const parsedQuality = Number(rawValue?.trim());
		if (
			!Number.isFinite(parsedQuality) ||
			parsedQuality < 0 ||
			parsedQuality > 1
		) {
			return [];
		}

		quality = parsedQuality;
	}

	return [{ quality, type, subtype }];
}

function qualityFor(
	ranges: readonly MediaRange[],
	type: string,
	subtype: string,
) {
	const exact = ranges.filter(
		(range) => range.type === type && range.subtype === subtype,
	);
	if (exact.length > 0) {
		return Math.max(...exact.map((range) => range.quality));
	}

	const typeWildcards = ranges.filter(
		(range) => range.type === type && range.subtype === "*",
	);
	if (typeWildcards.length > 0) {
		return Math.max(...typeWildcards.map((range) => range.quality));
	}

	const wildcards = ranges.filter(
		(range) => range.type === "*" && range.subtype === "*",
	);
	return wildcards.length > 0
		? Math.max(...wildcards.map((range) => range.quality))
		: 0;
}
