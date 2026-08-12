const DOCUMENT_SHORT_NAMES: Readonly<Record<string, string>> = {
	"blueprints-technical": "Blueprints",
	financial: "Financial",
	medical: "Medical",
	"pmc-personnel": "PMC personnel",
	project: "Project",
	technical: "Technical",
	test: "Test",
	user: "User",
};

export function getDocumentShortName(document: { id: string; name: string }) {
	return DOCUMENT_SHORT_NAMES[document.id] ?? document.name;
}
