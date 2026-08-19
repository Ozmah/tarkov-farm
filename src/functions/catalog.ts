import { createServerFn } from "@tanstack/react-start";

export const getCatalog = createServerFn({ method: "GET" }).handler(
	async () => {
		const { readCatalog } = await import("@/server/catalog.server");
		const { canAccessLocalEditor } = await import(
			"@/server/editor/access.server"
		);
		const { readPublicLayoutMode } = await import(
			"@/server/layout-mode.server"
		);

		return {
			...(await readCatalog()),
			editorAvailable: canAccessLocalEditor(),
			layoutMode: readPublicLayoutMode(),
		};
	},
);

export const getPublicMapData = createServerFn({ method: "GET" })
	.validator((input: { mapId: string }) => {
		if (
			typeof input?.mapId !== "string" ||
			input.mapId.length === 0 ||
			input.mapId.length > 100 ||
			!/^[a-zA-Z0-9_-]+$/.test(input.mapId)
		) {
			throw new Error("Invalid map identifier");
		}

		return { mapId: input.mapId };
	})
	.handler(async ({ data }) => {
		const { readPublicMap } = await import("@/server/catalog.server");

		return readPublicMap(data.mapId);
	});
