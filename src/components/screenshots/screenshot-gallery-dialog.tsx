import { useEffect, useState } from "react";

import { LocationScreenshotDialog } from "@/components/map/location-screenshot-dialog";

/** A local `file` takes precedence over the published `url`. */
export type GalleryScreenshot = {
	key: string;
	file?: File;
	url?: string;
};

type ScreenshotGalleryDialogProps = {
	index?: number;
	screenshots: GalleryScreenshot[];
	title: string;
	onIndexChange: (index: number | undefined) => void;
};

/** Full-screen viewer for a form's screenshots, with A/D and arrow navigation. */
export function ScreenshotGalleryDialog({
	index,
	screenshots,
	title,
	onIndexChange,
}: ScreenshotGalleryDialogProps) {
	const open = index !== undefined;
	const [fileUrls, setFileUrls] = useState<ReadonlyMap<File, string>>(
		() => new Map(),
	);

	// Object URLs only while the viewer is open; revoked when it closes or the files change.
	useEffect(() => {
		if (!open) return;
		const urls = new Map<File, string>();
		for (const { file } of screenshots)
			if (file) urls.set(file, URL.createObjectURL(file));
		setFileUrls(urls);
		return () => {
			for (const url of urls.values()) URL.revokeObjectURL(url);
		};
	}, [open, screenshots]);

	const viewerScreenshot = (position: number) => {
		const screenshot = screenshots[position];
		const path = screenshot?.file
			? fileUrls.get(screenshot.file)
			: screenshot?.url;
		return path
			? { path, altText: `${title} screenshot ${position + 1}`, caption: null }
			: undefined;
	};
	const hasPrevious = open && index > 0;
	const hasNext = open && index < screenshots.length - 1;

	return (
		<LocationScreenshotDialog
			locationDescription={null}
			locationName={title}
			screenshot={open ? viewerScreenshot(index) : undefined}
			previousScreenshot={hasPrevious ? viewerScreenshot(index - 1) : undefined}
			nextScreenshot={hasNext ? viewerScreenshot(index + 1) : undefined}
			onPrevious={hasPrevious ? () => onIndexChange(index - 1) : undefined}
			onNext={hasNext ? () => onIndexChange(index + 1) : undefined}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onIndexChange(undefined);
			}}
		/>
	);
}
