import {
	CaretDownIcon,
	CaretLeftIcon,
	CaretRightIcon,
	CornersOutIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import type {
	LocationDetails,
	LocationScreenshot,
} from "@/components/map/location-details-panel";
import { LocationScreenshotDialog } from "@/components/map/location-screenshot-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
	const [expanded, setExpanded] = useState(true);
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
			<Collapsible
				open={expanded}
				onOpenChange={setExpanded}
				className="shrink-0 border-border border-t bg-card"
			>
				<header className="flex min-h-14 items-center gap-3 px-3 sm:px-5">
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 items-center gap-2">
							<Badge
								variant="secondary"
								className="hidden shrink-0 sm:inline-flex"
							>
								{location.documentName}
							</Badge>
							<h2 className="truncate font-heading font-medium text-sm">
								{location.name}
							</h2>
						</div>
						<p className="text-muted-foreground text-xs tabular-nums">
							{screenshots.length === 0
								? "No screenshots"
								: `Screenshot ${selectedIndex + 1} of ${screenshots.length}`}
						</p>
					</div>

					{screenshots.length > 1 ? (
						<div className="flex items-center gap-1">
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
						</div>
					) : null}

					{selectedScreenshot && expanded ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Open full-size screenshot"
							onClick={openFullscreen}
						>
							<CornersOutIcon aria-hidden="true" />
						</Button>
					) : null}

					<CollapsibleTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={
									expanded ? "Collapse screenshots" : "Expand screenshots"
								}
							/>
						}
					>
						<CaretDownIcon
							aria-hidden="true"
							className="transition-transform duration-150 group-aria-expanded/button:rotate-180 motion-reduce:transition-none"
						/>
					</CollapsibleTrigger>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Close location screenshots"
						onClick={onClose}
					>
						<XIcon aria-hidden="true" />
					</Button>
				</header>

				<CollapsibleContent className="h-[clamp(18rem,30dvh,36rem)] border-border border-t">
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
				</CollapsibleContent>
			</Collapsible>

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
