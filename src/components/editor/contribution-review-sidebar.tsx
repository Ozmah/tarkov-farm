import { CheckCircleIcon } from "@phosphor-icons/react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ReviewedLocationContributionArchive } from "@/lib/location-contribution-archive-reader";
import {
	type ContributionLocationImportState,
	type ContributionLocationReviewDraft,
	getContributionLocationChangeCount,
} from "@/lib/location-contribution-review";
import { cn } from "@/lib/utils";

type ContributionReviewSidebarProps = {
	drafts: Record<string, ContributionLocationReviewDraft>;
	error?: string;
	importStates: Record<string, ContributionLocationImportState>;
	isCheckingReplacement: boolean;
	isImporting: boolean;
	modifiedCount: number;
	reviewed: ReviewedLocationContributionArchive;
	selectedCount: number;
	selectedId?: string;
	onDiscard: () => void;
	onImport: () => void;
	onIncludeChange: (locationId: string, included: boolean) => void;
	onSelect: (locationId: string) => void;
};

export function ContributionReviewSidebar({
	drafts,
	error,
	importStates,
	isCheckingReplacement,
	isImporting,
	modifiedCount,
	reviewed,
	selectedCount,
	selectedId,
	onDiscard,
	onImport,
	onIncludeChange,
	onSelect,
}: ContributionReviewSidebarProps) {
	return (
		<aside className="flex flex-col border-border border-b bg-card lg:min-h-0 lg:border-r lg:border-b-0">
			<div className="border-border border-b p-5">
				<h2 className="font-heading font-semibold text-lg uppercase tracking-wider">
					Review bundle
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Inspect, amend, and select only the locations that should be imported.
				</p>
				<div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground text-xs tabular-nums">
					<span>{reviewed.locations.length} locations</span>
					<span>{selectedCount} selected</span>
					<span>{modifiedCount} modified</span>
				</div>
				<p className="mt-3 break-all font-heading text-[0.625rem] text-muted-foreground tabular-nums">
					Bundle {reviewed.bundleId}
				</p>
			</div>

			<div className="divide-y divide-border lg:min-h-0 lg:flex-1 lg:overflow-auto">
				{reviewed.locations.map((location, index) => {
					const state = importStates[location.id];
					const draft = drafts[location.id];
					if (!draft) return null;
					const changeCount = getContributionLocationChangeCount(
						draft,
						location,
					);
					const name = draft.values.name || location.name;
					return (
						<div
							key={location.id}
							className={cn(
								"flex gap-3 p-4 transition-colors",
								selectedId === location.id && "bg-accent",
							)}
						>
							<Checkbox
								aria-label={`Include ${name} in import`}
								checked={state?.status === "imported" || draft.included}
								disabled={isImporting || state?.status === "imported"}
								onCheckedChange={(included) =>
									onIncludeChange(location.id, included)
								}
							/>
							<button
								type="button"
								className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => onSelect(location.id)}
							>
								<span className="flex items-center justify-between gap-3 font-heading text-muted-foreground text-xs tabular-nums">
									{String(index + 1).padStart(2, "0")}
									{changeCount > 0 ? (
										<Badge>{changeCount} changed</Badge>
									) : null}
								</span>
								<span className="mt-1 block truncate font-semibold">
									{name}
								</span>
								<span className="mt-1 block text-muted-foreground text-xs">
									{stateLabel(state, draft.included, changeCount)}
								</span>
							</button>
						</div>
					);
				})}
			</div>

			<div className="space-y-3 border-border border-t p-4">
				{error ? (
					<p role="alert" className="text-destructive text-sm">
						{error}
					</p>
				) : null}
				<Button
					type="button"
					className="w-full"
					disabled={isImporting || isCheckingReplacement || selectedCount === 0}
					onClick={onImport}
				>
					<CheckCircleIcon data-icon="inline-start" />
					{isImporting
						? "Saving selected locations…"
						: isCheckingReplacement
							? "Checking replacement…"
							: `Import selected (${selectedCount})`}
				</Button>
				<AlertDialog>
					<AlertDialogTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								disabled={isImporting}
							/>
						}
					>
						Discard bundle
					</AlertDialogTrigger>
					<AlertDialogContent size="sm">
						<AlertDialogHeader>
							<AlertDialogTitle>Discard this review?</AlertDialogTitle>
							<AlertDialogDescription>
								Unimported locations, review changes, and in-memory screenshots
								will be removed. Already imported locations remain saved
								locally.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Keep reviewing</AlertDialogCancel>
							<AlertDialogAction variant="destructive" onClick={onDiscard}>
								Discard bundle
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</aside>
	);
}

function stateLabel(
	state: ContributionLocationImportState | undefined,
	included: boolean,
	changeCount: number,
) {
	if (state?.status === "imported") return "Saved as a local change";
	if (state?.status === "importing") return "Processing screenshots…";
	if (state?.status === "failed") return "Import failed — review the error";
	if (included)
		return changeCount > 0 ? "Modified · Selected" : "Selected for import";
	return changeCount > 0 ? "Modified · Not selected" : "Awaiting review";
}
