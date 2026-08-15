import { CrosshairIcon } from "@phosphor-icons/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { LocationDetailsPanel } from "@/components/map/location-details-panel";
import { MapSidebarPanel } from "@/components/map/map-sidebar-panel";
import { MapWorkspace } from "@/components/map/map-workspace";
import { MapAttribution } from "@/components/map-attribution";
import {
	usePreparePublicMapNavigation,
	usePublicLayoutConfiguration,
} from "@/components/public-layout-context";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useSidebar } from "@/components/ui/sidebar";
import { getPublicMapData } from "@/functions/catalog";
import {
	encodeMapDocumentFilters,
	readCatalogId,
	resolveMapDocumentIds,
} from "@/lib/catalog-search";
import { getDocumentShortName } from "@/lib/document-display";
import { SUBMAP_LINKS } from "@/lib/submap-links";
import { Route as PublicLayoutRoute } from "./_public";

export const Route = createFileRoute("/_public/maps/$mapId")({
	loader: async ({ params }) => {
		if (readCatalogId(params.mapId) !== params.mapId) {
			throw notFound();
		}

		const mapData = await getPublicMapData({ data: { mapId: params.mapId } });

		if (!mapData) {
			throw notFound();
		}

		return mapData;
	},
	staleTime: 30_000,
	preloadStaleTime: 30_000,
	component: MapPage,
});

