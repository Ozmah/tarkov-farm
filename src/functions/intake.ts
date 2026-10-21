import { createServerFn } from "@tanstack/react-start";

import { parseSaveLocationFormData } from "@/lib/editor-validation";
import { parseIntakeDraftId } from "@/lib/intake-draft";

export const getPendingIntakeDrafts = createServerFn({ method: "GET" }).handler(
	async () => {
		const { listPendingIntakeDrafts } = await import(
			"@/server/intake/intake.server"
		);

		return listPendingIntakeDrafts();
	},
);

export const saveIntakeDraftLocation = createServerFn({ method: "POST" })
	.validator((formData: unknown) => {
		if (!(formData instanceof FormData))
			throw new Error("Expected draft location form data");
		return {
			draftId: parseIntakeDraftId(formData.get("draftId")),
			input: parseSaveLocationFormData(formData),
		};
	})
	.handler(async ({ data }) => {
		const { saveIntakeDraftLocation } = await import(
			"@/server/intake/intake.server"
		);

		return saveIntakeDraftLocation(data.draftId, data.input);
	});

export const dismissIntakeDraft = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (!input || typeof input !== "object" || !("id" in input))
			throw new Error("Draft identifier is required");
		return { id: parseIntakeDraftId(input.id) };
	})
	.handler(async ({ data }) => {
		const { dismissIntakeDraft } = await import(
			"@/server/intake/intake.server"
		);

		return dismissIntakeDraft(data.id);
	});
