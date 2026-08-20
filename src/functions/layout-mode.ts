import { createServerFn } from "@tanstack/react-start";

import { parseLayoutModeInput } from "@/lib/layout-mode";

export const setPublicLayoutMode = createServerFn({ method: "POST" })
	.validator(parseLayoutModeInput)
	.handler(async ({ data }) => {
		const { writePublicLayoutMode } = await import(
			"@/server/layout-mode.server"
		);
		writePublicLayoutMode(data.layoutMode);

		return data.layoutMode;
	});
