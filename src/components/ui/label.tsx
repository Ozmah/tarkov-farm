import type * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Consumers provide htmlFor or wrap the associated control.
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 font-semibold text-primary text-xs uppercase tracking-wide peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-data-[slot=checkbox]:font-normal peer-data-[slot=radio-group-item]:font-normal peer-data-[slot=switch]:font-normal peer-data-[slot=checkbox]:text-foreground peer-data-[slot=checkbox]:text-sm peer-data-[slot=radio-group-item]:text-foreground peer-data-[slot=radio-group-item]:text-sm peer-data-[slot=switch]:text-foreground peer-data-[slot=switch]:text-sm peer-data-[slot=checkbox]:normal-case peer-data-[slot=radio-group-item]:normal-case peer-data-[slot=switch]:normal-case peer-data-[slot=checkbox]:tracking-normal peer-data-[slot=radio-group-item]:tracking-normal peer-data-[slot=switch]:tracking-normal",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
