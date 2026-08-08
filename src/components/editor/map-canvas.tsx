import { MapPinIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import { pointerToBasisPoints } from "@/lib/editor-coordinates";
import {
	constrainView,
	fitView,
	isPointInsideImage,
	type Point,
	panView,
	type Size,
	type ViewTransform,
	viewportPointToImagePoint,
	zoomViewAtPoint,
} from "@/lib/editor-viewport";
import { cn } from "@/lib/utils";

const MIN_ZOOM_RATIO = 0.5;
const MAX_ZOOM_RATIO = 4;
const ZOOM_BUTTON_STEP = 0.25;
const WHEEL_SENSITIVITY = 0.0015;
const DRAG_THRESHOLD = 5;

type MapCanvasImage = {
	altText: string;
	height: number;
	path: string;
	width: number;
};

type MapCanvasLocation = {
	id: string;
	isActive: boolean;
	name: string;
	xBasisPoints: number;
	yBasisPoints: number;
};

type DraftMarker = Omit<MapCanvasLocation, "id">;

type MapCanvasProps = {
	draftMarker: DraftMarker;
	image: MapCanvasImage;
	locations: MapCanvasLocation[];
	selectedLocationId?: string;
	onPositionChange: (position: {
		xBasisPoints: number;
		yBasisPoints: number;
	}) => void;
	onSelectLocation: (locationId: string) => void;
};

type PointerSession = {
	button: number;
	last: Point;
	moved: boolean;
	pointerId: number;
	start: Point;
};

export function MapCanvas({
	draftMarker,
	image,
	locations,
	selectedLocationId,
	onPositionChange,
	onSelectLocation,
}: MapCanvasProps) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<ViewTransform | undefined>(undefined);
	const viewportSizeRef = useRef<Size | undefined>(undefined);
	const fitScaleRef = useRef(1);
	const frameRef = useRef<number | undefined>(undefined);
	const pointerSessionRef = useRef<PointerSession | undefined>(undefined);
	const suppressContextMenuRef = useRef(false);
	const [view, setView] = useState<ViewTransform>();
	const [isPanning, setIsPanning] = useState(false);
	const imageSize = useMemo(
		() => ({ width: image.width, height: image.height }),
		[image.height, image.width],
	);
	const zoomRatio = view ? view.scale / fitScaleRef.current : 1;
	const zoomPercent = Math.round(zoomRatio * 100);

	const scheduleView = useCallback((nextView: ViewTransform) => {
		viewRef.current = nextView;

		if (frameRef.current !== undefined) {
			return;
		}

		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = undefined;

			if (viewRef.current) {
				setView(viewRef.current);
			}
		});
	}, []);

	useEffect(() => {
		return () => {
			if (frameRef.current !== undefined) {
				cancelAnimationFrame(frameRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const viewport = viewportRef.current;

		if (!viewport) {
			return;
		}

		const observer = new ResizeObserver(([entry]) => {
			if (!entry) {
				return;
			}

			const nextViewportSize = {
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			};

			if (nextViewportSize.width <= 0 || nextViewportSize.height <= 0) {
				return;
			}

			const nextFitView = fitView(nextViewportSize, imageSize);
			const currentView = viewRef.current;
			const previousViewportSize = viewportSizeRef.current;
			const previousFitScale = fitScaleRef.current;
			let nextView = nextFitView;

			if (currentView && previousViewportSize) {
				const previousCenter = viewportPointToImagePoint(
					{
						x: previousViewportSize.width / 2,
						y: previousViewportSize.height / 2,
					},
					currentView,
				);
				const preservedZoomRatio = clamp(
					currentView.scale / previousFitScale,
					MIN_ZOOM_RATIO,
					MAX_ZOOM_RATIO,
				);
				const nextScale = nextFitView.scale * preservedZoomRatio;

				nextView = constrainView(
					{
						scale: nextScale,
						x: nextViewportSize.width / 2 - previousCenter.x * nextScale,
						y: nextViewportSize.height / 2 - previousCenter.y * nextScale,
					},
					nextViewportSize,
					imageSize,
				);
			}

			fitScaleRef.current = nextFitView.scale;
			viewportSizeRef.current = nextViewportSize;
			viewRef.current = nextView;
			setView(nextView);
		});

		observer.observe(viewport);

		return () => observer.disconnect();
	}, [imageSize]);

	const zoomAtPoint = useCallback(
		(nextZoomRatio: number, point: Point) => {
			const currentView = viewRef.current;
			const viewportSize = viewportSizeRef.current;

			if (!currentView || !viewportSize) {
				return;
			}

			const boundedZoomRatio = clamp(
				nextZoomRatio,
				MIN_ZOOM_RATIO,
				MAX_ZOOM_RATIO,
			);
			const nextScale = fitScaleRef.current * boundedZoomRatio;

			scheduleView(
				zoomViewAtPoint({
					image: imageSize,
					nextScale,
					point,
					view: currentView,
					viewport: viewportSize,
				}),
			);
		},
		[imageSize, scheduleView],
	);

	useEffect(() => {
		const viewport = viewportRef.current;

		if (!viewport) {
			return;
		}

		const handleWheel = (event: WheelEvent) => {
			const currentView = viewRef.current;
			const viewportSize = viewportSizeRef.current;

			if (!currentView || !viewportSize) {
				return;
			}

			const bounds = viewport.getBoundingClientRect();
			const point = {
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top,
			};
			const imagePoint = viewportPointToImagePoint(point, currentView);

			if (!isPointInsideImage(imagePoint, imageSize)) {
				return;
			}

			event.preventDefault();

			const delta = normalizeWheelDelta(event, viewportSize.height);
			const currentZoomRatio = currentView.scale / fitScaleRef.current;
			const nextZoomRatio =
				currentZoomRatio * Math.exp(-delta * WHEEL_SENSITIVITY);

			zoomAtPoint(nextZoomRatio, point);
		};

		viewport.addEventListener("wheel", handleWheel, { passive: false });

		return () => viewport.removeEventListener("wheel", handleWheel);
	}, [imageSize, zoomAtPoint]);

	const zoomFromCenter = (nextZoomRatio: number) => {
		const viewportSize = viewportSizeRef.current;

		if (viewportSize) {
			zoomAtPoint(nextZoomRatio, {
				x: viewportSize.width / 2,
				y: viewportSize.height / 2,
			});
		}
	};

	const fitMap = () => {
		const viewportSize = viewportSizeRef.current;

		if (viewportSize) {
			scheduleView(fitView(viewportSize, imageSize));
		}
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (![0, 1, 2].includes(event.button) || pointerSessionRef.current) {
			return;
		}

		if ((event.target as HTMLElement).closest("[data-map-marker]")) {
			return;
		}

		const point = { x: event.clientX, y: event.clientY };

		pointerSessionRef.current = {
			button: event.button,
			last: point,
			moved: false,
			pointerId: event.pointerId,
			start: point,
		};
		event.currentTarget.setPointerCapture(event.pointerId);

		if (event.button === 1 || event.button === 2) {
			event.preventDefault();
			setIsPanning(true);
		}

		if (event.button === 2) {
			suppressContextMenuRef.current = false;
		}
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const session = pointerSessionRef.current;

		if (!session || session.pointerId !== event.pointerId) {
			return;
		}

		const point = { x: event.clientX, y: event.clientY };
		const distance = Math.hypot(
			point.x - session.start.x,
			point.y - session.start.y,
		);

		if (distance >= DRAG_THRESHOLD) {
			session.moved = true;
		}

		if (session.button === 0 || !session.moved) {
			session.last = point;
			return;
		}

		const currentView = viewRef.current;
		const viewportSize = viewportSizeRef.current;

		if (currentView && viewportSize) {
			scheduleView(
				panView({
					delta: {
						x: point.x - session.last.x,
						y: point.y - session.last.y,
					},
					image: imageSize,
					view: currentView,
					viewport: viewportSize,
				}),
			);
		}

		if (session.button === 2) {
			suppressContextMenuRef.current = true;
		}

		session.last = point;
		event.preventDefault();
	};

	const finishPointerInteraction = (
		event: ReactPointerEvent<HTMLDivElement>,
		cancelled = false,
	) => {
		const session = pointerSessionRef.current;

		if (!session || session.pointerId !== event.pointerId) {
			return;
		}

		if (!cancelled && session.button === 0 && !session.moved) {
			const currentView = viewRef.current;

			if (currentView) {
				const bounds = event.currentTarget.getBoundingClientRect();
				const imagePoint = viewportPointToImagePoint(
					{
						x: event.clientX - bounds.left,
						y: event.clientY - bounds.top,
					},
					currentView,
				);

				if (isPointInsideImage(imagePoint, imageSize)) {
					onPositionChange(
						pointerToBasisPoints({
							pointerX: imagePoint.x,
							pointerY: imagePoint.y,
							width: image.width,
							height: image.height,
						}),
					);
				}
			}
		}

		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}

		pointerSessionRef.current = undefined;
		setIsPanning(false);
	};

	return (
		<section className="flex min-h-[50svh] min-w-0 flex-col border-border border-b lg:min-h-0 lg:border-r lg:border-b-0">
			<div className="flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
				<p className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
					Wheel to zoom · Click to place · Middle or right drag to move
				</p>
				<Button type="button" variant="ghost" size="sm" onClick={fitMap}>
					Fit
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Zoom out"
					onClick={() => zoomFromCenter(zoomRatio - ZOOM_BUTTON_STEP)}
					disabled={zoomRatio <= MIN_ZOOM_RATIO}
				>
					<MinusIcon />
				</Button>
				<span className="w-12 text-center text-muted-foreground text-sm tabular-nums">
					{zoomPercent}%
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Zoom in"
					onClick={() => zoomFromCenter(zoomRatio + ZOOM_BUTTON_STEP)}
					disabled={zoomRatio >= MAX_ZOOM_RATIO}
				>
					<PlusIcon />
				</Button>
			</div>

			<div className="min-h-0 flex-1 bg-muted/20 p-4">
				{/* biome-ignore lint/a11y/noStaticElementInteractions: Pointer gestures supplement the accessible zoom buttons and coordinate fields. */}
				<div
					ref={viewportRef}
					className={cn(
						"relative size-full select-none overflow-hidden overscroll-contain bg-background",
						isPanning ? "cursor-grabbing" : "cursor-crosshair",
					)}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={(event) => finishPointerInteraction(event)}
					onPointerCancel={(event) => finishPointerInteraction(event, true)}
					onContextMenu={(event) => {
						if (suppressContextMenuRef.current) {
							event.preventDefault();
							suppressContextMenuRef.current = false;
						}
					}}
				>
					<div
						className="absolute top-0 left-0 isolate"
						style={{
							width: image.width,
							height: image.height,
							transform: view
								? `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
								: undefined,
							transformOrigin: "top left",
							visibility: view ? "visible" : "hidden",
							willChange: "transform",
						}}
					>
						<img
							src={image.path}
							alt={image.altText}
							width={image.width}
							height={image.height}
							draggable={false}
							className="pointer-events-none block size-full max-w-none"
						/>

						{locations.map((location) => {
							const isSelected = location.id === selectedLocationId;
							const marker = isSelected ? draftMarker : location;

							return (
								<MapMarker
									key={location.id}
									name={marker.name}
									xBasisPoints={marker.xBasisPoints}
									yBasisPoints={marker.yBasisPoints}
									isSelected={isSelected}
									isActive={marker.isActive}
									image={imageSize}
									inverseScale={view ? 1 / view.scale : 1}
									onClick={() => onSelectLocation(location.id)}
								/>
							);
						})}

						{!selectedLocationId && (
							<MapMarker
								name={draftMarker.name || "New location"}
								xBasisPoints={draftMarker.xBasisPoints}
								yBasisPoints={draftMarker.yBasisPoints}
								isSelected
								isActive={draftMarker.isActive}
								image={imageSize}
								inverseScale={view ? 1 / view.scale : 1}
							/>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

type MapMarkerProps = DraftMarker & {
	image: Size;
	inverseScale: number;
	isSelected: boolean;
	onClick?: () => void;
};

function MapMarker({
	name,
	xBasisPoints,
	yBasisPoints,
	isSelected,
	isActive,
	image,
	inverseScale,
	onClick,
}: MapMarkerProps) {
	const className = cn(
		"absolute z-10 flex size-7 items-center justify-center rounded-full border-2 border-background bg-cinnamon text-cinnamon-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
		isSelected && "size-9 bg-rowdy-orange text-rowdy-orange-foreground",
		!isActive && "opacity-50",
	);
	const style = {
		left: `${(xBasisPoints / 10_000) * image.width}px`,
		top: `${(yBasisPoints / 10_000) * image.height}px`,
		transform: `translate(-50%, -50%) scale(${inverseScale})`,
	};

	if (!onClick) {
		return (
			<span
				aria-hidden="true"
				className={cn(className, "pointer-events-none")}
				style={style}
			>
				<MapPinIcon weight="fill" />
			</span>
		);
	}

	return (
		<button
			type="button"
			data-map-marker
			aria-label={`Edit ${name}`}
			aria-pressed={isSelected}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={onClick}
			className={className}
			style={style}
		>
			<MapPinIcon aria-hidden="true" weight="fill" />
		</button>
	);
}

function normalizeWheelDelta(event: WheelEvent, viewportHeight: number) {
	const pixels =
		event.deltaMode === WheelEvent.DOM_DELTA_LINE
			? event.deltaY * 16
			: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
				? event.deltaY * viewportHeight
				: event.deltaY;

	return clamp(pixels, -120, 120);
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value));
}
