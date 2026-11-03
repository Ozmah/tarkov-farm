import type { ComponentProps } from "react";

import { PopoverContent } from "@/components/ui/popover";

export type MarkerPopoverOpenChange = (
	open: boolean,
	details: { event: Event; reason: string },
) => void;

/** Keys the map viewport uses for panning and zooming. */
const MAP_SHORTCUT_KEYS = new Set([
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"+",
	"=",
	"-",
	"0",
]);

/** Keeps pointer and keyboard input inside the popover away from the map. */
export function MarkerPopoverContent({
	onKeyDown,
	...props
}: ComponentProps<typeof PopoverContent>) {
	return (
		<PopoverContent
			{...props}
			onPointerDown={(event) => event.stopPropagation()}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if (MAP_SHORTCUT_KEYS.has(event.key)) event.stopPropagation();
			}}
		/>
	);
}
