import { RowsIcon } from "@phosphor-icons/react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LayoutMode } from "@/lib/layout-mode";
import { cn } from "@/lib/utils";

type LayoutModeToggleProps = {
	className?: string;
	compact?: boolean;
	disabled?: boolean;
	error?: string;
	id: string;
	layoutMode: LayoutMode;
	onLayoutModeChange: (layoutMode: LayoutMode) => void;
	surface?: "default" | "sidebar";
};

export function LayoutModeToggle({
	className,
	compact = false,
	disabled,
	error,
	id,
	layoutMode,
	onLayoutModeChange,
	surface = "default",
}: LayoutModeToggleProps) {
	const isSidebar = surface === "sidebar";
	const iconClassName = cn(
		"size-4 shrink-0",
		isSidebar ? "text-sidebar-foreground/70" : "text-muted-foreground",
	);
	const switchControl = (
		<Switch
			id={id}
			checked={layoutMode === "vertical"}
			disabled={disabled}
			onCheckedChange={(checked) =>
				onLayoutModeChange(checked ? "vertical" : "standard")
			}
			aria-label="Vertical mode"
			aria-describedby={error ? `${id}-error` : undefined}
			className={cn(
				isSidebar &&
					"focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30 data-checked:border-sidebar-primary data-unchecked:border-sidebar-border data-checked:bg-sidebar-primary data-unchecked:bg-sidebar-accent",
			)}
		/>
	);

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<div className="flex min-h-11 items-center gap-2">
				{compact ? (
					<Label
						htmlFor={id}
						className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"
					>
						<RowsIcon aria-hidden="true" className={iconClassName} />
						<span className="sr-only">Vertical mode</span>
					</Label>
				) : (
					<>
						<RowsIcon aria-hidden="true" className={iconClassName} />
						<Label
							htmlFor={id}
							className={cn(
								"min-w-0 flex-1 cursor-pointer font-medium text-sm normal-case tracking-normal",
								isSidebar && "text-sidebar-foreground",
							)}
						>
							Vertical mode
						</Label>
					</>
				)}
				{compact ? (
					<Tooltip>
						<TooltipTrigger render={switchControl} />
						<TooltipContent>Vertical mode</TooltipContent>
					</Tooltip>
				) : (
					switchControl
				)}
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
