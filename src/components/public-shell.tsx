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

type PublicShellProps = {
	catalog: {
		maps: ReadonlyArray<{ id: string; name: string }>;
		documents: ReadonlyArray<{
			id: string;
			name: string;
			isFilterable: boolean;
		}>;
		editorAvailable: boolean;
	};
	selectedDocumentIds: string[];
	currentMapId?: string;
	editorSearch?: {
		documents?: string;
		image?: string;
		location?: string;
		map?: string;
	};
	headerTitle: string;
	headerMeta?: string;
	onMapNavigate?: (mapId: string) => void;
	onMapNavigationStart?: (map: { id: string; name: string }) => void;
	onOverviewNavigate?: () => void;
	onSelectedDocumentsChange: (documentIds: string[]) => void;
	sidebarFooter?: ReactNode;
	sidebarPanel?: (closePanel: () => void) => ReactNode;
	children: ReactNode;
};

export function PublicShell({
	catalog,
	selectedDocumentIds,
	currentMapId,
	editorSearch,
	headerTitle,
	headerMeta,
	onMapNavigate,
	onMapNavigationStart,
	onOverviewNavigate,
	onSelectedDocumentsChange,
	sidebarFooter,
	sidebarPanel,
	children,
}: PublicShellProps) {
	return (
		<SidebarProvider
			open
			className="isolate h-svh overflow-hidden"
			style={{ "--sidebar-width": "21.875rem" } as CSSProperties}
		>
			<AppSidebar
				maps={catalog.maps}
				documents={catalog.documents}
				selectedDocumentIds={selectedDocumentIds}
				currentMapId={currentMapId}
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
				onOverviewNavigate={onOverviewNavigate}
				onSelectedDocumentsChange={onSelectedDocumentsChange}
				sidebarPanel={sidebarPanel}
			/>
			<SidebarInset className="min-h-0 min-w-0 overflow-hidden">
				<header className="flex h-14 shrink-0 items-center gap-3 border-border border-b bg-card px-4 sm:px-6">
					<SidebarTrigger className="md:hidden" />
					<Separator orientation="vertical" className="h-4 md:hidden" />
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
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
