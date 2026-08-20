import type { LocationScreenshot } from "@/components/map/location-details-panel";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";

type LocationScreenshotDialogProps = {
	locationName: string;
	onOpenChange: (open: boolean) => void;
	screenshot?: LocationScreenshot;
};

export function LocationScreenshotDialog({
	locationName,
	onOpenChange,
	screenshot,
}: LocationScreenshotDialogProps) {
	return (
		<Dialog open={Boolean(screenshot)} onOpenChange={onOpenChange}>
			<DialogContent
				overlayClassName="bg-black/85"
				className="w-auto max-w-[calc(100vw-2rem)] gap-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[calc(100vw-2rem)]"
			>
				<DialogTitle className="sr-only">
					{screenshot?.altText || `${locationName} screenshot`}
				</DialogTitle>
				<DialogDescription className="sr-only">
					Full-size location screenshot. Press Escape or click outside to close.
				</DialogDescription>
				{screenshot ? (
					<figure className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col bg-background">
						<img
							src={screenshot.path}
							alt={screenshot.altText}
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
