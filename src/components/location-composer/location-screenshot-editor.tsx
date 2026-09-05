import {
	ArrowDownIcon,
	ArrowUpIcon,
	ImageIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { FilePicker } from "@/components/ui/file-picker";
import { createLocationContributionThumbnail } from "@/lib/location-contribution-image";
import { cn } from "@/lib/utils";

export type ScreenshotDraft = {
	file?: File;
	height?: number;
	id?: string;
	key: string;
	previewUrl?: string;
	width?: number;
};

type LocationScreenshotEditorProps = {
	className?: string;
	description?: string;
	disabled: boolean;
	maxScreenshots: number;
	screenshots: ScreenshotDraft[];
	onFilesAdded: (files: File[]) => void;
	onMove: (index: number, offset: -1 | 1) => void;
	onRemove: (key: string) => void;
};

export function LocationScreenshotEditor({
	className,
	description = "Add at least one JPEG, PNG, or WebP image. Saving generates 1000px and 1920px WebP variants without cropping.",
	disabled,
	maxScreenshots,
	screenshots,
	onFilesAdded,
	onMove,
	onRemove,
}: LocationScreenshotEditorProps) {
	const pickerDisabled = disabled || screenshots.length >= maxScreenshots;

	return (
		<FieldSet className={cn(className)}>
			<FieldLegend variant="label">Screenshots</FieldLegend>
			<FieldDescription id="location-screenshots-description">
				{description}
			</FieldDescription>

			{screenshots.length > 0 ? (
				<>
					<div className="flex items-center justify-between gap-3">
						<FilePicker
							accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
							buttonLabel="Add screenshots"
							buttonVariant="outline"
							describedBy="location-screenshots-description"
							disabled={pickerDisabled}
							multiple
							variant="button"
							onFilesSelected={onFilesAdded}
						/>
						<span className="text-muted-foreground text-xs tabular-nums">
							{screenshots.length} of {maxScreenshots}
						</span>
					</div>
					<ol className="flex flex-col gap-4">
						{screenshots.map((screenshot, index) => (
							<ScreenshotItem
								key={screenshot.key}
								disabled={disabled}
								index={index}
								screenshot={screenshot}
								total={screenshots.length}
								onMove={onMove}
								onRemove={onRemove}
							/>
						))}
					</ol>
				</>
			) : (
				<FilePicker
					accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
					buttonLabel="Choose screenshots"
					describedBy="location-screenshots-description"
					disabled={pickerDisabled}
					dropLabel="Drop screenshots here"
					helpText="JPEG, PNG, or WebP. You can select more than one file."
					icon={
						<ImageIcon aria-hidden="true" className="text-muted-foreground" />
					}
					multiple
					regionLabel="Screenshot upload"
					onFilesSelected={onFilesAdded}
				/>
			)}
		</FieldSet>
	);
}

type ScreenshotItemProps = {
	disabled: boolean;
	index: number;
	screenshot: ScreenshotDraft;
	total: number;
	onMove: (index: number, offset: -1 | 1) => void;
	onRemove: (key: string) => void;
};

function ScreenshotItem({
	disabled,
	index,
	screenshot,
	total,
	onMove,
	onRemove,
}: ScreenshotItemProps) {
	const file = screenshot.file;
	const [preview, setPreview] = useState<{
		file: File;
		url?: string;
		error?: string;
	}>();
	const currentPreview = preview?.file === file ? preview : undefined;
	if (preview && preview.file !== file) setPreview(undefined);

	useEffect(() => {
		if (!file) return;
		const controller = new AbortController();
		let url: string | undefined;
		void createLocationContributionThumbnail(file, controller.signal)
			.then((blob) => {
				if (controller.signal.aborted) return;
				url = URL.createObjectURL(blob);
				setPreview({ file, url });
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setPreview({
					file,
					error:
						error instanceof Error
							? error.message
							: "Could not preview screenshot",
				});
			});
		return () => {
			controller.abort();
			if (url) URL.revokeObjectURL(url);
		};
	}, [file]);

	return (
		<li className="overflow-hidden border border-border bg-background">
			<div className="aspect-video bg-muted">
				{file && !currentPreview?.url ? (
					<p
						role={currentPreview?.error ? "alert" : "status"}
						className="p-3 text-muted-foreground text-sm"
					>
						{currentPreview?.error ?? "Checking screenshot..."}
					</p>
				) : (
					<img
						src={file ? currentPreview?.url : screenshot.previewUrl}
						alt=""
						width={screenshot.width}
						height={screenshot.height}
						draggable={false}
						className="size-full object-contain"
					/>
				)}
			</div>

			<div className="p-3">
				<div className="flex items-center gap-1">
					<span className="mr-auto text-muted-foreground text-xs tabular-nums">
						{index + 1} of {total}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Move screenshot ${index + 1} up`}
						disabled={disabled || index === 0}
						onClick={() => onMove(index, -1)}
					>
						<ArrowUpIcon aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Move screenshot ${index + 1} down`}
						disabled={disabled || index === total - 1}
						onClick={() => onMove(index, 1)}
					>
						<ArrowDownIcon aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Remove screenshot ${index + 1}`}
						className="text-destructive hover:text-destructive"
						disabled={disabled}
						onClick={() => onRemove(screenshot.key)}
					>
						<TrashIcon aria-hidden="true" />
					</Button>
				</div>
			</div>
		</li>
	);
}
