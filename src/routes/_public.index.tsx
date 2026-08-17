import { ArrowRightIcon, MapTrifoldIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { usePreparePublicMapNavigation } from "@/components/public-layout-context";
import { RouteError } from "@/components/route-error";
import { buttonVariants } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { UpdateFeed } from "@/components/update-feed";
import { getUpdates } from "@/functions/updates";
import { getDocumentShortName } from "@/lib/document-display";
import { isPlainNavigationClick } from "@/lib/navigation-intent";
import { createSeoHead } from "@/lib/seo";
import { Route as PublicLayoutRoute } from "./_public";

export const Route = createFileRoute("/_public/")({
	head: () =>
		createSeoHead({
			title: "Tarkov Farm | Kord Breach Document Locations",
			description:
				"Find Kord Breach document locations in Escape from Tarkov with interactive maps, screenshots and key requirements.",
			pathname: "/",
		}),
	loader: () => getUpdates(),
	errorComponent: (props) => (
		<RouteError
			{...props}
			analyticsError={{
				error_code: "updates_unavailable",
				operation: "updates_load",
			}}
		/>
	),
	staleTime: 30_000,
	preloadStaleTime: 30_000,
	component: App,
});

function App() {
	const catalog = PublicLayoutRoute.useLoaderData();
	const updates = Route.useLoaderData();
	const prepareMapNavigation = usePreparePublicMapNavigation();
	const filterableDocuments = catalog.documents.filter(
		(document) => document.isFilterable,
	);
	const mapSummaries = catalog.maps.flatMap((map) => {
		const locations = catalog.documentLocations.filter(
			(location) => location.mapId === map.id,
		);

		if (locations.length === 0) {
			return [];
		}

		const documentIds = new Set(
			catalog.documentMaps
				.filter((assignment) => assignment.mapId === map.id)
				.map((assignment) => assignment.documentId),
		);
		const documents = filterableDocuments.filter((document) =>
			documentIds.has(document.id),
		);

		return [{ map, documents, documentCount: locations.length }];
	});
	const totalLocations = catalog.documentLocations.length;

	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10">
				<header className="border-border border-b pb-6">
					<div className="flex min-w-0 flex-col gap-1.5">
						<h1 className="text-balance font-heading font-medium text-3xl tracking-tight sm:text-4xl">
							Kord Breach
						</h1>
						<p className="text-muted-foreground text-sm">
							{totalLocations} locations across {mapSummaries.length} maps.
						</p>
					</div>
				</header>

				<div className="grid items-start gap-10 xl:grid-cols-2 xl:gap-12">
					<section
						aria-labelledby="updates-title"
						className="flex flex-col gap-5"
					>
						<div className="flex flex-wrap items-center justify-between gap-4">
							<h2
								id="updates-title"
								className="text-balance font-heading font-medium text-2xl tracking-tight"
							>
								Latest updates
							</h2>
							{updates.length > 0 ? (
								<Link
									to="/updates"
									search={{}}
									className={buttonVariants({ variant: "ghost", size: "sm" })}
								>
									View all
									<ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
								</Link>
							) : null}
						</div>
						{updates.length > 0 ? (
							<UpdateFeed mobileLimit={1} updates={updates.slice(0, 2)} />
						) : (
							<p className="text-muted-foreground text-sm">
								The first project update will appear here.
							</p>
						)}
					</section>

					<section aria-labelledby="maps-title" className="flex flex-col gap-5">
						<h2
							id="maps-title"
							className="text-balance font-heading font-medium text-2xl tracking-tight"
						>
							Maps
						</h2>

						{mapSummaries.length > 0 ? (
							<div className="@container">
								<ul className="grid @md:grid-cols-2 gap-px overflow-hidden border border-border bg-border">
									{mapSummaries.map(({ map, documents, documentCount }) => (
										<li key={map.id}>
											<Link
												to="/maps/$mapId"
												params={{ mapId: map.id }}
												search={{}}
												onClick={(event) => {
													if (isPlainNavigationClick(event)) {
														prepareMapNavigation(map, "home");
													}
												}}
												className="group flex min-h-20 items-center gap-3 bg-card p-3 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
											>
												<div
													aria-hidden="true"
													className="flex size-10 shrink-0 items-center justify-center border border-border bg-background font-heading font-medium text-primary transition-colors group-hover:border-primary"
												>
													{getMapMonogram(map.name)}
												</div>
												<div className="min-w-0 flex-1">
													<h3 className="line-clamp-2 font-heading font-medium text-sm leading-tight transition-colors group-hover:text-primary">
														{map.name}
													</h3>
													<p className="text-muted-foreground text-xs tabular-nums">
														{documentCount}{" "}
														{documentCount === 1 ? "location" : "locations"}
													</p>
													<p className="truncate text-muted-foreground text-xs">
														{documents
															.map((document) => getDocumentShortName(document))
															.join(", ")}
													</p>
												</div>
												<ArrowRightIcon
													aria-hidden="true"
													className="size-4 shrink-0 text-muted-foreground transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
												/>
											</Link>
										</li>
									))}
								</ul>
							</div>
						) : (
							<Empty className="border border-border bg-card">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<MapTrifoldIcon aria-hidden="true" />
									</EmptyMedia>
									<EmptyTitle>No maps available</EmptyTitle>
									<EmptyDescription>
										No active locations are available.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}

function getMapMonogram(name: string) {
	const words = name
		.split(/\s+/)
		.map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
		.filter(Boolean);

	if (words[0]?.toLocaleLowerCase("en") === "the" && words[1]) {
		const subject = words[1];
		return `${subject[0]}${subject.at(-1)}`.toLocaleUpperCase("en");
	}

	if (words.length > 1) {
		return words
			.filter((word) => word.toLocaleLowerCase("en") !== "of")
			.map((word) => word[0])
			.join("")
			.slice(0, 2)
			.toLocaleUpperCase("en");
	}

	return (words[0] ?? "?").slice(0, 2).toLocaleUpperCase("en");
}
