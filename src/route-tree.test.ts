import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

type RuntimeRoute = {
	children?: RuntimeRoute[] | Record<string, RuntimeRoute>;
	options: { id?: string };
};

describe("route shell boundaries", () => {
	it("keeps editors outside the public browse layout", () => {
		const rootRoutes = Object.values(
			routeTree.children ?? {},
		) as RuntimeRoute[];
		const rootRouteIds = rootRoutes.map((route) => route.options.id);
		const publicRoute = rootRoutes.find(
			(route) => route.options.id === "/_public",
		);
		const publicChildIds = Object.values(publicRoute?.children ?? {}).map(
			(route) => route.options.id,
		);

		expect(rootRouteIds).toContain("/contribute/editor");
		expect(rootRouteIds).toContain("/editor");
		expect(publicChildIds).toContain("/contribute");
		expect(publicChildIds).not.toContain("/contribute/editor");
	});
});
