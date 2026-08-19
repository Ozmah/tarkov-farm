import {
	ArrowSquareOutIcon,
	CaretDownIcon,
	FileTextIcon,
	HandHeartIcon,
	HouseIcon,
	InfoIcon,
	MapTrifoldIcon,
	NewspaperClippingIcon,
	PencilSimpleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { LayoutModeToggle } from "@/components/layout-mode-toggle";
import { TarkovFarmLogo } from "@/components/tarkov-farm-logo";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { buildProblemIssueUrl } from "@/lib/github-links";
import type { LayoutMode } from "@/lib/layout-mode";
import { isPlainNavigationClick } from "@/lib/navigation-intent";

type VerticalAppBarProps = {
	catalog: {
		editorAvailable: boolean;
		maps: ReadonlyArray<{ id: string; name: string }>;
	};
	currentMapId?: string;
	editorSearch?: {
		documents?: string;
		image?: string;
		location?: string;
		map?: string;
	};
	headerMeta?: string;
	headerTitle: string;
	layoutMode: LayoutMode;
	layoutModeError?: string;
	layoutModePending?: boolean;
	onLayoutModeChange: (layoutMode: LayoutMode) => void;
	onMapNavigationStart?: (map: { id: string; name: string }) => void;
};

const projectLinks = [
	{ icon: FileTextIcon, label: "Documents", to: "/documents" },
	{ icon: NewspaperClippingIcon, label: "Updates", to: "/updates" },
	{ icon: InfoIcon, label: "About", to: "/about" },
	{ icon: HandHeartIcon, label: "Want to help?", to: "/contribute" },
] as const;

export function VerticalAppBar({
	catalog,
	currentMapId,
	editorSearch,
	headerMeta,
	headerTitle,
	layoutMode,
	layoutModeError,
	layoutModePending,
	onLayoutModeChange,
	onMapNavigationStart,
}: VerticalAppBarProps) {
	const [navigationOpen, setNavigationOpen] = useState(false);
	const currentHref = useRouterState({
		select: (state) => state.location.href,
	});
	const currentMap = currentMapId
		? catalog.maps.find((map) => map.id === currentMapId)
		: undefined;
	const problemIssueUrl = buildProblemIssueUrl({
		currentHref,
		mapName: currentMap?.name,
	});

	return (
		<header className="flex min-h-16 shrink-0 items-center gap-3 border-sidebar-border border-b bg-sidebar px-3 text-sidebar-foreground sm:px-5">
			<Link
				to="/"
				search={{}}
				aria-label="Tarkov Farm Season Docs homepage"
				className="flex shrink-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
			>
				<TarkovFarmLogo className="size-8" />
				<span className="hidden items-baseline gap-1.5 lg:flex">
					<span className="font-heading font-semibold text-sidebar-primary text-sm uppercase tracking-wide">
						Tarkov Farm
					</span>
					<span className="text-sidebar-foreground/70 text-xs">
						Season Docs
					</span>
				</span>
			</Link>

			<div className="h-5 w-px shrink-0 bg-sidebar-border" aria-hidden="true" />
			<div className="min-w-0 flex-1">
				<p className="truncate font-heading text-sidebar-primary text-sm uppercase tracking-wide">
					{headerTitle}
				</p>
				{headerMeta ? (
					<p
						aria-live="polite"
						className="truncate text-sidebar-foreground/65 text-xs tabular-nums"
					>
						{headerMeta}
					</p>
				) : null}
			</div>

			<Popover open={navigationOpen} onOpenChange={setNavigationOpen}>
				<PopoverTrigger
					render={
						<Button
							variant="ghost"
							size="sm"
							className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground"
						/>
					}
				>
					<MapTrifoldIcon data-icon="inline-start" aria-hidden="true" />
					<span className="hidden sm:inline">Navigate</span>
					<CaretDownIcon data-icon="inline-end" aria-hidden="true" />
				</PopoverTrigger>
				<PopoverContent
					side="bottom"
					align="end"
					className="flex max-h-[min(42rem,calc(100dvh-5rem))] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden"
				>
					<div className="border-border border-b p-4">
						<PopoverTitle className="font-heading font-medium">
							Explore Tarkov Farm
						</PopoverTitle>
						<PopoverDescription className="mt-1 text-muted-foreground text-sm">
							Maps, season documents, and project information.
						</PopoverDescription>
					</div>
					<nav
						aria-label="Vertical mode navigation"
						className="overflow-auto p-2"
					>
						<p className="px-3 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
							Maps
						</p>
						<NavLink
							icon={HouseIcon}
							label="Home"
							to="/"
							onNavigate={() => setNavigationOpen(false)}
						/>
						{catalog.maps.map((map) => (
							<NavLink
								key={map.id}
								icon={MapTrifoldIcon}
								label={map.name}
								to="/maps/$mapId"
								params={{ mapId: map.id }}
								isCurrent={map.id === currentMapId}
								onNavigate={(event) => {
									setNavigationOpen(false);
									if (
										map.id !== currentMapId &&
										isPlainNavigationClick(event)
									) {
										onMapNavigationStart?.(map);
									}
								}}
							/>
						))}

						<p className="mt-2 border-border border-t px-3 pt-4 pb-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
							Project
						</p>
						{projectLinks.map((link) => (
							<NavLink
								key={link.to}
								icon={link.icon}
								label={link.label}
								to={link.to}
								search={link.to === "/contribute" ? { map: currentMapId } : {}}
								onNavigate={() => setNavigationOpen(false)}
							/>
						))}
						<a
							href={problemIssueUrl}
							target="_blank"
							rel="noreferrer"
							className="flex min-h-11 items-center gap-3 px-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
						>
							<WarningCircleIcon aria-hidden="true" className="size-4" />
							<span className="min-w-0 flex-1">Something wrong?</span>
							<ArrowSquareOutIcon
								aria-hidden="true"
								className="size-3 text-muted-foreground"
							/>
						</a>
						{catalog.editorAvailable ? (
							<NavLink
								icon={PencilSimpleIcon}
								label="Open editor"
								to="/editor"
								search={editorSearch ?? { map: currentMapId }}
								onNavigate={() => setNavigationOpen(false)}
							/>
						) : null}
					</nav>
					<div className="border-border border-t p-3 md:hidden">
						<LayoutModeToggle
							id="navigation-vertical-mode"
							layoutMode={layoutMode}
							disabled={layoutModePending}
							error={layoutModeError}
							onLayoutModeChange={onLayoutModeChange}
						/>
					</div>
				</PopoverContent>
			</Popover>

			<LayoutModeToggle
				id="topbar-vertical-mode"
				layoutMode={layoutMode}
				disabled={layoutModePending}
				error={layoutModeError}
				onLayoutModeChange={onLayoutModeChange}
				surface="sidebar"
				className="hidden md:flex"
			/>
		</header>
	);
}

type NavLinkProps = {
	icon: React.ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
	isCurrent?: boolean;
	label: string;
	onNavigate: (event: React.MouseEvent<HTMLAnchorElement>) => void;
	params?: { mapId: string };
	search?: {
		documents?: string;
		image?: string;
		location?: string;
		map?: string;
	};
	to:
		| "/"
		| "/about"
		| "/contribute"
		| "/documents"
		| "/editor"
		| "/maps/$mapId"
		| "/updates";
};

function NavLink({
	icon: Icon,
	isCurrent,
	label,
	onNavigate,
	params,
	search = {},
	to,
}: NavLinkProps) {
	return (
		<Link
			to={to}
			params={params}
			search={search}
			onClick={onNavigate}
			aria-current={isCurrent ? "page" : undefined}
			className="flex min-h-11 items-center gap-3 border-transparent border-l-2 px-3 text-sm outline-none hover:border-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-primary aria-[current=page]:bg-muted"
		>
			<Icon aria-hidden={true} className="size-4" />
			<span className="truncate">{label}</span>
		</Link>
	);
}
