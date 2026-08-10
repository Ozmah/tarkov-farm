import { ArrowLeftIcon, MapPinIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SidebarMap = {
	id: string;
	name: string;
};

type SidebarMapView = {
	id: string;
	name: string;
};

type SidebarLocation = {
	documentName: string;
	id: string;
	name: string;
};

type MapSidebarPanelProps = {
	action?: ReactNode;
	className?: string;
	locations: SidebarLocation[];
	maps: SidebarMap[];
	mapViews: SidebarMapView[];
	selectedLocationId?: string;
	selectedMapId: string;
	selectedMapViewId?: string;
	onBack: () => void;
	onLocationSelect: (locationId: string) => void;
	onMapChange: (mapId: string) => void;
	onMapViewChange: (mapViewId: string) => void;
};

export function MapSidebarPanel({
	action,
	className,
	locations,
	maps,
	mapViews,
	selectedLocationId,
	selectedMapId,
	selectedMapViewId,
	onBack,
	onLocationSelect,
	onMapChange,
	onMapViewChange,
}: MapSidebarPanelProps) {
	return (
		<div className={cn("flex min-h-0 flex-1 flex-col", className)}>
			<header className="flex min-h-16 shrink-0 items-center gap-3 border-sidebar-border border-b px-3">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Return to all maps"
					className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
					onClick={onBack}
				>
					<ArrowLeftIcon />
				</Button>
				<div className="min-w-0 flex-1">
					<p className="truncate font-heading font-medium text-sidebar-foreground text-sm">
						Locations
					</p>
					<p className="truncate text-sidebar-foreground/70 text-sm tabular-nums">
						{locations.length} {locations.length === 1 ? "result" : "results"}
					</p>
				</div>
				{action}
			</header>

			<div className="grid shrink-0 gap-4 border-sidebar-border border-b p-4">
				<Field>
					<FieldLabel htmlFor="sidebar-map" className="text-sidebar-primary">
						Map
					</FieldLabel>
					<Select
						items={maps.map((map) => ({ value: map.id, label: map.name }))}
						value={selectedMapId}
						onValueChange={(mapId) => {
							if (mapId) {
								onMapChange(mapId);
							}
						}}
					>
						<SelectTrigger
							id="sidebar-map"
							className="w-full border-sidebar-border text-sidebar-foreground focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30"
						>
							<SelectValue placeholder="Select a map" />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectGroup>
								{maps.map((map) => (
									<SelectItem key={map.id} value={map.id}>
										{map.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>

				{mapViews.length > 1 ? (
					<Field>
						<FieldLabel
							htmlFor="sidebar-map-view"
							className="text-sidebar-primary"
						>
							Map view
						</FieldLabel>
						<Select
							items={mapViews.map((view) => ({
								value: view.id,
								label: view.name,
							}))}
							value={selectedMapViewId ?? null}
							onValueChange={(mapViewId) => {
								if (mapViewId) {
									onMapViewChange(mapViewId);
								}
							}}
						>
							<SelectTrigger
								id="sidebar-map-view"
								className="w-full border-sidebar-border text-sidebar-foreground focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30"
							>
								<SelectValue placeholder="Select a map view" />
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectGroup>
									{mapViews.map((view) => (
										<SelectItem key={view.id} value={view.id}>
											{view.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				) : null}
			</div>

			{locations.length > 0 ? (
				<ul className="min-h-0 flex-1 overflow-auto py-2">
					{locations.map((location, index) => {
						const selected = selectedLocationId === location.id;

						return (
							<li key={location.id}>
								<button
									type="button"
									aria-pressed={selected}
									onClick={() => onLocationSelect(location.id)}
									className={cn(
										"flex min-h-14 w-full items-center gap-3 border-transparent border-l-2 px-4 py-2 text-left text-sidebar-foreground outline-none hover:border-sidebar-primary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset",
										selected &&
											"border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground",
									)}
								>
									<span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-sidebar-border font-heading text-xs tabular-nums">
										{index + 1}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm">
											{location.name}
										</span>
										<span className="block truncate text-sidebar-foreground/65 text-xs">
											{location.documentName}
										</span>
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			) : (
				<Empty className="min-h-48 p-6 text-sidebar-foreground">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MapPinIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No locations</EmptyTitle>
						<EmptyDescription className="text-sidebar-foreground/70">
							No locations match this view and document selection.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</div>
	);
}

export function PendingMapSidebarPanel({
	mapName,
	onBack,
}: {
	mapName: string;
	onBack: () => void;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex min-h-16 shrink-0 items-center gap-3 border-sidebar-border border-b px-3">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Return to all maps"
					className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
					onClick={onBack}
				>
					<ArrowLeftIcon />
				</Button>
				<div className="min-w-0 flex-1">
					<p className="truncate font-heading font-medium text-sidebar-foreground text-sm">
						{mapName}
					</p>
					<p className="truncate text-sidebar-foreground/70 text-sm">
						Loading locations…
					</p>
				</div>
			</header>

			<div className="flex flex-col gap-3 p-4" aria-hidden="true">
				<div className="h-11 bg-sidebar-accent/60" />
				<div className="h-px bg-sidebar-border" />
				<div className="h-14 bg-sidebar-accent/40" />
				<div className="h-14 bg-sidebar-accent/40" />
				<div className="h-14 bg-sidebar-accent/40" />
			</div>
		</div>
	);
}
