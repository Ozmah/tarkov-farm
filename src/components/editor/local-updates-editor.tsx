import { CopyIcon, PlusIcon } from "@phosphor-icons/react";
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
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteUpdate, saveUpdate } from "@/functions/updates";
import {
	datetimeLocalToInstantString,
	formatInstantDate,
	instantStringToDatetimeLocal,
	nowDatetimeLocal,
} from "@/lib/date";
import { getDocumentShortName } from "@/lib/document-display";
import type { PublicUpdate } from "@/lib/publication-updates";
import type {
	ReleaseContext,
	ReleaseContextLocation,
} from "@/lib/release-context";
import { cn } from "@/lib/utils";

type UpdateDraft = {
	description: string;
	id?: string;
	publishedAt: string;
	title: string;
};

type LocalUpdatesEditorProps = {
	releaseContext: ReleaseContext;
	updates: PublicUpdate[];
	onRefresh: (selectedId?: string) => Promise<void>;
};

export function LocalUpdatesEditor({
	releaseContext,
	updates,
	onRefresh,
}: LocalUpdatesEditorProps) {
	const [draft, setDraft] = useState<UpdateDraft>();
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string>();

	function selectUpdate(update: PublicUpdate) {
		setError(undefined);
		setDraft({
			...update,
			publishedAt: instantStringToDatetimeLocal(update.publishedAt),
		});
	}

	function beginUpdate() {
		setError(undefined);
		setDraft({
			description: "",
			publishedAt: nowDatetimeLocal(),
			title: "",
		});
	}

	async function submitUpdate() {
		if (!draft) return;

		setError(undefined);
		setIsSaving(true);

		try {
			const result = await saveUpdate({
				data: {
					description: draft.description,
					id: draft.id,
					publishedAt: datetimeLocalToInstantString(draft.publishedAt),
					title: draft.title,
				},
			});

			await onRefresh(result.id);
			setDraft((current) =>
				current ? { ...current, id: result.id } : current,
			);
		} catch (caughtError) {
			setError(readErrorMessage(caughtError));
		} finally {
			setIsSaving(false);
		}
	}

	async function removeUpdate() {
		if (!draft?.id) return;

		setError(undefined);
		setIsDeleting(true);

		try {
			await deleteUpdate({ data: { id: draft.id } });
			setDraft(undefined);
			await onRefresh(undefined);
		} catch (caughtError) {
			setError(readErrorMessage(caughtError));
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<div className="@container min-h-0 flex-1 overflow-auto">
			<div className="mx-auto grid w-full max-w-6xl @4xl:grid-cols-[20rem_minmax(0,1fr)] gap-8 p-6 sm:p-10">
				<ReleaseContextPanel
					className="@4xl:col-span-2"
					context={releaseContext}
				/>

				<section aria-labelledby="editor-updates-title" className="min-w-0">
					<div className="flex items-center justify-between gap-4">
						<div className="min-w-0">
							<h1
								id="editor-updates-title"
								className="text-balance font-heading font-medium text-2xl tracking-tight"
							>
								Updates
							</h1>
							<p className="text-pretty text-base text-muted-foreground sm:text-sm">
								Published with the next deployment.
							</p>
						</div>
						<Button type="button" size="sm" onClick={beginUpdate}>
							<PlusIcon data-icon="inline-start" aria-hidden="true" />
							New
						</Button>
					</div>

					{updates.length > 0 ? (
						<ul className="mt-5 divide-y divide-border border-border border-y">
							{updates.map((update) => (
								<li key={update.id}>
									<button
										type="button"
										onClick={() => selectUpdate(update)}
										className={cn(
											"flex min-h-16 w-full flex-col items-start justify-center gap-1 px-3 py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:-ring-offset-2",
											draft?.id === update.id && "bg-muted",
										)}
									>
										<p className="w-full truncate font-heading font-medium">
											{update.title}
										</p>
										<time
											dateTime={update.publishedAt}
											className="text-base text-muted-foreground tabular-nums sm:text-sm"
										>
											{formatUpdateDate(update.publishedAt)}
										</time>
									</button>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-5 text-pretty text-base text-muted-foreground sm:text-sm">
							No updates have been published yet.
						</p>
					)}
				</section>

				<section aria-label="Update form" className="min-w-0">
					{draft ? (
						<form
							className="border border-border bg-card p-5 sm:p-6"
							onSubmit={(event) => {
								event.preventDefault();
								void submitUpdate();
							}}
							onKeyDown={(event) => {
								if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
									event.currentTarget.requestSubmit();
								}
							}}
						>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="update-title">Title</FieldLabel>
									<Input
										id="update-title"
										name="title"
										value={draft.title}
										onChange={(event) =>
											setDraft((current) =>
												current
													? { ...current, title: event.target.value }
													: current,
											)
										}
										maxLength={120}
										autoComplete="off"
										spellCheck="false"
										required
									/>
								</Field>

								<Field>
									<FieldLabel htmlFor="update-published-at">
										Publication date and time
									</FieldLabel>
									<Input
										id="update-published-at"
										name="publishedAt"
										type="datetime-local"
										value={draft.publishedAt}
										onChange={(event) =>
											setDraft((current) =>
												current
													? { ...current, publishedAt: event.target.value }
													: current,
											)
										}
										required
										disabled={Boolean(draft.id)}
									/>
									<FieldDescription>
										{draft.id
											? "Publication dates are immutable after saving."
											: "Shown in Mexico City time and stored as UTC. New updates must be later than the latest update."}
									</FieldDescription>
								</Field>

								<Field>
									<FieldLabel htmlFor="update-description">
										Description
									</FieldLabel>
									<Textarea
										id="update-description"
										name="description"
										value={draft.description}
										onChange={(event) =>
											setDraft((current) =>
												current
													? { ...current, description: event.target.value }
													: current,
											)
										}
										maxLength={2_000}
										rows={8}
										required
									/>
									<FieldDescription>
										Use Ctrl+Enter to save from this field.
									</FieldDescription>
								</Field>

								{error ? <FieldError>{error}</FieldError> : null}
							</FieldGroup>

							<div className="mt-6 flex flex-wrap items-center gap-3">
								<Button type="submit" disabled={isSaving || isDeleting}>
									{isSaving ? "Saving…" : "Save update"}
								</Button>

								{draft.id ? (
									<AlertDialog>
										<AlertDialogTrigger
											render={
												<Button
													type="button"
													variant="ghost"
													disabled={isSaving || isDeleting}
												/>
											}
										>
											Delete
										</AlertDialogTrigger>
										<AlertDialogContent size="sm">
											<AlertDialogHeader>
												<AlertDialogTitle>Delete this update?</AlertDialogTitle>
												<AlertDialogDescription>
													This removes it from the published update history.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction onClick={() => void removeUpdate()}>
													{isDeleting ? "Deleting…" : "Delete update"}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								) : null}
							</div>
						</form>
					) : (
						<Empty className="min-h-64 border border-border">
							<EmptyHeader>
								<EmptyTitle>Select an update</EmptyTitle>
								<EmptyDescription>
									Choose an existing update or create a new one.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</section>
			</div>
		</div>
	);
}

function ReleaseContextPanel({
	className,
	context,
}: {
	className?: string;
	context: ReleaseContext;
}) {
	const [copyStatus, setCopyStatus] = useState<"copied" | "error">();
	const changedLocations = [
		...context.locations.added.map((location) => ({
			location,
			status: "Added" as const,
		})),
		...context.locations.modified.map((location) => ({
			location,
			status: "Modified" as const,
		})),
		...context.locations.removed.map((location) => ({
			location,
			status: "Removed" as const,
		})),
	];
	const hasChanges = changedLocations.length > 0;

	async function copySummary() {
		try {
			await navigator.clipboard.writeText(createReleaseSummary(context));
			setCopyStatus("copied");
		} catch {
			setCopyStatus("error");
		}
	}

	return (
		<section
			aria-labelledby="release-context-title"
			className={cn("border border-border bg-card", className)}
		>
			<header className="flex flex-wrap items-start justify-between gap-4 border-border border-b p-5 sm:p-6">
				<div className="min-w-0">
					<h2
						id="release-context-title"
						className="text-balance font-heading font-medium text-xl"
					>
						Release context
					</h2>
					<p className="max-w-[65ch] text-pretty text-base text-muted-foreground sm:text-sm">
						{context.baselineSource === "git-head"
							? "Changes since the publication data in the latest commit."
							: "Changes since the most recent published update."}
					</p>
				</div>
				<div className="flex items-center gap-3">
					<p
						aria-live="polite"
						className="text-base text-muted-foreground sm:text-sm"
					>
						{copyStatus === "copied"
							? "Copied"
							: copyStatus === "error"
								? "Copy failed"
								: hasChanges
									? `${changedLocations.length} changed records`
									: "Up to date"}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void copySummary()}
						disabled={!hasChanges}
					>
						<CopyIcon data-icon="inline-start" aria-hidden="true" />
						Copy summary
					</Button>
				</div>
			</header>

			<div className="grid @4xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] gap-6 p-5 sm:p-6">
				<div className="min-w-0">
					<dl className="grid grid-cols-3 gap-4 border-border border-b pb-5">
						<ReleaseMetric
							label="Locations"
							value={context.currentTotals.locations}
						/>
						<ReleaseMetric
							label="Screenshots"
							value={context.currentTotals.screenshots}
						/>
						<ReleaseMetric label="Maps" value={context.currentTotals.maps} />
					</dl>

					<div className="grid @2xl:grid-cols-5 grid-cols-2 gap-4 border-border border-b py-5">
						<ReleaseDelta label="Added" value={context.deltas.locationsAdded} />
						<ReleaseDelta
							label="Modified"
							value={context.deltas.locationsModified}
						/>
						<ReleaseDelta
							label="Removed"
							value={context.deltas.locationsRemoved}
						/>
						<ReleaseDelta
							label="Screenshots +"
							value={context.deltas.screenshotsAdded}
						/>
						<ReleaseDelta
							label="Screenshots −"
							value={context.deltas.screenshotsRemoved}
						/>
					</div>

					<div className="grid @2xl:grid-cols-2 gap-5 pt-5">
						<NamedValues label="Affected maps" values={context.affectedMaps} />
						<NamedValues
							label="Affected documents"
							values={context.affectedDocuments}
							formatValue={getDocumentShortName}
						/>
					</div>
				</div>

				<div className="min-w-0">
					<h3 className="font-heading font-medium text-base">
						Changed locations
					</h3>
					{hasChanges ? (
						<ul className="mt-3 max-h-72 divide-y divide-border overflow-auto border-border border-y">
							{changedLocations.map(({ location, status }) => (
								<ChangedLocation
									key={`${status}-${location.id}`}
									location={location}
									status={status}
								/>
							))}
						</ul>
					) : (
						<p className="mt-3 text-pretty text-base text-muted-foreground sm:text-sm">
							No unpublished location changes were detected.
						</p>
					)}
				</div>
			</div>
		</section>
	);
}

function ReleaseMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="min-w-0">
			<dt className="truncate text-base text-muted-foreground sm:text-sm">
				{label}
			</dt>
			<dd className="font-heading text-2xl tabular-nums">{value}</dd>
		</div>
	);
}

function ReleaseDelta({ label, value }: { label: string; value: number }) {
	return (
		<div className="min-w-0">
			<p className="truncate text-base text-muted-foreground sm:text-sm">
				{label}
			</p>
			<p className="font-heading font-medium text-lg tabular-nums">{value}</p>
		</div>
	);
}

function NamedValues({
	formatValue = ({ name }) => name,
	label,
	values,
}: {
	formatValue?: (value: { id: string; name: string }) => string;
	label: string;
	values: Array<{ id: string; name: string }>;
}) {
	return (
		<div className="min-w-0">
			<h3 className="font-heading font-medium text-base">{label}</h3>
			<p className="mt-1 text-pretty text-base text-muted-foreground sm:text-sm">
				{values.length > 0 ? values.map(formatValue).join(", ") : "None"}
			</p>
		</div>
	);
}

function ChangedLocation({
	location,
	status,
}: {
	location: ReleaseContextLocation;
	status: "Added" | "Modified" | "Removed";
}) {
	return (
		<li className="grid gap-1 py-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-3">
			<p className="font-heading text-primary text-sm">{status}</p>
			<div className="min-w-0">
				<p className="truncate font-medium">{location.name}</p>
				<p className="truncate text-base text-muted-foreground sm:text-sm">
					{location.map.name} · {getDocumentShortName(location.document)}
				</p>
			</div>
		</li>
	);
}

function createReleaseSummary(context: ReleaseContext) {
	const sentences: string[] = [];
	const { deltas } = context;
	const locationChanges: string[] = [];

	if (deltas.locationsAdded > 0) {
		locationChanges.push(`${deltas.locationsAdded} added`);
	}
	if (deltas.locationsModified > 0) {
		locationChanges.push(`${deltas.locationsModified} updated`);
	}
	if (deltas.locationsRemoved > 0) {
		locationChanges.push(`${deltas.locationsRemoved} removed`);
	}

	if (locationChanges.length > 0) {
		sentences.push(
			`Locations: ${locationChanges.join(", ")} across ${formatEnglishList(context.affectedMaps.map(({ name }) => name))}.`,
		);
	}

	const screenshotChanges: string[] = [];
	if (deltas.screenshotsAdded > 0) {
		screenshotChanges.push(`${deltas.screenshotsAdded} added`);
	}
	if (deltas.screenshotsRemoved > 0) {
		screenshotChanges.push(`${deltas.screenshotsRemoved} removed`);
	}
	if (screenshotChanges.length > 0) {
		sentences.push(`Screenshots: ${screenshotChanges.join(", ")}.`);
	}

	if (context.affectedDocuments.length > 0) {
		sentences.push(
			`Documents: ${formatEnglishList(context.affectedDocuments.map(getDocumentShortName))}.`,
		);
	}

	return sentences.join(" ");
}

function formatEnglishList(values: string[]) {
	if (values.length === 0) return "no maps";
	if (values.length === 1) return values[0];
	if (values.length === 2) return `${values[0]} and ${values[1]}`;
	return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatUpdateDate(value: string) {
	return formatInstantDate(value, {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function readErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "The update request failed";
}
