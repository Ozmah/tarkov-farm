export type Point = {
	x: number;
	y: number;
};

export type Size = {
	width: number;
	height: number;
};

export type ViewTransform = {
	scale: number;
	x: number;
	y: number;
};

export function fitView(viewport: Size, image: Size): ViewTransform {
	assertPositiveSize(viewport, "Viewport");
	assertPositiveSize(image, "Image");

	const scale = Math.min(
		viewport.width / image.width,
		viewport.height / image.height,
	);

	return {
		scale,
		x: (viewport.width - image.width * scale) / 2,
		y: (viewport.height - image.height * scale) / 2,
	};
}

export function zoomViewAtPoint(input: {
	image: Size;
	nextScale: number;
	point: Point;
	view: ViewTransform;
	viewport: Size;
}) {
	const worldPoint = viewportPointToImagePoint(input.point, input.view);

	return constrainZoomView(
		{
			scale: input.nextScale,
			x: input.point.x - worldPoint.x * input.nextScale,
			y: input.point.y - worldPoint.y * input.nextScale,
		},
		input.viewport,
		input.image,
	);
}

function constrainZoomView(view: ViewTransform, viewport: Size, image: Size) {
	assertPositiveSize(viewport, "Viewport");
	assertPositiveSize(image, "Image");

	const renderedWidth = image.width * view.scale;
	const renderedHeight = image.height * view.scale;

	return {
		...view,
		x:
			renderedWidth <= viewport.width
				? clamp(view.x, 0, viewport.width - renderedWidth)
				: clamp(view.x, viewport.width - renderedWidth, 0),
		y:
			renderedHeight <= viewport.height
				? clamp(view.y, 0, viewport.height - renderedHeight)
				: clamp(view.y, viewport.height - renderedHeight, 0),
	};
}

export function panView(input: {
	delta: Point;
	image: Size;
	view: ViewTransform;
	viewport: Size;
}) {
	return constrainView(
		{
			...input.view,
			x: input.view.x + input.delta.x,
			y: input.view.y + input.delta.y,
		},
		input.viewport,
		input.image,
	);
}

export function constrainView(
	view: ViewTransform,
	viewport: Size,
	image: Size,
) {
	assertPositiveSize(viewport, "Viewport");
	assertPositiveSize(image, "Image");

	if (!Number.isFinite(view.scale) || view.scale <= 0) {
		throw new Error("View scale must be positive");
	}

	const renderedWidth = image.width * view.scale;
	const renderedHeight = image.height * view.scale;

	return {
		...view,
		x:
			renderedWidth <= viewport.width
				? (viewport.width - renderedWidth) / 2
				: clamp(view.x, viewport.width - renderedWidth, 0),
		y:
			renderedHeight <= viewport.height
				? (viewport.height - renderedHeight) / 2
				: clamp(view.y, viewport.height - renderedHeight, 0),
	};
}

export function viewportPointToImagePoint(point: Point, view: ViewTransform) {
	if (!Number.isFinite(view.scale) || view.scale <= 0) {
		throw new Error("View scale must be positive");
	}

	return {
		x: (point.x - view.x) / view.scale,
		y: (point.y - view.y) / view.scale,
	};
}

export function isPointInsideImage(point: Point, image: Size) {
	return (
		point.x >= 0 &&
		point.y >= 0 &&
		point.x <= image.width &&
		point.y <= image.height
	);
}

function assertPositiveSize(size: Size, label: string) {
	if (
		!Number.isFinite(size.width) ||
		!Number.isFinite(size.height) ||
		size.width <= 0 ||
		size.height <= 0
	) {
		throw new Error(`${label} dimensions must be positive`);
	}
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value));
}
