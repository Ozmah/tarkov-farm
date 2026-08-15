import {
	HouseIcon,
	InfoIcon,
	MapTrifoldIcon,
	NewspaperClippingIcon,
} from "@phosphor-icons/react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

import { DocumentFilter } from "@/components/document-filter";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { encodeDocumentFilters } from "@/lib/catalog-search";
import { isPlainNavigationClick } from "@/lib/navigation-intent";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
	maps: ReadonlyArray<{ id: string; name: string }>;
	documents: ReadonlyArray<{
		id: string;
		name: string;
		isFilterable: boolean;
	}>;
	documentLocations: ReadonlyArray<{
		documentId: string;
		mapId: string;
		mapImageId: string;
	}>;
	selectedDocumentIds: string[];
	currentMapId?: string;
	currentMapImageId?: string;
	footer?: ReactNode;
	onMapNavigate?: (mapId: string) => void;
	onMapNavigationStart?: (map: { id: string; name: string }) => void;
	onHomeNavigate?: () => void;
	onSelectedDocumentsChange: (documentIds: string[]) => void;
	sidebarPanel?: (closePanel: () => void) => ReactNode;
};

export function AppSidebar({
	maps,
	documents,
	documentLocations,
	selectedDocumentIds,
	currentMapId,
	currentMapImageId,
	footer,
	onMapNavigate,
	onMapNavigationStart,
	onHomeNavigate,
	onSelectedDocumentsChange,
	sidebarPanel,
}: AppSidebarProps) {
	const { isMobile, setOpenMobile } = useSidebar();
	const matchRoute = useMatchRoute();
	const hasSidebarPanel = Boolean(sidebarPanel);
	const isAboutRoute = Boolean(matchRoute({ to: "/about", fuzzy: false }));
	const isHomeRoute = Boolean(matchRoute({ to: "/", fuzzy: false }));
	const isUpdatesRoute = Boolean(matchRoute({ to: "/updates", fuzzy: false }));
	const [isSidebarPanelOpen, setIsSidebarPanelOpen] = useState(hasSidebarPanel);
	const search = {
		documents: encodeDocumentFilters(selectedDocumentIds),
	};
	const visibleSidebarPanel = isSidebarPanelOpen ? sidebarPanel : undefined;

	useEffect(() => {
		if (hasSidebarPanel) {
			setIsSidebarPanelOpen(true);
		}
	}, [hasSidebarPanel]);

	function closeMobileSidebar() {
		if (isMobile) {
			setOpenMobile(false);
		}
	}

	function navigateToMap(mapId: string) {
		setIsSidebarPanelOpen(true);
		closeMobileSidebar();
		onMapNavigationStart?.(
			maps.find((map) => map.id === mapId) ?? {
				id: mapId,
				name: "Selected map",
			},
		);
		onMapNavigate?.(mapId);
	}

	return (
		<Sidebar collapsible="offcanvas">
			<SidebarHeader className="border-sidebar-border border-b p-5">
				<Link
					to="/"
					search={search}
					onClick={closeMobileSidebar}
					aria-label="Tarkov Season Documents homepage"
					className="flex min-w-0 flex-col gap-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
				>
					<span className="font-heading font-semibold text-base text-sidebar-primary uppercase tracking-wide">
						Tarkov
					</span>
					<span className="text-sidebar-foreground/75 text-sm">
						Season Documents
					</span>
				</Link>
			</SidebarHeader>
			{isAboutRoute || isUpdatesRoute ? null : (
				<DocumentFilter
					currentMapId={currentMapId}
					currentMapImageId={currentMapImageId}
					documents={documents}
					documentLocations={documentLocations}
					selectedDocumentIds={selectedDocumentIds}
					onSelectedDocumentsChange={onSelectedDocumentsChange}
				/>
			)}

			<div className="relative min-h-0 flex-1 overflow-hidden">
				<div
					inert={visibleSidebarPanel ? true : undefined}
					className={cn(
						"flex size-full flex-col transition-transform duration-150 ease-out motion-reduce:transition-none",
						visibleSidebarPanel && "-translate-x-6",
					)}
				>
					<SidebarContent>
						<nav aria-label="Map navigation">
							<SidebarGroup>
								<SidebarMenu>
									<SidebarMenuItem>
										<div className="flex h-9 items-center gap-2 px-3 font-medium text-sm">
											<MapTrifoldIcon aria-hidden="true" className="size-4" />
											<span>Maps</span>
										</div>
										<SidebarMenuSub>
											<SidebarMenuSubItem>
												<SidebarMenuSubButton
													render={
														onHomeNavigate ? (
															<button
																type="button"
																onClick={() => {
																	setIsSidebarPanelOpen(false);
																	closeMobileSidebar();
																	onHomeNavigate();
																}}
															/>
														) : (
															<Link
																to="/"
																search={search}
																onClick={closeMobileSidebar}
															/>
														)
													}
													isActive={isHomeRoute && currentMapId === undefined}
													aria-current={
														isHomeRoute && currentMapId === undefined
															? "page"
															: undefined
													}
													className="h-11 border-transparent border-l data-active:border-sidebar-primary lg:h-8"
												>
													<HouseIcon aria-hidden="true" />
													<span>Home</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
											{maps.map((map) => (
												<SidebarMenuSubItem key={map.id}>
													<SidebarMenuSubButton
														render={
															onMapNavigate ? (
																<button
																	type="button"
																	onClick={() => navigateToMap(map.id)}
																/>
															) : (
																<Link
																	to="/maps/$mapId"
																	params={{ mapId: map.id }}
																	search={search}
																	onClick={(event) => {
																		if (!isPlainNavigationClick(event)) {
																			return;
																		}

																		setIsSidebarPanelOpen(true);
																		if (map.id !== currentMapId) {
																			onMapNavigationStart?.(map);
																		}
																		closeMobileSidebar();
																	}}
																/>
															)
														}
														isActive={currentMapId === map.id}
														aria-current={
															currentMapId === map.id ? "page" : undefined
														}
														className="h-11 border-transparent border-l data-active:border-sidebar-primary lg:h-8"
													>
														<span>{map.name}</span>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroup>
						</nav>
					</SidebarContent>
				</div>
				{visibleSidebarPanel ? (
					<div className="slide-in-from-right-8 absolute inset-0 flex animate-in flex-col bg-sidebar duration-150 will-change-transform motion-reduce:animate-none">
						{visibleSidebarPanel(() => setIsSidebarPanelOpen(false))}
					</div>
				) : null}
			</div>
			<SidebarFooter className="border-sidebar-border border-t">
				<nav aria-label="Project navigation" className="flex flex-col gap-2">
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										to="/updates"
										search={search}
										onClick={() => {
											setIsSidebarPanelOpen(false);
											closeMobileSidebar();
										}}
									/>
								}
								isActive={isUpdatesRoute}
								aria-current={isUpdatesRoute ? "page" : undefined}
								className="border-transparent border-l data-active:border-sidebar-primary"
							>
								<NewspaperClippingIcon aria-hidden="true" />
								<span>Updates</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										to="/about"
										search={search}
										onClick={() => {
											setIsSidebarPanelOpen(false);
											closeMobileSidebar();
										}}
									/>
								}
								isActive={isAboutRoute}
								aria-current={isAboutRoute ? "page" : undefined}
								className="border-transparent border-l data-active:border-sidebar-primary"
							>
								<InfoIcon aria-hidden="true" />
								<span>About</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
					{footer}
				</nav>
			</SidebarFooter>
		</Sidebar>
	);
}
