import {
	createFileRoute,
	Outlet,
	useParams,
	useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PendingMapSidebarPanel } from "@/components/map/map-sidebar-panel";
import { PendingVerticalMapControls } from "@/components/map/vertical-map-controls";
import {
	type PublicLayoutConfiguration,
	PublicLayoutConfigurationProvider,
} from "@/components/public-layout-context";
import { PublicShell } from "@/components/public-shell";
import { RouteError } from "@/components/route-error";
import { getCatalog } from "@/functions/catalog";
import { setPublicLayoutMode } from "@/functions/layout-mode";
import {
	captureAnalyticsEvent,
	type MapSelectionSource,
} from "@/lib/analytics";
import { validateCatalogSearch } from "@/lib/catalog-search";
import type { LayoutMode } from "@/lib/layout-mode";

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
	const isContributeRoute = currentPathname === "/contribute";
	const isDocumentsRoute = currentPathname === "/documents";
	const isUpdatesRoute = currentPathname === "/updates";
	const navigationStartedRef = useRef(false);
	const [committedConfiguration, setCommittedConfiguration] =
		useState<PublicLayoutConfiguration>();
	const [pendingConfiguration, setPendingConfiguration] =
		useState<PublicLayoutConfiguration>();
	const [layoutMode, setLayoutMode] = useState<LayoutMode>(catalog.layoutMode);
	const [layoutModeError, setLayoutModeError] = useState<string>();
	const [layoutModePending, setLayoutModePending] = useState(false);
	const layoutModeRequestRef = useRef(0);
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
				verticalPanel: <PendingVerticalMapControls mapName={map.name} />,
			});
		},
		[],
	);
	const currentMap = catalog.maps.find((map) => map.id === params.mapId);
	const pendingMapId = pendingConfiguration?.editorSearch?.map;
	const configuration = pendingConfiguration ?? committedConfiguration;
	const changeLayoutMode = useCallback(
		(nextLayoutMode: LayoutMode) => {
			const previousLayoutMode = layoutMode;
			const requestId = layoutModeRequestRef.current + 1;
			layoutModeRequestRef.current = requestId;
			setLayoutMode(nextLayoutMode);
			setLayoutModeError(undefined);
			setLayoutModePending(true);

			void setPublicLayoutMode({ data: { layoutMode: nextLayoutMode } })
				.catch(() => {
					if (layoutModeRequestRef.current === requestId) {
						setLayoutMode(previousLayoutMode);
						setLayoutModeError("Could not save this preference. Try again.");
					}
				})
				.finally(() => {
					if (layoutModeRequestRef.current === requestId) {
						setLayoutModePending(false);
					}
				});
		},
		[layoutMode],
	);

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
			layoutMode={layoutMode}
			prepareMapNavigation={prepareMapNavigation}
			setConfiguration={setConfiguration}
		>
			<PublicShell
				catalog={catalog}
				currentMapId={currentMap?.id}
				layoutMode={layoutMode}
				layoutModeError={layoutModeError}
				layoutModePending={layoutModePending}
				editorSearch={{
					map: currentMap?.id,
					...configuration?.editorSearch,
				}}
				headerTitle={
					isAboutRoute
						? "About"
						: isContributeRoute
							? "Contribute"
							: isDocumentsRoute
								? "Documents"
								: isUpdatesRoute
									? "Updates"
									: (currentMap?.name ?? "Overview")
				}
				headerMeta={configuration?.headerMeta}
				onMapNavigationStart={(map) =>
					prepareMapNavigation(
						map,
						layoutMode === "vertical" ? "topbar" : "sidebar",
					)
				}
				onLayoutModeChange={changeLayoutMode}
				sidebarPanel={configuration?.sidebarPanel}
				verticalPanel={configuration?.verticalPanel}
			>
				<Outlet />
			</PublicShell>
		</PublicLayoutConfigurationProvider>
	);
}
