import { createFileRoute } from "@tanstack/react-router";

import { getDatabase } from "@/server/db/client.server";

const RESPONSE_HEADERS = {
	"cache-control": "no-store",
	"content-type": "application/json; charset=utf-8",
	"x-robots-tag": "noindex, nofollow",
};

export const Route = createFileRoute("/health")({
	server: {
		handlers: {
			GET: async () => {
				try {
					const { client } = await getDatabase();
					const rows = await client.all(
						"SELECT COUNT(*) AS map_count FROM maps",
					);
					const mapCount = Number(rows[0]?.map_count ?? 0);

					if (!Number.isSafeInteger(mapCount) || mapCount < 1) {
						throw new Error("Catalog is unavailable");
					}

					return Response.json(
						{ status: "healthy" },
						{ headers: RESPONSE_HEADERS },
					);
				} catch {
					return Response.json(
						{ status: "unhealthy" },
						{ status: 503, headers: RESPONSE_HEADERS },
					);
				}
			},
		},
	},
});
