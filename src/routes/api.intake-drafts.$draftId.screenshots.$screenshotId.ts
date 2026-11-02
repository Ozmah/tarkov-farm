import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/api/intake-drafts/$draftId/screenshots/$screenshotId",
)({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const { readIntakeDraftScreenshot } = await import(
					"@/server/intake/intake.server"
				);

				return readIntakeDraftScreenshot(
					request,
					params.draftId,
					params.screenshotId,
				);
			},
		},
	},
});
