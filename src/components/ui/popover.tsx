"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverTitle = PopoverPrimitive.Title;
const PopoverDescription = PopoverPrimitive.Description;

function PopoverContent({
	className,
	children,
	side = "top",
	sideOffset = 8,
	align = "center",
	alignOffset = 0,
	...props
}: PopoverPrimitive.Popup.Props &
	Pick<
		PopoverPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset"
	>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				collisionPadding={8}
				className="isolate z-50"
			>
				<PopoverPrimitive.Popup
					data-slot="popover-content"
					className={cn(
						"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 w-80 max-w-[calc(100vw-1rem)] origin-(--transform-origin) rounded-none bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-closed:animate-out data-open:animate-in motion-reduce:transition-none",
						className,
					)}
					{...props}
				>
					{children}
				</PopoverPrimitive.Popup>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
};
