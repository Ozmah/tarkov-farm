import {
	CaretDownIcon,
	FunnelSimpleIcon,
	InfoIcon,
	MapPinIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { DocumentThumbnail } from "@/components/document-thumbnail";
import type { LocationDetails } from "@/components/map/location-details-panel";
import type {
	MapSidebarPanelProps,
	SidebarDocument,
} from "@/components/map/map-sidebar-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type VerticalMapControlsProps = Omit<
	MapSidebarPanelProps,
	"action" | "onBack"
> & {
	selectedLocation?: LocationDetails;
};

export function VerticalMapControls({
	documents,
	locations,
	maps,
	mapViews,
	selectedDocumentIds,
	selectedLocation,
	selectedLocationId,
	selectedMapId,
	selectedMapViewId,
	onLocationSelect,
	onMapChange,
	onMapViewChange,
	onSelectedDocumentsChange,
}: VerticalMapControlsProps) {
	const [locationsOpen, setLocationsOpen] = useState(false);
	const selectedDocumentIdSet = new Set(selectedDocumentIds);
	const allDocumentsSelected = documents.every((document) =>
		selectedDocumentIdSet.has(document.id),
	);

	function toggleDocument(documentId: string) {
		const isSelected = selectedDocumentIdSet.has(documentId);

		if (isSelected && selectedDocumentIds.length === 1) return;

		onSelectedDocumentsChange(
			isSelected
				? selectedDocumentIds.filter((id) => id !== documentId)
				: [...selectedDocumentIds, documentId],
		);
	}

	return (
		<section
			aria-label="Map controls"
			className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-border border-b bg-card px-3 py-2 sm:px-5"
		>
			<div className="min-w-40 flex-1 sm:max-w-52">
				<label htmlFor="vertical-map" className="sr-only">
					Map
				</label>
				<Select
					items={maps.map((map) => ({ value: map.id, label: map.name }))}
					value={selectedMapId}
					onValueChange={(mapId) => {
						if (mapId) onMapChange(mapId);
					}}
				>
					<SelectTrigger id="vertical-map" className="w-full">
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
			</div>

			{mapViews.length > 1 ? (
				<div className="min-w-36 flex-1 sm:max-w-48">
					<label htmlFor="vertical-map-view" className="sr-only">
						Map view
					</label>
					<Select
						items={mapViews.map((view) => ({
							value: view.id,
							label: view.name,
						}))}
						value={selectedMapViewId ?? null}
						onValueChange={(mapViewId) => {
							if (mapViewId) onMapViewChange(mapViewId);
						}}
					>
						<SelectTrigger id="vertical-map-view" className="w-full">
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
				</div>
			) : null}

			{documents.length > 0 ? (
				<DocumentsPopover
					documents={documents}
					allDocumentsSelected={allDocumentsSelected}
					selectedDocumentIdSet={selectedDocumentIdSet}
					selectedDocumentIds={selectedDocumentIds}
					onShowAll={() =>
						onSelectedDocumentsChange(documents.map((document) => document.id))
					}
					onToggleDocument={toggleDocument}
				/>
			) : null}

			<Popover open={locationsOpen} onOpenChange={setLocationsOpen}>
				<PopoverTrigger render={<Button variant="outline" size="sm" />}>
					<MapPinIcon data-icon="inline-start" aria-hidden="true" />
					Locations
					<span className="text-muted-foreground tabular-nums">
						{locations.length}
					</span>
					<CaretDownIcon data-icon="inline-end" aria-hidden="true" />
				</PopoverTrigger>
				<PopoverContent
					side="bottom"
					align="end"
					className="flex max-h-[min(40rem,calc(100dvh-9rem))] w-[min(30rem,calc(100vw-1rem))] flex-col overflow-hidden"
				>
					<div className="border-border border-b p-4">
						<PopoverTitle className="font-heading font-medium">
							Locations
						</PopoverTitle>
						<PopoverDescription className="mt-1 text-muted-foreground text-sm">
							{locations.length} visible on this map view.
						</PopoverDescription>
					</div>
					{locations.length > 0 ? (
						<ul className="overflow-auto p-2">
							{locations.map((location, index) => (
								<li key={location.id}>
									<button
										type="button"
										aria-pressed={location.id === selectedLocationId}
										onClick={() => {
											onLocationSelect(location.id);
											setLocationsOpen(false);
										}}
										className="flex min-h-14 w-full items-center gap-3 border-transparent border-l-2 px-3 py-2 text-left outline-none hover:border-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-muted"
									>
										<span className="flex size-7 shrink-0 items-center justify-center rounded-full border font-heading text-xs tabular-nums">
											{location.markerLabel ?? index + 1}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm">
												{location.name}
											</span>
											<span className="block truncate text-muted-foreground text-xs">
												{location.documentName}
											</span>
										</span>
									</button>
								</li>
							))}
						</ul>
					) : (
						<p className="p-5 text-muted-foreground text-sm">
							No locations match the current filters.
						</p>
					)}
				</PopoverContent>
			</Popover>

			{selectedLocation ? (
				<LocationDetailsPopover location={selectedLocation} />
			) : null}
		</section>
	);
}

type DocumentsPopoverProps = {
	allDocumentsSelected: boolean;
	documents: SidebarDocument[];
	selectedDocumentIdSet: Set<string>;
	selectedDocumentIds: string[];
	onShowAll: () => void;
	onToggleDocument: (documentId: string) => void;
};

function DocumentsPopover({
	allDocumentsSelected,
	documents,
	selectedDocumentIdSet,
	selectedDocumentIds,
	onShowAll,
	onToggleDocument,
}: DocumentsPopoverProps) {
	return (
		<Popover>
			<PopoverTrigger render={<Button variant="outline" size="sm" />}>
				<FunnelSimpleIcon data-icon="inline-start" aria-hidden="true" />
				Documents
				<span className="text-muted-foreground tabular-nums">
					{selectedDocumentIds.length}/{documents.length}
				</span>
				<CaretDownIcon data-icon="inline-end" aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				className="w-[min(28rem,calc(100vw-1rem))]"
			>
				<div className="flex items-start justify-between gap-4 border-border border-b p-4">
					<div>
						<PopoverTitle className="font-heading font-medium">
							Document filters
						</PopoverTitle>
						<PopoverDescription className="mt-1 text-muted-foreground text-sm">
							Choose which document locations appear on the map.
						</PopoverDescription>
					</div>
					{!allDocumentsSelected ? (
						<Button variant="ghost" size="xs" onClick={onShowAll}>
							Show all
						</Button>
					) : null}
				</div>
				<div className="grid grid-cols-2 gap-px bg-border p-px">
					{documents.map((document) => {
						const selected = selectedDocumentIdSet.has(document.id);

						return (
							<button
								key={document.id}
								type="button"
								aria-label={`${document.name}, ${document.count} ${document.count === 1 ? "location" : "locations"}`}
								aria-pressed={selected}
								disabled={selected && selectedDocumentIds.length === 1}
								onClick={() => onToggleDocument(document.id)}
								className={cn(
									"flex min-h-16 items-center gap-2 bg-popover px-3 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default disabled:opacity-70",
									selected && "bg-muted",
								)}
							>
								<DocumentThumbnail document={document} className="size-9" />
								<span className="min-w-0 flex-1 truncate font-medium">
									{document.name}
								</span>
								<span className="text-muted-foreground tabular-nums">
									{document.count}
								</span>
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function LocationDetailsPopover({ location }: { location: LocationDetails }) {
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="secondary"
						size="sm"
						className="min-w-0 max-w-full sm:max-w-64"
					/>
				}
			>
				<InfoIcon data-icon="inline-start" aria-hidden="true" />
				<span className="truncate normal-case tracking-normal">
					{location.name}
				</span>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				className="max-h-[min(40rem,calc(100dvh-9rem))] w-[min(28rem,calc(100vw-1rem))] overflow-auto p-5"
			>
				<Badge variant="secondary">{location.documentName}</Badge>
				<PopoverTitle className="mt-3 text-balance font-heading font-medium text-xl">
					{location.name}
				</PopoverTitle>
				<PopoverDescription className="mt-3 text-pretty text-foreground text-sm">
					{location.description ?? "No additional location notes."}
				</PopoverDescription>
				{location.requiredKeys.length > 0 ? (
					<section
						aria-labelledby="vertical-location-required-keys"
						className="mt-5"
					>
						<h3
							id="vertical-location-required-keys"
							className="font-heading font-medium text-sm"
						>
							Required {location.requiredKeys.length === 1 ? "key" : "keys"}
						</h3>
						<ul className="mt-2 flex flex-col gap-2">
							{location.requiredKeys.map((key) => (
								<li key={key.id}>
									<a
										href={key.wikiUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex min-h-14 items-center gap-3 border bg-card p-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
									>
										<img
											src={key.imagePath}
											alt=""
											width={key.imageWidth}
											height={key.imageHeight}
											loading="lazy"
											decoding="async"
											className="size-9 object-contain"
										/>
										<span>{key.name}</span>
									</a>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

export function PendingVerticalMapControls({ mapName }: { mapName: string }) {
	return (
		<div className="flex min-h-16 shrink-0 items-center gap-3 border-border border-b bg-card px-5">
			<MapPinIcon aria-hidden="true" className="size-4 text-muted-foreground" />
			<p className="min-w-0 truncate text-sm">
				Loading <span className="font-medium">{mapName}</span> locations…
			</p>
		</div>
	);
}
