import { useState } from "react";

import {
	type DocumentArtwork,
	DocumentThumbnail,
} from "@/components/document-thumbnail";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type LocationDetails = {
	description: string | null;
	documentName: string;
	name: string;
	requiredKeys: Array<{
		id: string;
		imageHeight: number;
		imagePath: string;
		imageWidth: number;
		name: string;
		wikiUrl: string;
	}>;
};

type LocationScreenshot = {
	altText: string;
	caption: string | null;
	height: number;
	id: string;
	path: string;
	previewHeight: number;
	previewPath: string;
	previewWidth: number;
	width: number;
};

type LocationDetailsPanelProps = {
	className?: string;
	documentArtwork?: DocumentArtwork;
	location: LocationDetails;
	onClose: () => void;
	screenshots: LocationScreenshot[];
};

export function LocationDetailsPanel({
	className,
	documentArtwork,
	location,
	onClose,
	screenshots,
}: LocationDetailsPanelProps) {
	const isMobile = useIsMobile();
	const [selectedScreenshot, setSelectedScreenshot] =
		useState<LocationScreenshot>();

	return (
		<>
			<Sheet
				open
				modal={isMobile}
				disablePointerDismissal={!isMobile}
				onOpenChange={(open) => {
					if (!open && !selectedScreenshot) onClose();
				}}
			>
				<SheetContent
					side="right"
					closeLabel="Close location details"
					overlayClassName="bg-black/35 supports-backdrop-filter:backdrop-blur-none"
					showOverlay={isMobile}
					initialFocus={isMobile}
					finalFocus={isMobile}
					className={cn(
						"data-[side=right]:w-[calc(100%-1rem)] sm:max-w-[26rem]",
						className,
					)}
				>
					<header className="flex shrink-0 items-center gap-4 border-primary border-t p-5 pr-18">
						{documentArtwork ? (
							<DocumentThumbnail
								document={documentArtwork}
								className="size-16 sm:size-20"
							/>
						) : null}
						<div className="min-w-0 flex-1">
							<Badge variant="secondary">{location.documentName}</Badge>
							<SheetTitle
								aria-live="polite"
								className="mt-3 min-h-24 text-balance font-medium text-2xl normal-case tracking-tight"
							>
								{location.name}
							</SheetTitle>
						</div>
					</header>
					<Separator />

					<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-5">
						{location.description ? (
							<SheetDescription className="text-pretty text-base sm:text-sm">
								{location.description}
							</SheetDescription>
						) : null}

						{location.requiredKeys.length > 0 ? (
							<section
								aria-labelledby="location-required-keys"
								className="flex flex-col gap-3"
							>
								<h3
									id="location-required-keys"
									className="font-heading font-medium"
								>
									Required {location.requiredKeys.length === 1 ? "key" : "keys"}
								</h3>
								<ul className="grid gap-2">
									{location.requiredKeys.map((key) => (
										<li key={key.id}>
											<a
												href={key.wikiUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="group flex min-h-16 items-center gap-3 border bg-card p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											>
												<img
													src={key.imagePath}
													alt=""
													width={key.imageWidth}
													height={key.imageHeight}
													loading="lazy"
													decoding="async"
													className="size-10 object-contain transition-transform group-hover:scale-105 motion-reduce:transition-none"
												/>
												<span className="font-medium text-sm">{key.name}</span>
											</a>
										</li>
									))}
								</ul>
							</section>
						) : null}

						<section
							aria-labelledby="location-screenshots"
							className="flex flex-col gap-3"
						>
							<div className="flex items-center justify-between gap-4">
								<h3
									id="location-screenshots"
									className="font-heading font-medium"
								>
									Screenshots
								</h3>
								<p className="text-muted-foreground text-sm tabular-nums">
									{screenshots.length}
								</p>
							</div>

							{screenshots.length > 0 ? (
								<ul className="flex flex-col gap-4">
									{screenshots.map((screenshot) => (
										<li key={screenshot.id} className="flex flex-col gap-2">
											<button
												type="button"
												onClick={() => setSelectedScreenshot(screenshot)}
												aria-label={`View ${screenshot.altText || location.name} screenshot`}
												className="block w-full cursor-zoom-in bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring"
											>
												<img
													src={screenshot.previewPath}
													alt={screenshot.altText}
													width={screenshot.previewWidth}
													height={screenshot.previewHeight}
													loading="lazy"
													decoding="async"
													className="aspect-video w-full object-contain outline-1 outline-foreground/10 -outline-offset-1"
												/>
											</button>
											{screenshot.caption ? (
												<p className="text-pretty text-base text-muted-foreground sm:text-sm">
													{screenshot.caption}
												</p>
											) : null}
										</li>
									))}
								</ul>
							) : (
								<p className="text-base text-muted-foreground sm:text-sm">
									No screenshots are available for this location.
								</p>
							)}
						</section>
					</div>
				</SheetContent>
			</Sheet>

			<Dialog
				open={Boolean(selectedScreenshot)}
				onOpenChange={(open) => {
					if (!open) setSelectedScreenshot(undefined);
				}}
			>
				<DialogContent
					overlayClassName="bg-black/85"
					className="w-auto max-w-[calc(100vw-2rem)] gap-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[calc(100vw-2rem)]"
				>
					<DialogTitle className="sr-only">
						{selectedScreenshot?.altText || `${location.name} screenshot`}
					</DialogTitle>
					<DialogDescription className="sr-only">
						Full-size location screenshot. Press Escape or click outside to
						close.
					</DialogDescription>
					{selectedScreenshot ? (
						<figure className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col bg-background">
							<img
								src={selectedScreenshot.path}
								alt={selectedScreenshot.altText}
								width={selectedScreenshot.width}
								height={selectedScreenshot.height}
								decoding="async"
								className="max-h-[calc(100dvh-2rem)] min-h-0 w-auto max-w-[calc(100vw-2rem)] object-contain"
							/>
							{selectedScreenshot.caption ? (
								<figcaption className="shrink-0 p-3 pr-14 text-muted-foreground text-sm">
									{selectedScreenshot.caption}
								</figcaption>
							) : null}
						</figure>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
