type MapAttributionProps = {
	mapId: string;
};

export function MapAttribution({ mapId }: MapAttributionProps) {
	if (mapId === "the-lab") {
		return (
			<p className="text-pretty text-muted-foreground text-sm">
				The Lab map sourced from the{" "}
				<a
					href="https://escapefromtarkov.fandom.com/wiki/Map:The_Lab"
					target="_blank"
					rel="noreferrer"
					className="underline underline-offset-4 hover:text-foreground"
				>
					Escape from Tarkov Wiki
				</a>
				.
			</p>
		);
	}

	return (
		<p className="text-pretty text-muted-foreground text-sm">
			Map artwork © 2025{" "}
			<a
				href="https://reemr.se/"
				target="_blank"
				rel="noreferrer"
				className="underline underline-offset-4 hover:text-foreground"
			>
				re3mr
			</a>{" "}
			· Licensed under{" "}
			<a
				href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
				target="_blank"
				rel="noreferrer"
				className="underline underline-offset-4 hover:text-foreground"
			>
				CC BY-NC-SA 4.0
			</a>
			.
		</p>
	);
}
