import { CaretDownIcon, FileTextIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type FilterableDocument = {
	id: string;
	name: string;
	isFilterable: boolean;
};

type DocumentLocation = {
	documentId: string;
	mapId: string;
	mapImageId: string;
};

type DocumentFilterProps = {
	currentMapId?: string;
	currentMapImageId?: string;
	documents: ReadonlyArray<FilterableDocument>;
	documentLocations: ReadonlyArray<DocumentLocation>;
	selectedDocumentIds: string[];
	onSelectedDocumentsChange: (documentIds: string[]) => void;
};

export function DocumentFilter({
	currentMapId,
	currentMapImageId,
	documents,
	documentLocations,
	selectedDocumentIds,
	onSelectedDocumentsChange,
}: DocumentFilterProps) {
	const [isOpen, setIsOpen] = useState(false);
	const filterableDocuments = documents.filter(
		(document) => document.isFilterable,
	);
	const selectedDocuments = new Set(selectedDocumentIds);
	const counts = new Map<string, number>();

	for (const location of documentLocations) {
		const isInScope = currentMapImageId
			? location.mapImageId === currentMapImageId
			: !currentMapId || location.mapId === currentMapId;

		if (isInScope) {
			counts.set(
				location.documentId,
				(counts.get(location.documentId) ?? 0) + 1,
			);
		}
	}

	const resultCount = filterableDocuments.reduce((total, document) => {
		if (selectedDocuments.size > 0 && !selectedDocuments.has(document.id)) {
			return total;
		}

		return total + (counts.get(document.id) ?? 0);
	}, 0);
	const resultLabel = `${resultCount} ${resultCount === 1 ? "result" : "results"}`;
	const selectionLabel =
		selectedDocuments.size > 0
			? `${selectedDocuments.size} selected · ${resultLabel}`
			: `All · ${resultLabel}`;

	function toggleDocument(documentId: string, checked: boolean) {
		const nextSelection = checked
			? [...selectedDocumentIds, documentId]
			: selectedDocumentIds.filter((id) => id !== documentId);

		onSelectedDocumentsChange(nextSelection);
	}

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className="shrink-0 border-sidebar-border border-b"
		>
			<div className="flex min-h-14 items-stretch">
				<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 px-4 text-left text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset">
					<FileTextIcon aria-hidden="true" className="size-4 shrink-0" />
					<span className="min-w-0 flex-1">
						<span className="block font-medium text-sm">Documents</span>
						<span className="block truncate text-sidebar-foreground/70 text-xs tabular-nums">
							{selectionLabel}
						</span>
					</span>
					<CaretDownIcon
						aria-hidden="true"
						className={cn(
							"size-4 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none",
							isOpen && "rotate-180",
						)}
					/>
				</CollapsibleTrigger>
				{selectedDocuments.size > 0 ? (
					<button
						type="button"
						onClick={() => onSelectedDocumentsChange([])}
						className="min-h-11 shrink-0 px-4 font-medium text-sidebar-primary text-xs uppercase tracking-wide outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset"
					>
						Clear
					</button>
				) : null}
			</div>

			<CollapsibleContent className="max-h-[min(40svh,20rem)] overflow-auto border-sidebar-border border-t py-2">
				<fieldset>
					<legend className="sr-only">Filter locations by document</legend>
					{filterableDocuments.map((document) => {
						const count = counts.get(document.id) ?? 0;

						return (
							<label
								key={document.id}
								htmlFor={`document-filter-${document.id}`}
								className="flex min-h-11 cursor-pointer items-center gap-3 px-4 text-sidebar-foreground text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:min-h-9"
							>
								<Checkbox
									id={`document-filter-${document.id}`}
									checked={selectedDocuments.has(document.id)}
									onCheckedChange={(checked) =>
										toggleDocument(document.id, checked)
									}
								/>
								<span className="min-w-0 flex-1 truncate">{document.name}</span>
								<span className="shrink-0 text-sidebar-foreground/60 text-xs tabular-nums">
									{count}
								</span>
							</label>
						);
					})}
				</fieldset>
			</CollapsibleContent>
		</Collapsible>
	);
}
