import {
	CheckCircleIcon,
	FileZipIcon,
	ShieldCheckIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { MapWorkspace } from "@/components/map/map-workspace";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FilePicker } from "@/components/ui/file-picker";
import { getEditorData, importContributionLocation } from "@/functions/editor";
import type {
	ReviewedContributionLocation,
	ReviewedLocationContributionArchive,
} from "@/lib/location-contribution-archive-reader";
import type { LocationContributionCatalog } from "@/lib/location-contribution-catalog";
import { getLocationScreenshotAltText } from "@/lib/location-screenshot-text";
import { cn } from "@/lib/utils";

type EditorData = Awaited<ReturnType<typeof getEditorData>>;
type ImportState = {
	error?: string;
	localId?: string;
	status: "failed" | "imported" | "importing";
};

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
	const [selectedId, setSelectedId] = useState<string>();
	const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
	const [importStates, setImportStates] = useState<Record<string, ImportState>>(
		{},
	);
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
	const importableIds = new Set(
		pendingLocations.flatMap(({ id }) => (approvedIds.has(id) ? [id] : [])),
	);

	async function openArchive(file: File) {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setIsReading(true);
		setError(undefined);
		setReviewed(undefined);
		setApprovedIds(new Set());
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

	function toggleApproval(locationId: string, approved: boolean) {
		setApprovedIds((current) => {
			const next = new Set(current);
			if (approved) next.add(locationId);
			else next.delete(locationId);
			return next;
		});
	}

	async function importApproved() {
		if (!reviewed || importableIds.size === 0 || isImporting) return;
		setIsImporting(true);
		setError(undefined);
		let importedAny = false;

		try {
			for (const location of reviewed.locations) {
				if (!importableIds.has(location.id)) continue;
				setSelectedId(location.id);
				setImportStates((current) => ({
					...current,
					[location.id]: { status: "importing" },
				}));

				try {
					const result = await importContributionLocation({
						data: createLocationFormData(location),
					});
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
						`Import stopped at ${location.name}. Earlier locations remain saved locally. ${message}`,
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
		setApprovedIds(new Set());
		setImportStates({});
		setError(undefined);
	}

	return (
		<>
			<div className="flex min-h-0 flex-1 flex-col overflow-auto">
				<h1 className="sr-only">Contribution bundle reviewer</h1>
				{reviewed ? (
					<div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)] lg:overflow-hidden">
						<aside className="flex flex-col border-border border-b bg-card lg:min-h-0 lg:border-r lg:border-b-0">
							<div className="border-border border-b p-5">
								<h2 className="font-heading font-semibold text-lg uppercase tracking-wider">
									Review bundle
								</h2>
								<p className="mt-2 text-muted-foreground text-sm">
									Approve each location explicitly. Importing saves local editor
									changes; it does not deploy them.
								</p>
								<p className="mt-3 font-heading text-muted-foreground text-xs tabular-nums">
									Bundle {reviewed.bundleId}
								</p>
							</div>

							<div className="divide-y divide-border lg:min-h-0 lg:flex-1 lg:overflow-auto">
								{reviewed.locations.map((location, index) => {
									const state = importStates[location.id];
									const approved = approvedIds.has(location.id);
									return (
										<div
											key={location.id}
											className={cn(
												"flex gap-3 p-4 transition-colors",
												selectedId === location.id && "bg-accent",
											)}
										>
											<Checkbox
												aria-label={`Approve ${location.name}`}
												checked={state?.status === "imported" || approved}
												disabled={isImporting || state?.status === "imported"}
												onCheckedChange={(checked) =>
													toggleApproval(location.id, checked)
												}
											/>
											<button
												type="button"
												className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
												onClick={() => setSelectedId(location.id)}
											>
												<span className="block font-heading text-muted-foreground text-xs tabular-nums">
													{String(index + 1).padStart(2, "0")}
												</span>
												<span className="mt-1 block truncate font-semibold">
													{location.name}
												</span>
												<span className="mt-1 block text-muted-foreground text-xs">
													{stateLabel(state, approved)}
												</span>
											</button>
										</div>
									);
								})}
							</div>

							<div className="space-y-3 border-border border-t p-4">
								{error ? (
									<p role="alert" className="text-destructive text-sm">
										{error}
									</p>
								) : null}
								<Button
									type="button"
									className="w-full"
									disabled={isImporting || importableIds.size === 0}
									onClick={() => void importApproved()}
								>
									<CheckCircleIcon data-icon="inline-start" />
									{isImporting
										? "Saving approved locations…"
										: `Import approved (${importableIds.size})`}
								</Button>
								<AlertDialog>
									<AlertDialogTrigger
										render={
											<Button
												type="button"
												variant="ghost"
												className="w-full"
												disabled={isImporting}
											/>
										}
									>
										Discard bundle
									</AlertDialogTrigger>
									<AlertDialogContent size="sm">
										<AlertDialogHeader>
											<AlertDialogTitle>Discard this review?</AlertDialogTitle>
											<AlertDialogDescription>
												Unimported locations and their in-memory screenshots
												will be removed. Already imported locations remain saved
												locally.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Keep reviewing</AlertDialogCancel>
											<AlertDialogAction
												variant="destructive"
												onClick={discardReview}
											>
												Discard bundle
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</aside>

						{selectedLocation ? (
							<LocationReview
								data={reviewData}
								location={selectedLocation}
								warningIds={
									reviewed.warnings.find(
										({ locationId }) => locationId === selectedLocation.id,
									)?.possibleDuplicateIds ?? []
								}
								approved={approvedIds.has(selectedLocation.id)}
								importState={importStates[selectedLocation.id]}
								isImporting={isImporting}
								onApprovalChange={(approved) =>
									toggleApproval(selectedLocation.id, approved)
								}
							/>
						) : null}
					</div>
				) : (
					<ArchivePicker
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
							Unimported locations and screenshots exist only in memory and will
							be lost. Saved locations will remain in the local editor.
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

function ArchivePicker({
	disabled,
	error,
	onFile,
}: {
	disabled: boolean;
	error?: string;
	onFile: (file: File) => void;
}) {
	return (
		<main className="flex min-h-[70svh] flex-1 items-center justify-center p-5 sm:p-8">
			<div className="w-full max-w-2xl border border-border bg-card p-6 shadow-[0_12px_32px_-20px_color-mix(in_oklch,var(--foreground)_45%,transparent)] sm:p-10">
				<div className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
					<FileZipIcon className="size-6" aria-hidden="true" />
				</div>
				<h2 className="mt-8 text-balance font-heading font-semibold text-2xl uppercase tracking-tight sm:text-3xl">
					Open a contribution bundle
				</h2>
				<p className="mt-3 max-w-[65ch] text-muted-foreground">
					Contribution ZIPs come from other people, so the editor checks the
					file structure, manifest, screenshots, and map references before
					showing anything. If something is missing or out of place, the bundle
					is rejected.
				</p>
				<div className="mt-6 flex items-start gap-3 border-border border-y py-4 text-sm">
					<ShieldCheckIcon
						className="mt-0.5 size-5 shrink-0 text-primary"
						aria-hidden="true"
					/>
					<p>
						Nothing is saved until you inspect and approve individual locations.
						Approved items become ordinary local editor changes.
					</p>
				</div>
				{error ? (
					<p role="alert" className="mt-5 text-destructive text-sm">
						{error}
					</p>
				) : null}
				<FilePicker
					accept=".zip,application/zip"
					buttonLabel={disabled ? "Verifying bundle…" : "Choose ZIP bundle"}
					buttonSize="lg"
					className="mt-6"
					disabled={disabled}
					dropLabel="Drop a ZIP bundle here"
					helpText="One contribution ZIP bundle at a time."
					icon={
						<FileZipIcon
							className="size-6 text-muted-foreground"
							aria-hidden="true"
						/>
					}
					regionLabel="Contribution bundle upload"
					onFilesSelected={([file]) => {
						if (file) onFile(file);
					}}
				/>
			</div>
		</main>
	);
}

function LocationReview({
	approved,
	data,
	importState,
	isImporting,
	location,
	warningIds,
	onApprovalChange,
}: {
	approved: boolean;
	data: EditorData;
	importState?: ImportState;
	isImporting: boolean;
	location: ReviewedContributionLocation;
	warningIds: string[];
	onApprovalChange: (approved: boolean) => void;
}) {
	const image = data.mapImages.find(({ id }) => id === location.mapImageId);
	const map = data.maps.find(({ id }) => id === image?.mapId);
	const document = data.documents.find(({ id }) => id === location.documentId);
	const requiredKeys = location.requiredKeyIds.map(
		(id) => data.keys.find((key) => key.id === id)?.name ?? id,
	);
	const referenceMarkers = data.locations
		.filter(({ mapImageId }) => mapImageId === location.mapImageId)
		.map((existing) => ({
			...existing,
			appearance: "reference" as const,
			clusterable: false,
			id: `existing:${existing.id}`,
			label: "",
			selectable: false,
		}));
	const markerId = `review:${location.id}`;

	return (
		<main className="min-w-0 lg:min-h-0 lg:overflow-auto">
			<div className="mx-auto w-full max-w-6xl p-5 sm:p-8">
				<div className="flex flex-col justify-between gap-5 border-border border-b pb-6 sm:flex-row sm:items-start">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-3">
							<h2 className="text-balance font-heading font-semibold text-2xl uppercase tracking-tight sm:text-3xl">
								{location.name}
							</h2>
							{importState?.status === "imported" ? (
								<Badge>
									<CheckCircleIcon aria-hidden="true" /> Saved locally
								</Badge>
							) : null}
						</div>
						<p className="mt-2 text-muted-foreground text-sm">
							{map?.name} · {image?.name} · {document?.name}
						</p>
					</div>
					<div className="flex min-h-11 items-center gap-3 border border-border px-4 py-2 font-semibold text-sm">
						<Checkbox
							aria-label={`Approve ${location.name}`}
							checked={importState?.status === "imported" || approved}
							disabled={isImporting || importState?.status === "imported"}
							onCheckedChange={onApprovalChange}
						/>
						{importState?.status === "imported"
							? "Imported"
							: "Approve location"}
					</div>
				</div>

				{warningIds.length > 0 ? (
					<div className="mt-6 flex items-start gap-3 bg-destructive/10 p-4 text-sm">
						<WarningIcon
							className="mt-0.5 size-5 shrink-0 text-destructive"
							aria-hidden="true"
						/>
						<div>
							<p className="font-semibold">Possible duplicate location</p>
							<p className="mt-1 text-muted-foreground">
								A current location has a matching name or lies within 0.75% of
								these coordinates. Compare the reference markers before
								approval.
							</p>
						</div>
					</div>
				) : null}

				{image ? (
					<div className="mt-8 overflow-hidden border border-border">
						<MapWorkspace
							key={image.id}
							ariaLabel={`Review position for ${location.name}`}
							className="min-h-[24rem]!"
							image={image}
							instructions="Review position · Drag to pan · Wheel to zoom"
							markers={[
								...referenceMarkers,
								{
									clusterable: false,
									id: markerId,
									label: "+",
									name: location.name,
									xBasisPoints: location.xBasisPoints,
									yBasisPoints: location.yBasisPoints,
								},
							]}
							selectedMarkerId={markerId}
						/>
					</div>
				) : null}

				<div className="grid gap-x-10 gap-y-6 border-border border-b py-8 md:grid-cols-2">
					<div>
						<h3 className="font-heading font-semibold text-sm uppercase tracking-wider">
							Location details
						</h3>
						<dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-sm">
							<dt className="text-muted-foreground">Coordinates</dt>
							<dd className="font-heading tabular-nums">
								{location.xBasisPoints}, {location.yBasisPoints}
							</dd>
							<dt className="text-muted-foreground">Document</dt>
							<dd>{document?.name ?? location.documentId}</dd>
							<dt className="text-muted-foreground">Required keys</dt>
							<dd>{requiredKeys.join(", ") || "None"}</dd>
						</dl>
					</div>
					<div>
						<h3 className="font-heading font-semibold text-sm uppercase tracking-wider">
							Description
						</h3>
						<p className="mt-4 whitespace-pre-wrap text-sm">
							{location.description || "No description provided."}
						</p>
					</div>
				</div>

				<section className="py-8">
					<div className="flex flex-wrap items-baseline justify-between gap-3">
						<h3 className="font-heading font-semibold text-lg uppercase tracking-wider">
							Screenshots
						</h3>
						<span className="text-muted-foreground text-sm tabular-nums">
							{location.screenshots.length} files ·{" "}
							{formatBytes(
								location.screenshots.reduce(
									(total, { file }) => total + file.size,
									0,
								),
							)}
						</span>
					</div>
					<div className="mt-5 grid gap-6 sm:grid-cols-2">
						{location.screenshots.map((screenshot, index) => (
							<ReviewScreenshot
								key={screenshot.id}
								index={index}
								locationDescription={location.description}
								locationName={location.name}
								screenshot={screenshot}
							/>
						))}
					</div>
				</section>
			</div>
		</main>
	);
}

function ReviewScreenshot({
	index,
	locationDescription,
	locationName,
	screenshot,
}: {
	index: number;
	locationDescription: string | null;
	locationName: string;
	screenshot: ReviewedContributionLocation["screenshots"][number];
}) {
	const [url, setUrl] = useState<string>();
	const altText = getLocationScreenshotAltText(
		{ description: locationDescription, name: locationName },
		screenshot.altText,
	);
	useEffect(() => {
		const nextUrl = URL.createObjectURL(screenshot.file);
		setUrl(nextUrl);
		return () => URL.revokeObjectURL(nextUrl);
	}, [screenshot.file]);

	return (
		<figure className="min-w-0">
			<div className="aspect-video overflow-hidden bg-muted">
				{url ? (
					<img src={url} alt={altText} className="size-full object-contain" />
				) : null}
			</div>
			<figcaption className="border-border border-x border-b p-4 text-sm">
				<p className="font-semibold">Screenshot {index + 1}</p>
				<p className="mt-2 text-muted-foreground">
					Alt: {screenshot.altText || "Empty"}
				</p>
				{screenshot.caption ? (
					<p className="mt-1 text-muted-foreground">
						Caption: {screenshot.caption}
					</p>
				) : null}
			</figcaption>
		</figure>
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

function createLocationFormData(location: ReviewedContributionLocation) {
	const formData = new FormData();
	formData.set("mapImageSha256", location.mapImageSha256);
	formData.set(
		"payload",
		JSON.stringify({
			location: {
				mapImageId: location.mapImageId,
				name: location.name,
				description: location.description,
				xBasisPoints: location.xBasisPoints,
				yBasisPoints: location.yBasisPoints,
				isActive: true,
				documentId: location.documentId,
				requiredKeyIds: location.requiredKeyIds,
			},
			screenshots: location.screenshots.map((screenshot, uploadIndex) => ({
				altText: screenshot.altText,
				caption: screenshot.caption,
				uploadIndex,
			})),
		}),
	);
	for (const screenshot of location.screenshots) {
		formData.append("screenshots", screenshot.file);
	}
	return formData;
}

function stateLabel(state: ImportState | undefined, approved: boolean) {
	if (state?.status === "imported") return "Saved as a local change";
	if (state?.status === "importing") return "Processing screenshots…";
	if (state?.status === "failed") return "Import failed — review the error";
	return approved ? "Approved for import" : "Awaiting review";
}

function formatBytes(bytes: number) {
	return `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MiB`;
}

function readErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "The contribution bundle could not be reviewed";
}
