import {
	ArrowCounterClockwiseIcon,
	CheckCircleIcon,
	MinusIcon,
	PencilSimpleIcon,
	PlusIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import {
	type ReactNode,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";

import { ContributionScreenshotReview } from "@/components/editor/contribution-screenshot-review";
import {
	MapWorkspace,
	type MapWorkspaceMarker,
} from "@/components/map/map-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { getEditorData } from "@/functions/editor";
import type { ReviewedContributionLocation } from "@/lib/location-contribution-archive-reader";
import { verifyLocationContributionImageFile } from "@/lib/location-contribution-image";
import {
	type ContributionLocationImportState,
	type ContributionLocationReviewDraft,
	type ContributionLocationReviewValues,
	type ContributionReviewField,
	createContributionLocationReviewDraft,
	findReviewedScreenshot,
	getAvailableReviewOptions,
	getContributionLocationChangedFields,
} from "@/lib/location-contribution-review";

type EditorData = Awaited<ReturnType<typeof getEditorData>>;
type ContributionLocationReviewProps = {
	data: EditorData;
	draft: ContributionLocationReviewDraft;
	importState?: ContributionLocationImportState;
	location: ReviewedContributionLocation;
	warningIds: string[];
	onDraftChange: (
		update:
			| ContributionLocationReviewDraft
			| ((
					draft: ContributionLocationReviewDraft,
			  ) => ContributionLocationReviewDraft),
	) => void;
	onRestore: () => void;
};

type EditableSection =
	| "description"
	| "document"
	| "keys"
	| "map"
	| "name"
	| "position";

export function ContributionLocationReview({
	data,
	draft,
	importState,
	location,
	warningIds,
	onDraftChange,
	onRestore,
}: ContributionLocationReviewProps) {
	const [editing, setEditing] = useState<EditableSection>();
	const replacementRequestsRef = useRef(new Map<string, AbortController>());
	function abortPendingReplacementChecks() {
		for (const controller of replacementRequestsRef.current.values()) {
			controller.abort();
		}
		replacementRequestsRef.current.clear();
	}
	const cancelPendingReplacements = useEffectEvent(() => {
		const pendingIds = new Set(replacementRequestsRef.current.keys());
		if (pendingIds.size === 0) return;
		abortPendingReplacementChecks();
		onDraftChange((current) => ({
			...current,
			screenshots: current.screenshots.map((screenshot) =>
				pendingIds.has(screenshot.sourceId)
					? {
							...screenshot,
							isCheckingReplacement: false,
							replacementError:
								"Replacement check was cancelled when the review changed.",
						}
					: screenshot,
			),
		}));
	});
	useEffect(() => () => cancelPendingReplacements(), []);
	const original = createContributionLocationReviewDraft(location);
	const changedFields = new Set(
		getContributionLocationChangedFields(draft, location),
	);
	const isLocked =
		importState?.status === "imported" || importState?.status === "importing";
	const image = data.mapImages.find(({ id }) => id === draft.values.mapImageId);
	const map = data.maps.find(({ id }) => id === image?.mapId);
	const options = getAvailableReviewOptions(draft.values.mapImageId, data);
	const originalImage = data.mapImages.find(
		({ id }) => id === original.values.mapImageId,
	);
	const originalMap = data.maps.find(({ id }) => id === originalImage?.mapId);
	const changedMap = image?.mapId !== originalImage?.mapId;
	const document = data.documents.find(
		({ id }) => id === draft.values.documentId,
	);
	const originalDocument = data.documents.find(
		({ id }) => id === original.values.documentId,
	);
	const requiredKeyNames = getKeyNames(draft.values.requiredKeyIds, data);
	const originalRequiredKeyNames = getKeyNames(
		original.values.requiredKeyIds,
		data,
	);
	const canRestoreDocument = options.documents.some(
		({ id }) => id === original.values.documentId,
	);
	const availableKeyIds = new Set(options.keys.map(({ id }) => id));
	const canRestoreRequiredKeys = original.values.requiredKeyIds.every((id) =>
		availableKeyIds.has(id),
	);
	const positionChanged =
		changedFields.has("xBasisPoints") || changedFields.has("yBasisPoints");
	const screenshotChanged = draft.screenshots.some(
		(screenshot, index) =>
			!screenshot.included ||
			screenshot.replacement !== undefined ||
			screenshot.sourceId !== location.screenshots[index]?.id,
	);
	const hasChanges = changedFields.size > 0 || screenshotChanged;
	const duplicateNames = warningIds.map(
		(id) => data.locations.find((candidate) => candidate.id === id)?.name ?? id,
	);

	function updateValues(
		changes:
			| Partial<ContributionLocationReviewValues>
			| ((
					values: ContributionLocationReviewValues,
			  ) => ContributionLocationReviewValues),
	) {
		if (isLocked) return;
		onDraftChange((current) => ({
			...current,
			values:
				typeof changes === "function"
					? changes(current.values)
					: { ...current.values, ...changes },
		}));
	}

	function restoreField(field: ContributionReviewField) {
		updateValues({ [field]: original.values[field] });
	}

	function restoreMapAndAccess() {
		updateValues({
			documentId: original.values.documentId,
			mapImageId: original.values.mapImageId,
			requiredKeyIds: original.values.requiredKeyIds,
		});
	}

	function updateScreenshot(
		screenshotId: string,
		update: (
			screenshot: ContributionLocationReviewDraft["screenshots"][number],
		) => ContributionLocationReviewDraft["screenshots"][number],
	) {
		onDraftChange((current) => ({
			...current,
			screenshots: current.screenshots.map((screenshot) =>
				screenshot.sourceId === screenshotId ? update(screenshot) : screenshot,
			),
		}));
	}

	async function replaceScreenshot(screenshotId: string, file: File) {
		replacementRequestsRef.current.get(screenshotId)?.abort();
		const controller = new AbortController();
		replacementRequestsRef.current.set(screenshotId, controller);
		updateScreenshot(screenshotId, (screenshot) => ({
			...screenshot,
			isCheckingReplacement: true,
			replacementError: undefined,
		}));

		try {
			const verified = await verifyLocationContributionImageFile(file, {
				signal: controller.signal,
			});
			if (replacementRequestsRef.current.get(screenshotId) !== controller)
				return;
			replacementRequestsRef.current.delete(screenshotId);
			updateScreenshot(screenshotId, (screenshot) => ({
				...screenshot,
				isCheckingReplacement: false,
				replacement: {
					file: verified.file,
					sourceSha256: verified.sourceSha256,
				},
				replacementError: undefined,
			}));
		} catch (caughtError) {
			if (replacementRequestsRef.current.get(screenshotId) !== controller)
				return;
			replacementRequestsRef.current.delete(screenshotId);
			updateScreenshot(screenshotId, (screenshot) => ({
				...screenshot,
				isCheckingReplacement: false,
				replacementError: readErrorMessage(caughtError),
			}));
		}
	}

	function changeMap(mapId: string) {
		const nextImage = data.mapImages.find(
			(candidate) => candidate.mapId === mapId,
		);
		if (!nextImage) return;
		const nextOptions = getAvailableReviewOptions(nextImage.id, data);
		const availableKeyIds = new Set(nextOptions.keys.map(({ id }) => id));
		updateValues((current) => ({
			...current,
			documentId: nextOptions.documents.some(
				({ id }) => id === current.documentId,
			)
				? current.documentId
				: (nextOptions.documents[0]?.id ?? ""),
			mapImageId: nextImage.id,
			requiredKeyIds: current.requiredKeyIds.filter((id) =>
				availableKeyIds.has(id),
			),
		}));
	}

	const includeId = `include-location-${location.id}`;

	return (
		<main className="min-w-0 lg:min-h-0 lg:overflow-auto">
			<div className="mx-auto w-full max-w-6xl p-5 sm:p-8">
				<header className="flex flex-col justify-between gap-5 border-border border-b pb-6 sm:flex-row sm:items-start">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-3">
							<h2 className="text-balance font-heading font-semibold text-2xl uppercase tracking-tight sm:text-3xl">
								{draft.values.name || "Untitled location"}
							</h2>
							{hasChanges ? (
								<Badge>Modified</Badge>
							) : (
								<Badge variant="secondary">Original</Badge>
							)}
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
					<div className="flex flex-wrap items-center justify-end gap-2">
						{hasChanges ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={isLocked}
								onClick={() => {
									abortPendingReplacementChecks();
									setEditing(undefined);
									onRestore();
								}}
							>
								<ArrowCounterClockwiseIcon
									data-icon="inline-start"
									aria-hidden="true"
								/>
								Discard changes
							</Button>
						) : null}
						<label
							htmlFor={includeId}
							className="flex min-h-11 cursor-pointer items-center gap-3 border border-border px-4 py-2 font-semibold text-sm has-disabled:cursor-default has-disabled:opacity-50"
						>
							<Checkbox
								id={includeId}
								aria-label={`Include ${draft.values.name || location.name} in import`}
								checked={importState?.status === "imported" || draft.included}
								disabled={isLocked}
								onCheckedChange={(included) =>
									onDraftChange((current) => ({ ...current, included }))
								}
							/>
							{importState?.status === "imported"
								? "Imported"
								: "Include in import"}
						</label>
					</div>
				</header>

				{warningIds.length > 0 ? (
					<div className="mt-6 flex items-start gap-3 bg-destructive/10 p-4 text-sm">
						<WarningIcon
							className="mt-0.5 size-5 shrink-0 text-destructive"
							aria-hidden="true"
						/>
						<div>
							<p className="font-semibold">Possible duplicate location</p>
							<p className="mt-1 text-muted-foreground">
								Compare against {formatList(duplicateNames)} before importing.
							</p>
						</div>
					</div>
				) : null}

				<section
					className="mt-8 border border-border"
					aria-labelledby="location-data-heading"
				>
					<div className="flex items-center justify-between gap-4 border-border border-b bg-card px-5 py-4">
						<h3
							id="location-data-heading"
							className="font-heading font-semibold text-sm uppercase tracking-wider"
						>
							Location data
						</h3>
						<span className="text-muted-foreground text-xs tabular-nums">
							{changedFields.size} changed fields
						</span>
					</div>

					<ReviewRow
						changed={changedFields.has("name")}
						current={draft.values.name || "Empty"}
						disabled={isLocked}
						editing={editing === "name"}
						label="Name"
						original={original.values.name}
						onEdit={() => setEditing(editing === "name" ? undefined : "name")}
						onRestore={() => restoreField("name")}
					>
						<Input
							aria-label="Edit contribution location name"
							autoComplete="off"
							maxLength={120}
							spellCheck="false"
							value={draft.values.name}
							onChange={(event) => updateValues({ name: event.target.value })}
						/>
					</ReviewRow>

					<ReviewRow
						changed={changedFields.has("description")}
						current={draft.values.description || "No description provided"}
						disabled={isLocked}
						editing={editing === "description"}
						label="Description"
						original={original.values.description || "No description provided"}
						onEdit={() =>
							setEditing(editing === "description" ? undefined : "description")
						}
						onRestore={() => restoreField("description")}
					>
						<Textarea
							aria-label="Edit contribution location description"
							maxLength={2_000}
							rows={5}
							value={draft.values.description}
							onChange={(event) =>
								updateValues({ description: event.target.value })
							}
						/>
					</ReviewRow>

					<ReviewRow
						changed={changedFields.has("mapImageId")}
						current={`${map?.name ?? "Unknown map"} · ${image?.name ?? "Unknown view"}`}
						disabled={isLocked}
						editing={editing === "map"}
						label="Map"
						original={`${originalMap?.name ?? "Unknown map"} · ${originalImage?.name ?? "Unknown view"}`}
						onEdit={() => setEditing(editing === "map" ? undefined : "map")}
						restoreLabel={changedMap ? "Revert map and access" : "Revert Map"}
						onRestore={() =>
							changedMap ? restoreMapAndAccess() : restoreField("mapImageId")
						}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<ReviewSelect
								label="Map"
								items={data.maps}
								value={options.mapId}
								onChange={changeMap}
							/>
							<ReviewSelect
								label="Map view"
								items={options.mapImages}
								value={draft.values.mapImageId}
								onChange={(mapImageId) => updateValues({ mapImageId })}
							/>
						</div>
					</ReviewRow>

					<ReviewRow
						changed={changedFields.has("documentId")}
						current={document?.name ?? draft.values.documentId}
						disabled={isLocked}
						editing={editing === "document"}
						label="Document"
						original={originalDocument?.name ?? original.values.documentId}
						onEdit={() =>
							setEditing(editing === "document" ? undefined : "document")
						}
						restoreLabel={
							canRestoreDocument
								? "Revert Document"
								: "Revert map and access to restore Document"
						}
						onRestore={() =>
							canRestoreDocument
								? restoreField("documentId")
								: restoreMapAndAccess()
						}
					>
						<ReviewSelect
							label="Document"
							items={options.documents}
							value={draft.values.documentId}
							onChange={(documentId) => updateValues({ documentId })}
						/>
					</ReviewRow>

					<ReviewRow
						changed={changedFields.has("requiredKeyIds")}
						current={formatList(requiredKeyNames)}
						disabled={isLocked}
						editing={editing === "keys"}
						label="Required keys"
						original={formatList(originalRequiredKeyNames)}
						onEdit={() => setEditing(editing === "keys" ? undefined : "keys")}
						restoreLabel={
							canRestoreRequiredKeys
								? "Revert Required keys"
								: "Revert map and access to restore Required keys"
						}
						onRestore={() =>
							canRestoreRequiredKeys
								? restoreField("requiredKeyIds")
								: restoreMapAndAccess()
						}
					>
						<div className="grid max-h-72 gap-1 overflow-auto border border-border p-2">
							{options.keys.length > 0 ? (
								options.keys.map((key) => {
									const checked = draft.values.requiredKeyIds.includes(key.id);
									const keyId = `review-key-${location.id}-${key.id}`;
									return (
										<label
											key={key.id}
											htmlFor={keyId}
											className="flex min-h-11 cursor-pointer items-center gap-3 px-2 hover:bg-muted"
										>
											<Checkbox
												id={keyId}
												checked={checked}
												onCheckedChange={(nextChecked) =>
													updateValues({
														requiredKeyIds: nextChecked
															? [...draft.values.requiredKeyIds, key.id]
															: draft.values.requiredKeyIds.filter(
																	(id) => id !== key.id,
																),
													})
												}
											/>
											{key.name}
										</label>
									);
								})
							) : (
								<p className="p-2 text-muted-foreground text-sm">
									No keys are assigned to this map.
								</p>
							)}
						</div>
					</ReviewRow>
				</section>

				<section
					className="mt-8 overflow-hidden border border-border"
					aria-labelledby="map-position-heading"
				>
					<div className="flex flex-wrap items-center gap-3 border-border border-b bg-card px-5 py-4">
						<h3
							id="map-position-heading"
							className="font-heading font-semibold text-sm uppercase tracking-wider"
						>
							Map position
						</h3>
						{positionChanged ? (
							<Badge>Modified</Badge>
						) : (
							<Badge variant="secondary">Original</Badge>
						)}
						<span className="ml-auto font-heading text-muted-foreground text-xs tabular-nums">
							{draft.values.xBasisPoints}, {draft.values.yBasisPoints}
						</span>
						{positionChanged ? (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								disabled={isLocked}
								onClick={() =>
									updateValues({
										xBasisPoints: original.values.xBasisPoints,
										yBasisPoints: original.values.yBasisPoints,
									})
								}
							>
								<ArrowCounterClockwiseIcon
									data-icon="inline-start"
									aria-hidden="true"
								/>
								Revert
							</Button>
						) : null}
						<Button
							type="button"
							variant="outline"
							size="xs"
							disabled={isLocked}
							onClick={() =>
								setEditing(editing === "position" ? undefined : "position")
							}
						>
							<PencilSimpleIcon data-icon="inline-start" aria-hidden="true" />
							{editing === "position" ? "Done" : "Edit position"}
						</Button>
					</div>
					{image ? (
						<MapWorkspace
							key={image.id}
							ariaLabel={`Review position for ${draft.values.name || location.name}`}
							className="min-h-[24rem]!"
							image={image}
							instructions={
								editing === "position"
									? "Click to move the proposed marker · Wheel to zoom"
									: "Review proposed and existing markers · Wheel to zoom"
							}
							markers={createReviewMarkers(
								data,
								draft,
								location,
								original,
								positionChanged,
							)}
							selectedMarkerId={`review:${location.id}`}
							selectedMarkerPosition={draft.values}
							onMapPress={
								editing === "position" && !isLocked
									? (position) => updateValues(position)
									: undefined
							}
						/>
					) : null}
					{editing === "position" ? (
						<div className="grid gap-4 border-border border-t bg-muted/20 p-4 sm:grid-cols-2">
							<CoordinateInput
								axis="X"
								value={draft.values.xBasisPoints}
								onChange={(xBasisPoints) => updateValues({ xBasisPoints })}
							/>
							<CoordinateInput
								axis="Y"
								value={draft.values.yBasisPoints}
								onChange={(yBasisPoints) => updateValues({ yBasisPoints })}
							/>
						</div>
					) : null}
				</section>

				<section className="py-8" aria-labelledby="screenshots-heading">
					<div className="flex flex-wrap items-baseline justify-between gap-3">
						<div className="flex items-center gap-3">
							<h3
								id="screenshots-heading"
								className="font-heading font-semibold text-lg uppercase tracking-wider"
							>
								Screenshots
							</h3>
							{screenshotChanged ? <Badge>Modified</Badge> : null}
						</div>
						<span className="text-muted-foreground text-sm tabular-nums">
							{draft.screenshots.filter(({ included }) => included).length} of{" "}
							{draft.screenshots.length} included
						</span>
					</div>
					<ol className="mt-5 grid gap-6 sm:grid-cols-2">
						{draft.screenshots.map((screenshot, index) => (
							<ContributionScreenshotReview
								key={screenshot.sourceId}
								disabled={isLocked}
								draft={screenshot}
								index={index}
								source={findReviewedScreenshot(location, screenshot.sourceId)}
								total={draft.screenshots.length}
								onIncludedChange={(included) =>
									updateScreenshot(screenshot.sourceId, (candidate) => ({
										...candidate,
										included,
									}))
								}
								onMove={(offset) =>
									onDraftChange((current) => ({
										...current,
										screenshots: moveItem(current.screenshots, index, offset),
									}))
								}
								onReplacementFile={(file) =>
									void replaceScreenshot(screenshot.sourceId, file)
								}
								onReplacementChange={(replacement) =>
									updateScreenshot(screenshot.sourceId, (candidate) => ({
										...candidate,
										isCheckingReplacement: false,
										replacement,
										replacementError: undefined,
									}))
								}
							/>
						))}
					</ol>
				</section>
			</div>
		</main>
	);
}

function ReviewRow({
	changed,
	children,
	current,
	disabled,
	editing,
	label,
	original,
	restoreLabel = `Revert ${label}`,
	onEdit,
	onRestore,
}: {
	changed: boolean;
	children: ReactNode;
	current: string;
	disabled: boolean;
	editing: boolean;
	label: string;
	original: string;
	restoreLabel?: string;
	onEdit: () => void;
	onRestore?: () => void;
}) {
	return (
		<div className="border-border border-b last:border-b-0">
			<div className="grid gap-3 px-5 py-4 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:items-start">
				<div className="flex items-center gap-2">
					<span className="font-semibold text-sm">{label}</span>
					{changed ? <Badge>Changed</Badge> : null}
				</div>
				{changed ? (
					<div className="min-w-0 space-y-2 text-sm">
						<div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-muted-foreground">
							<MinusIcon
								className="mt-1 size-3 text-destructive"
								aria-hidden="true"
							/>
							<p className="whitespace-pre-wrap break-words line-through decoration-destructive/70">
								{original}
							</p>
						</div>
						<div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2">
							<PlusIcon
								className="mt-1 size-3 text-primary"
								aria-hidden="true"
							/>
							<p className="whitespace-pre-wrap break-words">{current}</p>
						</div>
					</div>
				) : (
					<p className="min-w-0 whitespace-pre-wrap break-words text-sm">
						{current}
					</p>
				)}
				<div className="flex items-center gap-1 md:justify-end">
					{changed && onRestore ? (
						<Button
							type="button"
							variant="ghost"
							size="xs"
							aria-label={restoreLabel}
							disabled={disabled}
							onClick={onRestore}
						>
							<ArrowCounterClockwiseIcon
								data-icon="inline-start"
								aria-hidden="true"
							/>
							Revert
						</Button>
					) : null}
					<Button
						type="button"
						variant="ghost"
						size="xs"
						aria-label={`${editing ? "Finish editing" : "Edit"} ${label}`}
						disabled={disabled}
						onClick={onEdit}
					>
						<PencilSimpleIcon data-icon="inline-start" aria-hidden="true" />
						{editing ? "Done" : "Edit"}
					</Button>
				</div>
			</div>
			{editing ? (
				<div className="border-border border-t bg-muted/20 p-4 sm:px-5">
					{children}
				</div>
			) : null}
		</div>
	);
}

function ReviewSelect({
	items,
	label,
	value,
	onChange,
}: {
	items: Array<{ id: string; name: string }>;
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="grid gap-2 text-sm">
			<span className="font-semibold">{label}</span>
			<Select
				items={items.map(({ id, name }) => ({ label: name, value: id }))}
				value={value}
				onValueChange={(next) => next && onChange(next)}
			>
				<SelectTrigger className="w-full" aria-label={label}>
					<SelectValue
						placeholder={`Select ${label.toLocaleLowerCase("en-US")}`}
					/>
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{items.map((item) => (
							<SelectItem key={item.id} value={item.id}>
								{item.name}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}

function CoordinateInput({
	axis,
	value,
	onChange,
}: {
	axis: "X" | "Y";
	value: number;
	onChange: (value: number) => void;
}) {
	const id = `review-coordinate-${axis.toLocaleLowerCase("en-US")}`;
	return (
		<label htmlFor={id} className="grid gap-2 text-sm">
			<span className="font-semibold">{axis} coordinate</span>
			<Input
				id={id}
				type="number"
				min={0}
				max={10_000}
				step={1}
				value={value}
				onChange={(event) => {
					if (!Number.isNaN(event.target.valueAsNumber))
						onChange(event.target.valueAsNumber);
				}}
			/>
		</label>
	);
}

function createReviewMarkers(
	data: EditorData,
	draft: ContributionLocationReviewDraft,
	location: ReviewedContributionLocation,
	original: ContributionLocationReviewDraft,
	positionChanged: boolean,
) {
	const requiredKeyCounts = new Map<string, number>();
	for (const { locationId } of data.locationRequiredKeys) {
		requiredKeyCounts.set(
			locationId,
			(requiredKeyCounts.get(locationId) ?? 0) + 1,
		);
	}
	const markers: MapWorkspaceMarker[] = data.locations
		.filter(({ mapImageId }) => mapImageId === draft.values.mapImageId)
		.map((existing) => ({
			...existing,
			appearance: "reference" as const,
			clusterable: false,
			id: `existing:${existing.id}`,
			label: "",
			requiredKeyCount: requiredKeyCounts.get(existing.id) ?? 0,
			selectable: false,
		}));
	if (
		positionChanged &&
		original.values.mapImageId === draft.values.mapImageId
	) {
		markers.push({
			accessibleLabel: `ZIP original position for ${location.name}: ${original.values.xBasisPoints}, ${original.values.yBasisPoints}`,
			appearance: "reference" as const,
			clusterable: false,
			id: `original:${location.id}`,
			isActive: true,
			label: "−",
			name: `${location.name} — ZIP original`,
			requiredKeyCount: original.values.requiredKeyIds.length,
			selectable: false,
			xBasisPoints: original.values.xBasisPoints,
			yBasisPoints: original.values.yBasisPoints,
		});
	}
	markers.push({
		accessibleLabel: `Proposed position for ${draft.values.name || location.name}: ${draft.values.xBasisPoints}, ${draft.values.yBasisPoints}`,
		clusterable: false,
		id: `review:${location.id}`,
		isActive: true,
		label: "+",
		name: draft.values.name || location.name,
		requiredKeyCount: draft.values.requiredKeyIds.length,
		xBasisPoints: draft.values.xBasisPoints,
		yBasisPoints: draft.values.yBasisPoints,
	});
	return markers;
}

function getKeyNames(ids: string[], data: EditorData) {
	return ids.map((id) => data.keys.find((key) => key.id === id)?.name ?? id);
}

function formatList(values: string[]) {
	return values.length > 0 ? values.join(", ") : "None";
}

function moveItem<T>(items: T[], index: number, offset: -1 | 1) {
	const nextIndex = index + offset;
	if (nextIndex < 0 || nextIndex >= items.length) return items;
	const next = [...items];
	const [item] = next.splice(index, 1);
	if (item === undefined) return items;
	next.splice(nextIndex, 0, item);
	return next;
}

function readErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "Could not verify this screenshot";
}
