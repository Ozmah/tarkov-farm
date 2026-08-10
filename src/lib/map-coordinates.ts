export function pointerToBasisPoints(input: {
	pointerX: number;
	pointerY: number;
	width: number;
	height: number;
}) {
	if (
		!Object.values(input).every(Number.isFinite) ||
		input.width <= 0 ||
		input.height <= 0
	) {
		throw new Error("Map bounds must be positive");
	}

	return {
		xBasisPoints: clampBasisPoints(
			Math.round((input.pointerX / input.width) * 10_000),
		),
		yBasisPoints: clampBasisPoints(
			Math.round((input.pointerY / input.height) * 10_000),
		),
	};
}

function clampBasisPoints(value: number) {
	return Math.min(10_000, Math.max(0, value));
}
