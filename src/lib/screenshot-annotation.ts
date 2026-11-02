/** Marks drawn over a screenshot, in image pixels. */

export type AnnotationTool = "ellipse" | "rectangle" | "arrow" | "pen";

export type AnnotationPoint = { x: number; y: number };

export type AnnotationShape =
	| {
			kind: "ellipse" | "rectangle";
			x: number;
			y: number;
			width: number;
			height: number;
	  }
	| { kind: "arrow"; from: AnnotationPoint; to: AnnotationPoint }
	| { kind: "pen"; points: AnnotationPoint[] };

export const ANNOTATION_COLOR = "#ff1a1a";
export const MIN_BRIGHTNESS = 100;
export const MAX_BRIGHTNESS = 250;
/** Marks smaller than this (in image pixels) are treated as accidental clicks. */
const MIN_SHAPE_SIZE = 4;

/**
 * The shape spanned by a drag. With `constrain` (Shift): a square or circle,
 * or an arrow snapped to the nearest 45°. `bounds` keeps a constrained shape
 * inside the image: the pointer is clamped, but squaring can push past it.
 */
export function shapeFromDrag(
	kind: Exclude<AnnotationTool, "pen">,
	start: AnnotationPoint,
	end: AnnotationPoint,
	constrain = false,
	bounds?: { width: number; height: number },
): AnnotationShape {
	if (kind === "arrow")
		return {
			kind,
			from: start,
			to: constrain ? snapToEighth(start, end, bounds) : end,
		};

	let width = end.x - start.x;
	let height = end.y - start.y;
	if (constrain) {
		const signX = Math.sign(width || 1);
		const signY = Math.sign(height || 1);
		let side = Math.max(Math.abs(width), Math.abs(height));
		if (bounds)
			side = Math.min(
				side,
				signX > 0 ? bounds.width - start.x : start.x,
				signY > 0 ? bounds.height - start.y : start.y,
			);
		width = signX * side;
		height = signY * side;
	}
	return {
		kind,
		x: Math.min(start.x, start.x + width),
		y: Math.min(start.y, start.y + height),
		width: Math.abs(width),
		height: Math.abs(height),
	};
}

/** Adds a freehand point, skipping jitter closer than `minDistance` to the last one. */
export function extendPenStroke(
	points: AnnotationPoint[],
	point: AnnotationPoint,
	minDistance: number,
) {
	const last = points.at(-1);
	return last && distance(last, point) < minDistance
		? points
		: [...points, point];
}

export function isVisibleShape(shape: AnnotationShape) {
	switch (shape.kind) {
		case "arrow":
			return distance(shape.from, shape.to) >= MIN_SHAPE_SIZE * 2;
		case "pen": {
			// A loop, not Math.max(...points): long strokes exceed the argument limit.
			const [first] = shape.points;
			if (!first || shape.points.length < 2) return false;
			let [minX, maxX, minY, maxY] = [first.x, first.x, first.y, first.y];
			for (const { x, y } of shape.points) {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
			return Math.max(maxX - minX, maxY - minY) >= MIN_SHAPE_SIZE;
		}
		default:
			return shape.width >= MIN_SHAPE_SIZE && shape.height >= MIN_SHAPE_SIZE;
	}
}

/** Same visual weight on a 1080p capture and a 4K one. */
export function annotationStrokeWidth(imageWidth: number, imageHeight: number) {
	return Math.max(2, Math.round(Math.min(imageWidth, imageHeight) / 220));
}

/** Image brightened by the filter, marks drawn on top without it so red stays red. */
export function renderAnnotatedImage(
	context: CanvasRenderingContext2D,
	image: CanvasImageSource,
	size: { width: number; height: number },
	shapes: AnnotationShape[],
	brightness: number,
) {
	const stroke = annotationStrokeWidth(size.width, size.height);
	context.clearRect(0, 0, size.width, size.height);
	context.filter = brightness === 100 ? "none" : `brightness(${brightness}%)`;
	context.drawImage(image, 0, 0, size.width, size.height);
	context.filter = "none";
	context.strokeStyle = ANNOTATION_COLOR;
	context.fillStyle = ANNOTATION_COLOR;
	context.lineWidth = stroke;
	context.lineCap = "round";
	context.lineJoin = "round";
	for (const shape of shapes) drawShape(context, shape, stroke);
}

function drawShape(
	context: CanvasRenderingContext2D,
	shape: AnnotationShape,
	stroke: number,
) {
	context.beginPath();
	switch (shape.kind) {
		case "rectangle":
			context.rect(shape.x, shape.y, shape.width, shape.height);
			context.stroke();
			return;
		case "ellipse":
			context.ellipse(
				shape.x + shape.width / 2,
				shape.y + shape.height / 2,
				shape.width / 2,
				shape.height / 2,
				0,
				0,
				Math.PI * 2,
			);
			context.stroke();
			return;
		case "pen": {
			const [first, ...rest] = shape.points;
			if (!first) return;
			context.moveTo(first.x, first.y);
			for (const point of rest) context.lineTo(point.x, point.y);
			context.stroke();
			return;
		}
		case "arrow": {
			const { from, to } = shape;
			const angle = Math.atan2(to.y - from.y, to.x - from.x);
			// The head never exceeds half the shaft, so short arrows stay arrows.
			const head = Math.min(stroke * 5, distance(from, to) / 2);
			const spread = Math.PI / 7;
			// The shaft stops inside the head so its round cap does not poke through the tip.
			const shaftEnd = {
				x: to.x - Math.cos(angle) * head * 0.6,
				y: to.y - Math.sin(angle) * head * 0.6,
			};
			context.moveTo(from.x, from.y);
			context.lineTo(shaftEnd.x, shaftEnd.y);
			context.stroke();
			context.beginPath();
			context.moveTo(to.x, to.y);
			context.lineTo(
				to.x - Math.cos(angle - spread) * head,
				to.y - Math.sin(angle - spread) * head,
			);
			context.lineTo(
				to.x - Math.cos(angle + spread) * head,
				to.y - Math.sin(angle + spread) * head,
			);
			context.closePath();
			context.fill();
			return;
		}
	}
}

/** Full-resolution result, in the same format and with the same name as the original. */
export async function exportAnnotatedScreenshot(
	original: File,
	image: HTMLImageElement,
	shapes: AnnotationShape[],
	brightness: number,
): Promise<File> {
	const size = { width: image.naturalWidth, height: image.naturalHeight };
	const canvas = document.createElement("canvas");
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas is unavailable in this browser");
	renderAnnotatedImage(context, image, size, shapes, brightness);
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, original.type, 0.95),
	);
	if (!blob || blob.type !== original.type)
		throw new Error("The edited screenshot could not be encoded");
	return new File([blob], original.name, { type: original.type });
}

function distance(a: AnnotationPoint, b: AnnotationPoint) {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

function snapToEighth(
	start: AnnotationPoint,
	end: AnnotationPoint,
	bounds?: { width: number; height: number },
) {
	const step = Math.PI / 4;
	const angle =
		Math.round(Math.atan2(end.y - start.y, end.x - start.x) / step) * step;
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	let length = distance(start, end);
	// Shorten along the snapped direction so the tip stays inside the image.
	if (bounds) {
		if (dx > 1e-9) length = Math.min(length, (bounds.width - start.x) / dx);
		if (dx < -1e-9) length = Math.min(length, start.x / -dx);
		if (dy > 1e-9) length = Math.min(length, (bounds.height - start.y) / dy);
		if (dy < -1e-9) length = Math.min(length, start.y / -dy);
	}
	return { x: start.x + dx * length, y: start.y + dy * length };
}
