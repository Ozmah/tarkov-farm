import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import { AnalyticsProvider } from "@/components/analytics-provider";
import { RouteError } from "@/components/route-error";
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
				title: "Tarkov Farm | Escape from Tarkov Document Locations",
			},
			{
				name: "description",
				content:
					"Interactive maps and screenshots for Escape from Tarkov seasonal document locations.",
			},
			{
				name: "theme-color",
				content: "#062540",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
				sizes: "any",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	errorComponent: (props) => (
		<RouteError
			{...props}
			analyticsError={{
				error_code: "unexpected_application_error",
				operation: "route_load",
			}}
		/>
	),
	notFoundComponent: () => (
		<main className="container mx-auto p-4 pt-16">
			<h1>404</h1>
			<p>The requested page could not be found.</p>
		</main>
	),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark scheme-only-dark">
			<head>
				<HeadContent />
			</head>
			<body className="antialiased">
				<AnalyticsProvider />
				<TooltipProvider>{children}</TooltipProvider>
				<Scripts />
				{import.meta.env.DEV ? (
					<TanStackDevtools
						config={{ inspectHotkey: ["Shift", "Alt", "CtrlOrMeta"] }}
					/>
				) : null}
			</body>
		</html>
	);
}
