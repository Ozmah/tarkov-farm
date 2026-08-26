import { createFileRoute } from "@tanstack/react-router";

import { LocationContributionEditor } from "@/components/contributions/location-contribution-editor";
import { getContributionCatalog } from "@/functions/contributions";
import { readCatalogId } from "@/lib/catalog-search";
import { createSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_public/contribute")({
	validateSearch: (search: Record<string, unknown>) => ({
		map: readCatalogId(search.map),
	}),
	loader: () => getContributionCatalog(),
	head: () =>
		createSeoHead({
			title: "Contribute | Tarkov Farm",
			description: "Build a bundle of new document locations for Tarkov Farm.",
			pathname: "/contribute",
		}),
	staleTime: 30_000,
	component: ContributePage,
});

function ContributePage() {
	const catalog = Route.useLoaderData();
	const { map } = Route.useSearch();

	return <LocationContributionEditor catalog={catalog} initialMapId={map} />;
}
