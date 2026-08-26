import { useState } from "react";

import type { MapMarkerPreview as MapMarkerPreviewData } from "@/lib/map-marker-preview";

type MapMarkerPreviewProps = {
	name: string;
	position?: {
		index: number;
		total: number;
	};
	preview?: MapMarkerPreviewData;
};

export function MapMarkerPreview({
	name,
	position,
	preview,
}: MapMarkerPreviewProps) {
	const [failedPath, setFailedPath] = useState<string>();
	const previewFailed = preview?.path === failedPath;

	return (
		<div
			data-slot="map-marker-preview"
			className="flex w-64 max-w-[calc(100vw-1rem)] flex-col overflow-hidden"
		>
			<div className="flex min-h-9 items-center gap-3 px-3 py-2">
				<p className="min-w-0 flex-1 truncate font-heading font-semibold text-xs">
					{name}
				</p>
				{position ? (
					<span className="shrink-0 text-background/70 tabular-nums">
						{position.index}/{position.total}
					</span>
				) : null}
			</div>
			{preview ? (
				<div className="grid h-36 place-items-center bg-black/75">
					{previewFailed ? (
						<p className="px-4 text-center text-background/70 text-xs">
							Preview unavailable
						</p>
					) : (
						<img
							src={preview.path}
							alt={preview.altText || `${name} screenshot`}
							width={preview.width}
							height={preview.height}
							loading="lazy"
							decoding="async"
							draggable={false}
							onError={() => setFailedPath(preview.path)}
							className="size-full object-contain"
						/>
					)}
				</div>
			) : null}
		</div>
	);
}
