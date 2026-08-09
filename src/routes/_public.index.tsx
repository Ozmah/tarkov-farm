import {
	ArrowRightIcon,
	MapPinLineIcon,
	MapTrifoldIcon,
} from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { usePreparePublicMapNavigation } from "@/components/public-layout-context";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	encodeDocumentFilters,
	readSelectedDocumentIds,
} from "@/lib/catalog-search";
import { isPlainNavigationClick } from "@/lib/navigation-intent";
import { Route as PublicLayoutRoute } from "./_public";

export const Route = createFileRoute("/_public/")({
	component: App,
});

function App() {
	const catalog = PublicLayoutRoute.useLoaderData();
	const prepareMapNavigation = usePreparePublicMapNavigation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const filterableDocuments = catalog.documents.filter(
		(document) => document.isFilterable,
	);
	const filterableDocumentIds = new Set(
		filterableDocuments.map((document) => document.id),
	);
	const selectedDocumentIds = readSelectedDocumentIds(search.documents).filter(
		(id) => filterableDocumentIds.has(id),
	);
	const selectedDocumentIdSet = new Set(selectedDocumentIds);
	const selectedDocuments = filterableDocuments.filter((document) =>
		selectedDocumentIdSet.has(document.id),
	);
	const visibleLocations = catalog.documentLocations.filter(
		(location) =>
			selectedDocumentIdSet.size === 0 ||
			selectedDocumentIdSet.has(location.documentId),
	);
	const mapSummaries = catalog.maps.flatMap((map) => {
		const locations = visibleLocations.filter(
			(location) => location.mapId === map.id,
		);

		if (locations.length === 0) {
			return [];
		}

		const documentIds = new Set(
			locations.map((location) => location.documentId),
		);
		const documents = filterableDocuments.filter((document) =>
			documentIds.has(document.id),
		);

		return [{ map, documents, documentCount: locations.length }];
	});
	const encodedFilters = encodeDocumentFilters(selectedDocumentIds);

	function updateSelectedDocuments(documentIds: string[]) {
		void navigate({
			to: "/",
			search: { documents: encodeDocumentFilters(documentIds) },
			replace: true,
		});
	}

	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 sm:px-10 sm:py-12">
				<section
					aria-labelledby="overview-title"
					className="flex flex-col gap-6"
				>
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div className="flex min-w-0 flex-col gap-2">
							<h1
								id="overview-title"
								className="text-balance font-heading font-medium text-3xl tracking-tight"
							>
								Season Documentation
							</h1>
							<p className="max-w-[56ch] text-pretty text-base text-muted-foreground sm:text-sm">
								{selectedDocuments.length > 0
									? `Showing locations for ${selectedDocuments.map((document) => document.name).join(", ")}.`
									: "Document locations."}
							</p>
						</div>
						{selectedDocuments.length > 0 ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => updateSelectedDocuments([])}
							>
								Clear filters
							</Button>
						) : null}
					</div>

					<dl className="flex flex-wrap items-center gap-8">
						<div className="flex items-center gap-2">
							<dt className="sr-only">Document locations</dt>
							<MapPinLineIcon
								aria-hidden="true"
								className="size-6 text-primary"
							/>
							<dd className="font-heading text-2xl tabular-nums">
								{visibleLocations.length}
							</dd>
						</div>
						<div className="flex items-center gap-2">
							<dt className="sr-only">Maps available</dt>
							<MapTrifoldIcon
								aria-hidden="true"
								className="size-6 text-primary"
							/>
							<dd className="font-heading text-2xl tabular-nums">
								{mapSummaries.length}
							</dd>
						</div>
					</dl>
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
							<ul className="grid @2xl:grid-cols-2 gap-3">
								{mapSummaries.map(({ map, documents, documentCount }) => (
									<li key={map.id}>
										<Link
											to="/maps/$mapId"
											params={{ mapId: map.id }}
											search={{ documents: encodedFilters }}
											onClick={(event) => {
												if (isPlainNavigationClick(event)) {
													prepareMapNavigation(map);
												}
											}}
											className="group flex min-h-24 items-center gap-4 border border-border bg-card p-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
										>
											<div
												aria-hidden="true"
												className="flex size-14 shrink-0 items-center justify-center bg-secondary font-heading font-medium text-secondary-foreground outline-1 outline-foreground/10 -outline-offset-1"
											>
												{getMapMonogram(map.name)}
											</div>
											<div className="min-w-0 flex-1">
												<h3 className="truncate font-heading font-medium text-lg">
													{map.name}
												</h3>
												<p className="text-base text-muted-foreground tabular-nums sm:text-sm">
													{documentCount}{" "}
													{documentCount === 1 ? "location" : "locations"}
												</p>
												<p className="truncate text-base text-muted-foreground sm:text-sm">
													{documents
														.map((document) => document.name)
														.join(", ")}
												</p>
											</div>
											<ArrowRightIcon
												aria-hidden="true"
												className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-1 motion-reduce:transition-none sm:size-4"
											/>
										</Link>
									</li>
								))}
							</ul>
						</div>
					) : (
						<Empty className="border border-border">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<MapTrifoldIcon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>No maps available</EmptyTitle>
								<EmptyDescription>
									No active locations match the selected documents.
								</EmptyDescription>
							</EmptyHeader>
							<Button
								type="button"
								variant="outline"
								onClick={() => updateSelectedDocuments([])}
							>
								Clear filters
							</Button>
						</Empty>
					)}
				</section>
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
