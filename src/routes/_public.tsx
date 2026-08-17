import {
	createFileRoute,
	Outlet,
	useParams,
	useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PendingMapSidebarPanel } from "@/components/map/map-sidebar-panel";
import {
	type PublicLayoutConfiguration,
	PublicLayoutConfigurationProvider,
} from "@/components/public-layout-context";
import { PublicShell } from "@/components/public-shell";
import { RouteError } from "@/components/route-error";
import { getCatalog } from "@/functions/catalog";
import {
	captureAnalyticsEvent,
	type MapSelectionSource,
} from "@/lib/analytics";
import { validateCatalogSearch } from "@/lib/catalog-search";

export const Route = createFileRoute("/_public")({
	validateSearch: validateCatalogSearch,
	loader: () => getCatalog(),
	errorComponent: (props) => (
		<RouteError
			{...props}
			analyticsError={{
				error_code: "catalog_unavailable",
				operation: "catalog_load",
			}}
		/>
	),
	staleTime: 30_000,
	preloadStaleTime: 30_000,
	component: PublicLayout,
});

function PublicLayout() {
	const catalog = Route.useLoaderData();
	const params = useParams({ strict: false }) as { mapId?: string };
	const isRouterLoading = useRouterState({
		select: (state) => state.isLoading,
	});
	const currentPathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isAboutRoute = currentPathname === "/about";
	const isDocumentsRoute = currentPathname === "/documents";
	const isUpdatesRoute = currentPathname === "/updates";
	const navigationStartedRef = useRef(false);
	const [committedConfiguration, setCommittedConfiguration] =
		useState<PublicLayoutConfiguration>();
	const [pendingConfiguration, setPendingConfiguration] =
		useState<PublicLayoutConfiguration>();
	const setConfiguration = useCallback(
		(nextConfiguration?: PublicLayoutConfiguration) => {
			setCommittedConfiguration(nextConfiguration);
		},
		[],
	);
	const prepareMapNavigation = useCallback(
		(map: { id: string; name: string }, source: MapSelectionSource) => {
			captureAnalyticsEvent("map_selected", {
				map_id: map.id,
				source,
			});
			setPendingConfiguration({
				editorSearch: { map: map.id },
				headerMeta: "Loading…",
				sidebarPanel: (closePanel) => (
					<PendingMapSidebarPanel mapName={map.name} onBack={closePanel} />
				),
			});
		},
		[],
	);
	const currentMap = catalog.maps.find((map) => map.id === params.mapId);
	const pendingMapId = pendingConfiguration?.editorSearch?.map;
	const configuration = pendingConfiguration ?? committedConfiguration;

	useEffect(() => {
		if (isRouterLoading) {
			navigationStartedRef.current = true;
			return;
		}

		if (pendingMapId === currentMap?.id) {
			navigationStartedRef.current = false;
			setPendingConfiguration(undefined);
			return;
		}

		if (navigationStartedRef.current && pendingMapId) {
			navigationStartedRef.current = false;
			setPendingConfiguration(undefined);
		}
	}, [currentMap?.id, isRouterLoading, pendingMapId]);

	return (
		<PublicLayoutConfigurationProvider
			prepareMapNavigation={prepareMapNavigation}
			setConfiguration={setConfiguration}
		>
			<PublicShell
				catalog={catalog}
				currentMapId={currentMap?.id}
				editorSearch={{
					map: currentMap?.id,
					...configuration?.editorSearch,
				}}
				headerTitle={
					isAboutRoute
						? "About"
						: isDocumentsRoute
							? "Documents"
							: isUpdatesRoute
								? "Updates"
								: (currentMap?.name ?? "Overview")
				}
				headerMeta={configuration?.headerMeta}
				onMapNavigationStart={(map) => prepareMapNavigation(map, "sidebar")}
				sidebarPanel={configuration?.sidebarPanel}
			>
				<Outlet />
			</PublicShell>
		</PublicLayoutConfigurationProvider>
	);
}
