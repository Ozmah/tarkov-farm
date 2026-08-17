import {
	MapWorkspace,
	type MapWorkspaceImage,
	type MapWorkspaceMarker,
} from "@/components/map/map-workspace";

type MapCanvasLocation = MapWorkspaceMarker & {
	isActive: boolean;
	markerLabel?: string;
};

type DraftMarker = Omit<MapCanvasLocation, "id">;

type MapCanvasProps = {
	draftMarker: DraftMarker;
	image: MapWorkspaceImage;
	locations: MapCanvasLocation[];
	selectedLocationId?: string;
	onPositionChange: (position: {
		xBasisPoints: number;
		yBasisPoints: number;
	}) => void;
	onSelectLocation: (locationId: string) => void;
};

export function MapCanvas({
	draftMarker,
	image,
	locations,
	selectedLocationId,
	onPositionChange,
	onSelectLocation,
}: MapCanvasProps) {
	const selectedLocation = selectedLocationId
		? locations.find((location) => location.id === selectedLocationId)
		: undefined;
	const markers = locations.map((location, index) => {
		const marker = location.id === selectedLocationId ? draftMarker : location;

		return {
			...marker,
			id: location.id,
			label: location.markerLabel ?? String(index + 1),
		};
	});

	if (!selectedLocationId) {
		markers.push({
			...draftMarker,
			clusterable: false,
			id: "new-location",
			label: "+",
			name: draftMarker.name || "New location",
		});
	}

	return (
		<MapWorkspace
			ariaLabel="Location editor map"
			className="border-border border-b lg:border-r lg:border-b-0"
			image={image}
			instructions="Click to place · Drag to move · Wheel to zoom"
			markers={markers}
			selectedMarkerId={selectedLocationId ?? "new-location"}
			selectedMarkerPosition={selectedLocation}
			onMapPress={onPositionChange}
			onSelectMarker={(markerId) => {
				if (markerId !== "new-location") {
					onSelectLocation(markerId);
				}
			}}
		/>
	);
}
