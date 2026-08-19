import { MonitorIcon } from "@phosphor-icons/react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LayoutMode } from "@/lib/layout-mode";
import { cn } from "@/lib/utils";

type LayoutModeToggleProps = {
	className?: string;
	disabled?: boolean;
	error?: string;
	id: string;
	layoutMode: LayoutMode;
	onLayoutModeChange: (layoutMode: LayoutMode) => void;
	surface?: "default" | "sidebar";
};

export function LayoutModeToggle({
	className,
	disabled,
	error,
	id,
	layoutMode,
	onLayoutModeChange,
	surface = "default",
}: LayoutModeToggleProps) {
	const isSidebar = surface === "sidebar";

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<div className="flex min-h-11 items-center gap-3">
				<MonitorIcon
					aria-hidden="true"
					className={cn(
						"size-4 shrink-0",
						isSidebar ? "text-sidebar-foreground/70" : "text-muted-foreground",
					)}
				/>
				<Label
					htmlFor={id}
					className={cn(
						"min-w-0 flex-1 font-medium text-sm",
						isSidebar && "text-sidebar-foreground",
					)}
				>
					Vertical mode
				</Label>
				<Switch
					id={id}
					checked={layoutMode === "vertical"}
					disabled={disabled}
					onCheckedChange={(checked) =>
						onLayoutModeChange(checked ? "vertical" : "standard")
					}
					aria-describedby={error ? `${id}-error` : undefined}
					className={cn(
						isSidebar &&
							"focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30 data-checked:border-sidebar-primary data-unchecked:border-sidebar-border data-checked:bg-sidebar-primary data-unchecked:bg-sidebar-accent",
					)}
				/>
			</div>
			{error ? (
				<p
					id={`${id}-error`}
					role="status"
					className={cn(
						"text-xs",
						isSidebar ? "text-sidebar-foreground/70" : "text-muted-foreground",
					)}
				>
					{error}
				</p>
			) : null}
		</div>
	);
}
