import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type {
	LocationDetails,
	LocationScreenshot,
} from "@/components/map/location-details-panel";
import { LocationScreenshotDialog } from "@/components/map/location-screenshot-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type VerticalScreenshotInspectorProps = {
	location: LocationDetails;
	onClose: () => void;
	onScreenshotOpen?: (screenshotIndex: number) => void;
	screenshots: LocationScreenshot[];
};

export function VerticalScreenshotInspector({
	location,
	onClose,
	onScreenshotOpen,
	screenshots,
}: VerticalScreenshotInspectorProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [fullscreenScreenshot, setFullscreenScreenshot] =
		useState<LocationScreenshot>();
	const selectedScreenshot = screenshots[selectedIndex];
	const hasPrevious = selectedIndex > 0;
	const hasNext = selectedIndex < screenshots.length - 1;

	function openFullscreen() {
		if (!selectedScreenshot) return;

		onScreenshotOpen?.(selectedIndex);
		setFullscreenScreenshot(selectedScreenshot);
	}

	return (
		<>
			<section className="shrink-0 border-border border-t bg-card">
				<header className="flex min-h-14 items-center gap-3 px-3 sm:px-5">
					<div className="min-w-0">
						<h2 className="min-w-0 truncate font-heading font-medium text-sm">
							{location.name}
						</h2>
					</div>

					<div className="ml-auto flex shrink-0 items-center gap-1">
						<Badge
							variant="secondary"
							className="hidden shrink-0 sm:inline-flex"
						>
							{location.documentName}
						</Badge>
						<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
							{screenshots.length === 0
								? "No screenshots"
								: `${selectedIndex + 1} of ${screenshots.length}`}
						</span>
						{screenshots.length > 1 ? (
							<>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									disabled={!hasPrevious}
									aria-label="Previous screenshot"
									onClick={() =>
										setSelectedIndex((index) => Math.max(0, index - 1))
									}
								>
									<CaretLeftIcon aria-hidden="true" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									disabled={!hasNext}
									aria-label="Next screenshot"
									onClick={() =>
										setSelectedIndex((index) =>
											Math.min(screenshots.length - 1, index + 1),
										)
									}
								>
									<CaretRightIcon aria-hidden="true" />
								</Button>
							</>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Close location screenshots"
							onClick={onClose}
						>
							<XIcon aria-hidden="true" />
						</Button>
					</div>
				</header>

				<div className="h-[clamp(18rem,30dvh,36rem)] border-border border-t">
					{selectedScreenshot ? (
						<figure className="grid size-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-background/35">
							<button
								type="button"
								onClick={openFullscreen}
								aria-label={`View ${selectedScreenshot.altText || location.name} screenshot full size`}
								className="group min-h-0 overflow-hidden p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
							>
								<img
									src={selectedScreenshot.previewPath}
									alt={selectedScreenshot.altText}
									width={selectedScreenshot.previewWidth}
									height={selectedScreenshot.previewHeight}
									loading="eager"
									decoding="async"
									className="size-full object-contain transition-transform duration-150 ease-out group-hover:scale-[1.01] motion-reduce:transition-none"
								/>
							</button>
							{selectedScreenshot.caption ? (
								<figcaption className="border-border border-t px-5 py-3 text-center text-muted-foreground text-sm">
									{selectedScreenshot.caption}
								</figcaption>
							) : null}
						</figure>
					) : (
						<div className="flex size-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
							No screenshots are available for this location.
						</div>
					)}
				</div>
			</section>

			<LocationScreenshotDialog
				locationName={location.name}
				screenshot={fullscreenScreenshot}
				onOpenChange={(open) => {
					if (!open) setFullscreenScreenshot(undefined);
				}}
			/>
		</>
	);
}
