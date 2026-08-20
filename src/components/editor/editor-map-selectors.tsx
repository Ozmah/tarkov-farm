import { Field, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type EditorMapSelectorsProps = {
	maps: Array<{ id: string; name: string }>;
	mapViews: Array<{ id: string; name: string }>;
	selectedMapId: string;
	selectedMapViewId?: string;
	onMapChange: (mapId: string) => void;
	onMapViewChange: (mapViewId: string) => void;
};

export function EditorMapSelectors({
	maps,
	mapViews,
	selectedMapId,
	selectedMapViewId,
	onMapChange,
	onMapViewChange,
}: EditorMapSelectorsProps) {
	return (
		<>
			<Field>
				<FieldLabel
					htmlFor="editor-sidebar-map"
					className="text-sidebar-primary"
				>
					Map
				</FieldLabel>
				<Select
					items={maps.map((map) => ({ value: map.id, label: map.name }))}
					value={selectedMapId}
					onValueChange={(mapId) => {
						if (mapId) onMapChange(mapId);
					}}
				>
					<SelectTrigger
						id="editor-sidebar-map"
						className="w-full border-sidebar-border text-sidebar-foreground focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30"
					>
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

			{mapViews.length > 1 ? (
				<Field>
					<FieldLabel
						htmlFor="editor-sidebar-map-view"
						className="text-sidebar-primary"
					>
						Map view
					</FieldLabel>
					<Select
						items={mapViews.map((view) => ({
							value: view.id,
							label: view.name,
						}))}
						value={selectedMapViewId ?? null}
						onValueChange={(mapViewId) => {
							if (mapViewId) onMapViewChange(mapViewId);
						}}
					>
						<SelectTrigger
							id="editor-sidebar-map-view"
							className="w-full border-sidebar-border text-sidebar-foreground focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30"
						>
							<SelectValue placeholder="Select a map view" />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectGroup>
								{mapViews.map((view) => (
									<SelectItem key={view.id} value={view.id}>
										{view.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			) : null}
		</>
	);
}
