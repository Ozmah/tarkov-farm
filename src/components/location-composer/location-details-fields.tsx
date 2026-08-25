import type {
	LocationComposerDraft,
	LocationDraftChange,
} from "@/components/location-composer/location-draft";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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

type LocationDetailsFieldsProps = {
	draft: LocationComposerDraft;
	draftMapId: string;
	keyboardSubmitHint: string;
	mapImages: Array<{ id: string; name: string }>;
	maps: Array<{ id: string; name: string }>;
	onDraftChange: LocationDraftChange;
	onMapChange: (mapId: string) => void;
};

export function LocationDetailsFields({
	draft,
	draftMapId,
	keyboardSubmitHint,
	mapImages,
	maps,
	onDraftChange,
	onMapChange,
}: LocationDetailsFieldsProps) {
	return (
		<>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="location-map">Map</FieldLabel>
					<Select
						items={maps.map((map) => ({
							value: map.id,
							label: map.name,
						}))}
						value={draftMapId}
						onValueChange={(nextMapId) => {
							if (nextMapId) onMapChange(nextMapId);
						}}
					>
						<SelectTrigger id="location-map" className="w-full">
							<SelectValue placeholder="Select a map" />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectGroup>
								{maps.map((map) => (
									<SelectItem key={map.id} value={map.id}>
										{map.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>

				{mapImages.length > 1 ? (
					<Field>
						<FieldLabel htmlFor="location-map-view">Map view</FieldLabel>
						<Select
							items={mapImages.map((item) => ({
								value: item.id,
								label: item.name,
							}))}
							value={draft.mapImageId}
							onValueChange={(nextImageId) => {
								if (nextImageId) {
									onDraftChange("mapImageId", nextImageId);
								}
							}}
						>
							<SelectTrigger id="location-map-view" className="w-full">
								<SelectValue placeholder="Select a map view" />
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectGroup>
									{mapImages.map((item) => (
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
					onChange={(event) => onDraftChange("name", event.target.value)}
					maxLength={120}
					autoComplete="off"
					spellCheck="false"
					required
				/>
			</Field>

			<Field>
				<FieldLabel htmlFor="location-description">Description</FieldLabel>
				<Textarea
					id="location-description"
					value={draft.description}
					onChange={(event) => onDraftChange("description", event.target.value)}
					maxLength={2_000}
					rows={4}
					placeholder="Landmarks, floor, container, or route notes"
				/>
				<FieldDescription>{keyboardSubmitHint}</FieldDescription>
			</Field>

			<div className="grid grid-cols-2 gap-4">
				<CoordinateField
					axis="X"
					value={draft.xBasisPoints}
					onChange={(value) => onDraftChange("xBasisPoints", value)}
				/>
				<CoordinateField
					axis="Y"
					value={draft.yBasisPoints}
					onChange={(value) => onDraftChange("yBasisPoints", value)}
				/>
			</div>
			<FieldDescription>
				Coordinates use basis points from 0 to 10000.
			</FieldDescription>
		</>
	);
}

function CoordinateField({
	axis,
	value,
	onChange,
}: {
	axis: "X" | "Y";
	value: number;
	onChange: (value: number) => void;
}) {
	const id = `location-${axis.toLowerCase()}`;

	return (
		<Field>
			<FieldLabel htmlFor={id}>{axis}</FieldLabel>
			<Input
				id={id}
				type="number"
				min={0}
				max={10_000}
				step={1}
				value={value}
				onChange={(event) => {
					if (!Number.isNaN(event.target.valueAsNumber)) {
						onChange(event.target.valueAsNumber);
					}
				}}
				required
			/>
		</Field>
	);
}
