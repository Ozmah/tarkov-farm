const GITHUB_REPOSITORY_URL = "https://github.com/Ozmah/tarkov-farm";
const PRODUCTION_ORIGIN = "https://tarkov.farm";
const MAX_CONTEXT_LENGTH = 500;

type IssueContext = {
	currentHref?: string;
	mapName?: string;
};

export const CONTRIBUTING_GUIDE_URL = `${GITHUB_REPOSITORY_URL}/blob/develop/CONTRIBUTING.md`;
export const X_PROFILE_URL = "https://x.com/OzmahG";

export function buildProblemIssueUrl(context: IssueContext = {}) {
	return buildIssueUrl("report-a-problem.yml", "Problem", context);
}

export function buildLocationIssueUrl(context: IssueContext = {}) {
	return buildIssueUrl("new-location.yml", "Location", context);
}

function buildIssueUrl(
	template: string,
	issueType: string,
	context: IssueContext,
) {
	const url = new URL(`${GITHUB_REPOSITORY_URL}/issues/new`);
	const mapName = readContextValue(context.mapName);
	const currentPage = readCurrentPage(context.currentHref);

	url.searchParams.set("template", template);

	if (mapName) {
		url.searchParams.set("map", mapName);
		url.searchParams.set("title", `[${issueType}][${mapName}] `);
	}

	if (currentPage) {
		url.searchParams.set("page", currentPage);
	}

	return url.toString();
}

function readContextValue(value?: string) {
	const trimmedValue = value?.trim();
	return trimmedValue && trimmedValue.length <= 100 ? trimmedValue : undefined;
}

function readCurrentPage(value?: string) {
	if (!value || value.length > MAX_CONTEXT_LENGTH) {
		return undefined;
	}

	try {
		const url = new URL(value, PRODUCTION_ORIGIN);

		return url.origin === PRODUCTION_ORIGIN ? url.href : undefined;
	} catch {
		return undefined;
	}
}
