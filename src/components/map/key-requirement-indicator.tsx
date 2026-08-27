import { KeyIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

type KeyRequirementIndicatorProps = {
	className?: string;
};

export function KeyRequirementIndicator({
	className,
}: KeyRequirementIndicatorProps) {
	return (
		<span
			data-key-requirement-indicator
			aria-hidden="true"
			className={cn(
				"inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-milk-mustache bg-cosmic-ink text-milk-mustache shadow-[0_1px_3px_rgb(0_0_0/0.75)]",
				className,
			)}
		>
			<KeyIcon weight="bold" className="size-2.5" />
		</span>
	);
}
