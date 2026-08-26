import { createServerFn } from "@tanstack/react-start";

export const getContributionCatalog = createServerFn({ method: "GET" }).handler(
	async () => {
		const { readContributionCatalog } = await import(
			"@/server/contributions/contribution-catalog.server"
		);

		return readContributionCatalog();
	},
);
