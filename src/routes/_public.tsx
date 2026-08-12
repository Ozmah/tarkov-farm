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
import { getCatalog } from "@/functions/catalog";
import {
	encodeDocumentFilters,
	readSelectedDocumentIds,
	validateCatalogSearch,
} from "@/lib/catalog-search";

export const Route = createFileRoute("/_public")({
	validateSearch: validateCatalogSearch,
	loader: () => getCatalog(),
	staleTime: 30_000,
	preloadStaleTime: 30_000,
	component: PublicLayout,
});

function PublicLayout() {
	const catalog = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const params = useParams({ strict: false }) as { mapId?: string };
	const isRouterLoading = useRouterState({
		select: (state) => state.isLoading,
	});
	const currentPathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isAboutRoute = currentPathname === "/about";
	const isUpdatesRoute = currentPathname === "/updates";
	const navigationStartedRef = useRef(false);
	const [pendingMapId, setPendingMapId] = useState<string>();
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
		(map: { id: string; name: string }) => {
			setPendingMapId(map.id);
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
	const filterableDocumentIds = new Set(
		catalog.documents
			.filter((document) => document.isFilterable)
			.map((document) => document.id),
	);
	const selectedDocumentIds = readSelectedDocumentIds(search.documents).filter(
		(documentId) => filterableDocumentIds.has(documentId),
	);
	const currentMap = catalog.maps.find((map) => map.id === params.mapId);
	const configuration = pendingConfiguration ?? committedConfiguration;

	useEffect(() => {
		if (isRouterLoading) {
			navigationStartedRef.current = true;
			return;
		}

		if (pendingMapId === currentMap?.id) {
			navigationStartedRef.current = false;
			setPendingMapId(undefined);
			setPendingConfiguration(undefined);
			return;
		}

		if (navigationStartedRef.current && pendingMapId) {
			navigationStartedRef.current = false;
			setPendingMapId(undefined);
			setPendingConfiguration(undefined);
		}
	}, [currentMap?.id, isRouterLoading, pendingMapId]);

	function updateSelectedDocuments(documentIds: string[]) {
		const nextSearch = {
			...search,
			documents: encodeDocumentFilters(documentIds),
			location: undefined,
		};

		if (currentMap) {
			void navigate({
				to: "/maps/$mapId",
				params: { mapId: currentMap.id },
				search: nextSearch,
				replace: true,
			});
			return;
		}

		void navigate({
			to: isAboutRoute ? "/about" : isUpdatesRoute ? "/updates" : "/",
			search: nextSearch,
			replace: true,
		});
	}

	return (
		<PublicLayoutConfigurationProvider
			prepareMapNavigation={prepareMapNavigation}
			setConfiguration={setConfiguration}
		>
			<PublicShell
				catalog={catalog}
				selectedDocumentIds={selectedDocumentIds}
				currentMapId={currentMap?.id}
				currentMapImageId={configuration?.currentMapImageId}
				editorSearch={{
					documents: encodeDocumentFilters(selectedDocumentIds),
					map: currentMap?.id,
					...configuration?.editorSearch,
				}}
				headerTitle={
					isAboutRoute
						? "About"
						: isUpdatesRoute
							? "Updates"
							: (currentMap?.name ?? "Kord Breach Season Home")
				}
				headerMeta={configuration?.headerMeta}
				onMapNavigationStart={prepareMapNavigation}
				onSelectedDocumentsChange={updateSelectedDocuments}
				sidebarPanel={configuration?.sidebarPanel}
			>
				<Outlet />
			</PublicShell>
		</PublicLayoutConfigurationProvider>
	);
}
