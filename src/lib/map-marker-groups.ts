const OVERLAP_DISTANCE_PX = 44;

type PositionedMarker = {
	id: string;
	xBasisPoints: number;
	yBasisPoints: number;
};

type MarkerGroup<T> = {
	id: string;
	markers: T[];
	xBasisPoints: number;
	yBasisPoints: number;
};

export function groupOverlappingMapMarkers<T extends PositionedMarker>(
	markers: readonly T[],
	image: { height: number; width: number },
	scale: number,
): MarkerGroup<T>[] {
	const parents = markers.map((_, index) => index);

	for (let leftIndex = 0; leftIndex < markers.length; leftIndex += 1) {
		const left = markers[leftIndex];
		if (!left) continue;

		for (
			let rightIndex = leftIndex + 1;
			rightIndex < markers.length;
			rightIndex += 1
		) {
			const right = markers[rightIndex];
			if (!right) continue;

			const horizontalDistance =
				((left.xBasisPoints - right.xBasisPoints) / 10_000) *
				image.width *
				scale;
			const verticalDistance =
				((left.yBasisPoints - right.yBasisPoints) / 10_000) *
				image.height *
				scale;

			if (
				Math.hypot(horizontalDistance, verticalDistance) < OVERLAP_DISTANCE_PX
			) {
				union(parents, leftIndex, rightIndex);
			}
		}
	}

	const markersByRoot = new Map<number, T[]>();

	for (const [index, marker] of markers.entries()) {
		const root = findRoot(parents, index);
		const group = markersByRoot.get(root);

		if (group) {
			group.push(marker);
		} else {
			markersByRoot.set(root, [marker]);
		}
	}

	return [...markersByRoot.values()].map((groupMarkers) => ({
		id:
			groupMarkers.length === 1
				? (groupMarkers[0]?.id ?? "")
				: `cluster:${groupMarkers
						.map(({ id }) => id)
						.sort()
						.join(":")}`,
		markers: groupMarkers,
		xBasisPoints: average(groupMarkers.map(({ xBasisPoints }) => xBasisPoints)),
		yBasisPoints: average(groupMarkers.map(({ yBasisPoints }) => yBasisPoints)),
	}));
}

function findRoot(parents: number[], index: number): number {
	const parent = parents[index];

	if (parent === undefined || parent === index) {
		return index;
	}

	const root = findRoot(parents, parent);
	parents[index] = root;
	return root;
}

function union(parents: number[], leftIndex: number, rightIndex: number) {
	const leftRoot = findRoot(parents, leftIndex);
	const rightRoot = findRoot(parents, rightIndex);

	if (leftRoot !== rightRoot) {
		parents[rightRoot] = leftRoot;
	}
}

function average(values: number[]) {
	return Math.round(
		values.reduce((total, value) => total + value, 0) / values.length,
	);
}
