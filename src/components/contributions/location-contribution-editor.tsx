import { useBlocker } from "@tanstack/react-router";
import { useState } from "react";

import { ContributionTray } from "@/components/contributions/contribution-tray";
import { LocationComposerForm } from "@/components/location-composer/location-composer-form";
import type {
	LocationComposerDraft,
	LocationDraftChange,
} from "@/components/location-composer/location-draft";
import type { ScreenshotDraft } from "@/components/location-composer/location-screenshot-editor";
import { MapCanvas } from "@/components/location-composer/map-canvas";
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
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import type { getContributionCatalog } from "@/functions/contributions";
import {
	MAX_CONTRIBUTION_SCREENSHOT_BYTES,
	MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION,
	shouldWarnAboutLocationContributionBundleSize,
} from "@/lib/location-contribution";
import {
	createLocationContributionWorkspace,
	getLocationContributionWorkspaceBytes,
	removeStagedContributionLocation,
	stageContributionLocation,
} from "@/lib/location-contribution-workspace";

type ContributionCatalog = Awaited<ReturnType<typeof getContributionCatalog>>;

type LocationContributionEditorProps = {
	catalog: ContributionCatalog;
	initialMapId?: string;
};

export function LocationContributionEditor({
	catalog,
	initialMapId,
}: LocationContributionEditorProps) {
	const [workspace, setWorkspace] = useState(
		createLocationContributionWorkspace,
	);
	const [draft, setDraft] = useState(() => createDraft(catalog, initialMapId));
	const [screenshots, setScreenshots] = useState<ScreenshotDraft[]>([]);
	const [editingLocationId, setEditingLocationId] = useState<string>();
	const [isStaging, setIsStaging] = useState(false);
	const [error, setError] = useState<string>();
	const draftImage =
		catalog.mapImages.find(({ id }) => id === draft.mapImageId) ??
		catalog.mapImages[0];
	const draftMapId = draftImage?.mapId ?? "";
	const mapImages = catalog.mapImages.filter(
		({ mapId }) => mapId === draftMapId,
	);
	const documentIds = new Set(
		catalog.documentMaps
			.filter(({ mapId }) => mapId === draftMapId)
			.map(({ documentId }) => documentId),
	);
	const availableDocuments = catalog.documents.filter(({ id }) =>
		documentIds.has(id),
	);
	const keyIds = new Set(
		catalog.keyMaps
			.filter(({ mapId }) => mapId === draftMapId)
			.map(({ keyId }) => keyId),
	);
	const availableKeys = catalog.keys.filter(({ id }) => keyIds.has(id));
	const canvasLocations = [
		...workspace.locations.flatMap((location, index) =>
			location.mapImageId === draftImage?.id ||
			location.id === editingLocationId
				? [
						{
							...location,
							isActive: true,
							markerLabel: String(index + 1),
							requiredKeyCount: location.requiredKeyIds.length,
						},
					]
				: [],
		),
		...catalog.locations.flatMap((location) =>
			location.mapImageId === draftImage?.id
				? [
						{
							...location,
							appearance: "reference" as const,
							clusterable: false,
							id: `published:${location.id}`,
							isActive: true,
							markerLabel: "",
							requiredKeyCount: location.requiredKeyCount ?? 0,
							selectable: false,
						},
					]
				: [],
		),
	];
	const workspaceBytes = getLocationContributionWorkspaceBytes(workspace);
	const hasInMemoryWork =
		workspace.locations.length > 0 ||
		screenshots.length > 0 ||
		!areDraftsEqual(draft, createDraft(catalog, undefined, draft.mapImageId));
	const navigationBlocker = useBlocker({
		disabled: !hasInMemoryWork,
		enableBeforeUnload: () => hasInMemoryWork,
		shouldBlockFn: ({ next }) => next.pathname !== "/contribute/editor",
		withResolver: true,
	});

	if (!draftImage) {
		return (
			<Empty className="min-h-[50svh]">
				<EmptyHeader>
					<EmptyTitle>No contribution maps available</EmptyTitle>
					<EmptyDescription>
						The public contribution catalog does not contain a current map
						image.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const updateDraft: LocationDraftChange = (key, value) => {
		setDraft((current) => ({ ...current, [key]: value }));
		setError(undefined);
	};

	const updateDraftMap = (mapId: string) => {
		const next = createDraft(catalog, mapId);
		const nextDocumentIds = new Set(
			catalog.documentMaps
				.filter((assignment) => assignment.mapId === mapId)
				.map(({ documentId }) => documentId),
		);
		const nextKeyIds = new Set(
			catalog.keyMaps
				.filter((assignment) => assignment.mapId === mapId)
				.map(({ keyId }) => keyId),
		);

		setDraft((current) => ({
			...current,
			documentId: nextDocumentIds.has(current.documentId)
				? current.documentId
				: next.documentId,
			mapImageId: next.mapImageId,
			requiredKeyIds: current.requiredKeyIds.filter((id) => nextKeyIds.has(id)),
		}));
		setError(undefined);
	};

	const addScreenshotFiles = (files: File[]) => {
		setError(undefined);

		if (
			screenshots.length + files.length >
			MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION
		) {
			setError(
				`A location can contain at most ${MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION} screenshots`,
			);
			return;
		}

		if (files.some((file) => !isAcceptedScreenshot(file))) {
			setError("Screenshots must be JPEG, PNG, or WebP files under 20 MiB");
			return;
		}

		setScreenshots((current) => [
			...current,
			...files.map((file) => ({
				file,
				key: crypto.randomUUID(),
			})),
		]);
	};

	const moveScreenshot = (index: number, offset: -1 | 1) => {
		setScreenshots((current) => {
			const nextIndex = index + offset;
			if (nextIndex < 0 || nextIndex >= current.length) return current;

			const next = [...current];
			const [moved] = next.splice(index, 1);
			if (!moved) return current;

			next.splice(nextIndex, 0, moved);
			return next;
		});
		setError(undefined);
	};

	const resetComposer = (mapImageId = draft.mapImageId) => {
		setDraft(createDraft(catalog, undefined, mapImageId));
		setScreenshots([]);
		setEditingLocationId(undefined);
		setError(undefined);
	};

	const editLocation = (locationId: string) => {
		const location = workspace.locations.find(({ id }) => id === locationId);
		if (!location || isStaging) return;

		setDraft({
			description: location.description ?? "",
			documentId: location.documentId,
			mapImageId: location.mapImageId,
			name: location.name,
			requiredKeyIds: location.requiredKeyIds,
			xBasisPoints: location.xBasisPoints,
			yBasisPoints: location.yBasisPoints,
		});
		setScreenshots(
			location.screenshots.map((screenshot) => ({
				file: screenshot.file,
				key: screenshot.id,
			})),
		);
		setEditingLocationId(locationId);
		setError(undefined);
	};

	const stageLocation = async () => {
		setError(undefined);
		setIsStaging(true);

		try {
			const nextWorkspace = await stageContributionLocation(
				workspace,
				{
					...draft,
					mapImageSha256: draftImage.sha256,
					screenshots: screenshots.map((screenshot) => {
						if (!screenshot.file) {
							throw new Error("A screenshot file is unavailable");
						}

						return {
							file: screenshot.file,
						};
					}),
				},
				editingLocationId,
			);

			setWorkspace(nextWorkspace);
			resetComposer(draft.mapImageId);
		} catch (caughtError) {
			setError(readErrorMessage(caughtError));
		} finally {
			setIsStaging(false);
		}
	};

	const removeLocation = (locationId: string) => {
		setWorkspace((current) =>
			removeStagedContributionLocation(current, locationId),
		);

		if (editingLocationId === locationId) resetComposer();
	};

	const downloadContribution = async () => {
		const {
			createLocationContributionArchive,
			downloadLocationContributionArchive,
		} = await import("@/lib/location-contribution-archive");
		const archive = await createLocationContributionArchive(workspace);
		downloadLocationContributionArchive(archive);
		return archive.blob.size;
	};

	return (
		<>
			<div className="flex min-h-0 flex-1 flex-col overflow-auto lg:overflow-hidden">
				<div className="grid flex-none lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[minmax(0,1fr)_auto]">
					<MapCanvas
						key={draftImage.id}
						draftMarker={{
							...draft,
							isActive: true,
							requiredKeyCount: draft.requiredKeyIds.length,
						}}
						image={draftImage}
						locations={canvasLocations}
						selectedLocationId={editingLocationId}
						onPositionChange={(position) => {
							if (!isStaging) {
								setDraft((current) => ({ ...current, ...position }));
							}
						}}
						onSelectLocation={editLocation}
					/>

					<LocationComposerForm
						availableDocuments={availableDocuments}
						availableKeys={availableKeys}
						className="overflow-visible border-border border-t lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:overflow-auto lg:border-t-0"
						disabled={isStaging}
						draft={draft}
						draftMapId={draftMapId}
						error={error}
						eyebrow={editingLocationId ? "Editing tray item" : "New location"}
						keyboardSubmitHint="Use Ctrl+Enter to add this location to the tray."
						mapImages={mapImages}
						maps={catalog.maps}
						maxScreenshots={MAX_CONTRIBUTION_SCREENSHOTS_PER_LOCATION}
						screenshots={screenshots}
						screenshotDescription="Add JPEG, PNG, or WebP files up to 20 MiB each. They remain in this browser."
						secondaryActions={
							editingLocationId ? (
								<Button
									type="button"
									variant="ghost"
									disabled={isStaging}
									onClick={() => resetComposer()}
								>
									Cancel edit
								</Button>
							) : undefined
						}
						submitLabel={editingLocationId ? "Update tray" : "Add to tray"}
						submitting={isStaging}
						submittingLabel="Checking screenshots…"
						title={draft.name || "Untitled location"}
						onDraftChange={updateDraft}
						onMapChange={updateDraftMap}
						onScreenshotFilesAdded={addScreenshotFiles}
						onScreenshotMove={moveScreenshot}
						onScreenshotRemove={(key) => {
							setScreenshots((current) =>
								current.filter((screenshot) => screenshot.key !== key),
							);
							setError(undefined);
						}}
						onSubmit={() => void stageLocation()}
					/>

					<ContributionTray
						disabled={isStaging}
						documents={catalog.documents}
						editingLocationId={editingLocationId}
						locations={workspace.locations}
						mapImages={catalog.mapImages}
						maps={catalog.maps}
						totalBytes={workspaceBytes}
						warnAboutSize={shouldWarnAboutLocationContributionBundleSize(
							workspace,
						)}
						onCreate={() => resetComposer()}
						onDownload={downloadContribution}
						onEdit={editLocation}
						onRemove={removeLocation}
					/>
				</div>
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
						<AlertDialogTitle>Leave the contribution editor?</AlertDialogTitle>
						<AlertDialogDescription>
							Your locations, draft changes, and screenshots will be lost.
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
							Leave editor
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function createDraft(
	catalog: ContributionCatalog,
	mapId?: string,
	mapImageId?: string,
): LocationComposerDraft {
	const image =
		catalog.mapImages.find(({ id }) => id === mapImageId) ??
		catalog.mapImages.find((item) => item.mapId === mapId) ??
		catalog.mapImages[0];
	const documentId = catalog.documentMaps.find(
		(assignment) => assignment.mapId === image?.mapId,
	)?.documentId;

	return {
		description: "",
		documentId: documentId ?? "",
		mapImageId: image?.id ?? "",
		name: "",
		requiredKeyIds: [],
		xBasisPoints: 5_000,
		yBasisPoints: 5_000,
	};
}

function isAcceptedScreenshot(file: File) {
	return (
		file.size > 0 &&
		file.size <= MAX_CONTRIBUTION_SCREENSHOT_BYTES &&
		["image/jpeg", "image/png", "image/webp"].includes(file.type)
	);
}

function areDraftsEqual(
	left: LocationComposerDraft,
	right: LocationComposerDraft,
) {
	return (
		left.description === right.description &&
		left.documentId === right.documentId &&
		left.mapImageId === right.mapImageId &&
		left.name === right.name &&
		left.xBasisPoints === right.xBasisPoints &&
		left.yBasisPoints === right.yBasisPoints &&
		left.requiredKeyIds.length === right.requiredKeyIds.length &&
		left.requiredKeyIds.every((id, index) => id === right.requiredKeyIds[index])
	);
}

function readErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "Could not stage this location";
}
