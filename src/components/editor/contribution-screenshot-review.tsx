import {
	ArrowCounterClockwiseIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	DownloadSimpleIcon,
	EyeSlashIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { downloadBrowserBlob } from "@/lib/browser-download";
import type { ReviewedContributionScreenshot } from "@/lib/location-contribution-archive-reader";
import type {
	ContributionScreenshotReplacement,
	ContributionScreenshotReviewDraft,
} from "@/lib/location-contribution-review";
import { cn } from "@/lib/utils";

type ContributionScreenshotReviewProps = {
	disabled: boolean;
	draft: ContributionScreenshotReviewDraft;
	index: number;
	source: ReviewedContributionScreenshot;
	total: number;
	onIncludedChange: (included: boolean) => void;
	onMove: (offset: -1 | 1) => void;
	onReplacementFile: (file: File) => void;
	onReplacementChange: (
		replacement: ContributionScreenshotReplacement | undefined,
	) => void;
};

export function ContributionScreenshotReview({
	disabled,
	draft,
	index,
	source,
	total,
	onIncludedChange,
	onMove,
	onReplacementFile,
	onReplacementChange,
}: ContributionScreenshotReviewProps) {
	const status = !draft.included
		? "Excluded"
		: draft.replacement
			? "Replaced"
			: "Original";

	return (
		<li
			className={cn(
				"overflow-hidden border border-border bg-background transition-opacity",
				!draft.included && "opacity-60",
			)}
		>
			<div className="flex items-center gap-3 border-border border-b bg-card px-4 py-3">
				<span className="font-heading text-muted-foreground text-xs tabular-nums">
					{String(index + 1).padStart(2, "0")}
				</span>
				<Badge variant={status === "Excluded" ? "destructive" : "secondary"}>
					{status}
				</Badge>
				<span className="ml-auto text-muted-foreground text-xs tabular-nums">
					{formatBytes((draft.replacement?.file ?? source.file).size)}
				</span>
			</div>

			{draft.replacement ? (
				<div className="grid sm:grid-cols-2">
					<ScreenshotPreview
						altText={`ZIP original screenshot ${index + 1}`}
						file={source.file}
						label="ZIP original"
					/>
					<ScreenshotPreview
						altText={`Replacement preview for screenshot ${index + 1}`}
						className="border-border border-t sm:border-t-0 sm:border-l"
						file={draft.replacement.file}
						label="Replacement"
					/>
				</div>
			) : (
				<ScreenshotPreview
					altText={`Screenshot ${index + 1} preview`}
					file={source.file}
				/>
			)}

			<div className="space-y-3 p-4">
				{source.caption ? (
					<p className="text-muted-foreground text-sm">{source.caption}</p>
				) : null}
				{draft.replacementError ? (
					<p role="alert" className="text-destructive text-sm">
						{draft.replacementError}
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="xs"
						aria-label={`Download original screenshot ${index + 1}`}
						disabled={disabled}
						onClick={() => downloadBrowserBlob(source.file, source.file.name)}
					>
						<DownloadSimpleIcon data-icon="inline-start" aria-hidden="true" />
						Download original
					</Button>
					<FilePicker
						accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
						buttonAriaLabel={`${draft.isCheckingReplacement ? "Checking replacement for" : "Choose replacement for"} screenshot ${index + 1}`}
						buttonLabel={draft.isCheckingReplacement ? "Checking…" : "Replace"}
						buttonSize="xs"
						buttonVariant="outline"
						disabled={disabled || draft.isCheckingReplacement}
						inputLabel={`Replace screenshot ${index + 1}`}
						variant="button"
						onFilesSelected={([file]) => {
							if (file) onReplacementFile(file);
						}}
					/>
					{draft.replacement ? (
						<Button
							type="button"
							variant="ghost"
							size="xs"
							aria-label={`Undo replacement for screenshot ${index + 1}`}
							disabled={disabled || draft.isCheckingReplacement}
							onClick={() => onReplacementChange(undefined)}
						>
							<ArrowCounterClockwiseIcon
								data-icon="inline-start"
								aria-hidden="true"
							/>
							Undo replacement
						</Button>
					) : null}
					<Button
						type="button"
						variant="ghost"
						size="xs"
						aria-label={`${draft.included ? "Exclude" : "Restore"} screenshot ${index + 1}`}
						className={cn(
							draft.included && "text-destructive hover:text-destructive",
						)}
						disabled={disabled || draft.isCheckingReplacement}
						onClick={() => onIncludedChange(!draft.included)}
					>
						{draft.included ? (
							<EyeSlashIcon data-icon="inline-start" aria-hidden="true" />
						) : (
							<ArrowCounterClockwiseIcon
								data-icon="inline-start"
								aria-hidden="true"
							/>
						)}
						{draft.included ? "Exclude" : "Restore"}
					</Button>
					<div className="ml-auto flex gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={`Move screenshot ${index + 1} up`}
							disabled={disabled || draft.isCheckingReplacement || index === 0}
							onClick={() => onMove(-1)}
						>
							<ArrowUpIcon aria-hidden="true" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={`Move screenshot ${index + 1} down`}
							disabled={
								disabled || draft.isCheckingReplacement || index === total - 1
							}
							onClick={() => onMove(1)}
						>
							<ArrowDownIcon aria-hidden="true" />
						</Button>
					</div>
				</div>
			</div>
		</li>
	);
}

function ScreenshotPreview({
	altText,
	className,
	file,
	label,
}: {
	altText: string;
	className?: string;
	file: File;
	label?: string;
}) {
	const [url, setUrl] = useState<string>();

	useEffect(() => {
		const nextUrl = URL.createObjectURL(file);
		setUrl(nextUrl);
		return () => URL.revokeObjectURL(nextUrl);
	}, [file]);

	return (
		<figure className={cn("relative aspect-video bg-muted", className)}>
			{label ? (
				<figcaption className="absolute top-0 left-0 z-10 bg-background/90 px-2 py-1 font-heading text-[0.625rem] uppercase tracking-wider">
					{label}
				</figcaption>
			) : null}
			{url ? (
				<img src={url} alt={altText} className="size-full object-contain" />
			) : null}
		</figure>
	);
}

function formatBytes(bytes: number) {
	return `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MiB`;
}
