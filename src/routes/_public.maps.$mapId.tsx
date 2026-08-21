import { CrosshairIcon } from "@phosphor-icons/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { LocationDetailsPanel } from "@/components/map/location-details-panel";
import { MapNavigationStrip } from "@/components/map/map-navigation-strip";
import { MapSidebarPanel } from "@/components/map/map-sidebar-panel";
import { MapWorkspace } from "@/components/map/map-workspace";
import {
	VerticalDocumentFilters,
	VerticalLocationsControl,
} from "@/components/map/vertical-map-controls";
import { VerticalScreenshotInspector } from "@/components/map/vertical-screenshot-inspector";
import { MapAttribution } from "@/components/map-attribution";
import {
	usePreparePublicMapNavigation,
	usePublicLayoutConfiguration,
	usePublicLayoutMode,
} from "@/components/public-layout-context";
import { RouteError } from "@/components/route-error";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useSidebar } from "@/components/ui/sidebar";
import { getPublicMapData } from "@/functions/catalog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	captureAnalyticsEvent,
	type LocationViewSource,
	type MapControlSource,
} from "@/lib/analytics";
import {
	encodeMapDocumentFilters,
	readCatalogId,
	resolveMapDocumentIds,
} from "@/lib/catalog-search";
import { getDocumentShortName } from "@/lib/document-display";
import { numberMapLocations } from "@/lib/map-location-order";
import { indexFirstScreenshotPreviews } from "@/lib/map-marker-preview";
import { createSeoHead } from "@/lib/seo";
import { SUBMAP_LINKS } from "@/lib/submap-links";
import { Route as PublicLayoutRoute } from "./_public";

const DESKTOP_DETAILS_VIEWPORT_INSET_PX = 416;

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
	head: ({ loaderData, params }) => {
		if (!loaderData) {
			return {};
		}

		const locationCount = loaderData.locations.length;
		const locationLabel = locationCount === 1 ? "location" : "locations";

		return createSeoHead({
			title: `${loaderData.map.name} Document Locations | Tarkov Farm`,
			description: `Find ${locationCount} seasonal document ${locationLabel} on ${loaderData.map.name} in Escape from Tarkov, with map markers and screenshots.`,
			pathname: `/maps/${encodeURIComponent(params.mapId)}`,
		});
	},
	errorComponent: (props) => (
		<RouteError
			{...props}
			analyticsError={{
				error_code: "map_data_unavailable",
				operation: "map_load",
			}}
		/>
	),
	staleTime: 30_000,
	preloadStaleTime: 30_000,
	component: MapPage,
});

