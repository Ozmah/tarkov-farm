import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getMapNavigationLabel } from "@/lib/map-navigation";
import { isPlainNavigationClick } from "@/lib/navigation-intent";
import { SUBMAP_LINKS } from "@/lib/submap-links";
import { cn } from "@/lib/utils";

type MapNavigationStripProps = {
	documentSearch?: string;
	maps: ReadonlyArray<{ id: string; name: string }>;
	onMapNavigationStart: (map: { id: string; name: string }) => void;
	selectedMapId: string;
	selectedViewKey: string;
};

export function MapNavigationStrip({
	documentSearch,
	maps,
	onMapNavigationStart,
	selectedMapId,
	selectedViewKey,
}: MapNavigationStripProps) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const activeLinkRef = useRef<HTMLAnchorElement>(null);
	const [canScrollBackward, setCanScrollBackward] = useState(false);
	const [canScrollForward, setCanScrollForward] = useState(false);
	const activeDestination = `${selectedMapId}:${selectedViewKey}`;
	const overflowMask =
		canScrollBackward && canScrollForward
			? "linear-gradient(to right, transparent, black 1rem, black calc(100% - 1rem), transparent)"
			: canScrollBackward
				? "linear-gradient(to right, transparent, black 1rem)"
				: canScrollForward
					? "linear-gradient(to left, transparent, black 1rem)"
					: undefined;
	const updateOverflow = useCallback(() => {
		const scroller = scrollerRef.current;

		if (!scroller) return;

		setCanScrollBackward(scroller.scrollLeft > 1);
		setCanScrollForward(
			scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1,
		);
	}, []);

	useEffect(() => {
		const scroller = scrollerRef.current;

		if (!scroller) return;

		updateOverflow();
		scroller.addEventListener("scroll", updateOverflow, { passive: true });
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? undefined
				: new ResizeObserver(updateOverflow);
		resizeObserver?.observe(scroller);

		return () => {
			scroller.removeEventListener("scroll", updateOverflow);
			resizeObserver?.disconnect();
		};
	}, [updateOverflow]);

	useEffect(() => {
		if (!activeDestination) return;

		activeLinkRef.current?.scrollIntoView({
			behavior: "auto",
			block: "nearest",
			inline: "center",
		});
		updateOverflow();
	}, [activeDestination, updateOverflow]);

	function scroll(direction: -1 | 1) {
		const scroller = scrollerRef.current;

		if (!scroller) return;

		scroller.scrollBy({
			behavior: "auto",
			left: direction * Math.max(240, scroller.clientWidth * 0.7),
		});
	}

	return (
		<nav
			aria-label="Maps and map views"
			className="hidden shrink-0 border-border border-b bg-card lg:flex lg:h-[var(--map-context-row-height)]"
		>
			{canScrollBackward ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Show previous maps"
					onClick={() => scroll(-1)}
					className="h-auto shrink-0 rounded-none border-border border-r bg-card/95"
				>
					<CaretLeftIcon aria-hidden="true" />
				</Button>
			) : null}

			<div
				ref={scrollerRef}
				className="min-w-0 flex-1 scroll-px-11 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				style={{ maskImage: overflowMask, WebkitMaskImage: overflowMask }}
			>
				<ul className="flex min-w-max items-stretch gap-2">
					{maps.map((map) => {
						const isSelectedMap = map.id === selectedMapId;
						const submaps = SUBMAP_LINKS.filter(
							(link) => link.mapId === map.id,
						);
						const mainActive = isSelectedMap && selectedViewKey === "main";
						const mapSearch = {
							documents: isSelectedMap ? documentSearch : undefined,
							location: undefined,
							view: undefined,
						};

						return (
							<li key={map.id} className="flex items-stretch gap-0.5">
								<Link
									ref={mainActive ? activeLinkRef : undefined}
									to="/maps/$mapId"
									params={{ mapId: map.id }}
									search={mapSearch}
									activeOptions={{
										exact: true,
										explicitUndefined: true,
									}}
									aria-label={`${map.name} main map`}
									aria-current={mainActive ? "page" : undefined}
									onClick={(event) => {
										if (!isSelectedMap && isPlainNavigationClick(event)) {
											onMapNavigationStart(map);
										}
									}}
									className={cn(
										"flex min-h-11 items-center border-transparent border-b-2 px-3 font-heading font-medium text-muted-foreground text-xs uppercase tracking-wide outline-none transition-colors hover:border-primary/45 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
										mainActive && "border-primary text-foreground",
									)}
								>
									{getMapNavigationLabel(map)}
								</Link>

								{submaps.map((submap) => {
									const submapActive =
										isSelectedMap && selectedViewKey === submap.targetViewKey;

									return (
										<Link
											key={submap.targetViewKey}
											ref={submapActive ? activeLinkRef : undefined}
											to="/maps/$mapId"
											params={{ mapId: map.id }}
											search={{
												documents: isSelectedMap ? documentSearch : undefined,
												location: undefined,
												view: submap.targetViewKey,
											}}
											activeOptions={{
												exact: true,
												explicitUndefined: true,
											}}
											aria-label={`${map.name} — ${submap.name}`}
											aria-current={submapActive ? "page" : undefined}
											onClick={(event) => {
												if (!isSelectedMap && isPlainNavigationClick(event)) {
													onMapNavigationStart(map);
												}
											}}
											className={cn(
												"flex min-h-11 items-center border-transparent border-b-2 px-2 font-heading text-muted-foreground/75 text-xs outline-none transition-colors hover:border-primary/35 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
												submapActive && "border-primary text-foreground",
											)}
										>
											{submap.navigationName}
										</Link>
									);
								})}
							</li>
						);
					})}
				</ul>
			</div>

			{canScrollForward ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Show more maps"
					onClick={() => scroll(1)}
					className="h-auto shrink-0 rounded-none border-border border-l bg-card/95"
				>
					<CaretRightIcon aria-hidden="true" />
				</Button>
			) : null}
		</nav>
	);
}
