import {
	CameraIcon,
	CheckIcon,
	CircleNotchIcon,
	CopyIcon,
	DownloadSimpleIcon,
} from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useState } from "react";

import {
	canvasToPngBlob,
	createLocationReplyImageFileName,
	DEFAULT_LOCATION_REPLY_MESSAGE,
	LOCATION_REPLY_IMAGE_HEIGHT,
	LOCATION_REPLY_IMAGE_WIDTH,
	type LocationReplyImageInput,
	renderLocationReplyImage,
} from "@/components/location-image/location-image-renderer";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type LocationReplyImageDialogProps = {
	disabled: boolean;
	input: Omit<LocationReplyImageInput, "message">;
	requiresSave: boolean;
};

type ExportStatus = "copied" | "downloaded" | "error" | "idle";

export function LocationReplyImageDialog({
	disabled,
	input,
	requiresSave,
}: LocationReplyImageDialogProps) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState(DEFAULT_LOCATION_REPLY_MESSAGE);
	const [isRendering, setIsRendering] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [status, setStatus] = useState<ExportStatus>("idle");
	const [error, setError] = useState("");
	const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(
		null,
	);
	const saveHintId = useId();
	const busy = isRendering || isExporting;
	const renderInput = useMemo(() => ({ ...input, message }), [input, message]);

	useEffect(() => {
		if (!open || !previewCanvas) return;

		let cancelled = false;
		const renderCanvas = document.createElement("canvas");
		setIsRendering(true);
		setStatus("idle");
		setError("");

		void renderLocationReplyImage(renderCanvas, renderInput)
			.then(() => {
				if (cancelled) return;
				previewCanvas.width = LOCATION_REPLY_IMAGE_WIDTH;
				previewCanvas.height = LOCATION_REPLY_IMAGE_HEIGHT;
				const context = previewCanvas.getContext("2d");
				if (!context) throw new Error("The image preview is unavailable.");
				context.drawImage(renderCanvas, 0, 0);
			})
			.catch((renderError: unknown) => {
				if (cancelled) return;
				setStatus("error");
				setError(readErrorMessage(renderError));
			})
			.finally(() => {
				if (!cancelled) setIsRendering(false);
			});

		return () => {
			cancelled = true;
		};
	}, [open, previewCanvas, renderInput]);

	async function preparePng() {
		const canvas = document.createElement("canvas");
		await renderLocationReplyImage(canvas, renderInput);
		return canvasToPngBlob(canvas);
	}

	async function copyPng() {
		setIsExporting(true);
		setError("");
		try {
			if (
				!window.isSecureContext ||
				!navigator.clipboard?.write ||
				typeof ClipboardItem === "undefined"
			) {
				throw new Error(
					"This browser cannot copy PNG images here. Download the PNG instead.",
				);
			}

			const png = preparePng();
			await navigator.clipboard.write([
				new ClipboardItem({
					"image/png": png,
				}),
			]);
			setStatus("copied");
		} catch (copyError) {
			setStatus("error");
			setError(readErrorMessage(copyError));
		} finally {
			setIsExporting(false);
		}
	}

	async function downloadPng() {
		setIsExporting(true);
		setError("");
		try {
			const png = await preparePng();
			const url = URL.createObjectURL(png);
			const link = document.createElement("a");
			link.download = createLocationReplyImageFileName(
				input.map.name,
				input.location.markerLabel,
			);
			link.href = url;
			link.hidden = true;
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 0);
			setStatus("downloaded");
		} catch (downloadError) {
			setStatus("error");
			setError(readErrorMessage(downloadError));
		} finally {
			setIsExporting(false);
		}
	}

	const statusMessage =
		status === "copied"
			? "PNG copied."
			: status === "downloaded"
				? "PNG downloaded."
				: status === "error"
					? error
					: `${LOCATION_REPLY_IMAGE_WIDTH} × ${LOCATION_REPLY_IMAGE_HEIGHT} PNG`;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (busy) return;
				setOpen(nextOpen);
				if (nextOpen) {
					setStatus("idle");
					setError("");
				}
			}}
		>
			<Button
				type="button"
				variant="outline"
				disabled={disabled}
				aria-disabled={requiresSave || undefined}
				aria-describedby={requiresSave ? saveHintId : undefined}
				className={requiresSave ? "cursor-not-allowed opacity-50" : undefined}
				onClick={() => {
					if (!requiresSave) setOpen(true);
				}}
			>
				<CameraIcon data-icon="inline-start" aria-hidden="true" />
				{requiresSave ? "Save first" : "Screenshot"}
			</Button>
			{requiresSave ? (
				<span id={saveHintId} className="sr-only">
					Save changes before creating a screenshot.
				</span>
			) : null}

			<DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-6xl">
				<div className="flex flex-col gap-2 pr-10">
					<DialogTitle>Location screenshot</DialogTitle>
					<DialogDescription>
						Create a reply image from the saved location, its first screenshot,
						and its exact map position.
					</DialogDescription>
				</div>

				<div className="grid min-h-0 gap-6 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_18rem] lg:overflow-hidden">
					<div className="min-w-0 lg:self-start">
						<div
							className="relative overflow-hidden border border-border bg-background"
							aria-busy={isRendering}
						>
							<canvas
								ref={setPreviewCanvas}
								aria-label={`Reply image preview for ${input.location.name}`}
								className="block aspect-2/1 h-auto w-full"
								height={LOCATION_REPLY_IMAGE_HEIGHT}
								role="img"
								width={LOCATION_REPLY_IMAGE_WIDTH}
							>
								{input.location.name} on {input.map.name}. {message}
							</canvas>
							{isRendering ? (
								<div className="absolute inset-0 grid place-items-center bg-background/80">
									<CircleNotchIcon
										aria-label="Rendering preview"
										className="size-7 animate-spin text-primary motion-reduce:animate-none"
									/>
								</div>
							) : null}
						</div>
						<p className="mt-2 text-muted-foreground text-xs">
							The preview scales to fit. Export always uses the full resolution.
						</p>
					</div>

					<div className="flex min-h-0 flex-col gap-5 lg:overflow-y-auto">
						<Field>
							<FieldLabel htmlFor="location-reply-message">Message</FieldLabel>
							<Textarea
								id="location-reply-message"
								value={message}
								maxLength={160}
								rows={4}
								disabled={isExporting}
								onChange={(event) => setMessage(event.target.value)}
							/>
							<FieldDescription>
								Up to two lines are included in the image.
							</FieldDescription>
						</Field>

						<div className="grid gap-2">
							<Button
								type="button"
								disabled={busy}
								onClick={() => void copyPng()}
							>
								{status === "copied" ? (
									<CheckIcon data-icon="inline-start" aria-hidden="true" />
								) : (
									<CopyIcon data-icon="inline-start" aria-hidden="true" />
								)}
								{status === "copied" ? "Copied" : "Copy PNG"}
							</Button>
							<Button
								type="button"
								variant="secondary"
								disabled={busy}
								onClick={() => void downloadPng()}
							>
								<DownloadSimpleIcon
									data-icon="inline-start"
									aria-hidden="true"
								/>
								Download PNG
							</Button>
						</div>

						<p
							aria-live="polite"
							className={
								status === "error"
									? "min-h-10 text-destructive text-xs leading-5"
									: "min-h-10 text-muted-foreground text-xs leading-5"
							}
						>
							{statusMessage}
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function readErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "The reply image could not be created.";
}
