import {
	ArrowDownIcon,
	ArrowUpIcon,
	ImageIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ScreenshotDraft = {
	altText: string;
	caption: string;
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
	onUpdate: (key: string, field: "altText" | "caption", value: string) => void;
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
	onUpdate,
}: LocationScreenshotEditorProps) {
	return (
		<FieldSet className={cn(className)}>
			<FieldLegend variant="label">Screenshots</FieldLegend>
			<FieldDescription id="location-screenshots-description">
				{description}
			</FieldDescription>

			<Field>
				<FieldLabel htmlFor="location-screenshots">Add images</FieldLabel>
				<Input
					id="location-screenshots"
					type="file"
					accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
					multiple
					aria-describedby="location-screenshots-description"
					disabled={disabled || screenshots.length >= maxScreenshots}
					onChange={(event) => {
						onFilesAdded(Array.from(event.target.files ?? []));
						event.target.value = "";
					}}
				/>
			</Field>

			{screenshots.length > 0 ? (
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
							onUpdate={onUpdate}
						/>
					))}
				</ol>
			) : (
				<div className="flex min-h-32 flex-col items-center justify-center gap-2 border border-input border-dashed bg-background p-4 text-center">
					<ImageIcon aria-hidden="true" className="text-muted-foreground" />
					<p className="text-muted-foreground text-sm">
						No screenshots added yet.
					</p>
				</div>
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
	onUpdate: LocationScreenshotEditorProps["onUpdate"];
};

function ScreenshotItem({
	disabled,
	index,
	screenshot,
	total,
	onMove,
	onRemove,
	onUpdate,
}: ScreenshotItemProps) {
	const altInputId = `screenshot-${screenshot.key}-alt`;
	const captionInputId = `screenshot-${screenshot.key}-caption`;
	const previewImageRef = useRef<HTMLImageElement>(null);
	const file = screenshot.file;

	useEffect(() => {
		const previewImage = previewImageRef.current;

		if (!file || !previewImage) {
			return;
		}

		return attachFilePreview(previewImage, file);
	}, [file]);

	return (
		<li className="overflow-hidden border border-border bg-background">
			<div className="aspect-video bg-muted">
				<img
					ref={previewImageRef}
					src={file ? undefined : screenshot.previewUrl}
					alt={screenshot.altText}
					width={screenshot.width}
					height={screenshot.height}
					draggable={false}
					className="size-full object-contain"
				/>
			</div>

			<div className="flex flex-col gap-4 p-3">
				<Field>
					<FieldLabel htmlFor={altInputId}>Alt text (optional)</FieldLabel>
					<Input
						id={altInputId}
						value={screenshot.altText}
						onChange={(event) =>
							onUpdate(screenshot.key, "altText", event.target.value)
						}
						maxLength={240}
						placeholder="Only when the image adds information"
					/>
					<FieldDescription>
						Leave blank when the location description already explains the
						image.
					</FieldDescription>
				</Field>

				<Field>
					<FieldLabel htmlFor={captionInputId}>Caption</FieldLabel>
					<Textarea
						id={captionInputId}
						value={screenshot.caption}
						onChange={(event) =>
							onUpdate(screenshot.key, "caption", event.target.value)
						}
						maxLength={500}
						rows={2}
						placeholder="Optional route or viewpoint note"
					/>
				</Field>

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

function attachFilePreview(image: HTMLImageElement, file: File) {
	const previewUrl = URL.createObjectURL(file);
	image.src = previewUrl;

	return () => URL.revokeObjectURL(previewUrl);
}
