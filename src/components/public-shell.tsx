import { PencilSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { VerticalAppBar } from "@/components/vertical-app-bar";
import type { LayoutMode } from "@/lib/layout-mode";

type PublicShellProps = {
	catalog: {
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
		editorAvailable: boolean;
	};
	currentMapId?: string;
	editorSearch?: {
		documents?: string;
		image?: string;
		location?: string;
		map?: string;
	};
	headerTitle: string;
	headerMeta?: string;
	layoutMode?: LayoutMode;
	layoutModeError?: string;
	layoutModePending?: boolean;
	onMapNavigate?: (mapId: string) => void;
	onMapNavigationStart?: (map: { id: string; name: string }) => void;
	onHomeNavigate?: () => void;
	onLayoutModeChange?: (layoutMode: LayoutMode) => void;
	sidebarFooter?: ReactNode;
	sidebarPanel?: (closePanel: () => void) => ReactNode;
	verticalPanel?: ReactNode;
	children: ReactNode;
};

export function PublicShell({
	catalog,
	currentMapId,
	editorSearch,
	headerTitle,
	headerMeta,
	layoutMode,
	layoutModeError,
	layoutModePending,
	onMapNavigate,
	onMapNavigationStart,
	onHomeNavigate,
	onLayoutModeChange,
	sidebarFooter,
	sidebarPanel,
	verticalPanel,
	children,
}: PublicShellProps) {
	return (
		<SidebarProvider
			open
			className="isolate h-svh overflow-hidden"
			style={{ "--sidebar-width": "21.875rem" } as CSSProperties}
		>
			<a
				href="#main-content"
				className="fixed top-3 left-3 z-50 -translate-y-20 bg-primary px-4 py-3 font-semibold text-primary-foreground text-xs uppercase tracking-widest outline-none transition-transform focus:translate-y-0 focus:ring-2 focus:ring-ring"
			>
				Skip to content
			</a>
			{layoutMode !== "vertical" ? (
				<AppSidebar
					maps={catalog.maps}
					documents={catalog.documents}
					documentMaps={catalog.documentMaps}
					currentMapId={currentMapId}
					layoutMode={layoutMode}
					layoutModeError={layoutModeError}
					layoutModePending={layoutModePending}
					footer={
						sidebarFooter ??
						(catalog.editorAvailable ? (
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link
												to="/editor"
												search={editorSearch ?? { map: currentMapId }}
											/>
										}
									>
										<PencilSimpleIcon aria-hidden="true" />
										<span>Open editor</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						) : undefined)
					}
					onMapNavigate={onMapNavigate}
					onMapNavigationStart={onMapNavigationStart}
					onHomeNavigate={onHomeNavigate}
					onLayoutModeChange={onLayoutModeChange}
					sidebarPanel={sidebarPanel}
				/>
			) : null}
			<SidebarInset
				id="main-content"
				tabIndex={-1}
				className="min-h-0 min-w-0 overflow-hidden outline-none"
			>
				{layoutMode === "vertical" && onLayoutModeChange ? (
					<>
						<VerticalAppBar
							catalog={catalog}
							currentMapId={currentMapId}
							editorSearch={editorSearch}
							headerTitle={headerTitle}
							headerMeta={headerMeta}
							layoutMode={layoutMode}
							layoutModeError={layoutModeError}
							layoutModePending={layoutModePending}
							onLayoutModeChange={onLayoutModeChange}
							onMapNavigationStart={onMapNavigationStart}
						/>
						{verticalPanel}
					</>
				) : (
					<header className="flex h-14 shrink-0 items-center gap-3 border-border border-b bg-card px-4 sm:px-6 lg:px-3">
						<SidebarTrigger className="lg:hidden" />
						<Separator orientation="vertical" className="h-4 lg:hidden" />
						<p className="truncate font-heading text-primary text-sm uppercase tracking-wide">
							{headerTitle}
						</p>
						{headerMeta ? (
							<p
								aria-live="polite"
								className="ml-auto shrink-0 text-muted-foreground text-sm tabular-nums"
							>
								{headerMeta}
							</p>
						) : null}
					</header>
				)}
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
