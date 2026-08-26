// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContributionReviewDialog } from "./contribution-review-dialog";

afterEach(cleanup);

describe("ContributionReviewDialog", () => {
	it("reviews and downloads a contribution before linking to GitHub", async () => {
		const onDownload = vi.fn().mockResolvedValue(1_388);
		renderReviewDialog(onDownload);

		fireEvent.click(screen.getByRole("button", { name: "Review & download" }));

		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(
			screen.getByText("Woods · Main map · Technical manual"),
		).toBeTruthy();
		expect(screen.getByText("X 3193 · Y 1527 · 1 screenshot")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Download ZIP" }));

		await waitFor(() => expect(onDownload).toHaveBeenCalledOnce());
		expect(screen.getByRole("status").textContent).toContain("ZIP downloaded");
		expect(
			screen.getByRole("link", { name: "Open GitHub issue" }),
		).toBeTruthy();
	});

	it("keeps the review open and explains export failures", async () => {
		const onDownload = vi
			.fn()
			.mockRejectedValue(new Error("Screenshot integrity verification failed"));
		renderReviewDialog(onDownload);

		fireEvent.click(screen.getByRole("button", { name: "Review & download" }));
		fireEvent.click(screen.getByRole("button", { name: "Download ZIP" }));

		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toContain(
				"Screenshot integrity verification failed",
			),
		);
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("warns before downloading an oversized contribution", async () => {
		const oversizedBytes = 26 * 1_048_576;
		const onDownload = vi.fn().mockResolvedValue(oversizedBytes);
		renderReviewDialog(onDownload, oversizedBytes);

		fireEvent.click(screen.getByRole("button", { name: "Review & download" }));
		fireEvent.click(screen.getByRole("button", { name: "Download ZIP" }));

		expect(onDownload).not.toHaveBeenCalled();
		expect(
			screen.getByRole("alertdialog", {
				name: "ZIP may exceed GitHub's limit",
			}),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(onDownload).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Download ZIP" }));
		fireEvent.click(screen.getByRole("button", { name: "Download anyway" }));

		await waitFor(() => expect(onDownload).toHaveBeenCalledOnce());
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(screen.getByRole("status").textContent).toContain(
			"Arrange a private transfer",
		);
		expect(
			screen.getByText(/Do not paste private download links/),
		).toBeTruthy();
		expect(
			screen.queryByRole("link", { name: "Open GitHub issue" }),
		).toBeNull();
	});
});

function renderReviewDialog(
	onDownload: () => Promise<number>,
	totalBytes?: number,
) {
	const file = new File(["screenshot"], "location.png", { type: "image/png" });

	return render(
		<ContributionReviewDialog
			disabled={false}
			documents={[{ id: "technical", name: "Technical manual" }]}
			locations={[
				{
					description: "On the desk",
					documentId: "technical",
					id: "5b79d7e8-fd87-4c8c-a08a-53791777876b",
					mapImageId: "woods-main",
					mapImageSha256: "a".repeat(64),
					name: "USEC camp",
					requiredKeyIds: [],
					screenshots: [
						{
							altText: "Desk",
							byteLength: file.size,
							caption: null,
							entry:
								"locations/5b79d7e8-fd87-4c8c-a08a-53791777876b/screenshots/15bccba8-db3c-4363-8a61-424d77918b03.png",
							file,
							id: "15bccba8-db3c-4363-8a61-424d77918b03",
							mediaType: "image/png",
							sourceSha256: "b".repeat(64),
						},
					],
					xBasisPoints: 3_193,
					yBasisPoints: 1_527,
				},
			]}
			mapImages={[{ id: "woods-main", mapId: "woods", name: "Main map" }]}
			maps={[{ id: "woods", name: "Woods" }]}
			totalBytes={totalBytes ?? file.size}
			onDownload={onDownload}
		/>,
	);
}