function MapPage() {
	const locationViewIntentRef = useRef<
		{ locationId: string; source: LocationViewSource } | undefined
	>(undefined);
	const mapData = Route.useLoaderData();
	const catalog = PublicLayoutRoute.useLoaderData();
	const search = Route.useSearch();
	const isMobile = useIsMobile();
	const navigate = Route.useNavigate();
	const prepareMapNavigation = usePreparePublicMapNavigation();
	const layoutMode = usePublicLayoutMode();
	const assignedDocumentIds = new Set(
		catalog.documentMaps
			.filter((assignment) => assignment.mapId === mapData.map.id)
			.map((assignment) => assignment.documentId),
	);
	const mapDocuments = catalog.documents.filter(
		(document) => document.isFilterable && assignedDocumentIds.has(document.id),
	);
	const mapDocumentIds = mapDocuments.map((document) => document.id);
	const documentById = new Map(
		mapDocuments.map((document) => [document.id, document]),
	);
	const selectedDocumentIds = resolveMapDocumentIds(
		search.documents,
		mapDocumentIds,
	);
	const selectedDocumentIdSet = new Set(selectedDocumentIds);
	const previewByLocationId = useMemo(
		() => indexFirstScreenshotPreviews(mapData.screenshots),
		[mapData.screenshots],
	);
	const selectedImage =
		mapData.images.find((image) => image.viewKey === search.view) ??
		mapData.images.find((image) => image.viewKey === "main") ??
		mapData.images[0];
	const currentViewLocations = numberMapLocations(
		mapData.locations.filter(
			(location) => location.mapImageId === selectedImage?.id,
		),
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
	const selectedLocationId = selectedLocation?.id;
	const selectedLocationDocumentId = selectedLocation?.documentId;
	const selectedImageId = selectedImage?.id;
	const selectedScreenshotCount = selectedScreenshots.length;

	useEffect(() => {
		if (selectedImageId) {
			return;
		}

		captureAnalyticsEvent("app_error", {
			error_code: "map_image_missing",
			operation: "map_load",
			route: "map",
		});
	}, [selectedImageId]);

	useEffect(() => {
		if (!selectedLocationId || selectedScreenshotCount > 0) {
			return;
		}

		captureAnalyticsEvent("app_error", {
			error_code: "location_screenshots_unavailable",
			operation: "location_load",
			route: "map",
		});
	}, [selectedLocationId, selectedScreenshotCount]);

	useEffect(() => {
		if (!selectedLocationId || !selectedLocationDocumentId) {
			locationViewIntentRef.current = undefined;
			return;
		}

		const locationViewIntent = locationViewIntentRef.current;
		const locationViewSource =
			locationViewIntent?.locationId === selectedLocationId
				? (locationViewIntent?.source ?? "direct")
				: "direct";
		captureAnalyticsEvent("location_viewed", {
			document_id: selectedLocationDocumentId,
			location_id: selectedLocationId,
			map_id: mapData.map.id,
			source: locationViewSource,
		});
		locationViewIntentRef.current = undefined;
	}, [mapData.map.id, selectedLocationDocumentId, selectedLocationId]);

	const sidebarDocuments = mapDocuments.map((document) => ({
		count: currentViewLocations.filter(
			(location) => location.documentId === document.id,
		).length,
		id: document.id,
		imageHeight: document.imageHeight,
		imagePath: document.imagePath,
		imageWidth: document.imageWidth,
		name: getDocumentShortName(document),
	}));

	function selectLocation(locationId: string, source: MapControlSource) {
		locationViewIntentRef.current = { locationId, source };
		void navigate({
			to: "/maps/$mapId",
			params: { mapId: mapData.map.id },
			search: {
				documents: documentSearch,
				location: locationId,
				view: selectedImage?.viewKey,
			},
		});
	}

	function changeSelectedDocuments(
		documentIds: string[],
		source: MapControlSource,
	) {
		captureAnalyticsEvent("document_filter_changed", {
			document_ids: documentIds,
			map_id: mapData.map.id,
			selected_count: documentIds.length,
			source,
		});
		void navigate({
			to: "/maps/$mapId",
			params: { mapId: mapData.map.id },
			search: {
				documents: encodeMapDocumentFilters(documentIds, mapDocumentIds),
				location: undefined,
				view: selectedImage?.viewKey,
			},
			replace: true,
		});
	}

	function closeLocation() {
		void navigate({
			to: "/maps/$mapId",
			params: { mapId: mapData.map.id },
			search: {
				documents: documentSearch,
				location: undefined,
				view: selectedImage?.viewKey,
			},
			replace: true,
		});
	}

	const sharedMapControlProps = {
		documents: sidebarDocuments,
		locations: visibleLocations,
		selectedLocationId: selectedLocation?.id,
		selectedDocumentIds,
	};
	const sidebarPanel = (closePanel: () => void) => (
		<RouteMapSidebarPanel
			{...sharedMapControlProps}
			headerTitle={mapData.map.name}
			hideHeaderOnDesktop
			onBack={closePanel}
			onLocationSelect={(locationId) => selectLocation(locationId, "sidebar")}
			onSelectedDocumentsChange={(documentIds) =>
				changeSelectedDocuments(documentIds, "sidebar")
			}
		/>
	);
	const verticalLocationsControl = (
		<VerticalLocationsControl
			locations={visibleLocations}
			selectedLocationId={selectedLocation?.id}
			onLocationSelect={(locationId) => selectLocation(locationId, "topbar")}
		/>
	);
	const rightViewportInset =
		selectedLocation && layoutMode === "standard" && !isMobile
			? DESKTOP_DETAILS_VIEWPORT_INSET_PX
			: 0;

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
			verticalLocationsControl,
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
			<MapNavigationStrip
				documentSearch={documentSearch}
				maps={catalog.maps}
				selectedMapId={mapData.map.id}
				selectedViewKey={selectedImage?.viewKey ?? "main"}
				onMapNavigationStart={(map) => prepareMapNavigation(map, "map_strip")}
			/>
			{selectedImage ? (
				<>
					<div className="relative min-h-0 flex-1">
						<div className="h-full">
							<MapWorkspace
								key={selectedImage.id}
								ariaLabel={`${mapData.map.name} map`}
								className={
									layoutMode === "vertical" ? "h-full min-h-0" : "h-full"
								}
								image={selectedImage}
								instructions="Drag to move · Wheel or controls to zoom"
								markers={[
									...visibleLocations.map((location) => ({
										id: location.id,
										label: location.markerLabel,
										name: location.name,
										preview: previewByLocationId.get(location.id),
										secondaryLabel: location.documentName,
										xBasisPoints: location.xBasisPoints,
										yBasisPoints: location.yBasisPoints,
									})),
									...submapMarkers,
								]}
								rightViewportInset={rightViewportInset}
								selectedMarkerId={selectedLocation?.id}
								onImageError={() =>
									captureAnalyticsEvent("app_error", {
										error_code: "map_image_unavailable",
										operation: "map_load",
										route: "map",
									})
								}
								toolbarStart={
									layoutMode === "vertical" ? (
										<VerticalDocumentFilters
											documents={sidebarDocuments}
											selectedDocumentIds={selectedDocumentIds}
											onSelectedDocumentsChange={(documentIds) =>
												changeSelectedDocuments(documentIds, "topbar")
											}
										/>
									) : selectedImage.viewKey !== "main" ? (
										<p className="min-w-0 flex-1 truncate font-heading text-sm lg:hidden">
											{selectedImage.name}
										</p>
									) : null
								}
								onSelectMarker={(markerId) => {
									const targetView = submapViewByMarkerId.get(markerId);

									if (!targetView) {
										locationViewIntentRef.current = {
											locationId: markerId,
											source: "marker",
										};
									}

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

						{selectedLocation && layoutMode === "standard" ? (
							<LocationDetailsPanel
								documentArtwork={documentById.get(selectedLocation.documentId)}
								location={selectedLocation}
								screenshots={selectedScreenshots}
								onScreenshotOpen={(screenshotIndex) =>
									captureAnalyticsEvent("screenshot_opened", {
										location_id: selectedLocation.id,
										map_id: mapData.map.id,
										screenshot_count: selectedScreenshots.length,
										screenshot_index: screenshotIndex,
									})
								}
								onClose={closeLocation}
							/>
						) : null}
					</div>
					{selectedLocation && layoutMode === "vertical" ? (
						<VerticalScreenshotInspector
							key={selectedLocation.id}
							location={selectedLocation}
							screenshots={selectedScreenshots}
							onScreenshotOpen={(screenshotIndex) =>
								captureAnalyticsEvent("screenshot_opened", {
									location_id: selectedLocation.id,
									map_id: mapData.map.id,
									screenshot_count: selectedScreenshots.length,
									screenshot_index: screenshotIndex,
								})
							}
							onClose={closeLocation}
						/>
					) : null}
				</>
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
		/>
	);
}
