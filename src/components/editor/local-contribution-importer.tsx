import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ContributionArchivePicker } from "@/components/editor/contribution-archive-picker";
import { ContributionLocationReview } from "@/components/editor/contribution-location-review";
import { ContributionReviewSidebar } from "@/components/editor/contribution-review-sidebar";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getEditorData, importContributionLocation } from "@/functions/editor";
import type {
	ReviewedContributionLocation,
	ReviewedLocationContributionArchive,
} from "@/lib/location-contribution-archive-reader";
import type { LocationContributionCatalog } from "@/lib/location-contribution-catalog";
import {
	type ContributionLocationImportState,
	type ContributionLocationReviewDraft,
	createContributionLocationImportFormData,
	createContributionLocationReviewDraft,
	getContributionLocationChangeCount,
	restoreContributionLocationReviewDraft,
} from "@/lib/location-contribution-review";

type EditorData = Awaited<ReturnType<typeof getEditorData>>;

type LocalContributionImporterProps = {
	data: EditorData;
	onImported: () => Promise<void>;
};

export function LocalContributionImporter({
	data,
	onImported,
}: LocalContributionImporterProps) {
	const abortRef = useRef<AbortController | undefined>(undefined);
	const [reviewed, setReviewed] =
		useState<ReviewedLocationContributionArchive>();
	const [reviewData, setReviewData] = useState(data);
	const [drafts, setDrafts] = useState<
		Record<string, ContributionLocationReviewDraft>
	>({});
	const [selectedId, setSelectedId] = useState<string>();
	const [importStates, setImportStates] = useState<
		Record<string, ContributionLocationImportState>
	>({});
	const [isReading, setIsReading] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [error, setError] = useState<string>();
	const pendingLocations =
		reviewed?.locations.filter(
			({ id }) => importStates[id]?.status !== "imported",
		) ?? [];
	const hasPendingReview = pendingLocations.length > 0;
	const navigationBlocker = useBlocker({
		disabled: !hasPendingReview,
		enableBeforeUnload: () => hasPendingReview,
		shouldBlockFn: () => true,
		withResolver: true,
	});

	useEffect(
		() => () => {
			abortRef.current?.abort();
		},
		[],
	);

	const selectedLocation = reviewed?.locations.find(
		({ id }) => id === selectedId,
	);
	const selectedDraft = selectedId ? drafts[selectedId] : undefined;
	const importableLocations = pendingLocations.filter(
		({ id }) => drafts[id]?.included,
	);
	const isCheckingReplacement = importableLocations.some(({ id }) =>
		drafts[id]?.screenshots.some(
			(screenshot) => screenshot.isCheckingReplacement,
		),
	);
	const modifiedCount = reviewed
		? reviewed.locations.filter(
				(location) =>
					getContributionLocationChangeCount(
						drafts[location.id] ??
							createContributionLocationReviewDraft(location),
						location,
					) > 0,
			).length
		: 0;

	async function openArchive(file: File) {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setIsReading(true);
		setError(undefined);
		setReviewed(undefined);
		setDrafts({});
		setImportStates({});

		try {
			const [freshData, { readLocationContributionArchive }] =
				await Promise.all([
					getEditorData(),
					import("@/lib/location-contribution-archive-reader"),
				]);
			const result = await readLocationContributionArchive(
				file,
				createContributionCatalog(freshData),
				{ signal: controller.signal },
			);
			setReviewData(freshData);
			setReviewed(result);
			setDrafts(
				Object.fromEntries(
					result.locations.map((location) => [
						location.id,
						createContributionLocationReviewDraft(location),
					]),
				),
			);
			setSelectedId(result.locations[0]?.id);
		} catch (caughtError) {
			if (!controller.signal.aborted) setError(readErrorMessage(caughtError));
		} finally {
			if (abortRef.current === controller) {
				abortRef.current = undefined;
				setIsReading(false);
			}
		}
	}

	function updateDraft(
		locationId: string,
		update:
			| ContributionLocationReviewDraft
			| ((
					current: ContributionLocationReviewDraft,
			  ) => ContributionLocationReviewDraft),
	) {
		if (importStates[locationId]?.status === "imported" || isImporting) return;
		setDrafts((current) => {
			const currentDraft = current[locationId];
			if (!currentDraft) return current;
			return {
				...current,
				[locationId]:
					typeof update === "function" ? update(currentDraft) : update,
			};
		});
		setError(undefined);
	}

	async function importSelected() {
		if (
			!reviewed ||
			importableLocations.length === 0 ||
			isImporting ||
			isCheckingReplacement
		)
			return;
		setError(undefined);

		const queue: Array<{
			formData: FormData;
			location: ReviewedContributionLocation;
		}> = [];
		try {
			for (const location of importableLocations) {
				const draft = drafts[location.id];
				if (!draft) throw new Error("A contribution review draft is missing");
				queue.push({
					formData: createContributionLocationImportFormData(
						draft,
						location,
						reviewData,
					),
					location,
				});
			}
		} catch (caughtError) {
			setError(readErrorMessage(caughtError));
			return;
		}

		setIsImporting(true);
		let importedAny = false;
		try {
			for (const { formData, location } of queue) {
				setSelectedId(location.id);
				setImportStates((current) => ({
					...current,
					[location.id]: { status: "importing" },
				}));

				try {
					const result = await importContributionLocation({ data: formData });
					importedAny = true;
					setImportStates((current) => ({
						...current,
						[location.id]: { localId: result.id, status: "imported" },
					}));
				} catch (caughtError) {
					const message = readErrorMessage(caughtError);
					setImportStates((current) => ({
						...current,
						[location.id]: { error: message, status: "failed" },
					}));
					setError(
						`Import stopped at ${drafts[location.id]?.values.name ?? location.name}. Earlier locations remain saved locally. ${message}`,
					);
					break;
				}
			}

			if (importedAny) {
				try {
					await onImported();
				} catch (caughtError) {
					setError(
						`Locations were saved, but the editor could not refresh. ${readErrorMessage(caughtError)}`,
					);
				}
			}
		} finally {
			setIsImporting(false);
		}
	}

	function discardReview() {
		abortRef.current?.abort();
		setReviewed(undefined);
		setSelectedId(undefined);
		setDrafts({});
		setImportStates({});
		setError(undefined);
	}

	return (
		<>
			<div className="flex min-h-0 flex-1 flex-col overflow-auto">
				<h1 className="sr-only">Contribution bundle reviewer</h1>
				{reviewed ? (
					<div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)] lg:overflow-hidden">
						<ContributionReviewSidebar
							drafts={drafts}
							error={error}
							importStates={importStates}
							isCheckingReplacement={isCheckingReplacement}
							isImporting={isImporting}
							modifiedCount={modifiedCount}
							reviewed={reviewed}
							selectedCount={importableLocations.length}
							selectedId={selectedId}
							onDiscard={discardReview}
							onImport={() => void importSelected()}
							onIncludeChange={(locationId, included) =>
								updateDraft(locationId, (current) => ({
									...current,
									included,
								}))
							}
							onSelect={setSelectedId}
						/>

						{selectedLocation && selectedDraft ? (
							<ContributionLocationReview
								key={selectedLocation.id}
								data={reviewData}
								draft={selectedDraft}
								importState={importStates[selectedLocation.id]}
								location={selectedLocation}
								warningIds={findPossibleDuplicateIds(selectedDraft, reviewData)}
								onDraftChange={(update) =>
									updateDraft(selectedLocation.id, update)
								}
								onRestore={() =>
									updateDraft(selectedLocation.id, (current) =>
										restoreContributionLocationReviewDraft(
											current,
											selectedLocation,
										),
									)
								}
							/>
						) : null}
					</div>
				) : (
					<ContributionArchivePicker
						disabled={isReading}
						error={error}
						onFile={(file) => void openArchive(file)}
					/>
				)}
			</div>

			<AlertDialog
				open={navigationBlocker.status === "blocked"}
				onOpenChange={(open) => {
					if (!open && navigationBlocker.status === "blocked") {
						navigationBlocker.reset();
					}
				}}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Leave this bundle review?</AlertDialogTitle>
						<AlertDialogDescription>
							Unimported locations, review changes, and screenshots exist only
							in memory and will be lost. Saved locations will remain in the
							local editor.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Stay here</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (navigationBlocker.status === "blocked") {
									navigationBlocker.proceed();
								}
							}}
						>
							Leave review
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function createContributionCatalog(
	data: EditorData,
): LocationContributionCatalog {
	return {
		documentMaps: data.documentMaps,
		documents: data.documents,
		keyMaps: data.keyMaps,
		keys: data.keys,
		locations: data.locations,
		mapImages: data.mapImages.map((image) => ({
			...image,
			sha256: image.contentHash,
		})),
		maps: data.maps,
	};
}

function findPossibleDuplicateIds(
	draft: ContributionLocationReviewDraft,
	data: EditorData,
) {
	return data.locations
		.filter(
			(location) =>
				location.mapImageId === draft.values.mapImageId &&
				(normalizeName(location.name) === normalizeName(draft.values.name) ||
					Math.hypot(
						location.xBasisPoints - draft.values.xBasisPoints,
						location.yBasisPoints - draft.values.yBasisPoints,
					) <= 75),
		)
		.map(({ id }) => id);
}

function normalizeName(value: string) {
	return value.trim().toLocaleLowerCase("en-US");
}

function readErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "The contribution bundle could not be reviewed";
}
