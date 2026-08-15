import { ArrowLeftIcon, MapPinIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import {
	type DocumentArtwork,
	DocumentThumbnail,
} from "@/components/document-thumbnail";
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
	documentId: string;
	documentName: string;
	id: string;
	name: string;
};

type SidebarDocument = DocumentArtwork & {
	count: number;
	id: string;
	name: string;
};

type MapSidebarPanelProps = {
	action?: ReactNode;
	className?: string;
	documents: SidebarDocument[];
	locations: SidebarLocation[];
	maps: SidebarMap[];
	mapViews: SidebarMapView[];
	selectedLocationId?: string;
	selectedDocumentIds: string[];
	selectedMapId: string;
	selectedMapViewId?: string;
	onBack: () => void;
	onSelectedDocumentsChange: (documentIds: string[]) => void;
	onLocationSelect: (locationId: string) => void;
	onMapChange: (mapId: string) => void;
	onMapViewChange: (mapViewId: string) => void;
};

export function MapSidebarPanel({
	action,
	className,
	documents,
	locations,
	maps,
	mapViews,
	selectedLocationId,
	selectedDocumentIds,
	selectedMapId,
	selectedMapViewId,
	onBack,
	onSelectedDocumentsChange,
	onLocationSelect,
	onMapChange,
	onMapViewChange,
}: MapSidebarPanelProps) {
	const selectedDocumentIdSet = new Set(selectedDocumentIds);
	const documentById = new Map(
		documents.map((document) => [document.id, document]),
	);
	const allDocumentsSelected = documents.every((document) =>
		selectedDocumentIdSet.has(document.id),
	);
	const totalLocationCount = documents.reduce(
		(total, document) => total + document.count,
		0,
	);

	function toggleDocument(documentId: string) {
		const isSelected = selectedDocumentIdSet.has(documentId);

		if (isSelected && selectedDocumentIds.length === 1) {
			return;
		}

		onSelectedDocumentsChange(
			isSelected
				? selectedDocumentIds.filter((id) => id !== documentId)
				: [...selectedDocumentIds, documentId],
		);
	}

	return (
		<div className={cn("flex min-h-0 flex-1 flex-col", className)}>
			<header className="flex h-16 shrink-0 items-center gap-3 border-sidebar-border border-b px-3">
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

				{documents.length > 0 ? (
					<fieldset className="flex flex-col gap-2">
						<div className="flex min-h-7 items-center justify-between gap-3">
							<legend className="font-medium text-sidebar-primary text-sm">
								Documents
							</legend>
							{allDocumentsSelected ? (
								<p className="text-sidebar-foreground/60 text-xs tabular-nums">
									All · {totalLocationCount}
								</p>
							) : (
								<button
									type="button"
									onClick={() =>
										onSelectedDocumentsChange(
											documents.map((document) => document.id),
										)
									}
									className="min-h-7 font-semibold text-sidebar-primary text-xs uppercase tracking-wide outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
								>
									Show all
								</button>
							)}
						</div>
						<div className="grid grid-cols-2 gap-px overflow-hidden border border-sidebar-border bg-sidebar-border">
							{documents.map((document) => {
								const isSelected = selectedDocumentIdSet.has(document.id);

								return (
									<button
										key={document.id}
										type="button"
										aria-label={`${document.name}, ${document.count} ${document.count === 1 ? "location" : "locations"}`}
										aria-pressed={isSelected}
										disabled={isSelected && selectedDocumentIds.length === 1}
										onClick={() => toggleDocument(document.id)}
										className={cn(
											"flex min-h-14 items-center gap-2 bg-sidebar px-2 text-left text-sidebar-foreground text-xs outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset disabled:cursor-default disabled:opacity-70",
											isSelected &&
												"bg-sidebar-accent text-sidebar-accent-foreground",
										)}
									>
										<DocumentThumbnail document={document} className="size-8" />
										<span className="min-w-0 flex-1 truncate font-medium">
											{document.name}
										</span>
										<span className="shrink-0 text-sidebar-foreground/60 tabular-nums">
											{document.count}
										</span>
									</button>
								);
							})}
						</div>
					</fieldset>
				) : null}
			</div>

			{locations.length > 0 ? (
				<ul className="min-h-0 flex-1 overflow-auto py-2">
					{locations.map((location, index) => {
						const selected = selectedLocationId === location.id;
						const document = documentById.get(location.documentId);

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
									{document ? (
										<DocumentThumbnail
											document={document}
											className="size-10"
										/>
									) : null}
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
			<header className="flex h-16 shrink-0 items-center gap-3 border-sidebar-border border-b px-3">
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
