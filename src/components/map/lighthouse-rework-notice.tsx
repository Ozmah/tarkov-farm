import { InfoIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

export function LighthouseReworkNotice() {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) return null;

	return (
		<aside
			aria-label="Lighthouse map update"
			className="absolute bottom-4 left-3 z-20 flex w-[calc(100%-1.5rem)] max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-4 pr-12 text-card-foreground shadow-lg sm:left-4"
		>
			<InfoIcon
				aria-hidden="true"
				className="mt-0.5 size-5 shrink-0 text-muted-foreground"
			/>
			<p className="text-sm leading-relaxed">
				Lighthouse was just reworked. The current map and locations are from the
				old version. We’ll try to update them soon!
			</p>
			<button
				type="button"
				aria-label="Dismiss Lighthouse map update"
				className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
				onClick={() => setDismissed(true)}
			>
				<XIcon aria-hidden="true" className="size-4" />
			</button>
		</aside>
	);
}
