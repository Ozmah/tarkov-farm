import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCatalog } from "@/functions/catalog";

export const Route = createFileRoute("/")({
	loader: () => getCatalog(),
	component: App,
});

function App() {
	const { maps, documents } = Route.useLoaderData();
	const [query, setQuery] = useState("");
	const normalizedQuery = query.trim().toLocaleLowerCase("en");
	const filteredMaps = maps.filter((map) =>
		map.name.toLocaleLowerCase("en").includes(normalizedQuery),
	);

	return (
		<SidebarProvider className="isolate">
			<AppSidebar
				query={query}
				onQueryChange={setQuery}
				documents={documents}
			/>
			<SidebarInset className="min-w-0">
				<header className="flex h-14 shrink-0 items-center gap-3 border-border border-b px-4 sm:px-6">
					<SidebarTrigger />
					<Separator orientation="vertical" className="h-4" />
					<p className="font-heading text-sm uppercase tracking-wide">
						Map index
					</p>
					<p
						aria-live="polite"
						className="ml-auto text-muted-foreground text-sm tabular-nums"
					>
						{filteredMaps.length} of {maps.length}
					</p>
				</header>

				<main className="flex min-h-0 flex-1 overflow-auto px-6 py-12 sm:px-10 sm:py-16">
					<div className="m-auto w-full max-w-5xl">
						<h1 className="sr-only">Escape from Tarkov maps</h1>

						{filteredMaps.length > 0 ? (
							<ul
								role="list"
								className="flex flex-col items-center gap-3 sm:gap-4"
							>
								{filteredMaps.map((map) => (
									<li key={map.id} className="w-full text-center">
										<Link
											to="/maps/$mapId"
											params={{ mapId: map.id }}
											className="inline-flex max-w-full justify-center text-balance font-heading font-medium text-3xl text-foreground tracking-tight outline-none hover:underline hover:decoration-2 hover:decoration-cinnamon hover:underline-offset-8 focus-visible:ring-2 focus-visible:ring-ring sm:text-5xl lg:text-6xl"
										>
											{map.name}
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p
								role="status"
								className="text-center text-base text-muted-foreground"
							>
								No maps match “{query.trim()}”.
							</p>
						)}
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
