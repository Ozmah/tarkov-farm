import { NotePencilIcon } from "@phosphor-icons/react";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { dismissIntakeDraft } from "@/functions/intake";
import type { IntakeDraft } from "@/lib/intake-draft";

export type OpenedIntakeDraft = {
	draft: IntakeDraft;
	files: File[];
};

type IntakeDraftsProps = {
	drafts: IntakeDraft[];
	catalog: {
		maps: Array<{ id: string; name: string }>;
		mapImages: Array<{ id: string; mapId: string; name: string }>;
		documents: Array<{ id: string; name: string }>;
	};
	onOpen: (opened: OpenedIntakeDraft) => void;
	onDismissed: () => Promise<void>;
};

export function intakeScreenshotUrl(draftId: string, screenshotId: string) {
	return `/api/intake-drafts/${draftId}/screenshots/${screenshotId}`;
}

export function IntakeDrafts({
	drafts,
	catalog,
	onOpen,
	onDismissed,
}: IntakeDraftsProps) {
	const [busyId, setBusyId] = useState<string>();
	const [error, setError] = useState<string>();

	async function run(id: string, action: () => Promise<void>) {
		setBusyId(id);
		setError(undefined);
		try {
			await action();
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Draft action failed",
			);
		} finally {
			setBusyId(undefined);
		}
	}

	if (drafts.length === 0) {
		return (
			<Empty className="min-h-[50svh]">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<NotePencilIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>No pending drafts</EmptyTitle>
					<EmptyDescription>
						Drafts created by the local agent appear here for review.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="min-h-0 flex-1 overflow-auto p-5">
			{error && (
				<p role="alert" className="mb-4 text-destructive text-sm">
					{error}
				</p>
			)}
			<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{drafts.map((draft) => {
					const image = catalog.mapImages.find(
						({ id }) => id === draft.values.mapImageId,
					);
					const map = catalog.maps.find(({ id }) => id === image?.mapId);
					const document = catalog.documents.find(
						({ id }) => id === draft.values.documentId,
					);
					const cover = draft.screenshots[0];
					const busy = busyId === draft.id;

					return (
						<li
							key={draft.id}
							className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
						>
							{cover ? (
								<img
									src={intakeScreenshotUrl(draft.id, cover.id)}
									alt=""
									width={cover.width}
									height={cover.height}
									loading="lazy"
									className="aspect-video w-full object-cover"
								/>
							) : (
								<div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground text-sm">
									No screenshots
								</div>
							)}
							<div className="flex flex-1 flex-col gap-2 p-4">
								<h3 className="font-heading font-medium text-lg">
									{draft.values.name || "Untitled draft"}
								</h3>
								<p className="text-muted-foreground text-sm">
									{[
										map ? `${map.name} · ${image?.name}` : "No map",
										document?.name ?? "No document",
										`${draft.screenshots.length} screenshot${draft.screenshots.length === 1 ? "" : "s"}`,
									].join(" — ")}
								</p>
								{draft.notes && (
									<p className="line-clamp-3 whitespace-pre-line rounded-md bg-muted p-2 text-sm">
										{draft.notes}
									</p>
								)}
								<div className="mt-auto flex gap-2 pt-2">
									<Button
										type="button"
										size="sm"
										disabled={busyId !== undefined}
										onClick={() =>
											void run(draft.id, async () =>
												onOpen({ draft, files: await fetchDraftFiles(draft) }),
											)
										}
									>
										{busy ? "Opening…" : "Open"}
									</Button>
									<AlertDialog>
										<AlertDialogTrigger
											render={
												<Button
													type="button"
													size="sm"
													variant="ghost"
													disabled={busyId !== undefined}
												/>
											}
										>
											Dismiss
										</AlertDialogTrigger>
										<AlertDialogContent size="sm">
											<AlertDialogHeader>
												<AlertDialogTitle>Dismiss this draft?</AlertDialogTitle>
												<AlertDialogDescription>
													It leaves the review queue for good. Its files stay in
													assets/intake.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={() =>
														void run(draft.id, async () => {
															await dismissIntakeDraft({
																data: { id: draft.id },
															});
															await onDismissed();
														})
													}
												>
													Dismiss draft
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** Screenshots become regular Files so the location form treats them like uploads. */
async function fetchDraftFiles(draft: IntakeDraft) {
	return Promise.all(
		draft.screenshots.map(async (screenshot, index) => {
			const response = await fetch(
				intakeScreenshotUrl(draft.id, screenshot.id),
			);
			if (!response.ok)
				throw new Error(`Draft screenshot ${index + 1} could not be loaded`);
			return new File([await response.blob()], `${screenshot.id}`, {
				type: screenshot.mediaType,
			});
		}),
	);
}
