import { useEffect } from "react";

import type { LocationScreenshot } from "@/components/map/location-details-panel";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { useGlobalScreenshotNavigation } from "@/hooks/use-global-screenshot-navigation";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";
import { getLocationScreenshotAltText } from "@/lib/location-screenshot-text";
import { cn } from "@/lib/utils";

type LocationScreenshotDialogProps = {
	locationDescription: string | null;
	locationName: string;
	nextScreenshot?: LocationScreenshot;
	onNext?: () => void;
	onOpenChange: (open: boolean) => void;
	onPrevious?: () => void;
	previousScreenshot?: LocationScreenshot;
	screenshot?: LocationScreenshot;
};

export function LocationScreenshotDialog({
	locationDescription,
	locationName,
	nextScreenshot,
	onNext,
	onOpenChange,
	onPrevious,
	previousScreenshot,
	screenshot,
}: LocationScreenshotDialogProps) {
	const isOpen = Boolean(screenshot);
	const hasNavigation = Boolean(onPrevious || onNext);
	useGlobalScreenshotNavigation({
		active: isOpen && hasNavigation,
		onNext,
		onPrevious,
	});
	const { isActive, isTransitioning, ...swipeProps } = useSwipeNavigation({
		active: isOpen,
		onNext,
		onPrevious,
	});
	const altText = screenshot
		? getLocationScreenshotAltText(
				{ description: locationDescription, name: locationName },
				screenshot.altText,
			)
		: `${locationName} screenshot`;

	useEffect(() => {
		if (!isOpen) return;

		for (const path of [previousScreenshot?.path, nextScreenshot?.path]) {
			if (!path) continue;
			const image = new Image();
			image.src = path;
		}
	}, [isOpen, nextScreenshot?.path, previousScreenshot?.path]);

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent
				aria-keyshortcuts={
					hasNavigation ? "A ArrowLeft D ArrowRight" : undefined
				}
				overlayClassName="bg-black/85"
				className="w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-hidden bg-transparent p-0 shadow-none ring-0 sm:max-w-[calc(100vw-2rem)]"
			>
				<DialogTitle className="sr-only">{altText}</DialogTitle>
				<DialogDescription className="sr-only">
					Full-size location screenshot.
					{hasNavigation
						? " Use A or Left Arrow for the previous screenshot and D or Right Arrow for the next screenshot."
						: ""}
					{" Press Escape or click outside to close."}
				</DialogDescription>
				{screenshot ? (
					<figure
						{...swipeProps}
						data-slot="screenshot-swipe-surface"
						className={cn(
							"flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] select-none flex-col bg-background",
							isActive && "will-change-transform",
							isTransitioning &&
								"transition-transform duration-200 ease-out motion-reduce:transition-none",
						)}
					>
						<img
							src={screenshot.path}
							alt={altText}
							width={screenshot.width}
							height={screenshot.height}
							decoding="async"
							draggable={false}
							className="max-h-[calc(100dvh-2rem)] min-h-0 w-auto max-w-[calc(100vw-2rem)] object-contain"
						/>
						{screenshot.caption ? (
							<figcaption className="shrink-0 p-3 pr-14 text-muted-foreground text-sm">
								{screenshot.caption}
							</figcaption>
						) : null}
					</figure>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
