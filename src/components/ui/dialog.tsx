import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Dialog(props: DialogPrimitive.Root.Props) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({
	className,
	...props
}: DialogPrimitive.Backdrop.Props) {
	return (
		<DialogPrimitive.Backdrop
			data-slot="dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-50 bg-black/70 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute supports-backdrop-filter:backdrop-blur-sm motion-reduce:transition-none",
				className,
			)}
			{...props}
		/>
	);
}

function DialogContent({
	className,
	children,
	overlayClassName,
	showCloseButton = true,
	...props
}: DialogPrimitive.Popup.Props & {
	overlayClassName?: string;
	showCloseButton?: boolean;
}) {
	return (
		<DialogPortal>
			<DialogOverlay className={overlayClassName} />
			<DialogPrimitive.Popup
				data-slot="dialog-content"
				className={cn(
					"fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 bg-popover p-6 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10 transition-[scale,opacity] duration-150 data-ending-style:scale-[0.98] data-starting-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none sm:max-w-md",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton ? (
					<DialogPrimitive.Close
						data-slot="dialog-close"
						render={
							<Button
								type="button"
								variant="secondary"
								size="icon"
								className="absolute top-3 right-3 shadow-md"
							/>
						}
					>
						<XIcon aria-hidden="true" />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				) : null}
			</DialogPrimitive.Popup>
		</DialogPortal>
	);
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn(
				"font-heading font-semibold text-lg uppercase tracking-wider",
				className,
			)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export { Dialog, DialogContent, DialogDescription, DialogTitle };
