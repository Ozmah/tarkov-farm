import { CheckIcon, MapPinIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { MapMarkerPreview } from "@/components/map/map-marker-preview";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MapMarkerPreview as MapMarkerPreviewData } from "@/lib/map-marker-preview";
import type { Point } from "@/lib/map-viewport";
import { cn } from "@/lib/utils";

type ClusterMarker = {
	id: string;
	label?: string;
	name: string;
	preview?: MapMarkerPreviewData;
	secondaryLabel?: string;
};

type MapMarkerClusterProps = {
	markers: ClusterMarker[];
	onSelect: (markerId: string) => void;
	position: Point;
	selectedMarkerId?: string;
};

const MAP_SHORTCUT_KEYS = new Set([
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"+",
	"=",
	"-",
	"0",
]);
export function MapMarkerCluster({
	markers,
	onSelect,
	position,
	selectedMarkerId,
}: MapMarkerClusterProps) {
	const [open, setOpen] = useState(false);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const restoreFocusRef = useRef(true);
	const containsSelection = markers.some(
		(marker) => marker.id === selectedMarkerId,
	);
	const representativeMarkerIndex = Math.max(
		0,
		markers.findIndex((marker) => marker.id === selectedMarkerId),
	);
	const previewMarker = markers[representativeMarkerIndex];
	const trigger = (
		<PopoverTrigger
			aria-label={`Choose among ${markers.length} nearby locations${containsSelection ? ", including the selected location" : ""}`}
			onPointerDown={(event) => event.stopPropagation()}
			className={cn(
				"group/cluster pointer-events-auto absolute z-20 flex size-11 items-center justify-center rounded-full border-2 border-cosmic-ink bg-milk-mustache font-bold font-heading text-cosmic-ink text-sm shadow-[0_2px_8px_rgb(0_0_0/0.8)] outline-none ring-2 ring-milk-mustache before:absolute before:-z-10 before:size-10 before:-translate-x-1.5 before:-translate-y-1.5 before:rounded-full before:border-2 before:border-cosmic-ink before:bg-milk-mustache before:content-[''] focus-visible:ring-4 focus-visible:ring-rowdy-orange",
				containsSelection &&
					"bg-rowdy-orange text-rowdy-orange-foreground ring-rowdy-orange",
			)}
			style={{
				left: position.x,
				top: position.y,
				transform: "translate(-50%, -100%)",
				transformOrigin: "50% 100%",
			}}
		>
			<span className="tabular-nums">{markers.length}</span>
		</PopoverTrigger>
	);

	return (
		<Popover
			modal={false}
			open={open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) {
					restoreFocusRef.current = true;
					setTooltipOpen(false);
				}

				setOpen(nextOpen);
			}}
		>
			<Tooltip open={!open && tooltipOpen} onOpenChange={setTooltipOpen}>
				<TooltipTrigger render={trigger} />
				<TooltipContent className="max-w-none flex-col items-stretch gap-0 overflow-hidden p-0">
					{previewMarker ? (
						<MapMarkerPreview
							name={previewMarker.name}
							position={{
								index: representativeMarkerIndex + 1,
								total: markers.length,
							}}
							preview={previewMarker.preview}
						/>
					) : null}
				</TooltipContent>
			</Tooltip>
			<PopoverContent
				finalFocus={() => restoreFocusRef.current}
				onPointerDown={(event) => event.stopPropagation()}
				onKeyDown={(event) => {
					if (MAP_SHORTCUT_KEYS.has(event.key)) {
						event.stopPropagation();
					}
				}}
			>
				<header className="flex items-start gap-3 border-border border-b p-4">
					<MapPinIcon aria-hidden="true" className="mt-0.5 shrink-0" />
					<div className="min-w-0">
						<PopoverTitle className="font-heading font-medium text-sm">
							Nearby locations
						</PopoverTitle>
						<PopoverDescription className="mt-1 text-muted-foreground text-xs">
							Choose the exact location to open.
						</PopoverDescription>
					</div>
				</header>
				<ul className="max-h-72 overflow-y-auto p-1.5">
					{markers.map((marker) => {
						const selected = marker.id === selectedMarkerId;

						return (
							<li key={marker.id}>
								<button
									type="button"
									aria-label={`Open location ${marker.label}: ${marker.name}${marker.secondaryLabel ? `, ${marker.secondaryLabel}` : ""}`}
									aria-pressed={selected}
									onClick={() => {
										restoreFocusRef.current = false;
										setOpen(false);
										onSelect(marker.id);
									}}
									className={cn(
										"flex min-h-12 w-full items-center gap-3 px-2.5 py-2 text-left outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
										selected && "bg-accent text-accent-foreground",
									)}
								>
									<span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-heading text-xs tabular-nums">
										{marker.label}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm">
											{marker.name}
										</span>
										{marker.secondaryLabel ? (
											<span className="block truncate text-muted-foreground text-xs">
												{marker.secondaryLabel}
											</span>
										) : null}
									</span>
									{selected ? <CheckIcon aria-hidden="true" /> : null}
								</button>
							</li>
						);
					})}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
