import {
	ArrowLeftIcon,
	CrosshairIcon,
	NewspaperClippingIcon,
	PlusIcon,
} from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LocalUpdatesEditor } from "@/components/editor/local-updates-editor";
import {
	LocationScreenshotEditor,
	type ScreenshotDraft,
} from "@/components/editor/location-screenshot-editor";
import { MapCanvas } from "@/components/editor/map-canvas";
import { MapSidebarPanel } from "@/components/map/map-sidebar-panel";
import { PublicShell } from "@/components/public-shell";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import {
	deleteLocation,
	type getEditorData,
	saveLocation,
} from "@/functions/editor";
import {
	encodeMapDocumentFilters,
	resolveMapDocumentIds,
} from "@/lib/catalog-search";
import { getDocumentShortName } from "@/lib/document-display";
import {
	MAX_SCREENSHOT_BYTES,
	MAX_SCREENSHOTS_PER_LOCATION,
} from "@/lib/editor-validation";
import { numberMapLocations } from "@/lib/map-location-order";
import type { PublicUpdate } from "@/lib/publication-updates";
import type { ReleaseContext } from "@/lib/release-context";

type EditorData = Awaited<ReturnType<typeof getEditorData>>;
type EditorSearch = {
	documents?: string;
	map?: string;
	image?: string;
	location?: string;
	section?: "updates";
};
type EditorLocation = EditorData["locations"][number];
type EditorScreenshot = EditorData["screenshots"][number];
type MapImage = EditorData["mapImages"][number];
type SavedLocationTarget = {
	id: string;
	mapId: string;
	mapImageId: string;
};
type Draft = {
	name: string;
	description: string;
	mapImageId: string;
	xBasisPoints: number;
	yBasisPoints: number;
	isActive: boolean;
	documentId: string;
	requiredKeyIds: string[];
};

type LocalMapEditorProps = {
	data: EditorData;
	releaseContext: ReleaseContext;
	updates: PublicUpdate[];
	search: EditorSearch;
	onSearchChange: (
		next: EditorSearch,
		replace?: boolean,
	) => void | Promise<void>;
};

