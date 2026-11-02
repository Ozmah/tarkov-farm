import { CaretLeftIcon, CheckIcon, MapPinIcon } from "@phosphor-icons/react";
import { type ReactNode, useRef, useState } from "react";
import { KeyRequirementIndicator } from "@/components/map/key-requirement-indicator";
import { MapMarkerPreview } from "@/components/map/map-marker-preview";
import {
	MarkerPopoverContent,
	type MarkerPopoverOpenChange,
} from "@/components/map/marker-popover";
import {
	Popover,
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
	inspectable?: boolean;
	label?: string;
	name: string;
	preview?: MapMarkerPreviewData;
	requiredKeyCount?: number;
	secondaryLabel?: string;
};

type MapMarkerClusterProps = {
	markers: ClusterMarker[];
	open: boolean;
	position: Point;
	/** Shown in place of the list for inspectable markers. */
	renderInspector?: (markerId: string) => ReactNode;
	selectedMarkerId?: string;
	onOpenChange: MarkerPopoverOpenChange;
	/** Chosen from the list; the parent closes the popover. */
	onSelect: (markerId: string) => void;
};

export function MapMarkerCluster({
	markers,
	open,
	position,
	renderInspector,
	selectedMarkerId,
	onOpenChange,
	onSelect,
}: MapMarkerClusterProps) {
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const [inspectedMarkerId, setInspectedMarkerId] = useState<string>();
	const inspectableMarkers = renderInspector
		? markers.filter((marker) => marker.inspectable)
		: [];
	const inspectedIndex = inspectableMarkers.findIndex(
		(marker) => marker.id === inspectedMarkerId,
	);
	const inspectedMarker = inspectableMarkers[inspectedIndex];
	const restoreFocusRef = useRef(true);
	const containsSelection = markers.some(
		(marker) => marker.id === selectedMarkerId,
	);
	const representativeMarkerIndex = Math.max(
		0,
		markers.findIndex((marker) => marker.id === selectedMarkerId),
	);
	const previewMarker = markers[representativeMarkerIndex];
	const keyedLocationCount = markers.filter(
		(marker) => (marker.requiredKeyCount ?? 0) > 0,
	).length;
	const keyAccessLabel =
		keyedLocationCount > 0
			? `, ${keyedLocationCount} ${keyedLocationCount === 1 ? "location requires" : "locations require"} key access`
			: "";
	const trigger = (
		<PopoverTrigger
			aria-label={`Choose among ${markers.length} nearby locations${containsSelection ? ", including the selected location" : ""}${keyAccessLabel}`}
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
			{keyedLocationCount > 0 ? (
				<KeyRequirementIndicator className="absolute -top-1 -right-1" />
			) : null}
		</PopoverTrigger>
	);

	return (
		<Popover
			modal={false}
			open={open}
			onOpenChange={(nextOpen, details) => {
				if (nextOpen) {
					restoreFocusRef.current = true;
					setTooltipOpen(false);
				} else {
					setInspectedMarkerId(undefined);
				}

				onOpenChange(nextOpen, details);
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
			<MarkerPopoverContent
				finalFocus={() => restoreFocusRef.current}
				onKeyDown={(event) => {
					if (
						!inspectedMarker ||
						(event.key !== "ArrowLeft" && event.key !== "ArrowRight")
					) {
						return;
					}

					event.preventDefault();
					const offset = event.key === "ArrowLeft" ? -1 : 1;
					const count = inspectableMarkers.length;
					setInspectedMarkerId(
						inspectableMarkers[(inspectedIndex + offset + count) % count]?.id,
					);
				}}
			>
				{inspectedMarker && renderInspector ? (
					<>
						<div className="flex items-center gap-2 border-border border-b px-1.5 py-1">
							<button
								type="button"
								onClick={() => setInspectedMarkerId(undefined)}
								className="flex min-h-11 items-center gap-1.5 px-2 font-heading text-xs outline-none hover:bg-accent focus-visible:bg-accent"
							>
								<CaretLeftIcon aria-hidden="true" />
								Nearby locations
							</button>
							<span className="ml-auto px-2 text-muted-foreground text-xs tabular-nums">
								{inspectedIndex + 1} of {inspectableMarkers.length}
							</span>
						</div>
						{renderInspector(inspectedMarker.id)}
					</>
				) : (
					<ClusterList
						markers={markers}
						selectedMarkerId={selectedMarkerId}
						onChoose={(marker) => {
							if (marker.inspectable && renderInspector) {
								setInspectedMarkerId(marker.id);
								return;
							}
							restoreFocusRef.current = false;
							onSelect(marker.id);
						}}
					/>
				)}
			</MarkerPopoverContent>
		</Popover>
	);
}

type ClusterListProps = {
	markers: ClusterMarker[];
	selectedMarkerId?: string;
	onChoose: (marker: ClusterMarker) => void;
};

function ClusterList({
	markers,
	selectedMarkerId,
	onChoose,
}: ClusterListProps) {
	return (
		<>
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
					const requiresKeyAccess = (marker.requiredKeyCount ?? 0) > 0;

					return (
						<li key={marker.id}>
							<button
								type="button"
								aria-label={`Open location${marker.label ? ` ${marker.label}` : ""}: ${marker.name}${marker.secondaryLabel ? `, ${marker.secondaryLabel}` : ""}${requiresKeyAccess ? ", requires key access" : ""}`}
								aria-pressed={selected}
								onClick={() => onChoose(marker)}
								className={cn(
									"flex min-h-12 w-full items-center gap-3 px-2.5 py-2 text-left outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
									selected && "bg-accent text-accent-foreground",
								)}
							>
								<span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-heading text-xs tabular-nums">
									{marker.label}
									{requiresKeyAccess ? (
										<KeyRequirementIndicator className="absolute -top-1.5 -right-1.5 size-3.5 [&_svg]:size-2" />
									) : null}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm">{marker.name}</span>
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
		</>
	);
}
