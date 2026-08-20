import {
	ArrowLeftIcon,
	ArrowSquareOutIcon,
	CaretRightIcon,
	FileTextIcon,
	HandHeartIcon,
	HouseIcon,
	InfoIcon,
	ListIcon,
	MapTrifoldIcon,
	NewspaperClippingIcon,
	PencilSimpleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";

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
import { SUBMAP_LINKS } from "@/lib/submap-links";
import { cn } from "@/lib/utils";

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
	locationsControl?: ReactNode;
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
	locationsControl,
}: VerticalAppBarProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuView, setMenuView] = useState<"main" | "maps">("main");
	const currentHref = useRouterState({
		select: (state) => state.location.href,
	});
	const currentViewKey = useRouterState({
		select: (state) => {
			const view = (state.location.search as { view?: unknown }).view;
			return typeof view === "string" ? view : "main";
		},
	});
	const currentMap = currentMapId
		? catalog.maps.find((map) => map.id === currentMapId)
		: undefined;
	const problemIssueUrl = buildProblemIssueUrl({
		currentHref,
		mapName: currentMap?.name,
	});
	const closeMenu = () => {
		setMenuOpen(false);
		setMenuView("main");
	};
	const changeMenuOpen = (open: boolean) => {
		setMenuOpen(open);
		if (!open) setMenuView("main");
	};

	return (
		<header className="flex min-h-16 shrink-0 items-center gap-3 border-sidebar-border border-b bg-sidebar px-3 text-sidebar-foreground sm:px-5">
			<Link
				to="/"
				search={{}}
				aria-label="Tarkov Farm Season Docs homepage"
				className="flex shrink-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
			>
				<TarkovFarmLogo className="size-8" />
				<span className="hidden items-baseline gap-[var(--inline-context-gap)] lg:flex">
					<span className="font-heading font-semibold text-sidebar-primary text-sm uppercase tracking-wide">
						Tarkov Farm
					</span>
					<span className="text-sidebar-foreground/70 text-xs">
						Season Docs
					</span>
				</span>
			</Link>

			<div className="h-5 w-px shrink-0 bg-sidebar-border" aria-hidden="true" />
			<div className="flex min-w-0 flex-1 items-baseline justify-start gap-[var(--inline-context-gap)]">
				<span className="truncate font-heading text-sidebar-primary text-sm uppercase tracking-wide">
					{headerTitle}
				</span>
				{headerMeta ? (
					<span
						aria-live="polite"
						className="truncate text-sidebar-foreground/65 text-xs tabular-nums"
					>
						{headerMeta}
					</span>
				) : null}
			</div>

			<LayoutModeToggle
				id="topbar-vertical-mode"
				compact
				layoutMode={layoutMode}
				disabled={layoutModePending}
				error={layoutModeError}
				onLayoutModeChange={onLayoutModeChange}
				surface="sidebar"
			/>

			{locationsControl}

			<Popover open={menuOpen} onOpenChange={changeMenuOpen}>
				<PopoverTrigger
					render={
						<Button
							variant="ghost"
							size="sm"
							aria-label="Open menu"
							className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground"
						/>
					}
				>
					<ListIcon data-icon="inline-start" aria-hidden="true" />
					<span className="hidden sm:inline">Menu</span>
				</PopoverTrigger>
				<PopoverContent
					side="bottom"
					align="end"
					className="flex max-h-[min(42rem,calc(100dvh-5rem))] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden"
				>
					{menuView === "maps" ? (
						<>
							<div className="flex items-start gap-2 border-border border-b p-4">
								<Button
									autoFocus
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label="Back to main menu"
									onClick={() => setMenuView("main")}
								>
									<ArrowLeftIcon aria-hidden="true" />
								</Button>
								<div className="min-w-0 pt-1">
									<PopoverTitle className="font-heading font-medium">
										Maps
									</PopoverTitle>
									<PopoverDescription className="mt-1 text-muted-foreground text-sm">
										Select a map or map view.
									</PopoverDescription>
								</div>
							</div>
							<nav aria-label="Map navigation" className="overflow-auto p-2">
								{catalog.maps.map((map) => {
									const isCurrentMap = map.id === currentMapId;
									const submaps = SUBMAP_LINKS.filter(
										(submap) => submap.mapId === map.id,
									);

									return (
										<div key={map.id}>
											<NavLink
												icon={MapTrifoldIcon}
												label={map.name}
												to="/maps/$mapId"
												params={{ mapId: map.id }}
												search={{
													documents: isCurrentMap
														? editorSearch?.documents
														: undefined,
													view: undefined,
												}}
												isCurrent={isCurrentMap && currentViewKey === "main"}
												onNavigate={(event) => {
													closeMenu();
													if (!isCurrentMap && isPlainNavigationClick(event)) {
														onMapNavigationStart?.(map);
													}
												}}
											/>
											{submaps.map((submap) => (
												<NavLink
													key={submap.targetViewKey}
													icon={MapTrifoldIcon}
													label={submap.navigationName}
													to="/maps/$mapId"
													params={{ mapId: map.id }}
													search={{
														documents: isCurrentMap
															? editorSearch?.documents
															: undefined,
														view: submap.targetViewKey,
													}}
													isCurrent={
														isCurrentMap &&
														currentViewKey === submap.targetViewKey
													}
													className="pl-8 text-muted-foreground"
													onNavigate={(event) => {
														closeMenu();
														if (
															!isCurrentMap &&
															isPlainNavigationClick(event)
														) {
															onMapNavigationStart?.(map);
														}
													}}
												/>
											))}
										</div>
									);
								})}
							</nav>
						</>
					) : (
						<>
							<div className="border-border border-b p-4">
								<PopoverTitle className="font-heading font-medium">
									Menu
								</PopoverTitle>
								<PopoverDescription className="mt-1 text-muted-foreground text-sm">
									Tarkov Farm navigation and project links.
								</PopoverDescription>
							</div>
							<nav
								aria-label="Vertical mode navigation"
								className="overflow-auto p-2"
							>
								<Button
									autoFocus
									type="button"
									variant="ghost"
									onClick={() => setMenuView("maps")}
									className="w-full justify-start px-3 font-normal text-sm normal-case tracking-normal"
								>
									<MapTrifoldIcon data-icon="inline-start" aria-hidden="true" />
									<span className="min-w-0 flex-1 truncate text-left">
										Maps
									</span>
									<CaretRightIcon data-icon="inline-end" aria-hidden="true" />
								</Button>

								<p className="mt-2 border-border border-t px-3 pt-4 pb-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
									Project
								</p>
								<NavLink
									icon={HouseIcon}
									label="Home"
									to="/"
									onNavigate={closeMenu}
								/>
								{projectLinks.map((link) => (
									<NavLink
										key={link.to}
										icon={link.icon}
										label={link.label}
										to={link.to}
										search={
											link.to === "/contribute" ? { map: currentMapId } : {}
										}
										onNavigate={closeMenu}
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
										onNavigate={closeMenu}
									/>
								) : null}
							</nav>
						</>
					)}
				</PopoverContent>
			</Popover>
		</header>
	);
}

type NavLinkProps = {
	className?: string;
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
		view?: string;
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
	className,
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
			className={cn(
				"flex min-h-11 items-center gap-3 border-transparent border-l-2 px-3 text-sm outline-none hover:border-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-primary aria-[current=page]:bg-muted",
				className,
			)}
		>
			<Icon aria-hidden={true} className="size-4" />
			<span className="truncate">{label}</span>
		</Link>
	);
}
