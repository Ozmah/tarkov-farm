import { ArrowLeftIcon } from "@phosphor-icons/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { MapAttribution } from "@/components/map-attribution";
import { getCatalog } from "@/functions/catalog";

export const Route = createFileRoute("/maps/$mapId")({
	loader: async ({ params }) => {
		const { maps } = await getCatalog();
		const map = maps.find((item) => item.id === params.mapId);

		if (!map) {
			throw notFound();
		}

		return map;
	},
	component: MapPage,
});

function MapPage() {
	const map = Route.useLoaderData();

	return (
		<main className="isolate flex min-h-svh flex-col gap-10 p-6 sm:p-10">
			<Link
				to="/"
				className="inline-flex w-fit items-center gap-2 text-base text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
			>
				<ArrowLeftIcon aria-hidden="true" className="size-4" />
				All maps
			</Link>

			<div className="m-auto flex max-w-5xl flex-col items-center gap-4 text-center">
				<p className="font-heading text-muted-foreground text-sm uppercase tracking-wide">
					Map
				</p>
				<h1 className="text-balance font-heading font-medium text-4xl tracking-tight sm:text-6xl lg:text-7xl">
					{map.name}
				</h1>
				<p className="max-w-[42ch] text-pretty text-base text-muted-foreground">
					Document locations will be added here.
				</p>
			</div>

			<footer className="text-center">
				<MapAttribution mapId={map.id} />
			</footer>
		</main>
	);
}
