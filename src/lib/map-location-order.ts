const ROW_TOLERANCE_BASIS_POINTS = 350;

type PositionedLocation = {
	id: string;
	xBasisPoints: number;
	yBasisPoints: number;
};

export function numberMapLocations<T extends PositionedLocation>(
	locations: readonly T[],
) {
	const byVerticalPosition = [...locations].sort(
		(left, right) =>
			left.yBasisPoints - right.yBasisPoints ||
			left.xBasisPoints - right.xBasisPoints ||
			left.id.localeCompare(right.id),
	);
	const rows: T[][] = [];

	for (const location of byVerticalPosition) {
		const currentRow = rows.at(-1);
		const rowStart = currentRow?.[0]?.yBasisPoints;

		if (
			currentRow &&
			rowStart !== undefined &&
			location.yBasisPoints - rowStart <= ROW_TOLERANCE_BASIS_POINTS
		) {
			currentRow.push(location);
		} else {
			rows.push([location]);
		}
	}

	const orderedLocations = rows.flatMap((row) =>
		[...row].sort(
			(left, right) =>
				left.xBasisPoints - right.xBasisPoints ||
				left.yBasisPoints - right.yBasisPoints ||
				left.id.localeCompare(right.id),
		),
	);

	return orderedLocations.map((location, index) => ({
		...location,
		markerLabel: String(index + 1),
	}));
}
