import {
	ArrowSquareOutIcon,
	CircleNotchIcon,
	DownloadSimpleIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { buildContributionBundleIssueUrl } from "@/lib/github-links";
import type { StagedContributionLocation } from "@/lib/location-contribution-workspace";
import { cn } from "@/lib/utils";

const GITHUB_ATTACHMENT_LIMIT_BYTES = 25 * 1_048_576;
const GITHUB_ATTACHMENT_WARNING_BYTES = 24 * 1_048_576;

type ContributionReviewDialogProps = {
	documents: Array<{ id: string; name: string }>;
	disabled: boolean;
	locations: StagedContributionLocation[];
	mapImages: Array<{ id: string; mapId: string; name: string }>;
	maps: Array<{ id: string; name: string }>;
	totalBytes: number;
	onDownload: () => Promise<number>;
};

export function ContributionReviewDialog({
	documents,
	disabled,
	locations,
	mapImages,
	maps,
	totalBytes,
	onDownload,
}: ContributionReviewDialogProps) {
	const [open, setOpen] = useState(false);
	const [status, setStatus] = useState<"idle" | "downloading" | "downloaded">(
		"idle",
	);
	const [error, setError] = useState<string>();
	const [archiveBytes, setArchiveBytes] = useState<number>();
	const [largeDownloadWarningOpen, setLargeDownloadWarningOpen] =
		useState(false);
	const exceedsGitHubLimit =
		archiveBytes !== undefined && archiveBytes > GITHUB_ATTACHMENT_LIMIT_BYTES;
	const mayExceedGitHubLimit =
		exceedsGitHubLimit ||
		(archiveBytes === undefined &&
			totalBytes >= GITHUB_ATTACHMENT_WARNING_BYTES);

	const handleDownload = async () => {
		setStatus("downloading");
		setError(undefined);

		try {
			setArchiveBytes(await onDownload());
			setStatus("downloaded");
		} catch (downloadError) {
			setStatus("idle");
			setError(
				downloadError instanceof Error
					? downloadError.message
					: "The contribution ZIP could not be created. Try again.",
			);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (status === "downloading") return;
				setOpen(nextOpen);
				if (nextOpen) {
					setError(undefined);
					setArchiveBytes(undefined);
					setStatus("idle");
				}
			}}
		>
			<Button
				type="button"
				size="sm"
				className="flex-1 sm:flex-none"
				disabled={disabled || locations.length === 0}
				onClick={() => setOpen(true)}
			>
				Review &amp; download
			</Button>

			<DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
				<div className="flex flex-col gap-2 pr-10">
					<DialogTitle>Review contribution</DialogTitle>
					<DialogDescription>
						Nothing is uploaded. Verify the locations, then download one ZIP.
					</DialogDescription>
					<p className="font-heading text-sm tabular-nums">
						{locations.length} location{locations.length === 1 ? "" : "s"} ·{" "}
						{formatBytes(totalBytes)}
					</p>
				</div>

				<ol className="min-h-0 overflow-y-auto border border-border">
					{locations.map((location, index) => {
						const image = mapImages.find(
							({ id }) => id === location.mapImageId,
						);
						const map = maps.find(({ id }) => id === image?.mapId);
						const document = documents.find(
							({ id }) => id === location.documentId,
						);

						return (
							<li
								key={location.id}
								className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 border-border border-b p-4 last:border-b-0"
							>
								<span className="flex size-7 items-center justify-center border border-border font-heading text-xs tabular-nums">
									{index + 1}
								</span>
								<div className="min-w-0">
									<p className="truncate font-medium">{location.name}</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{map?.name ?? "Unknown map"} ·{" "}
										{image?.name ?? "Unknown view"} ·{" "}
										{document?.name ?? "Unknown document"}
									</p>
									<p className="mt-1 text-muted-foreground text-xs tabular-nums">
										X {location.xBasisPoints} · Y {location.yBasisPoints} ·{" "}
										{location.screenshots.length} screenshot
										{location.screenshots.length === 1 ? "" : "s"}
									</p>
								</div>
							</li>
						);
					})}
				</ol>

				<div className="flex flex-col gap-4">
					<div
						className={cn(
							"flex gap-2 text-muted-foreground text-xs leading-relaxed",
							mayExceedGitHubLimit && "text-rowdy-orange",
						)}
					>
						<WarningIcon className="mt-0.5 shrink-0" aria-hidden="true" />
						<p>
							GitHub attachments are public and limited to 25 MiB.
							{exceedsGitHubLimit
								? ` This ${formatBytes(archiveBytes)} ZIP is too large for GitHub. Arrange the transfer with the maintainer through a trusted private channel. Do not paste private download links into a public issue.`
								: mayExceedGitHubLimit
									? " The final ZIP may exceed that limit; its exact size will be checked after download."
									: " Attach the downloaded ZIP only if you are comfortable making it public."}
						</p>
					</div>

					{error ? (
						<p role="alert" className="text-destructive text-sm">
							{error}
						</p>
					) : null}
					{status === "downloaded" ? (
						<p role="status" className="text-sm">
							{exceedsGitHubLimit
								? "ZIP downloaded, but it is too large for GitHub. Arrange a private transfer with the maintainer."
								: "ZIP downloaded. Attach it to a GitHub issue to send the contribution."}
						</p>
					) : null}

					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="ghost"
							disabled={status === "downloading"}
							onClick={() => setOpen(false)}
						>
							Back to editor
						</Button>
						{status === "downloaded" && !exceedsGitHubLimit ? (
							<a
								href={buildContributionBundleIssueUrl()}
								target="_blank"
								rel="noreferrer"
								className={buttonVariants({ variant: "outline" })}
							>
								Open GitHub issue
								<ArrowSquareOutIcon data-icon="inline-end" aria-hidden="true" />
							</a>
						) : null}
						<Button
							type="button"
							disabled={status === "downloading"}
							onClick={() => {
								if (
									archiveBytes === undefined &&
									totalBytes >= GITHUB_ATTACHMENT_WARNING_BYTES
								) {
									setLargeDownloadWarningOpen(true);
									return;
								}

								void handleDownload();
							}}
						>
							{status === "downloading" ? (
								<CircleNotchIcon
									className="animate-spin motion-reduce:animate-none"
									data-icon="inline-start"
									aria-hidden="true"
								/>
							) : (
								<DownloadSimpleIcon
									data-icon="inline-start"
									aria-hidden="true"
								/>
							)}
							{status === "downloading"
								? "Verifying & creating ZIP…"
								: status === "downloaded"
									? "Download again"
									: "Download ZIP"}
						</Button>
					</div>
				</div>
			</DialogContent>
			<AlertDialog
				open={largeDownloadWarningOpen}
				onOpenChange={setLargeDownloadWarningOpen}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>ZIP may exceed GitHub's limit</AlertDialogTitle>
						<AlertDialogDescription>
							This contribution already contains {formatBytes(totalBytes)} of
							screenshots before ZIP metadata. You can download it, but GitHub
							may not accept it. Arrange an oversized transfer with the
							maintainer through a trusted private channel; never paste private
							download links into a public issue.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setLargeDownloadWarningOpen(false);
								void handleDownload();
							}}
						>
							Download anyway
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Dialog>
	);
}

function formatBytes(bytes: number) {
	if (bytes < 1_048_576) return `${Math.ceil(bytes / 1_024)} KiB`;
	return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}
