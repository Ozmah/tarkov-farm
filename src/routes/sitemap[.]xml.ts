import { createFileRoute } from "@tanstack/react-router";

import { createSitemapXml } from "@/lib/sitemap";

const RESPONSE_HEADERS = {
	"cache-control": "public, max-age=3600, stale-while-revalidate=86400",
	"content-type": "application/xml; charset=utf-8",
	"x-content-type-options": "nosniff",
};

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const { readCatalog } = await import("@/server/catalog.server");
				const catalog = await readCatalog();
				const sitemap = createSitemapXml(catalog.maps.map((map) => map.id));

				return new Response(sitemap, { headers: RESPONSE_HEADERS });
			},
		},
	},
});
