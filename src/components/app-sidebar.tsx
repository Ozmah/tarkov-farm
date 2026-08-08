import {
	CaretRightIcon,
	FileTextIcon,
	FunnelSimpleIcon,
	MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type AppSidebarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	documents: ReadonlyArray<{
		id: string;
		name: string;
		isFilterable: boolean;
	}>;
};

export function AppSidebar({
	query,
	onQueryChange,
	documents,
}: AppSidebarProps) {
	return (
		<Sidebar>
			<SidebarHeader className="border-sidebar-border border-b p-5">
				<Link
					to="/"
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

			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						<Collapsible defaultOpen className="group/collapsible">
							<SidebarMenuItem>
								<CollapsibleTrigger
									render={<SidebarMenuButton tooltip="Documents" />}
								>
									<FileTextIcon />
									<span>Documents</span>
									<CaretRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90 motion-reduce:transition-none" />
								</CollapsibleTrigger>
								<CollapsibleContent>
									<SidebarMenuSub>
										{documents.map((document) => (
											<SidebarMenuSubItem key={document.id}>
												<p
													className="min-w-0 px-3 py-1.5 text-sidebar-foreground/80 text-sm"
													title={
														document.isFilterable
															? undefined
															: "Expansion Hub item; excluded from map filters"
													}
												>
													{document.name}
												</p>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</CollapsibleContent>
							</SidebarMenuItem>
						</Collapsible>
					</SidebarMenu>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>
						<FunnelSimpleIcon />
						Map filter
					</SidebarGroupLabel>
					<SidebarGroupContent className="relative px-3">
						<label htmlFor="map-search" className="sr-only">
							Search maps
						</label>
						<MagnifyingGlassIcon
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/50"
						/>
						<SidebarInput
							id="map-search"
							name="map-search"
							type="search"
							value={query}
							onChange={(event) => onQueryChange(event.target.value)}
							placeholder="Search maps"
							autoComplete="off"
							className="pl-7"
						/>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
