import { createFileRoute, Link } from "@tanstack/react-router";

import { DocumentThumbnail } from "@/components/document-thumbnail";
import { usePreparePublicMapNavigation } from "@/components/public-layout-context";
import { encodeMapDocumentFilters } from "@/lib/catalog-search";
import { isPlainNavigationClick } from "@/lib/navigation-intent";
import { Route as PublicLayoutRoute } from "./_public";

export const Route = createFileRoute("/_public/documents")({
	head: () => ({
		meta: [
			{ title: "Battle Pass Documents | Tarkov Farm" },
			{
				name: "description",
				content:
					"Identify every Battle Pass document and open the maps where it can be found.",
			},
		],
	}),
	component: DocumentsPage,
});

function DocumentsPage() {
	const catalog = PublicLayoutRoute.useLoaderData();
	const prepareMapNavigation = usePreparePublicMapNavigation();
	const mapById = new Map(catalog.maps.map((map) => [map.id, map]));
	const mappedDocumentMaps = new Set(
		catalog.documentLocations.map(
			(location) => `${location.documentId}:${location.mapId}`,
		),
	);
	const farmableDocuments = catalog.documents.filter(
		(document) => document.isFilterable,
	);
	const classifiedDocument = catalog.documents.find(
		(document) => document.isWildcard,
	);

	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<main className="mx-auto flex w-full max-w-5xl flex-col px-6 py-10 sm:px-10 sm:py-14">
				<header className="flex flex-col gap-4 border-border border-b pb-10">
					<h1 className="max-w-[18ch] text-balance font-heading font-medium text-4xl tracking-[-0.035em] sm:text-5xl">
						Battle Pass documents
					</h1>
					<p className="max-w-[62ch] text-pretty text-base text-muted-foreground leading-relaxed">
						List of every document, maps they appear on and how each looks
					</p>
				</header>

				<section aria-labelledby="farmable-documents-title">
					<h2 id="farmable-documents-title" className="sr-only">
						Farmable documents
					</h2>
					<ul className="divide-y divide-border border-border border-b">
						{farmableDocuments.map((document) => {
							const maps = catalog.documentMaps
								.filter((assignment) => assignment.documentId === document.id)
								.flatMap((assignment) => {
									const map = mapById.get(assignment.mapId);
									return map ? [map] : [];
								});

							return (
								<li
									key={document.id}
									id={document.id}
									className="grid scroll-mt-6 gap-6 py-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8 sm:py-10"
								>
									<DocumentThumbnail
										document={document}
										alt={`${document.name} in-game item`}
										className="h-48 w-full sm:h-44"
									/>

									<article className="flex min-w-0 flex-col gap-5">
										<div className="flex flex-col gap-3">
											<h3 className="text-balance font-heading font-medium text-2xl tracking-tight">
												{document.name}
											</h3>
											<p className="max-w-[68ch] whitespace-pre-line text-pretty text-muted-foreground leading-relaxed">
												{document.description}
											</p>
										</div>

										<div className="flex flex-col gap-2">
											<p className="font-heading font-medium text-sm">
												Found on
											</p>
											<ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
												{maps.map((map) => {
													const hasLocations = mappedDocumentMaps.has(
														`${document.id}:${map.id}`,
													);
													const mapDocumentIds = catalog.documentMaps
														.filter((assignment) => assignment.mapId === map.id)
														.map((assignment) => assignment.documentId);

													return (
														<li
															key={map.id}
															className="flex items-baseline gap-2"
														>
															<Link
																to="/maps/$mapId"
																params={{ mapId: map.id }}
																search={{
																	documents: encodeMapDocumentFilters(
																		[document.id],
																		mapDocumentIds,
																	),
																}}
																onClick={(event) => {
																	if (isPlainNavigationClick(event)) {
																		prepareMapNavigation(map);
																	}
																}}
																className="font-medium underline decoration-border underline-offset-4 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
															>
																{map.name}
															</Link>
															{hasLocations ? null : (
																<span className="text-muted-foreground text-xs">
																	Locations pending
																</span>
															)}
														</li>
													);
												})}
											</ul>
										</div>
									</article>
								</li>
							);
						})}
					</ul>
				</section>

				{classifiedDocument ? (
					<section
						id={classifiedDocument.id}
						aria-labelledby="classified-document-title"
						className="mt-10 grid scroll-mt-6 gap-6 border-border border-y py-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8 sm:py-10"
					>
						<DocumentThumbnail
							document={classifiedDocument}
							alt={`${classifiedDocument.name} in-game item`}
							className="h-48 w-full sm:h-44"
						/>

						<div className="flex min-w-0 flex-col gap-5">
							<div className="flex flex-col gap-3">
								<h2
									id="classified-document-title"
									className="text-balance font-heading font-medium text-2xl tracking-tight"
								>
									{classifiedDocument.name}
								</h2>
								<p className="max-w-[68ch] whitespace-pre-line text-pretty text-muted-foreground leading-relaxed">
									{classifiedDocument.description}
								</p>
							</div>
						</div>
					</section>
				) : null}
			</main>
		</div>
	);
}
