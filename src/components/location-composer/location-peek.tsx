import { CheckIcon, CopyIcon, WarningIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useState } from "react";

import { KeyRequirementIndicator } from "@/components/map/key-requirement-indicator";
import { MapMarkerPreviewImage } from "@/components/map/map-marker-preview";
import { Button } from "@/components/ui/button";
import { PopoverTitle } from "@/components/ui/popover";
import { readClipboardError, writeClipboardText } from "@/lib/clipboard";
import type { MapMarkerPreview } from "@/lib/map-marker-preview";

export type LocationPeekLocation = {
	description?: string | null;
	documentName?: string;
	markerLabel?: string;
	name: string;
	preview?: MapMarkerPreview;
	requiredKeyCount?: number;
	xBasisPoints: number;
	yBasisPoints: number;
};

type LocationPeekProps = {
	location: LocationPeekLocation;
	/** Omitted where the location cannot be edited, such as published ones in the public editor. */
	onEdit?: () => void;
	onUsePosition: () => void;
};

export function LocationPeek({
	location,
	onEdit,
	onUsePosition,
}: LocationPeekProps) {
	const position = `${location.xBasisPoints}, ${location.yBasisPoints}`;
	const eyebrow = [
		location.markerLabel ? `#${location.markerLabel}` : undefined,
		location.documentName,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div data-slot="location-peek" className="flex flex-col">
			<div className="flex items-start gap-3 border-border border-b px-3.5 py-3">
				<div className="min-w-0 flex-1">
					{eyebrow ? (
						<p className="font-heading text-[0.6875rem] text-primary uppercase tracking-widest">
							{eyebrow}
						</p>
					) : null}
					<PopoverTitle className="mt-1 break-words font-heading font-semibold text-sm">
						{location.name}
					</PopoverTitle>
				</div>
				<CopyTextButton label="Copy name" text={location.name} />
			</div>

			{location.preview ? (
				<MapMarkerPreviewImage
					className="h-36 text-muted-foreground"
					name={location.name}
					preview={location.preview}
				/>
			) : null}

			{location.description ? (
				<PeekRow label="Description">
					<p className="break-words">{location.description}</p>
					<CopyTextButton
						label="Copy description"
						text={location.description}
					/>
				</PeekRow>
			) : null}

			<PeekRow label="Position · X, Y">
				<p className="font-heading tabular-nums">{position}</p>
				<CopyTextButton label="Copy position" text={position} />
			</PeekRow>

			{(location.requiredKeyCount ?? 0) > 0 ? (
				<p className="flex items-center gap-2 border-border border-b px-3.5 py-2.5 text-muted-foreground text-xs">
					<KeyRequirementIndicator />
					Requires key access
				</p>
			) : null}

			<div className="flex gap-2 p-3.5">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="flex-1"
					onClick={onUsePosition}
				>
					Use position
				</Button>
				{onEdit ? (
					<Button type="button" size="sm" className="flex-1" onClick={onEdit}>
						Edit
					</Button>
				) : null}
			</div>
		</div>
	);
}

function PeekRow({
	children,
	label,
}: {
	children: [ReactNode, ReactNode];
	label: string;
}) {
	const [value, action] = children;

	return (
		<div className="flex items-start gap-3 border-border border-b px-3.5 py-2.5 text-sm">
			<div className="min-w-0 flex-1">
				<p className="mb-1 font-heading text-[0.6875rem] text-muted-foreground uppercase tracking-wider">
					{label}
				</p>
				{value}
			</div>
			{action}
		</div>
	);
}

type CopyStatus = "copied" | "error" | "idle";

const COPY_FEEDBACK_MS = 1_500;

function CopyTextButton({ label, text }: { label: string; text: string }) {
	const [status, setStatus] = useState<CopyStatus>("idle");
	const [message, setMessage] = useState("");

	useEffect(() => {
		if (status === "idle") return;
		const timeout = window.setTimeout(() => {
			setStatus("idle");
			setMessage("");
		}, COPY_FEEDBACK_MS);
		return () => window.clearTimeout(timeout);
	}, [status]);

	async function copy() {
		try {
			await writeClipboardText(text);
			setStatus("copied");
			setMessage(`${label.replace(/^Copy /, "")} copied.`);
		} catch (error) {
			setStatus("error");
			setMessage(readClipboardError(error));
		}
	}

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				aria-label={label}
				title={label}
				onClick={() => void copy()}
			>
				{status === "copied" ? (
					<CheckIcon aria-hidden="true" />
				) : status === "error" ? (
					<WarningIcon aria-hidden="true" />
				) : (
					<CopyIcon aria-hidden="true" />
				)}
			</Button>
			<span className="sr-only" aria-live="polite">
				{message}
			</span>
		</>
	);
}
