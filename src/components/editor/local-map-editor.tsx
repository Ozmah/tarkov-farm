import {
	ArrowLeftIcon,
	CrosshairIcon,
	MapPinIcon,
	PlusIcon,
} from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { MapCanvas } from "@/components/editor/map-canvas";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
	deleteLocation,
	type getEditorData,
	saveLocation,
} from "@/functions/editor";
import { cn } from "@/lib/utils";

type EditorData = Awaited<ReturnType<typeof getEditorData>>;
type EditorSearch = {
	map?: string;
	image?: string;
	location?: string;
};
type EditorLocation = EditorData["locations"][number];
type MapImage = EditorData["mapImages"][number];
type Draft = {
	name: string;
	description: string;
	xBasisPoints: number;
	yBasisPoints: number;
	isActive: boolean;
	documentId: string;
};

type LocalMapEditorProps = {
	data: EditorData;
	search: EditorSearch;
	onSearchChange: (
		next: EditorSearch,
		replace?: boolean,
	) => void | Promise<void>;
};

export function LocalMapEditor({
	data,
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
		images.find((image) => image.id === search.image) ?? images[0];
	const imageLocations = data.locations.filter(
		(location) => location.mapImageId === selectedImage?.id,
	);
	const selectedLocation = imageLocations.find(
		(location) => location.id === search.location,
	);
	const [newDraftVersion, setNewDraftVersion] = useState(0);

	const selectMap = (mapId: string | null) => {
		if (!mapId) {
			return;
		}

		const firstImage = data.mapImages.find((image) => image.mapId === mapId);
		void onSearchChange(
			{ map: mapId, image: firstImage?.id, location: undefined },
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

	const refreshAndSelect = async (locationId?: string) => {
		await router.invalidate();
		await onSearchChange({ location: locationId }, true);
	};

	return (
		<div className="isolate flex h-svh min-h-0 flex-col overflow-hidden bg-background">
			<header className="flex h-14 shrink-0 items-center gap-3 border-border border-b bg-card px-4 sm:px-6">
				<Link
					to="/"
					aria-label="Return to the map index"
					className="flex size-11 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					<ArrowLeftIcon aria-hidden="true" />
				</Link>
				<Separator orientation="vertical" className="h-4" />
				<div className="min-w-0">
					<h1 className="truncate font-heading font-medium text-base">
						Location editor
					</h1>
				</div>
				<Badge variant="secondary" className="ml-auto">
					Local only
				</Badge>
			</header>

			<div className="grid shrink-0 grid-cols-1 gap-4 border-border border-b px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(12rem,18rem)_minmax(12rem,18rem)_1fr]">
				<Field>
					<FieldLabel htmlFor="editor-map">Map</FieldLabel>
					<Select value={selectedMap?.id ?? null} onValueChange={selectMap}>
						<SelectTrigger id="editor-map" className="w-full">
							<SelectValue placeholder="Select a map" />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectGroup>
								{data.maps.map((map) => (
									<SelectItem key={map.id} value={map.id}>
										{map.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>

				<Field>
					<FieldLabel htmlFor="editor-map-image">Map view</FieldLabel>
					<Select
						value={selectedImage?.id ?? null}
						onValueChange={selectImage}
						disabled={images.length === 0}
					>
						<SelectTrigger id="editor-map-image" className="w-full">
							<SelectValue placeholder="No image available" />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectGroup>
								{images.map((image) => (
									<SelectItem key={image.id} value={image.id}>
										{image.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>

				<div className="hidden min-w-0 items-end justify-end lg:flex">
					<p className="truncate text-muted-foreground text-sm">
						{imageLocations.length} location
						{imageLocations.length === 1 ? "" : "s"} on this view
					</p>
				</div>
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[17rem_minmax(0,1fr)_22rem] lg:overflow-hidden">
				<aside className="flex min-h-48 flex-col border-border border-b bg-card lg:min-h-0 lg:border-r lg:border-b-0">
					<div className="flex h-19 shrink-0 items-center gap-3 border-border border-b px-4">
						<div className="min-w-0 flex-1">
							<h2 className="font-heading font-medium text-sm">Locations</h2>
							<p className="text-muted-foreground text-sm">
								Select one to edit
							</p>
						</div>
						<Button
							type="button"
							size="sm"
							onClick={beginNewLocation}
							disabled={!selectedImage}
						>
							<PlusIcon data-icon="inline-start" />
							New
						</Button>
					</div>
					{imageLocations.length > 0 ? (
						<ul className="min-h-0 flex-1 overflow-auto py-2">
							{imageLocations.map((location) => (
								<li key={location.id}>
									<button
										type="button"
										aria-pressed={selectedLocation?.id === location.id}
										onClick={() =>
											void onSearchChange({ location: location.id }, true)
										}
										className={cn(
											"flex min-h-12 w-full items-center gap-3 border-transparent border-l-2 px-4 py-2 text-left text-card-foreground outline-none transition-[color,background-color,border-color] duration-150 ease-out hover:border-primary hover:bg-accent/60 hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none",
											selectedLocation?.id === location.id &&
												"border-primary bg-accent/80 text-accent-foreground hover:bg-accent/80",
										)}
									>
										<MapPinIcon
											aria-hidden="true"
											className="shrink-0"
											weight={
												selectedLocation?.id === location.id
													? "fill"
													: "regular"
											}
										/>
										<span className="min-w-0 flex-1 truncate text-sm">
											{location.name}
										</span>
										{!location.isActive && (
											<Badge variant="secondary" className="text-current">
												Inactive
											</Badge>
										)}
									</button>
								</li>
							))}
						</ul>
					) : (
						<Empty className="min-h-48 p-6">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<MapPinIcon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>No locations</EmptyTitle>
								<EmptyDescription>
									Create the first location for this map view.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</aside>

				{selectedMap && selectedImage ? (
					<LocationWorkspace
						key={`${selectedImage.id}:${selectedLocation?.id ?? `new-${newDraftVersion}`}`}
						data={data}
						mapId={selectedMap.id}
						image={selectedImage}
						locations={imageLocations}
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
		</div>
	);
}

type LocationWorkspaceProps = {
	data: EditorData;
	mapId: string;
	image: MapImage;
	locations: EditorLocation[];
	selectedLocation?: EditorLocation;
	onSelectLocation: (locationId: string) => void;
	onSaved: (locationId?: string) => Promise<void>;
};

function LocationWorkspace({
	data,
	mapId,
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
	const [draft, setDraft] = useState<Draft>({
		name: selectedLocation?.name ?? "",
		description: selectedLocation?.description ?? "",
		xBasisPoints: selectedLocation?.xBasisPoints ?? 5_000,
		yBasisPoints: selectedLocation?.yBasisPoints ?? 5_000,
		isActive: selectedLocation?.isActive ?? true,
		documentId: selectedDocumentId,
	});
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string>();
	const allowedDocumentIds = new Set(
		data.documentMaps
			.filter((item) => item.mapId === mapId)
			.map((item) => item.documentId),
	);
	const availableDocuments = data.documents.filter((document) =>
		allowedDocumentIds.has(document.id),
	);

	const updateDraft = <Key extends keyof Draft>(
		key: Key,
		value: Draft[Key],
	) => {
		setDraft((current) => ({ ...current, [key]: value }));
	};

	const submitLocation = async () => {
		setError(undefined);
		setIsSaving(true);

		try {
			const result = await saveLocation({
				data: {
					id: selectedLocation?.id,
					mapImageId: image.id,
					name: draft.name,
					description: draft.description,
					xBasisPoints: draft.xBasisPoints,
					yBasisPoints: draft.yBasisPoints,
					isActive: draft.isActive,
					documentId: draft.documentId,
				},
			});

			await onSaved(result.id);
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
				image={image}
				locations={locations}
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
							{isSaving ? "Saving…" : "Save location"}
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
											This permanently removes the marker and its document link.
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
