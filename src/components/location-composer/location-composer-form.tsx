import type { ReactNode } from "react";

import { LocationAccessFields } from "@/components/location-composer/location-access-fields";
import { LocationDetailsFields } from "@/components/location-composer/location-details-fields";
import type {
	LocationComposerDraft,
	LocationDraftChange,
} from "@/components/location-composer/location-draft";
import {
	LocationScreenshotEditor,
	type ScreenshotDraft,
} from "@/components/location-composer/location-screenshot-editor";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type LocationComposerFormProps = {
	additionalFields?: ReactNode;
	availableDocuments: Array<{ id: string; name: string }>;
	availableKeys: Array<{
		id: string;
		imageHeight: number;
		imagePath: string;
		imageWidth: number;
		name: string;
	}>;
	className?: string;
	disabled: boolean;
	draft: LocationComposerDraft;
	draftMapId: string;
	error?: string;
	eyebrow: string;
	keyboardSubmitHint: string;
	mapImages: Array<{ id: string; name: string }>;
	maps: Array<{ id: string; name: string }>;
	maxScreenshots: number;
	screenshots: ScreenshotDraft[];
	screenshotDescription?: string;
	secondaryActions?: ReactNode;
	submitLabel: string;
	submitting: boolean;
	submittingLabel: string;
	title: string;
	onDraftChange: LocationDraftChange;
	onMapChange: (mapId: string) => void;
	onScreenshotFilesAdded: (files: File[]) => void;
	onScreenshotMove: (index: number, offset: -1 | 1) => void;
	onScreenshotRemove: (key: string) => void;
	onScreenshotUpdate: (
		key: string,
		field: "altText" | "caption",
		value: string,
	) => void;
	onSubmit: () => void;
};

export function LocationComposerForm({
	additionalFields,
	availableDocuments,
	availableKeys,
	className,
	disabled,
	draft,
	draftMapId,
	error,
	eyebrow,
	keyboardSubmitHint,
	mapImages,
	maps,
	maxScreenshots,
	screenshots,
	screenshotDescription,
	secondaryActions,
	submitLabel,
	submitting,
	submittingLabel,
	title,
	onDraftChange,
	onMapChange,
	onScreenshotFilesAdded,
	onScreenshotMove,
	onScreenshotRemove,
	onScreenshotUpdate,
	onSubmit,
}: LocationComposerFormProps) {
	return (
		<aside className={cn("min-h-0 overflow-auto bg-card p-5", className)}>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
				}}
				onKeyDown={(event) => {
					if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
						event.currentTarget.requestSubmit();
					}
				}}
				className="flex flex-col gap-6"
			>
				<div>
					<p className="font-heading text-muted-foreground text-sm uppercase tracking-wide">
						{eyebrow}
					</p>
					<h2 className="mt-1 text-balance font-heading font-medium text-2xl tracking-tight">
						{title}
					</h2>
				</div>

				<FieldGroup>
					<LocationDetailsFields
						draft={draft}
						draftMapId={draftMapId}
						keyboardSubmitHint={keyboardSubmitHint}
						mapImages={mapImages}
						maps={maps}
						onDraftChange={onDraftChange}
						onMapChange={onMapChange}
					/>
					<LocationAccessFields
						availableDocuments={availableDocuments}
						availableKeys={availableKeys}
						draft={draft}
						onDraftChange={onDraftChange}
					/>
					<LocationScreenshotEditor
						description={screenshotDescription}
						disabled={disabled}
						maxScreenshots={maxScreenshots}
						screenshots={screenshots}
						onFilesAdded={onScreenshotFilesAdded}
						onMove={onScreenshotMove}
						onRemove={onScreenshotRemove}
						onUpdate={onScreenshotUpdate}
					/>

					{additionalFields}
					{error && <FieldError>{error}</FieldError>}
				</FieldGroup>

				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" disabled={disabled}>
						{submitting ? submittingLabel : submitLabel}
					</Button>
					{secondaryActions}
				</div>
			</form>
		</aside>
	);
}
