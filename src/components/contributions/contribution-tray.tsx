import {
	MapPinIcon,
	PencilSimpleIcon,
	PlusIcon,
	TrashIcon,
} from "@phosphor-icons/react";

import { ContributionReviewDialog } from "@/components/contributions/contribution-review-dialog";
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
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { MAX_CONTRIBUTION_LOCATIONS } from "@/lib/location-contribution";
import type { StagedContributionLocation } from "@/lib/location-contribution-workspace";
import { cn } from "@/lib/utils";

type ContributionTrayProps = {
	disabled: boolean;
	documents: Array<{ id: string; name: string }>;
	editingLocationId?: string;
	locations: StagedContributionLocation[];
	mapImages: Array<{ id: string; mapId: string; name: string }>;
	maps: Array<{ id: string; name: string }>;
	totalBytes: number;
	warnAboutSize: boolean;
	onCreate: () => void;
	onDownload: () => Promise<number>;
	onEdit: (locationId: string) => void;
	onRemove: (locationId: string) => void;
};

export function ContributionTray({
	disabled,
	documents,
	editingLocationId,
	locations,
	mapImages,
	maps,
	totalBytes,
	warnAboutSize,
	onCreate,
	onDownload,
	onEdit,
	onRemove,
}: ContributionTrayProps) {
	return (
		<section
			aria-labelledby="contribution-tray-title"
			className="flex min-h-64 flex-col border-border border-t bg-card lg:min-h-[30svh]"
		>
			<div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:flex-nowrap sm:px-5">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2
							id="contribution-tray-title"
							className="font-heading font-semibold text-sm uppercase tracking-wider"
						>
							Contribution tray
						</h2>
						<span className="text-muted-foreground text-xs tabular-nums">
							{locations.length} of {MAX_CONTRIBUTION_LOCATIONS} ·{" "}
							{formatBytes(totalBytes)}
						</span>
					</div>
					<p
						className={cn(
							"mt-1 text-muted-foreground text-xs",
							warnAboutSize && "text-destructive",
						)}
					>
						{warnAboutSize
							? "This bundle is large. Review its screenshots before download."
							: "Files stay in this browser until you download the bundle."}
					</p>
				</div>
				<div className="flex w-full gap-2 sm:w-auto">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="flex-1 sm:flex-none"
						disabled={
							disabled || locations.length >= MAX_CONTRIBUTION_LOCATIONS
						}
						onClick={onCreate}
					>
						<PlusIcon data-icon="inline-start" aria-hidden="true" />
						New
					</Button>
					<ContributionReviewDialog
						disabled={disabled}
						documents={documents}
						locations={locations}
						mapImages={mapImages}
						maps={maps}
						totalBytes={totalBytes}
						onDownload={onDownload}
					/>
				</div>
			</div>

			{locations.length === 0 ? (
				<Empty className="min-h-40 flex-1 border-border border-t p-6">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MapPinIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No locations staged</EmptyTitle>
						<EmptyDescription>
							Place a marker, complete the form, and add it to this tray.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ol className="min-h-0 flex-1 overflow-auto border-border border-t">
					{locations.map((location, index) => {
						const image = mapImages.find(
							({ id }) => id === location.mapImageId,
						);
						const map = maps.find(({ id }) => id === image?.mapId);
						const document = documents.find(
							({ id }) => id === location.documentId,
						);
						const isEditing = location.id === editingLocationId;

						return (
							<li
								key={location.id}
								className={cn(
									"flex min-h-16 items-center gap-3 border-border border-b px-4 py-2 last:border-b-0 sm:px-5",
									isEditing && "bg-muted",
								)}
							>
								<span className="flex size-7 shrink-0 items-center justify-center border border-border font-heading text-xs tabular-nums">
									{index + 1}
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{location.name}</p>
									<p className="truncate text-muted-foreground text-xs">
										{map?.name ?? "Unknown map"} ·{" "}
										{document?.name ?? "Unknown document"}
										{" · "}
										{location.screenshots.length} screenshot
										{location.screenshots.length === 1 ? "" : "s"}
									</p>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={`Edit ${location.name}`}
									disabled={disabled}
									onClick={() => onEdit(location.id)}
								>
									<PencilSimpleIcon aria-hidden="true" />
								</Button>
								<AlertDialog>
									<AlertDialogTrigger
										render={
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												aria-label={`Remove ${location.name}`}
												disabled={disabled}
											/>
										}
									>
										<TrashIcon aria-hidden="true" />
									</AlertDialogTrigger>
									<AlertDialogContent size="sm">
										<AlertDialogHeader>
											<AlertDialogTitle>Remove this location?</AlertDialogTitle>
											<AlertDialogDescription>
												The location and its screenshots will be removed from
												this browser.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												variant="destructive"
												onClick={() => onRemove(location.id)}
											>
												Remove
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</li>
						);
					})}
				</ol>
			)}
		</section>
	);
}

function formatBytes(bytes: number) {
	if (bytes < 1_048_576) {
		return `${Math.ceil(bytes / 1_024)} KiB`;
	}

	return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}
