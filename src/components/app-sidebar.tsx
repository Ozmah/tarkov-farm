import {
	ArrowSquareOutIcon,
	FileTextIcon,
	HandHeartIcon,
	HouseIcon,
	InfoIcon,
	MapTrifoldIcon,
	NewspaperClippingIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { Link, useMatchRoute, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { LayoutModeToggle } from "@/components/layout-mode-toggle";
import { TarkovFarmLogo } from "@/components/tarkov-farm-logo";
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
import { getDocumentShortName } from "@/lib/document-display";
import { buildProblemIssueUrl } from "@/lib/github-links";
import type { LayoutMode } from "@/lib/layout-mode";
import { isPlainNavigationClick } from "@/lib/navigation-intent";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
	maps: ReadonlyArray<{ id: string; name: string }>;
	documents: ReadonlyArray<{
		id: string;
		name: string;
		isFilterable: boolean;
	}>;
	documentMaps: ReadonlyArray<{
		documentId: string;
		mapId: string;
	}>;
	currentMapId?: string;
	footerAddon?: ReactNode;
	footerNavigation?: ReactNode;
	footerNavigationLabel?: string;
	layoutMode?: LayoutMode;
	layoutModeError?: string;
	layoutModePending?: boolean;
	onLayoutModeChange?: (layoutMode: LayoutMode) => void;
	onMapNavigate?: (mapId: string) => void;
	onMapNavigationStart?: (map: { id: string; name: string }) => void;
	onHomeNavigate?: () => void;
	sidebarPanel?: (closePanel: () => void) => ReactNode;
};

export function AppSidebar({
	maps,
	documents,
	documentMaps,
	currentMapId,
	footerAddon,
	footerNavigation,
	footerNavigationLabel = "Project navigation",
	layoutMode,
	layoutModeError,
	layoutModePending,
	onLayoutModeChange,
	onMapNavigate,
	onMapNavigationStart,
	onHomeNavigate,
	sidebarPanel,
}: AppSidebarProps) {
	const { isMobile, setOpenMobile } = useSidebar();
	const matchRoute = useMatchRoute();
	const currentHref = useRouterState({
		select: (state) => state.location.href,
	});
	const hasSidebarPanel = Boolean(sidebarPanel);
	const hasFooterNavigation = footerNavigation !== undefined;
	const isAboutRoute = Boolean(matchRoute({ to: "/about", fuzzy: false }));
	const isContributeRoute = Boolean(
		matchRoute({ to: "/contribute", fuzzy: false }),
	);
	const isDocumentsRoute = Boolean(
		matchRoute({ to: "/documents", fuzzy: false }),
	);
	const isHomeRoute = Boolean(matchRoute({ to: "/", fuzzy: false }));
	const isUpdatesRoute = Boolean(matchRoute({ to: "/updates", fuzzy: false }));
	const [previousHasSidebarPanel, setPreviousHasSidebarPanel] =
		useState(hasSidebarPanel);
	const [isSidebarPanelOpen, setIsSidebarPanelOpen] = useState(hasSidebarPanel);

	if (hasSidebarPanel !== previousHasSidebarPanel) {
		setPreviousHasSidebarPanel(hasSidebarPanel);

		if (hasSidebarPanel) {
			setIsSidebarPanelOpen(true);
		}
	}

	const visibleSidebarPanel = isSidebarPanelOpen ? sidebarPanel : undefined;
	const currentMap = currentMapId
		? maps.find((map) => map.id === currentMapId)
		: undefined;
	const problemIssueUrl = buildProblemIssueUrl({
		currentHref,
		mapName: currentMap?.name,
	});
	const documentIdsByMap = new Map<string, Set<string>>();

	for (const assignment of documentMaps) {
		const documentIds = documentIdsByMap.get(assignment.mapId) ?? new Set();
		documentIds.add(assignment.documentId);
		documentIdsByMap.set(assignment.mapId, documentIds);
	}

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
			<SidebarHeader className="h-14 shrink-0 justify-center border-sidebar-border border-b px-5 py-0 pr-14 lg:pr-5">
				<Link
					to="/"
					search={{}}
					onClick={closeMobileSidebar}
					aria-label="Tarkov Farm Season Docs homepage"
					className="flex min-w-0 items-center gap-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
				>
					<TarkovFarmLogo className="size-8" />
					<span className="flex min-w-0 items-baseline gap-[var(--inline-context-gap)]">
						<span className="font-heading font-semibold text-sidebar-primary text-sm uppercase tracking-wide">
							Tarkov Farm
						</span>
						<span className="truncate text-sidebar-foreground/75 text-xs">
							Season Docs
						</span>
					</span>
				</Link>
			</SidebarHeader>
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
																search={{}}
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
											{maps.map((map) => {
												const assignedDocumentIds =
													documentIdsByMap.get(map.id) ?? new Set();
												const mapDocumentNames = documents
													.filter(
														(document) =>
															document.isFilterable &&
															assignedDocumentIds.has(document.id),
													)
													.map(getDocumentShortName);

												return (
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
																		search={{}}
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
															className="min-h-12 border-transparent border-l py-1.5 data-active:border-sidebar-primary"
														>
															<span className="min-w-0 flex-1">
																<span className="block truncate">
																	{map.name}
																</span>
																<span className="block truncate text-sidebar-foreground/60 text-xs">
																	{mapDocumentNames.join(", ")}
																</span>
															</span>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												);
											})}
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
				<nav
					aria-label={
						hasFooterNavigation ? footerNavigationLabel : "Project navigation"
					}
					className="flex flex-col gap-2"
				>
					{hasFooterNavigation ? (
						footerNavigation
					) : (
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link
											to="/documents"
											search={{}}
											onClick={() => {
												setIsSidebarPanelOpen(false);
												closeMobileSidebar();
											}}
										/>
									}
									isActive={isDocumentsRoute}
									aria-current={isDocumentsRoute ? "page" : undefined}
									className="border-transparent border-l data-active:border-sidebar-primary"
								>
									<FileTextIcon aria-hidden="true" />
									<span>Documents</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link
											to="/updates"
											search={{}}
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
											search={{}}
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
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<a
											href={problemIssueUrl}
											target="_blank"
											rel="noreferrer"
											onClick={closeMobileSidebar}
										/>
									}
								>
									<WarningCircleIcon aria-hidden="true" />
									<span>Something wrong?</span>
									<ArrowSquareOutIcon
										aria-hidden="true"
										className="ml-auto size-3! text-sidebar-foreground/60"
									/>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link
											to="/contribute"
											search={{ map: currentMapId }}
											onClick={() => {
												setIsSidebarPanelOpen(false);
												closeMobileSidebar();
											}}
										/>
									}
									isActive={isContributeRoute}
									aria-current={isContributeRoute ? "page" : undefined}
									className="border-transparent border-l data-active:border-sidebar-primary"
								>
									<HandHeartIcon aria-hidden="true" />
									<span>Want to help?</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					)}
					{hasFooterNavigation ? null : footerAddon}
				</nav>
				{layoutMode && onLayoutModeChange ? (
					<LayoutModeToggle
						id="sidebar-vertical-mode"
						layoutMode={layoutMode}
						disabled={layoutModePending}
						error={layoutModeError}
						onLayoutModeChange={onLayoutModeChange}
						surface="sidebar"
						className="px-3"
					/>
				) : null}
			</SidebarFooter>
		</Sidebar>
	);
}
