import { FileTextIcon, HouseIcon, MapTrifoldIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
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
	selectedDocumentIds: string[];
	currentMapId?: string;
	footer?: ReactNode;
	onMapNavigate?: (mapId: string) => void;
	onMapNavigationStart?: (map: { id: string; name: string }) => void;
	onOverviewNavigate?: () => void;
	onSelectedDocumentsChange: (documentIds: string[]) => void;
	sidebarPanel?: (closePanel: () => void) => ReactNode;
};

export function AppSidebar({
	maps,
	documents,
	selectedDocumentIds,
	currentMapId,
	footer,
	onMapNavigate,
	onMapNavigationStart,
	onOverviewNavigate,
	onSelectedDocumentsChange,
	sidebarPanel,
}: AppSidebarProps) {
	const { isMobile, setOpenMobile } = useSidebar();
	const hasSidebarPanel = Boolean(sidebarPanel);
	const [isSidebarPanelOpen, setIsSidebarPanelOpen] = useState(hasSidebarPanel);
	const filterableDocuments = documents.filter(
		(document) => document.isFilterable,
	);
	const selectedDocuments = new Set(selectedDocumentIds);
	const search = {
		documents: encodeDocumentFilters(selectedDocumentIds),
	};
	const visibleSidebarPanel = isSidebarPanelOpen ? sidebarPanel : undefined;

	useEffect(() => {
		if (hasSidebarPanel) {
			setIsSidebarPanelOpen(true);
		}
	}, [hasSidebarPanel]);

	function toggleDocument(documentId: string, checked: boolean) {
		const nextSelection = checked
			? [...selectedDocumentIds, documentId]
			: selectedDocumentIds.filter((id) => id !== documentId);

		onSelectedDocumentsChange(nextSelection);
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

			<div className="relative min-h-0 flex-1 overflow-hidden">
				<div
					inert={visibleSidebarPanel ? true : undefined}
					className={cn(
						"flex size-full flex-col transition-transform duration-150 ease-out motion-reduce:transition-none",
						visibleSidebarPanel && "-translate-x-6",
					)}
				>
					<SidebarContent>
						<SidebarGroup>
							<SidebarMenu>
								<SidebarMenuItem>
									<FieldSet className="gap-0">
										<FieldLegend className="mb-0 flex h-9 w-full items-center gap-2 px-3 font-medium text-sidebar-foreground text-sm normal-case tracking-normal">
											<FileTextIcon aria-hidden="true" className="size-4" />
											Documents
										</FieldLegend>
										<SidebarMenuSub>
											{filterableDocuments.map((document) => {
												const checked = selectedDocuments.has(document.id);

												return (
													<SidebarMenuSubItem key={document.id}>
														<label
															htmlFor={`document-filter-${document.id}`}
															className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sidebar-foreground text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:min-h-8"
														>
															<Checkbox
																id={`document-filter-${document.id}`}
																checked={checked}
																onCheckedChange={(nextChecked) =>
																	toggleDocument(document.id, nextChecked)
																}
															/>
															<span className="min-w-0 truncate">
																{document.name}
															</span>
														</label>
													</SidebarMenuSubItem>
												);
											})}
										</SidebarMenuSub>
									</FieldSet>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroup>

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
													onOverviewNavigate ? (
														<button
															type="button"
															onClick={() => {
																setIsSidebarPanelOpen(false);
																closeMobileSidebar();
																onOverviewNavigate();
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
												isActive={currentMapId === undefined}
												className="h-11 md:h-8"
											>
												<HouseIcon aria-hidden="true" />
												<span>Overview</span>
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
													className="h-11 md:h-8"
												>
													<span>{map.name}</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroup>
					</SidebarContent>
				</div>
				{visibleSidebarPanel ? (
					<div className="slide-in-from-right-8 absolute inset-0 flex animate-in flex-col bg-sidebar duration-150 will-change-transform motion-reduce:animate-none">
						{visibleSidebarPanel(() => setIsSidebarPanelOpen(false))}
					</div>
				) : null}
			</div>
			{footer ? (
				<SidebarFooter className="border-sidebar-border border-t">
					{footer}
				</SidebarFooter>
			) : null}
		</Sidebar>
	);
}
