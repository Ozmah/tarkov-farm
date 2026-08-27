import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { TarkovFarmLogo } from "@/components/tarkov-farm-logo";
import { cn } from "@/lib/utils";

type FocusedWorkspaceShellProps = {
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	title: string;
};

export function FocusedWorkspaceShell({
	actions,
	children,
	className,
	title,
}: FocusedWorkspaceShellProps) {
	return (
		<div
			className={cn(
				"isolate flex h-svh min-h-0 flex-col overflow-hidden bg-background",
				className,
			)}
		>
			<a
				href="#main-content"
				className="fixed top-3 left-3 z-50 -translate-y-20 bg-primary px-4 py-3 font-semibold text-primary-foreground text-xs uppercase tracking-widest outline-none transition-transform focus:translate-y-0 focus:ring-2 focus:ring-ring"
			>
				Skip to content
			</a>

			<header className="flex h-14 shrink-0 items-center gap-3 border-border border-b bg-card px-3 sm:px-5">
				<Link
					to="/"
					search={{}}
					aria-label="Tarkov Farm Season Docs homepage"
					className="flex shrink-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<TarkovFarmLogo className="size-8" />
					<span className="hidden items-baseline gap-[var(--inline-context-gap)] md:flex">
						<span className="font-heading font-semibold text-primary text-sm uppercase tracking-wide">
							Tarkov Farm
						</span>
						<span className="text-muted-foreground text-xs">Season Docs</span>
					</span>
				</Link>

				<div
					className="hidden h-5 w-px shrink-0 bg-border md:block"
					aria-hidden="true"
				/>
				<h1 className="min-w-0 flex-1 truncate font-heading text-primary text-sm uppercase tracking-wide">
					{title}
				</h1>
				{actions ? (
					<nav aria-label="Workspace navigation" className="shrink-0">
						{actions}
					</nav>
				) : null}
			</header>

			<main
				id="main-content"
				tabIndex={-1}
				className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none"
			>
				{children}
			</main>
		</div>
	);
}
