import { ArrowLeftIcon, CheckIcon, MapPinIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import {
	type DocumentArtwork,
	DocumentThumbnail,
} from "@/components/document-thumbnail";
import { KeyRequirementIndicator } from "@/components/map/key-requirement-indicator";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export type SidebarLocation = {
	documentId: string;
	documentName: string;
	id: string;
	markerLabel?: string;
	name: string;
	requiredKeyCount?: number;
};

export type SidebarDocument = DocumentArtwork & {
	count: number;
	id: string;
	name: string;
};

export type MapSidebarPanelProps = {
	action?: ReactNode;
	className?: string;
	documents: SidebarDocument[];
	headerTitle?: string;
	hideHeaderOnDesktop?: boolean;
	locations: SidebarLocation[];
	navigationControls?: ReactNode;
	selectedLocationId?: string;
	selectedDocumentIds: string[];
	onBack: () => void;
	onSelectedDocumentsChange: (documentIds: string[]) => void;
	onLocationSelect: (locationId: string) => void;
};

export function MapSidebarPanel({
	action,
	className,
	documents,
	headerTitle = "Locations",
	hideHeaderOnDesktop = false,
	locations,
	navigationControls,
	selectedLocationId,
	selectedDocumentIds,
	onBack,
	onSelectedDocumentsChange,
	onLocationSelect,
}: MapSidebarPanelProps) {
	const selectedDocumentIdSet = new Set(selectedDocumentIds);
	const documentById = new Map(
		documents.map((document) => [document.id, document]),
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
			<header
				className={cn(
					"flex h-16 shrink-0 items-center gap-3 border-sidebar-border border-b px-3",
					hideHeaderOnDesktop && "lg:hidden",
				)}
			>
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
						{headerTitle}
					</p>
					<p className="truncate text-sidebar-foreground/70 text-sm tabular-nums">
						{locations.length}{" "}
						{locations.length === 1 ? "location" : "locations"}
					</p>
				</div>
				{action}
			</header>

			<div
				className={cn(
					"grid shrink-0 gap-4 border-sidebar-border border-b p-4",
					hideHeaderOnDesktop && "lg:border-b-0 lg:px-4 lg:py-3",
				)}
			>
				{navigationControls}
				{documents.length > 0 ? (
					<fieldset className="flex flex-col gap-2">
						<legend className="flex min-h-7 items-center font-medium text-sidebar-primary text-sm">
							Documents
						</legend>
						<div className="grid grid-cols-2 gap-px overflow-hidden border border-sidebar-border bg-sidebar-border">
							{documents.map((document) => {
								const isSelected = selectedDocumentIdSet.has(document.id);

								return (
									<button
										key={document.id}
										type="button"
										aria-label={`${document.name}, ${document.count} ${document.count === 1 ? "location" : "locations"}`}
										aria-pressed={isSelected}
										data-selected={isSelected}
										disabled={isSelected && selectedDocumentIds.length === 1}
										onClick={() => toggleDocument(document.id)}
										className={cn(
											"flex min-h-14 items-center gap-2 bg-sidebar px-2 text-left text-sidebar-foreground/75 text-xs outline-none transition-[color,background-color,box-shadow] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset disabled:cursor-default",
											isSelected &&
												"bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--sidebar-primary)] hover:bg-[color-mix(in_oklch,var(--sidebar-accent),var(--sidebar-foreground)_8%)]",
										)}
									>
										<DocumentThumbnail document={document} className="size-8" />
										<span className="min-w-0 flex-1 truncate font-medium">
											{document.name}
										</span>
										{isSelected ? (
											<CheckIcon
												aria-hidden="true"
												className="size-3.5 shrink-0 text-sidebar-primary"
											/>
										) : null}
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

			<h2 id="sidebar-location-list" className="sr-only">
				Locations
			</h2>
			{locations.length > 0 ? (
				<ul
					aria-labelledby="sidebar-location-list"
					className="min-h-0 flex-1 overflow-auto py-2"
				>
					{locations.map((location, index) => {
						const selected = selectedLocationId === location.id;
						const document = documentById.get(location.documentId);
						const requiresKeyAccess = (location.requiredKeyCount ?? 0) > 0;

						return (
							<li key={location.id}>
								<button
									type="button"
									aria-label={`Open ${location.name}${requiresKeyAccess ? ", requires key access" : ""}`}
									aria-pressed={selected}
									onClick={() => onLocationSelect(location.id)}
									className={cn(
										"flex min-h-14 w-full items-center gap-3 border-transparent border-l-2 px-4 py-2 text-left text-sidebar-foreground outline-none hover:border-sidebar-primary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset",
										selected &&
											"border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground",
									)}
								>
									<span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-sidebar-border font-heading text-xs tabular-nums">
										{location.markerLabel ?? index + 1}
										{requiresKeyAccess ? (
											<KeyRequirementIndicator className="absolute -top-1.5 -right-1.5 size-3.5 [&_svg]:size-2" />
										) : null}
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
	hideHeaderOnDesktop = false,
	mapName,
	onBack,
}: {
	hideHeaderOnDesktop?: boolean;
	mapName: string;
	onBack: () => void;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header
				className={cn(
					"flex h-16 shrink-0 items-center gap-3 border-sidebar-border border-b px-3",
					hideHeaderOnDesktop && "lg:hidden",
				)}
			>
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
