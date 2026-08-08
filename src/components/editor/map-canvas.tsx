import {
	MapWorkspace,
	type MapWorkspaceImage,
	type MapWorkspaceMarker,
} from "@/components/map/map-workspace";

type MapCanvasLocation = MapWorkspaceMarker & {
	isActive: boolean;
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
	const markers = locations.map((location, index) => {
		const marker = location.id === selectedLocationId ? draftMarker : location;

		return {
			...marker,
			id: location.id,
			label: String(index + 1),
		};
	});

	if (!selectedLocationId) {
		markers.push({
			...draftMarker,
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
			instructions="Wheel to zoom · Click to place · Middle or right drag to move"
			markers={markers}
			selectedMarkerId={selectedLocationId ?? "new-location"}
			onMapPress={onPositionChange}
			onSelectMarker={(markerId) => {
				if (markerId !== "new-location") {
					onSelectLocation(markerId);
				}
			}}
		/>
	);
}
