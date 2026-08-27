import { CheckIcon, MapPinIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { DocumentThumbnail } from "@/components/document-thumbnail";
import { KeyRequirementIndicator } from "@/components/map/key-requirement-indicator";
import type {
	SidebarDocument,
	SidebarLocation,
} from "@/components/map/map-sidebar-panel";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type VerticalDocumentFiltersProps = {
	documents: SidebarDocument[];
	selectedDocumentIds: string[];
	onSelectedDocumentsChange: (documentIds: string[]) => void;
};

export function VerticalDocumentFilters({
	documents,
	selectedDocumentIds,
	onSelectedDocumentsChange,
}: VerticalDocumentFiltersProps) {
	const selectedDocumentIdSet = new Set(selectedDocumentIds);

	function toggleDocument(documentId: string) {
		const isSelected = selectedDocumentIdSet.has(documentId);

		if (isSelected && selectedDocumentIds.length === 1) return;

		onSelectedDocumentsChange(
			isSelected
				? selectedDocumentIds.filter((id) => id !== documentId)
				: [...selectedDocumentIds, documentId],
		);
	}

	if (documents.length === 0) return null;

	return (
		<fieldset className="min-w-0">
			<legend className="sr-only">Document filters</legend>
			<div className="flex min-w-0 gap-px overflow-x-auto border border-border bg-border">
				{documents.map((document) => {
					const selected = selectedDocumentIdSet.has(document.id);

					return (
						<button
							key={document.id}
							type="button"
							aria-label={`${document.name}, ${document.count} ${document.count === 1 ? "location" : "locations"}`}
							aria-pressed={selected}
							disabled={selected && selectedDocumentIds.length === 1}
							onClick={() => toggleDocument(document.id)}
							className={cn(
								"flex min-h-11 min-w-11 items-center gap-1.5 bg-card px-2 text-muted-foreground text-xs outline-none transition-[color,background-color,box-shadow] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default sm:min-w-24 md:min-w-32",
								selected &&
									"bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--primary)] hover:bg-[color-mix(in_oklch,var(--accent),var(--foreground)_8%)]",
							)}
						>
							<DocumentThumbnail document={document} className="size-7" />
							<span className="hidden min-w-0 flex-1 truncate font-medium md:block">
								{document.name}
							</span>
							{selected ? (
								<CheckIcon
									aria-hidden="true"
									className="hidden size-3.5 shrink-0 text-primary sm:block"
								/>
							) : null}
							<span className="hidden shrink-0 text-muted-foreground tabular-nums sm:block">
								{document.count}
							</span>
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}

type VerticalLocationsControlProps = {
	locations: SidebarLocation[];
	selectedLocationId?: string;
	onLocationSelect: (locationId: string) => void;
};

export function PendingVerticalLocationsControl({
	mapName,
}: {
	mapName: string;
}) {
	const label = `Loading ${mapName} locations`;

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			disabled
			aria-label={label}
			title={label}
			className="text-sidebar-foreground"
		>
			<MapPinIcon aria-hidden="true" />
		</Button>
	);
}

export function VerticalLocationsControl({
	locations,
	selectedLocationId,
	onLocationSelect,
}: VerticalLocationsControlProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Locations"
						title="Locations"
						className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground dark:aria-expanded:hover:bg-sidebar-accent"
					/>
				}
			>
				<MapPinIcon aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				className="flex max-h-[min(42rem,calc(100dvh-5rem))] w-[min(30rem,calc(100vw-1rem))] flex-col overflow-hidden"
			>
				<div className="shrink-0 border-border border-b p-4">
					<PopoverTitle className="font-heading font-medium">
						Locations
					</PopoverTitle>
					<PopoverDescription className="mt-1 text-muted-foreground text-sm">
						{locations.length} visible on this map view.
					</PopoverDescription>
				</div>
				{locations.length > 0 ? (
					<ul className="min-h-0 overflow-auto p-2">
						{locations.map((location, index) => {
							const requiresKeyAccess = (location.requiredKeyCount ?? 0) > 0;

							return (
								<li key={location.id}>
									<button
										type="button"
										aria-label={`Open ${location.name}${requiresKeyAccess ? ", requires key access" : ""}`}
										aria-pressed={location.id === selectedLocationId}
										onClick={() => {
											onLocationSelect(location.id);
											setOpen(false);
										}}
										className="flex min-h-14 w-full items-center gap-3 border-transparent border-l-2 px-3 py-2 text-left outline-none hover:border-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-muted"
									>
										<span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border font-heading text-xs tabular-nums">
											{location.markerLabel ?? index + 1}
											{requiresKeyAccess ? (
												<KeyRequirementIndicator className="absolute -top-1.5 -right-1.5 size-3.5 [&_svg]:size-2" />
											) : null}
										</span>
										<span className="min-w-0 flex-1 truncate text-sm">
											{location.name}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="p-5 text-muted-foreground text-sm">
						No locations match the current filters.
					</p>
				)}
			</PopoverContent>
		</Popover>
	);
}
