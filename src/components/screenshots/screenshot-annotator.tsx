import {
	ArrowCounterClockwiseIcon,
	ArrowUpRightIcon,
	CircleIcon,
	PencilSimpleLineIcon,
	SquareIcon,
	SunIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import {
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	type AnnotationPoint,
	type AnnotationShape,
	type AnnotationTool,
	annotationStrokeWidth,
	exportAnnotatedScreenshot,
	extendPenStroke,
	isVisibleShape,
	MAX_BRIGHTNESS,
	MIN_BRIGHTNESS,
	renderAnnotatedImage,
	shapeFromDrag,
} from "@/lib/screenshot-annotation";

type ScreenshotAnnotatorProps = {
	/** The screenshot to mark; the dialog is open while it is set. */
	file?: File;
	title: string;
	onCancel: () => void;
	onSave: (file: File) => void;
};

export function ScreenshotAnnotator({
	file,
	title,
	onCancel,
	onSave,
}: ScreenshotAnnotatorProps) {
	return (
		<Dialog
			open={Boolean(file)}
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<DialogContent
				overlayClassName="bg-black/85"
				className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-3 p-3 sm:max-w-[calc(100vw-2rem)]"
			>
				<DialogTitle className="pr-10 text-base">{title}</DialogTitle>
				<DialogDescription className="sr-only">
					Drag on the screenshot to draw an ellipse, a rectangle, an arrow, or a
					freehand line. Hold Shift for a circle, a square, or an arrow snapped
					to 45 degrees. Ctrl+Z undoes the last mark.
				</DialogDescription>
				{file ? (
					<AnnotatorWorkspace
						key={`${file.name}:${file.size}:${file.lastModified}`}
						file={file}
						onCancel={onCancel}
						onSave={onSave}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function AnnotatorWorkspace({
	file,
	onCancel,
	onSave,
}: {
	file: File;
	onCancel: () => void;
	onSave: (file: File) => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const dragStartRef = useRef<AnnotationPoint>(undefined);
	// Source of truth for a freehand stroke; `draft` only mirrors it for painting.
	const penPointsRef = useRef<AnnotationPoint[]>([]);
	const [image, setImage] = useState<HTMLImageElement>();
	const [tool, setTool] = useState<AnnotationTool>("ellipse");
	const [shapes, setShapes] = useState<AnnotationShape[]>([]);
	const [draft, setDraft] = useState<AnnotationShape>();
	const [brightness, setBrightness] = useState(MIN_BRIGHTNESS);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const changed = shapes.length > 0 || brightness !== MIN_BRIGHTNESS;

	useEffect(() => {
		const url = URL.createObjectURL(file);
		const next = new Image();
		let cancelled = false;
		next.src = url;
		next
			.decode()
			.then(() => {
				if (!cancelled) setImage(next);
			})
			.catch(() => {
				if (!cancelled) setError("This screenshot could not be opened");
			});
		return () => {
			cancelled = true;
			URL.revokeObjectURL(url);
		};
	}, [file]);

	// The canvas is an external drawing surface: repaint it whenever its inputs change.
	useEffect(() => {
		const context = canvasRef.current?.getContext("2d");
		if (!context || !image) return;
		renderAnnotatedImage(
			context,
			image,
			{ width: image.naturalWidth, height: image.naturalHeight },
			draft ? [...shapes, draft] : shapes,
			brightness,
		);
	}, [image, shapes, draft, brightness]);

	function toImagePoint(event: PointerEvent<HTMLCanvasElement>) {
		const canvas = event.currentTarget;
		const bounds = canvas.getBoundingClientRect();
		const clamp = (value: number, max: number) =>
			Math.min(Math.max(value, 0), max);
		return {
			x: clamp(
				((event.clientX - bounds.left) * canvas.width) / bounds.width,
				canvas.width,
			),
			y: clamp(
				((event.clientY - bounds.top) * canvas.height) / bounds.height,
				canvas.height,
			),
		};
	}

	function undo() {
		setShapes((current) => current.slice(0, -1));
	}

	async function save() {
		if (!image) return;
		setSaving(true);
		setError(undefined);
		try {
			onSave(await exportAnnotatedScreenshot(file, image, shapes, brightness));
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not save the edit",
			);
			setSaving(false);
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcut scope for the editor.
		<div
			className="flex min-h-0 flex-col gap-3"
			onKeyDown={(event: KeyboardEvent) => {
				if (
					(event.ctrlKey || event.metaKey) &&
					event.key.toLowerCase() === "z"
				) {
					event.preventDefault();
					undo();
				}
			}}
		>
			<div className="flex flex-wrap items-center gap-2">
				<ToolButton
					active={tool === "ellipse"}
					icon={<CircleIcon aria-hidden="true" />}
					label="Ellipse"
					onClick={() => setTool("ellipse")}
				/>
				<ToolButton
					active={tool === "rectangle"}
					icon={<SquareIcon aria-hidden="true" />}
					label="Rectangle"
					onClick={() => setTool("rectangle")}
				/>
				<ToolButton
					active={tool === "arrow"}
					icon={<ArrowUpRightIcon aria-hidden="true" />}
					label="Arrow"
					onClick={() => setTool("arrow")}
				/>
				<ToolButton
					active={tool === "pen"}
					icon={<PencilSimpleLineIcon aria-hidden="true" />}
					label="Pen"
					onClick={() => setTool("pen")}
				/>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={shapes.length === 0}
					onClick={undo}
				>
					<ArrowCounterClockwiseIcon
						data-icon="inline-start"
						aria-hidden="true"
					/>
					Undo
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={shapes.length === 0}
					onClick={() => setShapes([])}
				>
					<TrashIcon data-icon="inline-start" aria-hidden="true" />
					Clear
				</Button>
				<label className="ml-2 flex items-center gap-2 text-sm">
					<SunIcon aria-hidden="true" />
					<span className="sr-only">Brightness</span>
					<input
						type="range"
						min={MIN_BRIGHTNESS}
						max={MAX_BRIGHTNESS}
						step={5}
						value={brightness}
						onChange={(event) =>
							setBrightness(event.currentTarget.valueAsNumber)
						}
						className="w-32 accent-primary"
					/>
					<span className="w-12 text-muted-foreground tabular-nums">
						{brightness}%
					</span>
				</label>
				<div className="ml-auto flex gap-2">
					<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={!image || !changed || saving}
						onClick={() => void save()}
					>
						{saving ? "Saving…" : "Save"}
					</Button>
				</div>
			</div>
			{error ? (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			) : null}
			<div className="flex min-h-0 justify-center">
				{image ? (
					<canvas
						ref={canvasRef}
						width={image.naturalWidth}
						height={image.naturalHeight}
						aria-label="Screenshot being marked"
						className="h-auto max-h-[calc(100dvh-9rem)] w-auto max-w-full cursor-crosshair touch-none"
						onPointerDown={(event) => {
							if (event.button !== 0) return;
							event.currentTarget.setPointerCapture(event.pointerId);
							const point = toImagePoint(event);
							dragStartRef.current = point;
							penPointsRef.current = [point];
							if (tool === "pen") setDraft({ kind: "pen", points: [point] });
						}}
						onPointerMove={(event) => {
							const start = dragStartRef.current;
							if (!start) return;
							const point = toImagePoint(event);
							if (tool === "pen") {
								penPointsRef.current = extendPenStroke(
									penPointsRef.current,
									point,
									penJitter(event.currentTarget),
								);
								setDraft({ kind: "pen", points: penPointsRef.current });
							} else {
								setDraft(shapeFromDrag(tool, start, point, event.shiftKey));
							}
						}}
						onPointerUp={(event) => {
							const start = dragStartRef.current;
							dragStartRef.current = undefined;
							setDraft(undefined);
							if (!start) return;
							const shape: AnnotationShape =
								tool === "pen"
									? { kind: "pen", points: penPointsRef.current }
									: shapeFromDrag(
											tool,
											start,
											toImagePoint(event),
											event.shiftKey,
										);
							if (isVisibleShape(shape))
								setShapes((current) => [...current, shape]);
						}}
						onPointerCancel={() => {
							dragStartRef.current = undefined;
							setDraft(undefined);
						}}
					/>
				) : error ? null : (
					<p role="status" className="p-6 text-muted-foreground text-sm">
						Loading screenshot…
					</p>
				)}
			</div>
		</div>
	);
}

/** Freehand points closer than half a stroke add nothing visible. */
function penJitter(canvas: HTMLCanvasElement) {
	return annotationStrokeWidth(canvas.width, canvas.height) / 2;
}

function ToolButton({
	active,
	icon,
	label,
	onClick,
}: {
	active: boolean;
	icon: ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant={active ? "secondary" : "ghost"}
			size="sm"
			aria-pressed={active}
			onClick={onClick}
		>
			{icon}
			{label}
		</Button>
	);
}
