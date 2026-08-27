import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type {
	LocationDetails,
	LocationScreenshot,
} from "@/components/map/location-details-panel";
import { LocationScreenshotDialog } from "@/components/map/location-screenshot-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGlobalScreenshotNavigation } from "@/hooks/use-global-screenshot-navigation";
import { getLocationScreenshotAltText } from "@/lib/location-screenshot-text";

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
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const selectedScreenshot = screenshots[selectedIndex];
	const selectedAltText = selectedScreenshot
		? getLocationScreenshotAltText(location, selectedScreenshot.altText)
		: "";
	const hasPrevious = selectedIndex > 0;
	const hasNext = selectedIndex < screenshots.length - 1;
	useGlobalScreenshotNavigation({
		active: screenshots.length > 1 && !isFullscreenOpen,
		onNext: hasNext ? () => showNextScreenshot() : undefined,
		onPrevious: hasPrevious ? () => showPreviousScreenshot() : undefined,
	});

	function openFullscreen() {
		if (!selectedScreenshot) return;

		onScreenshotOpen?.(selectedIndex);
		setIsFullscreenOpen(true);
	}

	function showPreviousScreenshot(reportView = false) {
		if (!hasPrevious) return;

		const nextIndex = selectedIndex - 1;
		setSelectedIndex(nextIndex);
		if (reportView) onScreenshotOpen?.(nextIndex);
	}

	function showNextScreenshot(reportView = false) {
		if (!hasNext) return;

		const nextIndex = selectedIndex + 1;
		setSelectedIndex(nextIndex);
		if (reportView) onScreenshotOpen?.(nextIndex);
	}

	return (
		<>
			<section
				aria-keyshortcuts={
					screenshots.length > 1 && !isFullscreenOpen
						? "A ArrowLeft D ArrowRight"
						: undefined
				}
				className="shrink-0 border-border border-t bg-card"
			>
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
									onClick={() => showPreviousScreenshot()}
								>
									<CaretLeftIcon aria-hidden="true" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									disabled={!hasNext}
									aria-label="Next screenshot"
									onClick={() => showNextScreenshot()}
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
								aria-label={`View ${selectedAltText} screenshot full size`}
								className="group min-h-0 overflow-hidden p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
							>
								<img
									src={selectedScreenshot.previewPath}
									alt={selectedAltText}
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
				locationDescription={location.description}
				locationName={location.name}
				screenshot={isFullscreenOpen ? selectedScreenshot : undefined}
				previousScreenshot={
					hasPrevious ? screenshots[selectedIndex - 1] : undefined
				}
				nextScreenshot={hasNext ? screenshots[selectedIndex + 1] : undefined}
				onPrevious={
					hasPrevious ? () => showPreviousScreenshot(true) : undefined
				}
				onNext={hasNext ? () => showNextScreenshot(true) : undefined}
				onOpenChange={(open) => {
					if (!open) setIsFullscreenOpen(false);
				}}
			/>
		</>
	);
}
