import { createServerFn } from "@tanstack/react-start";

export const getCatalog = createServerFn({ method: "GET" }).handler(
	async () => {
		const { readCatalog } = await import("@/server/catalog.server");

		return readCatalog();
	},
);
