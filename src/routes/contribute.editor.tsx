import { ArrowLeftIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { LocationContributionEditor } from "@/components/contributions/location-contribution-editor";
import { FocusedWorkspaceShell } from "@/components/focused-workspace-shell";
import { RouteError } from "@/components/route-error";
import { buttonVariants } from "@/components/ui/button";
import { getContributionCatalog } from "@/functions/contributions";
import { readCatalogId } from "@/lib/catalog-search";
import { createSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/contribute/editor")({
	validateSearch: (search: Record<string, unknown>) => ({
		map: readCatalogId(search.map),
	}),
	loader: () => getContributionCatalog(),
	errorComponent: (props) => (
		<RouteError
			{...props}
			analyticsError={{
				error_code: "catalog_unavailable",
				operation: "catalog_load",
			}}
		/>
	),
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

	return (
		<FocusedWorkspaceShell
			title="Contribution editor"
			actions={
				<Link
					to="/contribute"
					search={{ map }}
					aria-label="Back to contribution guide"
					className={buttonVariants({ variant: "ghost", size: "sm" })}
				>
					<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
					<span className="hidden sm:inline">Contribution guide</span>
				</Link>
			}
		>
			<LocationContributionEditor catalog={catalog} initialMapId={map} />
		</FocusedWorkspaceShell>
	);
}
