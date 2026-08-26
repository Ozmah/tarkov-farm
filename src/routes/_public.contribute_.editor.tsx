import { createFileRoute } from "@tanstack/react-router";

import { LocationContributionEditor } from "@/components/contributions/location-contribution-editor";
import { getContributionCatalog } from "@/functions/contributions";
import { readCatalogId } from "@/lib/catalog-search";
import { createSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_public/contribute_/editor")({
	validateSearch: (search: Record<string, unknown>) => ({
		map: readCatalogId(search.map),
	}),
	loader: () => getContributionCatalog(),
	head: () =>
		createSeoHead({
			title: "Contribution editor | Tarkov Farm",
			description:
				"Prepare new document locations for a Tarkov Farm contribution.",
			pathname: "/contribute/editor",
		}),
	staleTime: 30_000,
	component: ContributionEditorPage,
});

function ContributionEditorPage() {
	const catalog = Route.useLoaderData();
	const { map } = Route.useSearch();

	return <LocationContributionEditor catalog={catalog} initialMapId={map} />;
}