export function LocalMapEditor({
	data,
	releaseContext,
	updates,
	search,
	onSearchChange,
}: LocalMapEditorProps) {
	const router = useRouter();
	const selectedMap =
		data.maps.find((map) => map.id === search.map) ?? data.maps[0];
	const images = data.mapImages.filter(
		(image) => image.mapId === selectedMap?.id,
	);
	const selectedImage =
		images.find((image) => image.id === search.image) ??
		images.find((image) => image.viewKey === "main") ??
		images[0];
	const imageLocations = numberMapLocations(
		data.locations.filter(
			(location) => location.mapImageId === selectedImage?.id,
		),
	);
	const assignedDocumentIds = new Set(
		data.documentMaps
			.filter((assignment) => assignment.mapId === selectedMap?.id)
			.map((assignment) => assignment.documentId),
	);
	const mapDocuments = data.documents.filter((document) =>
		assignedDocumentIds.has(document.id),
	);
	const mapDocumentIds = mapDocuments.map((document) => document.id);
	const selectedDocumentIds = resolveMapDocumentIds(
		search.documents,
		mapDocumentIds,
	);
	const selectedDocumentIdSet = new Set(selectedDocumentIds);
	const locationDocumentIds = new Map(
		data.locationDocuments.map((item) => [item.locationId, item.documentId]),
	);
	const visibleLocations = imageLocations.filter((location) => {
		const documentId = locationDocumentIds.get(location.id);

		return (
			selectedDocumentIdSet.size === 0 ||
			(documentId !== undefined && selectedDocumentIdSet.has(documentId))
		);
	});
	const selectedLocation = visibleLocations.find(
		(location) => location.id === search.location,
	);
	const [newDraftVersion, setNewDraftVersion] = useState(0);

	const selectMap = (mapId: string | null) => {
		if (!mapId) {
			return;
		}

		const mapImages = data.mapImages.filter((image) => image.mapId === mapId);
		const firstImage =
			mapImages.find((image) => image.viewKey === "main") ?? mapImages[0];
		void onSearchChange(
			{
				map: mapId,
				image: firstImage?.id,
				documents: undefined,
				location: undefined,
				section: undefined,
			},
			true,
		);
	};

	const selectImage = (imageId: string | null) => {
		if (imageId) {
			void onSearchChange({ image: imageId, location: undefined }, true);
		}
	};

	const beginNewLocation = () => {
		setNewDraftVersion((version) => version + 1);
		void onSearchChange({ location: undefined }, true);
	};

	const refreshAndSelect = async (target?: SavedLocationTarget) => {
		await onSearchChange(
			{
				...(target ? { map: target.mapId, image: target.mapImageId } : {}),
				location: target?.id,
			},
			true,
		);
		await router.invalidate({ sync: true });
	};
	const documentSearch = encodeMapDocumentFilters(
		selectedDocumentIds,
		mapDocumentIds,
	);
	const sidebarDocuments = mapDocuments.map((document) => ({
		count: imageLocations.filter(
			(location) => locationDocumentIds.get(location.id) === document.id,
		).length,
		id: document.id,
		imageHeight: document.imageHeight,
		imagePath: document.imagePath,
		imageWidth: document.imageWidth,
		name: getDocumentShortName(document),
	}));
	const sidebarLocations = visibleLocations.map((location) => {
		const documentId = locationDocumentIds.get(location.id);
		const document = data.documents.find((item) => item.id === documentId);

		return {
			documentId: documentId ?? "",
			documentName: document?.name ?? "Unassigned document",
			id: location.id,
			markerLabel: location.markerLabel,
			name: location.name,
		};
	});
	const editorCatalog = {
		maps: data.maps,
		documents: data.documents.map((document) => ({
			...document,
			isFilterable: true,
		})),
		documentMaps: data.documentMaps,
		editorAvailable: false,
	};
	return (
		<PublicShell
			catalog={editorCatalog}
			currentMapId={selectedMap?.id}
			headerTitle={
				search.section === "updates" ? "Updates editor" : "Location editor"
			}
			headerMeta="Local only"
			onMapNavigate={selectMap}
			onHomeNavigate={() =>
				void router.navigate({
					to: "/",
					search: {},
				})
			}
			sidebarFooter={
				<EditorSidebarFooter
					documentSearch={documentSearch}
					isUpdatesSelected={search.section === "updates"}
					selectedLocationId={selectedLocation?.id}
					selectedMap={selectedMap}
					selectedViewKey={selectedImage?.viewKey}
					onUpdatesSelect={() =>
						void onSearchChange(
							{ location: undefined, section: "updates" },
							true,
						)
					}
				/>
			}
			sidebarPanel={
				search.section === "updates"
					? undefined
					: (closePanel) => (
							<EditorMapSidebarPanel
								canCreateLocation={Boolean(selectedImage)}
								documents={sidebarDocuments}
								locations={sidebarLocations}
								maps={data.maps}
								mapViews={images.map((image) => ({
									id: image.id,
									name: image.name,
								}))}
								selectedLocationId={selectedLocation?.id}
								selectedDocumentIds={selectedDocumentIds}
								selectedMapId={selectedMap?.id ?? ""}
								selectedMapViewId={selectedImage?.id}
								onBack={closePanel}
								onCreateLocation={beginNewLocation}
								onLocationSelect={(locationId) =>
									void onSearchChange({ location: locationId }, true)
								}
								onMapChange={selectMap}
								onMapViewChange={selectImage}
								onSelectedDocumentsChange={(documentIds) =>
									void onSearchChange(
										{
											documents: encodeMapDocumentFilters(
												documentIds,
												mapDocumentIds,
											),
											location: undefined,
										},
										true,
									)
								}
							/>
						)
			}
		>
			{search.section === "updates" ? (
				<LocalUpdatesEditor
					releaseContext={releaseContext}
					updates={updates}
					onRefresh={async () => {
						await router.invalidate({ sync: true });
					}}
				/>
			) : (
				<div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_26rem] lg:overflow-hidden">
					{selectedMap && selectedImage ? (
						<LocationWorkspace
							key={selectedImage.id}
							data={data}
							draftVersion={newDraftVersion}
							image={selectedImage}
							locations={visibleLocations}
							selectedLocation={selectedLocation}
							onSelectLocation={(locationId) =>
								void onSearchChange({ location: locationId }, true)
							}
							onSaved={refreshAndSelect}
						/>
					) : (
						<Empty className="min-h-[50svh] lg:col-span-2">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<CrosshairIcon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>No map image</EmptyTitle>
								<EmptyDescription>
									Add a current image record before creating locations for this
									map.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</div>
			)}
		</PublicShell>
	);
}

type EditorSidebarFooterProps = {
	documentSearch?: string;
	isUpdatesSelected: boolean;
	selectedLocationId?: string;
	selectedMap?: EditorData["maps"][number];
	selectedViewKey?: string;
	onUpdatesSelect: () => void;
};

function EditorSidebarFooter({
	documentSearch,
	isUpdatesSelected,
	selectedLocationId,
	selectedMap,
	selectedViewKey,
	onUpdatesSelect,
}: EditorSidebarFooterProps) {
	const { isMobile, setOpenMobile } = useSidebar();

	function closeMobileSidebar() {
		if (isMobile) setOpenMobile(false);
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					render={
						<button
							type="button"
							onClick={() => {
								closeMobileSidebar();
								onUpdatesSelect();
							}}
						/>
					}
					isActive={isUpdatesSelected}
				>
					<NewspaperClippingIcon aria-hidden="true" />
					<span>Manage updates</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
			<SidebarMenuItem>
				<SidebarMenuButton
					render={
						selectedMap?.isActive ? (
							<Link
								to="/maps/$mapId"
								params={{ mapId: selectedMap.id }}
								search={{
									documents: documentSearch,
									location: selectedLocationId,
									view: selectedViewKey,
								}}
								onClick={closeMobileSidebar}
							/>
						) : (
							<Link
								to="/"
								search={{ documents: documentSearch }}
								onClick={closeMobileSidebar}
							/>
						)
					}
				>
					<ArrowLeftIcon aria-hidden="true" />
					<span>Exit editor</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

type EditorMapSidebarPanelProps = Omit<
	React.ComponentProps<typeof MapSidebarPanel>,
	"action"
> & {
	canCreateLocation: boolean;
	onCreateLocation: () => void;
};

function EditorMapSidebarPanel({
	canCreateLocation,
	onCreateLocation,
	...props
}: EditorMapSidebarPanelProps) {
	const { isMobile, setOpenMobile } = useSidebar();

	function runNavigation(action: () => void) {
		action();

		if (isMobile) {
			setOpenMobile(false);
		}
	}

	return (
		<MapSidebarPanel
			{...props}
			action={
				<Button
					type="button"
					size="sm"
					onClick={() => runNavigation(onCreateLocation)}
					disabled={!canCreateLocation}
				>
					<PlusIcon data-icon="inline-start" />
					New
				</Button>
			}
			onBack={props.onBack}
			onLocationSelect={(locationId) =>
				runNavigation(() => props.onLocationSelect(locationId))
			}
			onMapChange={(mapId) => runNavigation(() => props.onMapChange(mapId))}
			onMapViewChange={(mapViewId) =>
				runNavigation(() => props.onMapViewChange(mapViewId))
			}
		/>
	);
}

type LocationWorkspaceProps = {
	data: EditorData;
	draftVersion: number;
	image: MapImage;
	locations: EditorLocation[];
	selectedLocation?: EditorLocation;
	onSelectLocation: (locationId: string) => void;
	onSaved: (target?: SavedLocationTarget) => Promise<void>;
};

function LocationWorkspace({
	data,
	draftVersion,
	image,
	locations,
	selectedLocation,
	onSelectLocation,
	onSaved,
}: LocationWorkspaceProps) {
	const selectedDocumentId = selectedLocation
		? (data.locationDocuments.find(
				(item) => item.locationId === selectedLocation.id,
			)?.documentId ?? "")
		: "";
	const selectedRequiredKeyIds = useMemo(
		() =>
			selectedLocation
				? data.locationRequiredKeys
						.filter((item) => item.locationId === selectedLocation.id)
						.map((item) => item.keyId)
						.sort()
				: [],
		[data.locationRequiredKeys, selectedLocation],
	);
	const [draft, setDraft] = useState<Draft>(() =>
		createLocationDraft(
			selectedLocation,
			selectedDocumentId,
			selectedRequiredKeyIds,
			image.id,
		),
	);
	const [screenshotDrafts, setScreenshotDrafts] = useState<ScreenshotDraft[]>(
		() => createScreenshotDrafts(data.screenshots, selectedLocation?.id),
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string>();
	const resetState = {
		draftVersion,
		imageId: image.id,
		screenshots: data.screenshots,
		selectedDocumentId,
		selectedLocation,
		selectedRequiredKeyIds,
	};
	const [previousResetState, setPreviousResetState] = useState(resetState);
	const shouldReset =
		resetState.draftVersion !== previousResetState.draftVersion ||
		resetState.imageId !== previousResetState.imageId ||
		resetState.screenshots !== previousResetState.screenshots ||
		resetState.selectedDocumentId !== previousResetState.selectedDocumentId ||
		resetState.selectedLocation !== previousResetState.selectedLocation ||
		resetState.selectedRequiredKeyIds !==
			previousResetState.selectedRequiredKeyIds;

	if (shouldReset) {
		setPreviousResetState(resetState);
		setDraft(
			createLocationDraft(
				selectedLocation,
				selectedDocumentId,
				selectedRequiredKeyIds,
				image.id,
			),
		);
		setScreenshotDrafts(
			createScreenshotDrafts(data.screenshots, selectedLocation?.id),
		);
		setError(undefined);
	}

	const draftImage =
		data.mapImages.find((item) => item.id === draft.mapImageId) ?? image;
	const draftMapImages = data.mapImages.filter(
		(item) => item.mapId === draftImage.mapId,
	);
	const editableMaps = data.maps.filter((map) =>
		data.mapImages.some((item) => item.mapId === map.id),
	);
	const allowedDocumentIds = new Set(
		data.documentMaps
			.filter((item) => item.mapId === draftImage.mapId)
			.map((item) => item.documentId),
	);
	const availableDocuments = data.documents.filter((document) =>
		allowedDocumentIds.has(document.id),
	);
	const availableKeyIds = new Set(
		data.keyMaps
			.filter((item) => item.mapId === draftImage.mapId)
			.map((item) => item.keyId),
	);
	const availableKeys = data.keys.filter((key) => availableKeyIds.has(key.id));
	const canvasLocations =
		draftImage.id === image.id
			? locations
			: selectedLocation
				? [selectedLocation]
				: [];

	const updateDraft = <Key extends keyof Draft>(
		key: Key,
		value: Draft[Key],
	) => {
		setDraft((current) => ({ ...current, [key]: value }));
	};

	const updateDraftMap = (nextMapId: string) => {
		const nextImages = data.mapImages.filter(
			(item) => item.mapId === nextMapId,
		);
		const nextImage =
			nextImages.find((item) => item.viewKey === "main") ?? nextImages[0];

		if (!nextImage) return;

		const nextDocumentIds = new Set(
			data.documentMaps
				.filter((item) => item.mapId === nextMapId)
				.map((item) => item.documentId),
		);
		const firstDocument = data.documents.find((document) =>
			nextDocumentIds.has(document.id),
		);

		setDraft((current) => ({
			...current,
			mapImageId: nextImage.id,
			documentId: nextDocumentIds.has(current.documentId)
				? current.documentId
				: (firstDocument?.id ?? ""),
			requiredKeyIds: current.requiredKeyIds.filter((keyId) =>
				data.keyMaps.some(
					(item) => item.keyId === keyId && item.mapId === nextMapId,
				),
			),
		}));
	};

	const addScreenshotFiles = (files: File[]) => {
		setError(undefined);

		if (screenshotDrafts.length + files.length > MAX_SCREENSHOTS_PER_LOCATION) {
			setError(
				`A location can contain at most ${MAX_SCREENSHOTS_PER_LOCATION} screenshots`,
			);
			return;
		}

		if (files.some((file) => !isAcceptedScreenshotFile(file))) {
			setError("Screenshots must be JPEG, PNG, or WebP files under 20 MiB");
			return;
		}

		const additions = files.map(
			(file) =>
				({
					altText: "",
					caption: "",
					file,
					key: crypto.randomUUID(),
				}) satisfies ScreenshotDraft,
		);

		setScreenshotDrafts((current) => [...current, ...additions]);
	};

	const updateScreenshotDraft = (
		key: string,
		field: "altText" | "caption",
		value: string,
	) => {
		setScreenshotDrafts((current) =>
			current.map((screenshot) =>
				screenshot.key === key ? { ...screenshot, [field]: value } : screenshot,
			),
		);
	};

	const moveScreenshotDraft = (index: number, offset: -1 | 1) => {
		setScreenshotDrafts((current) => {
			const nextIndex = index + offset;

			if (nextIndex < 0 || nextIndex >= current.length) {
				return current;
			}

			const next = [...current];
			const [moved] = next.splice(index, 1);

			if (!moved) {
				return current;
			}

			next.splice(nextIndex, 0, moved);
			return next;
		});
	};

	const removeScreenshotDraft = (key: string) => {
		setScreenshotDrafts((current) =>
			current.filter((screenshot) => screenshot.key !== key),
		);
	};

	const submitLocation = async () => {
		setError(undefined);

		if (screenshotDrafts.length === 0) {
			setError("Add at least one screenshot before saving this location");
			return;
		}

		setIsSaving(true);

		try {
			const files: File[] = [];
			const screenshotPayload = screenshotDrafts.map((screenshot) => {
				const base = {
					altText: screenshot.altText,
					caption: screenshot.caption,
				};

				if (screenshot.id) {
					return { ...base, id: screenshot.id };
				}

				if (!screenshot.file) {
					throw new Error("A new screenshot file is unavailable");
				}

				const uploadIndex = files.push(screenshot.file) - 1;
				return { ...base, uploadIndex };
			});
			const formData = new FormData();

			formData.set(
				"payload",
				JSON.stringify({
					location: {
						id: selectedLocation?.id,
						mapImageId: draft.mapImageId,
						name: draft.name,
						description: draft.description,
						xBasisPoints: draft.xBasisPoints,
						yBasisPoints: draft.yBasisPoints,
						isActive: draft.isActive,
						documentId: draft.documentId,
						requiredKeyIds: draft.requiredKeyIds,
					},
					screenshots: screenshotPayload,
				}),
			);

			for (const file of files) {
				formData.append("screenshots", file);
			}

			const result = await saveLocation({
				data: formData,
			});

			await onSaved(result);
		} catch (caughtError) {
			setError(readErrorMessage(caughtError));
		} finally {
			setIsSaving(false);
		}
	};

	const removeLocation = async () => {
		if (!selectedLocation) {
			return;
		}

		setError(undefined);
		setIsDeleting(true);

		try {
			await deleteLocation({ data: { id: selectedLocation.id } });
			await onSaved(undefined);
		} catch (caughtError) {
			setError(readErrorMessage(caughtError));
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<MapCanvas
				key={draftImage.id}
				image={draftImage}
				locations={canvasLocations}
				selectedLocationId={selectedLocation?.id}
				draftMarker={{
					name: draft.name,
					xBasisPoints: draft.xBasisPoints,
					yBasisPoints: draft.yBasisPoints,
					isActive: draft.isActive,
				}}
				onPositionChange={(position) =>
					setDraft((current) => ({ ...current, ...position }))
				}
				onSelectLocation={onSelectLocation}
			/>

			<aside className="min-h-0 overflow-auto bg-card p-5">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void submitLocation();
					}}
					onKeyDown={(event) => {
						if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
							event.currentTarget.requestSubmit();
						}
					}}
					className="flex flex-col gap-6"
				>
					<div>
						<p className="font-heading text-muted-foreground text-sm uppercase tracking-wide">
							{selectedLocation ? "Edit location" : "New location"}
						</p>
						<h2 className="mt-1 text-balance font-heading font-medium text-2xl tracking-tight">
							{draft.name || "Untitled marker"}
						</h2>
					</div>

					<FieldGroup>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="location-map">Map</FieldLabel>
								<Select
									items={editableMaps.map((map) => ({
										value: map.id,
										label: map.name,
									}))}
									value={draftImage.mapId}
									onValueChange={(nextMapId) => {
										if (nextMapId) updateDraftMap(nextMapId);
									}}
								>
									<SelectTrigger id="location-map" className="w-full">
										<SelectValue placeholder="Select a map" />
									</SelectTrigger>
									<SelectContent alignItemWithTrigger={false}>
										<SelectGroup>
											{editableMaps.map((map) => (
												<SelectItem key={map.id} value={map.id}>
													{map.name}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</Field>

							{draftMapImages.length > 1 ? (
								<Field>
									<FieldLabel htmlFor="location-map-view">Map view</FieldLabel>
									<Select
										items={draftMapImages.map((item) => ({
											value: item.id,
											label: item.name,
										}))}
										value={draft.mapImageId}
										onValueChange={(nextImageId) => {
											if (nextImageId) updateDraft("mapImageId", nextImageId);
										}}
									>
										<SelectTrigger id="location-map-view" className="w-full">
											<SelectValue placeholder="Select a map view" />
										</SelectTrigger>
										<SelectContent alignItemWithTrigger={false}>
											<SelectGroup>
												{draftMapImages.map((item) => (
													<SelectItem key={item.id} value={item.id}>
														{item.name}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</Field>
							) : null}
						</div>
						<Field>
							<FieldLabel htmlFor="location-name">Name</FieldLabel>
							<Input
								id="location-name"
								value={draft.name}
								onChange={(event) => updateDraft("name", event.target.value)}
								maxLength={120}
								autoComplete="off"
								spellCheck="false"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="location-description">
								Description
							</FieldLabel>
							<Textarea
								id="location-description"
								value={draft.description}
								onChange={(event) =>
									updateDraft("description", event.target.value)
								}
								maxLength={2_000}
								rows={4}
								placeholder="Landmarks, floor, container, or route notes"
							/>
							<FieldDescription>
								Use Ctrl+Enter to save from this field.
							</FieldDescription>
						</Field>

						<div className="grid grid-cols-2 gap-4">
							<Field>
								<FieldLabel htmlFor="location-x">X</FieldLabel>
								<Input
									id="location-x"
									type="number"
									min={0}
									max={10_000}
									step={1}
									value={draft.xBasisPoints}
									onChange={(event) => {
										if (!Number.isNaN(event.target.valueAsNumber)) {
											updateDraft("xBasisPoints", event.target.valueAsNumber);
										}
									}}
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="location-y">Y</FieldLabel>
								<Input
									id="location-y"
									type="number"
									min={0}
									max={10_000}
									step={1}
									value={draft.yBasisPoints}
									onChange={(event) => {
										if (!Number.isNaN(event.target.valueAsNumber)) {
											updateDraft("yBasisPoints", event.target.valueAsNumber);
										}
									}}
									required
								/>
							</Field>
						</div>
						<FieldDescription>
							Coordinates use basis points from 0 to 10000.
						</FieldDescription>

						<FieldSet>
							<FieldLegend variant="label">Document</FieldLegend>
							<FieldDescription>
								Each location represents one document and keeps its own
								description and screenshots.
							</FieldDescription>
							{availableDocuments.length > 0 ? (
								<RadioGroup
									name="documentId"
									value={draft.documentId}
									onValueChange={(documentId) =>
										updateDraft("documentId", documentId)
									}
									required
								>
									{availableDocuments.map((document) => (
										<Field key={document.id} orientation="horizontal">
											<RadioGroupItem
												id={`document-${document.id}`}
												value={document.id}
											/>
											<FieldLabel
												htmlFor={`document-${document.id}`}
												className="cursor-pointer normal-case tracking-normal"
											>
												{document.name}
											</FieldLabel>
										</Field>
									))}
								</RadioGroup>
							) : (
								<FieldDescription>
									No farmable documents are assigned to this map.
								</FieldDescription>
							)}
						</FieldSet>

						<FieldSet>
							<FieldLegend variant="label">Required keys</FieldLegend>
							<FieldDescription>
								Select every key needed to access this location. Leave empty
								when no key is required.
							</FieldDescription>
							{availableKeys.length > 0 ? (
								<div className="grid max-h-72 gap-1 overflow-auto border p-2">
									{availableKeys.map((key) => {
										const checked = draft.requiredKeyIds.includes(key.id);
										return (
											<Field
												key={key.id}
												orientation="horizontal"
												className="p-2"
											>
												<Checkbox
													id={`required-key-${key.id}`}
													checked={checked}
													onCheckedChange={(nextChecked) =>
														updateDraft(
															"requiredKeyIds",
															nextChecked
																? [...draft.requiredKeyIds, key.id]
																: draft.requiredKeyIds.filter(
																		(id) => id !== key.id,
																	),
														)
													}
												/>
												<img
													src={key.imagePath}
													alt=""
													width={key.imageWidth}
													height={key.imageHeight}
													loading="lazy"
													decoding="async"
													className="size-8 object-contain"
												/>
												<FieldLabel
													htmlFor={`required-key-${key.id}`}
													className="cursor-pointer normal-case tracking-normal"
												>
													{key.name}
												</FieldLabel>
											</Field>
										);
									})}
								</div>
							) : (
								<FieldDescription>
									No keys are cataloged for this map.
								</FieldDescription>
							)}
						</FieldSet>

						<LocationScreenshotEditor
							disabled={isSaving || isDeleting}
							screenshots={screenshotDrafts}
							onFilesAdded={addScreenshotFiles}
							onMove={moveScreenshotDraft}
							onRemove={removeScreenshotDraft}
							onUpdate={updateScreenshotDraft}
						/>

						<Field orientation="horizontal">
							<Checkbox
								id="location-active"
								checked={draft.isActive}
								onCheckedChange={(checked) => updateDraft("isActive", checked)}
							/>
							<FieldLabel
								htmlFor="location-active"
								className="cursor-pointer normal-case tracking-normal"
							>
								Active location
							</FieldLabel>
						</Field>

						{error && <FieldError>{error}</FieldError>}
					</FieldGroup>

					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" disabled={isSaving || isDeleting}>
							{isSaving ? "Processing…" : "Save location"}
						</Button>

						{selectedLocation && (
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
										<AlertDialogTitle>Delete this location?</AlertDialogTitle>
										<AlertDialogDescription>
											This permanently removes the marker, screenshots, and its
											document link.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction onClick={() => void removeLocation()}>
											{isDeleting ? "Deleting…" : "Delete location"}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>
				</form>
			</aside>
		</>
	);
}

function readErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "The editor request failed";
}

function createLocationDraft(
	location: EditorLocation | undefined,
	documentId: string,
	requiredKeyIds: string[],
	defaultMapImageId: string,
): Draft {
	return {
		name: location?.name ?? "",
		description: location?.description ?? "",
		mapImageId: location?.mapImageId ?? defaultMapImageId,
		xBasisPoints: location?.xBasisPoints ?? 5_000,
		yBasisPoints: location?.yBasisPoints ?? 5_000,
		isActive: location?.isActive ?? true,
		documentId,
		requiredKeyIds,
	};
}

function createScreenshotDrafts(
	screenshots: EditorScreenshot[],
	locationId: string | undefined,
): ScreenshotDraft[] {
	if (!locationId) {
		return [];
	}

	return screenshots
		.filter((screenshot) => screenshot.locationId === locationId)
		.map((screenshot) => ({
			altText: screenshot.altText,
			caption: screenshot.caption ?? "",
			height: screenshot.previewHeight,
			id: screenshot.id,
			key: screenshot.id,
			previewUrl: screenshot.previewPath,
			width: screenshot.previewWidth,
		}));
}

function isAcceptedScreenshotFile(file: File) {
	return (
		file.size > 0 &&
		file.size <= MAX_SCREENSHOT_BYTES &&
		["image/jpeg", "image/png", "image/webp"].includes(file.type)
	);
}
