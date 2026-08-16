import { cn } from "@/lib/utils";

export type DocumentArtwork = {
	imageHeight: number;
	imagePath: string;
	imageWidth: number;
};

export function DocumentThumbnail({
	alt,
	className,
	document,
}: {
	alt?: string;
	className?: string;
	document: DocumentArtwork;
}) {
	return (
		<span
			aria-hidden={alt ? undefined : true}
			className={cn(
				"pointer-events-none flex shrink-0 select-none items-center justify-center overflow-hidden bg-foreground/5 ring-1 ring-foreground/10 ring-inset",
				className,
			)}
		>
			<img
				src={document.imagePath}
				alt={alt ?? ""}
				width={document.imageWidth}
				height={document.imageHeight}
				loading="lazy"
				decoding="async"
				draggable={false}
				className="size-full object-contain"
			/>
		</span>
	);
}
