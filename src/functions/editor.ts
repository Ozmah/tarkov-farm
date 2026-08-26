import { createServerFn } from "@tanstack/react-start";

import {
	parseDeleteLocationInput,
	parseImportContributionLocationFormData,
	parseSaveLocationFormData,
} from "@/lib/editor-validation";

export const getEditorData = createServerFn({ method: "GET" }).handler(
	async () => {
		const { readEditorData } = await import("@/server/editor/editor.server");

		return readEditorData();
	},
);

export const saveLocation = createServerFn({ method: "POST" })
	.validator(parseSaveLocationFormData)
	.handler(async ({ data }) => {
		const { saveEditorLocation } = await import(
			"@/server/editor/editor.server"
		);

		return saveEditorLocation(data);
	});

export const importContributionLocation = createServerFn({ method: "POST" })
	.validator(parseImportContributionLocationFormData)
	.handler(async ({ data }) => {
		const { saveEditorLocation } = await import(
			"@/server/editor/editor.server"
		);

		return saveEditorLocation(data.input, {
			expectedMapImageSha256: data.expectedMapImageSha256,
		});
	});

export const deleteLocation = createServerFn({ method: "POST" })
	.validator(parseDeleteLocationInput)
	.handler(async ({ data }) => {
		const { deleteEditorLocation } = await import(
			"@/server/editor/editor.server"
		);

		return deleteEditorLocation(data);
	});