function MapPage() {
	const mapData = Route.useLoaderData();
	const catalog = PublicLayoutRoute.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const prepareMapNavigation = usePreparePublicMapNavigation();
	const assignedDocumentIds = new Set(
		catalog.documentMaps
			.filter((assignment) => assignment.mapId === mapData.map.id)
			.map((assignment) => assignment.documentId),
	);
	const mapDocuments = catalog.documents.filter(
		(document) => document.isFilterable && assignedDocumentIds.has(document.id),
	);
	const mapDocumentIds = mapDocuments.map((document) => document.id);
	const selectedDocumentIds = resolveMapDocumentIds(
		search.documents,
		mapDocumentIds,
	);
	const selectedDocumentIdSet = new Set(selectedDocumentIds);
	const selectedImage =
		mapData.images.find((image) => image.viewKey === search.view) ??
		mapData.images.find((image) => image.viewKey === "main") ??
		mapData.images[0];
	const currentViewLocations = mapData.locations.filter(
		(location) => location.mapImageId === selectedImage?.id,
	);
	const visibleLocations = currentViewLocations.filter((location) =>
		selectedDocumentIdSet.has(location.documentId),
	);
	const selectedLocation = visibleLocations.find(
		(location) => location.id === search.location,
	);
	const selectedScreenshots = selectedLocation
		? mapData.screenshots.filter(
				(screenshot) => screenshot.locationId === selectedLocation.id,
			)
		: [];
	const submapMarkers =
		selectedImage?.viewKey === "main"
			? SUBMAP_LINKS.filter((link) => link.mapId === mapData.map.id).flatMap(
					(link) => {
						const targetImage = mapData.images.find(
							(image) => image.viewKey === link.targetViewKey,
						);

						if (!targetImage) return [];

						const locationCount = mapData.locations.filter(
							(location) =>
								location.mapImageId === targetImage.id &&
								(selectedDocumentIdSet.size === 0 ||
									selectedDocumentIdSet.has(location.documentId)),
						).length;
						const locationLabel =
							locationCount === 1 ? "location" : "locations";

						return [
							{
								id: `submap:${link.targetViewKey}`,
								kind: "submap" as const,
								label: String(locationCount),
								name: `${link.name} submap with ${locationCount} ${locationLabel}`,
								targetViewKey: link.targetViewKey,
								xBasisPoints: link.xBasisPoints,
								yBasisPoints: link.yBasisPoints,
							},
						];
					},
				)
			: [];
	const submapViewByMarkerId = new Map(
		submapMarkers.map((marker) => [marker.id, marker.targetViewKey]),
	);
	const documentSearch = encodeMapDocumentFilters(
		selectedDocumentIds,
		mapDocumentIds,
	);
	const sidebarDocuments = mapDocuments.map((document) => ({
		count: currentViewLocations.filter(
			(location) => location.documentId === document.id,
		).length,
		id: document.id,
		name: getDocumentShortName(document),
	}));

	const sidebarPanel = (closePanel: () => void) => (
		<RouteMapSidebarPanel
			documents={sidebarDocuments}
			locations={visibleLocations}
			maps={catalog.maps}
			mapViews={mapData.images.map((image) => ({
				id: image.viewKey,
				name: image.name,
			}))}
			selectedLocationId={selectedLocation?.id}
			selectedDocumentIds={selectedDocumentIds}
			selectedMapId={mapData.map.id}
			selectedMapViewId={selectedImage?.viewKey}
			onBack={closePanel}
			onLocationSelect={(locationId) =>
				void navigate({
					to: "/maps/$mapId",
					params: { mapId: mapData.map.id },
					search: {
						documents: documentSearch,
						location: locationId,
						view: selectedImage?.viewKey,
					},
				})
			}
			onSelectedDocumentsChange={(documentIds) =>
				void navigate({
					to: "/maps/$mapId",
					params: { mapId: mapData.map.id },
					search: {
						documents: encodeMapDocumentFilters(documentIds, mapDocumentIds),
						location: undefined,
						view: selectedImage?.viewKey,
					},
					replace: true,
				})
			}
			onMapChange={(mapId) => {
				const map = catalog.maps.find((item) => item.id === mapId);

				if (map) {
					prepareMapNavigation(map);
				}

				void navigate({
					to: "/maps/$mapId",
					params: { mapId },
					search: {},
				});
			}}
			onMapViewChange={(view) =>
				void navigate({
					to: "/maps/$mapId",
					params: { mapId: mapData.map.id },
					search: {
						documents: documentSearch,
						location: undefined,
						view,
					},
					replace: true,
				})
			}
		/>
	);

	usePublicLayoutConfiguration(
		{
			editorSearch: {
				documents: documentSearch,
				image: selectedImage?.id,
				location: selectedLocation?.id,
				map: mapData.map.id,
			},
			headerMeta: `${visibleLocations.length} ${visibleLocations.length === 1 ? "location" : "locations"}`,
			sidebarPanel,
		},
		[
			mapData.map.id,
			selectedImage?.id,
			selectedLocation?.id,
			documentSearch,
			visibleLocations.length,
		].join(":"),
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<h1 className="sr-only">{mapData.map.name} document locations</h1>
			{selectedImage ? (
				<div className="relative min-h-0 flex-1">
					<div className="h-full">
						<MapWorkspace
							key={selectedImage.id}
							ariaLabel={`${mapData.map.name} map`}
							className="h-full"
							image={selectedImage}
							instructions="Drag to move · Wheel or controls to zoom"
							markers={[
								...visibleLocations.map((location, index) => ({
									id: location.id,
									label: String(index + 1),
									name: location.name,
									xBasisPoints: location.xBasisPoints,
									yBasisPoints: location.yBasisPoints,
								})),
								...submapMarkers,
							]}
							selectedMarkerId={selectedLocation?.id}
							toolbarStart={
								<p className="min-w-0 flex-1 truncate font-heading text-sm xl:max-w-48 xl:flex-none">
									{selectedImage.name}
								</p>
							}
							onSelectMarker={(markerId) => {
								const targetView = submapViewByMarkerId.get(markerId);

								void navigate({
									to: "/maps/$mapId",
									params: { mapId: mapData.map.id },
									search: {
										documents: documentSearch,
										location: targetView ? undefined : markerId,
										view: targetView ?? selectedImage.viewKey,
									},
								});
							}}
						/>
					</div>

					{selectedLocation ? (
						<LocationDetailsPanel
							location={selectedLocation}
							screenshots={selectedScreenshots}
							onClose={() =>
								void navigate({
									to: "/maps/$mapId",
									params: { mapId: mapData.map.id },
									search: {
										documents: documentSearch,
										location: undefined,
										view: selectedImage.viewKey,
									},
									replace: true,
								})
							}
						/>
					) : null}
				</div>
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CrosshairIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No map image</EmptyTitle>
						<EmptyDescription>
							This map does not have a current public image.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}

			<footer className="shrink-0 border-border border-t bg-card px-4 py-2 text-center">
				<MapAttribution mapId={mapData.map.id} />
			</footer>
		</div>
	);
}

type RouteMapSidebarPanelProps = React.ComponentProps<typeof MapSidebarPanel>;

function RouteMapSidebarPanel(props: RouteMapSidebarPanelProps) {
	const { isMobile, setOpenMobile } = useSidebar();

	function runNavigation(action: () => void) {
		action();

		if (isMobile) {
			setOpenMobile(false);
		}
	}

	return (
		<MapSidebarPanel
			{...props}
			onBack={props.onBack}
			onLocationSelect={(locationId) =>
				runNavigation(() => props.onLocationSelect(locationId))
			}
			onMapChange={(mapId) => runNavigation(() => props.onMapChange(mapId))}
			onMapViewChange={(mapViewId) =>
				runNavigation(() => props.onMapViewChange(mapViewId))
			}
		/>
	);
}
