import type { LocationScreenshot } from "@/components/map/location-details-panel";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { getLocationScreenshotAltText } from "@/lib/location-screenshot-text";

type LocationScreenshotDialogProps = {
	locationDescription: string | null;
	locationName: string;
	onOpenChange: (open: boolean) => void;
	screenshot?: LocationScreenshot;
};

export function LocationScreenshotDialog({
	locationDescription,
	locationName,
	onOpenChange,
	screenshot,
}: LocationScreenshotDialogProps) {
	const altText = screenshot
		? getLocationScreenshotAltText(
				{ description: locationDescription, name: locationName },
				screenshot.altText,
			)
		: `${locationName} screenshot`;
	return (
		<Dialog open={Boolean(screenshot)} onOpenChange={onOpenChange}>
			<DialogContent
				overlayClassName="bg-black/85"
				className="w-auto max-w-[calc(100vw-2rem)] gap-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[calc(100vw-2rem)]"
			>
				<DialogTitle className="sr-only">{altText}</DialogTitle>
				<DialogDescription className="sr-only">
					Full-size location screenshot. Press Escape or click outside to close.
				</DialogDescription>
				{screenshot ? (
					<figure className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col bg-background">
						<img
							src={screenshot.path}
							alt={altText}
							width={screenshot.width}
							height={screenshot.height}
							decoding="async"
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
