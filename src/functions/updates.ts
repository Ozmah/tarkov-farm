import { createServerFn } from "@tanstack/react-start";

import {
	parseDeleteUpdateInput,
	parseSaveUpdateInput,
} from "@/lib/update-editor-validation";

export const getUpdates = createServerFn({ method: "GET" }).handler(
	async () => {
		const { readPublicUpdates } = await import("@/server/updates.server");
		return readPublicUpdates();
	},
);

export const getEditorUpdates = createServerFn({ method: "GET" }).handler(
	async () => {
		const { readEditorUpdates } = await import(
			"@/server/editor/updates-editor.server"
		);
		return readEditorUpdates();
	},
);

export const saveUpdate = createServerFn({ method: "POST" })
	.validator(parseSaveUpdateInput)
	.handler(async ({ data }) => {
		const { saveEditorUpdate } = await import(
			"@/server/editor/updates-editor.server"
		);
		return saveEditorUpdate(data);
	});

export const deleteUpdate = createServerFn({ method: "POST" })
	.validator(parseDeleteUpdateInput)
	.handler(async ({ data }) => {
		const { deleteEditorUpdate } = await import(
			"@/server/editor/updates-editor.server"
		);
		return deleteEditorUpdate(data);
	});
