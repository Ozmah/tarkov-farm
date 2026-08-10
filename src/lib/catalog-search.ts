const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_DOCUMENT_FILTERS = 20;

export type CatalogSearch = {
	documents?: string;
	location?: string;
	view?: string;
};

export function validateCatalogSearch(
	search: Record<string, unknown>,
): CatalogSearch {
	const selectedDocuments = readSelectedDocumentIds(search.documents);
	const location = readCatalogId(search.location);
	const view = readCatalogId(search.view);

	return {
		documents:
			selectedDocuments.length > 0 ? selectedDocuments.join(",") : undefined,
		location,
		view,
	};
}

export function readSelectedDocumentIds(value: unknown) {
	if (typeof value !== "string") {
		return [];
	}

	return Array.from(
		new Set(
			value
				.split(",")
				.map((id) => id.trim())
				.filter(
					(id) => id.length > 0 && id.length <= 100 && ID_PATTERN.test(id),
				),
		),
	).slice(0, MAX_DOCUMENT_FILTERS);
}

export function encodeDocumentFilters(documentIds: string[]) {
	return documentIds.length > 0 ? documentIds.join(",") : undefined;
}

export function readCatalogId(value: unknown) {
	return typeof value === "string" &&
		value.length > 0 &&
		value.length <= 100 &&
		ID_PATTERN.test(value)
		? value
		: undefined;
}
