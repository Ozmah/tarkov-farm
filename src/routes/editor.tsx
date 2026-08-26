import { createFileRoute, Link } from "@tanstack/react-router";

import { LocalMapEditor } from "@/components/editor/local-map-editor";
import { getEditorData } from "@/functions/editor";
import { getEditorUpdates } from "@/functions/updates";
import { validateCatalogSearch } from "@/lib/catalog-search";

type EditorSearch = {
	documents?: string;
	map?: string;
	image?: string;
	location?: string;
	section?: "import" | "updates";
};

export const Route = createFileRoute("/editor")({
	head: () => ({
		meta: [
			{ title: "Editor | Tarkov Farm" },
			{ name: "robots", content: "noindex, nofollow" },
		],
	}),
	validateSearch: (search: Record<string, unknown>): EditorSearch => {
		const catalogSearch = validateCatalogSearch(search);

		return {
			documents: catalogSearch.documents,
			map: readSearchValue(search.map),
			image: readSearchValue(search.image),
			location: readSearchValue(search.location),
			section:
				search.section === "updates" || search.section === "import"
					? search.section
					: undefined,
		};
	},
	loaderDeps: () => ({}),
	loader: async () => {
		const [data, updates] = await Promise.all([
			getEditorData(),
			getEditorUpdates(),
		]);

		return { data, updates };
	},
	staleTime: Number.POSITIVE_INFINITY,
	notFoundComponent: EditorNotFound,
	component: EditorRoute,
});

function EditorRoute() {
	const { data, updates } = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<LocalMapEditor
			data={data}
			releaseContext={updates.releaseContext}
			updates={updates.updates}
			search={search}
			onSearchChange={(next, replace = false) =>
				navigate({
					search: (previous) => ({ ...previous, ...next }),
					replace,
				})
			}
		/>
	);
}

function EditorNotFound() {
	return (
		<main className="isolate flex min-h-svh items-center justify-center p-6">
			<div className="flex max-w-md flex-col items-center gap-4 text-center">
				<p className="font-heading text-muted-foreground text-sm uppercase tracking-wide">
					404
				</p>
				<h1 className="text-balance font-heading font-medium text-3xl tracking-tight">
					Page not found
				</h1>
				<p className="text-pretty text-base text-muted-foreground">
					The local editor is unavailable in this environment.
				</p>
				<Link
					to="/"
					className="text-base text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					Return to the map index
				</Link>
			</div>
		</main>
	);
}

function readSearchValue(value: unknown) {
	if (typeof value !== "string" || value.length === 0 || value.length > 100) {
		return undefined;
	}

	return value;
}
