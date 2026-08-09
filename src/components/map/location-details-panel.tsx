import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type LocationDetails = {
	description: string | null;
	documentName: string;
	name: string;
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
	location: LocationDetails;
	onClose: () => void;
	screenshots: LocationScreenshot[];
};

export function LocationDetailsPanel({
	className,
	location,
	onClose,
	screenshots,
}: LocationDetailsPanelProps) {
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		const previouslyFocused =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onCloseRef.current();
			}
		};

		closeButtonRef.current?.focus();
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			previouslyFocused?.focus();
		};
	}, []);

	return (
		<aside
			role="dialog"
			aria-labelledby="location-details-title"
			className={cn(
				"absolute inset-y-3 right-3 z-30 flex w-[min(26rem,calc(100%-1.5rem))] flex-col border border-border bg-card shadow-xl",
				className,
			)}
		>
			<header className="flex shrink-0 items-start gap-4 p-5">
				<div className="min-w-0 flex-1">
					<Badge variant="secondary">{location.documentName}</Badge>
					<h2
						id="location-details-title"
						className="mt-3 text-balance font-heading font-medium text-2xl tracking-tight"
					>
						{location.name}
					</h2>
				</div>
				<Button
					ref={closeButtonRef}
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Close location details"
					onClick={onClose}
				>
					<XIcon />
				</Button>
			</header>
			<Separator />

			<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-5">
				{location.description ? (
					<p className="text-pretty text-base text-muted-foreground sm:text-sm">
						{location.description}
					</p>
				) : null}

				<section
					aria-labelledby="location-screenshots"
					className="flex flex-col gap-3"
				>
					<div className="flex items-center justify-between gap-4">
						<h3 id="location-screenshots" className="font-heading font-medium">
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
									<a
										href={screenshot.path}
										target="_blank"
										rel="noreferrer"
										className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<img
											src={screenshot.previewPath}
											alt={screenshot.altText}
											width={screenshot.previewWidth}
											height={screenshot.previewHeight}
											loading="lazy"
											decoding="async"
											className="aspect-video w-full object-cover outline-1 outline-foreground/10 -outline-offset-1"
										/>
									</a>
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
		</aside>
	);
}
