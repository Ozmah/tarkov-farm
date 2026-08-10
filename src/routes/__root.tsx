import { TanStackDevtools } from "@tanstack/react-devtools";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Tarkov Season Documents",
			},
			{
				name: "description",
				content: "Escape from Tarkov seasonal document location reference.",
			},
			{
				name: "theme-color",
				content: "#062540",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	errorComponent: RootErrorComponent,
	notFoundComponent: () => (
		<main className="container mx-auto p-4 pt-16">
			<h1>404</h1>
			<p>The requested page could not be found.</p>
		</main>
	),
	shellComponent: RootDocument,
});

function RootErrorComponent({ reset }: ErrorComponentProps) {
	return (
		<main className="isolate flex min-h-svh items-center justify-center p-6">
			<div className="flex max-w-md flex-col items-center gap-4 text-center">
				<p className="font-heading text-muted-foreground text-sm uppercase tracking-wide">
					Application error
				</p>
				<h1 className="text-balance font-heading font-medium text-3xl tracking-tight">
					The requested data could not be loaded
				</h1>
				<p className="text-pretty text-base text-muted-foreground">
					Try the request again. If it continues failing, the database may be
					unavailable.
				</p>
				<Button type="button" onClick={reset}>
					Try again
				</Button>
			</div>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark scheme-only-dark">
			<head>
				<HeadContent />
			</head>
			<body className="antialiased">
				<TooltipProvider>{children}</TooltipProvider>
				<Scripts />
				<TanStackDevtools
					config={{ inspectHotkey: ["Shift", "Alt", "CtrlOrMeta"] }}
				/>
			</body>
		</html>
	);
}
