import {
	CheckIcon,
	CircleNotchIcon,
	ImageIcon,
	LinkSimpleIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import {
	canvasToPngBlob,
	type LocationImageInput,
	renderPublicLocationImage,
} from "@/components/location-image/location-image-renderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyStatus = "copied" | "copying" | "error" | "idle";

const FEEDBACK_DURATION_MS = 2_500;

type LocationShareControlsProps = {
	className?: string;
	imageInput: LocationImageInput;
	locationId: string;
	mapId: string;
	viewKey: string;
};

export function LocationShareControls({
	className,
	imageInput,
	locationId,
	mapId,
	viewKey,
}: LocationShareControlsProps) {
	const [linkStatus, setLinkStatus] = useState<CopyStatus>("idle");
	const [imageStatus, setImageStatus] = useState<CopyStatus>("idle");
	const [statusMessage, setStatusMessage] = useState("");
	const busy = linkStatus === "copying" || imageStatus === "copying";

	useEffect(() => {
		const hasFinished =
			linkStatus === "copied" ||
			linkStatus === "error" ||
			imageStatus === "copied" ||
			imageStatus === "error";
		if (!hasFinished) return;

		const timeout = window.setTimeout(() => {
			setLinkStatus("idle");
			setImageStatus("idle");
			setStatusMessage("");
		}, FEEDBACK_DURATION_MS);

		return () => window.clearTimeout(timeout);
	}, [imageStatus, linkStatus]);

	async function copyLink() {
		setLinkStatus("copying");
		setImageStatus("idle");
		try {
			if (!window.isSecureContext || !navigator.clipboard?.writeText) {
				throw new Error(
					"Clipboard access is unavailable. Copy the browser URL instead.",
				);
			}

			const shareUrl = new URL(
				createLocationSharePath({ locationId, mapId, viewKey }),
				window.location.origin,
			);
			await navigator.clipboard.writeText(shareUrl.href);
			setLinkStatus("copied");
			setStatusMessage("Location link copied to clipboard.");
		} catch (error) {
			setLinkStatus("error");
			setStatusMessage(readCopyError(error));
		}
	}

	async function copyImage() {
		setImageStatus("copying");
		setLinkStatus("idle");
		try {
			if (
				!window.isSecureContext ||
				!navigator.clipboard?.write ||
				typeof ClipboardItem === "undefined"
			) {
				throw new Error("This browser cannot copy PNG images.");
			}

			const pngPromise = createPublicLocationPng(imageInput);
			await navigator.clipboard.write([
				new ClipboardItem({ "image/png": pngPromise }),
			]);
			setImageStatus("copied");
			setStatusMessage("Location image copied to clipboard.");
		} catch (error) {
			setImageStatus("error");
			setStatusMessage(readCopyError(error));
		}
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="min-w-28"
				disabled={busy}
				onClick={() => void copyLink()}
			>
				{linkStatus === "copied" ? (
					<CheckIcon data-icon="inline-start" aria-hidden="true" />
				) : (
					<LinkSimpleIcon data-icon="inline-start" aria-hidden="true" />
				)}
				{linkStatus === "copied"
					? "Link copied"
					: linkStatus === "error"
						? "Copy failed"
						: "Copy link"}
			</Button>
			<Button
				type="button"
				size="sm"
				className="min-w-32"
				disabled={busy}
				onClick={() => void copyImage()}
			>
				{imageStatus === "copying" ? (
					<CircleNotchIcon
						data-icon="inline-start"
						aria-hidden="true"
						className="animate-spin motion-reduce:animate-none"
					/>
				) : imageStatus === "copied" ? (
					<CheckIcon data-icon="inline-start" aria-hidden="true" />
				) : (
					<ImageIcon data-icon="inline-start" aria-hidden="true" />
				)}
				{imageStatus === "copying"
					? "Creating…"
					: imageStatus === "copied"
						? "Image copied"
						: imageStatus === "error"
							? "Copy failed"
							: "Copy as image"}
			</Button>
			<p className="sr-only" aria-live="polite">
				{statusMessage}
			</p>
		</div>
	);
}

export function createLocationSharePath(input: {
	locationId: string;
	mapId: string;
	viewKey: string;
}) {
	const query = new URLSearchParams({
		location: input.locationId,
		view: input.viewKey,
	});
	return `/maps/${encodeURIComponent(input.mapId)}?${query.toString()}`;
}

async function createPublicLocationPng(input: LocationImageInput) {
	const canvas = document.createElement("canvas");
	await renderPublicLocationImage(canvas, input);
	return canvasToPngBlob(canvas);
}

function readCopyError(error: unknown) {
	return error instanceof Error
		? error.message
		: "The clipboard operation failed. Try again.";
}
