import { MapTrifoldIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import {
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import { pointerToBasisPoints } from "@/lib/map-coordinates";
import {
	constrainView,
	fitView,
	focusViewOnImagePoint,
	isPointInsideImage,
	type Point,
	panView,
	type Size,
	type ViewTransform,
	viewportPointToImagePoint,
	zoomViewAtPoint,
} from "@/lib/map-viewport";
import { cn } from "@/lib/utils";

const MIN_ZOOM_RATIO = 1;
const MAX_ZOOM_RATIO = 4;
const ZOOM_BUTTON_STEP = 0.25;
const WHEEL_SENSITIVITY = 0.0015;
const DRAG_THRESHOLD = 5;
const SELECTED_MARKER_ZOOM_RATIO = 1.5;

export type MapWorkspaceImage = {
	altText: string;
	height: number;
	path: string;
	width: number;
};

export type MapWorkspaceMarker = {
	id: string;
	isActive?: boolean;
	kind?: "location" | "submap";
	label?: string;
	name: string;
	xBasisPoints: number;
	yBasisPoints: number;
};

type MapWorkspaceProps = {
	ariaLabel: string;
	className?: string;
	image: MapWorkspaceImage;
	instructions: string;
	markers: MapWorkspaceMarker[];
	panWithPrimaryButton?: boolean;
	selectedMarkerId?: string;
	selectedMarkerPosition?: {
		xBasisPoints: number;
		yBasisPoints: number;
	};
	toolbarStart?: ReactNode;
	onMapPress?: (position: {
		xBasisPoints: number;
		yBasisPoints: number;
	}) => void;
	onSelectMarker?: (markerId: string) => void;
};

type PointerSession = {
	button: number;
	last: Point;
	mode: "pan" | "press";
	moved: boolean;
	pointerId: number;
	start: Point;
};

export function MapWorkspace({
	ariaLabel,
	className,
	image,
	instructions,
	markers,
	panWithPrimaryButton = true,
	selectedMarkerId,
	selectedMarkerPosition,
	toolbarStart,
	onMapPress,
	onSelectMarker,
}: MapWorkspaceProps) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const imageElementRef = useRef<HTMLImageElement>(null);
	const viewRef = useRef<ViewTransform | undefined>(undefined);
	const viewportSizeRef = useRef<Size | undefined>(undefined);
	const fitScaleRef = useRef(1);
	const frameRef = useRef<number | undefined>(undefined);
	const pointerSessionRef = useRef<PointerSession | undefined>(undefined);
	const suppressContextMenuRef = useRef(false);
	const centeredMarkerIdRef = useRef<string | undefined>(undefined);
	const selectedMarkerFocusRef = useRef<
		| {
				xBasisPoints: number;
				yBasisPoints: number;
			}
		| undefined
	>(undefined);
	const [view, setView] = useState<ViewTransform>();
	const [isPanning, setIsPanning] = useState(false);
	const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const isImageReady = imageStatus === "ready";
	const selectedMarkerX = selectedMarkerPosition?.xBasisPoints;
	const selectedMarkerY = selectedMarkerPosition?.yBasisPoints;
	const selectedMarker = selectedMarkerId
		? markers.find((marker) => marker.id === selectedMarkerId)
		: undefined;
	const selectedFocusX = selectedMarkerX ?? selectedMarker?.xBasisPoints;
	const selectedFocusY = selectedMarkerY ?? selectedMarker?.yBasisPoints;
	selectedMarkerFocusRef.current =
		selectedMarkerId &&
		selectedFocusX !== undefined &&
		selectedFocusY !== undefined
		? {
				xBasisPoints: selectedFocusX,
				yBasisPoints: selectedFocusY,
			}
		: undefined;
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
		const imageElement = imageElementRef.current;

		if (imageElement?.complete) {
			setImageStatus(imageElement.naturalWidth > 0 ? "ready" : "error");
		}
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
				const selectedFocus = selectedMarkerFocusRef.current;

				nextView = selectedFocus
					? focusViewOnImagePoint({
							image: imageSize,
							point: {
								x: (selectedFocus.xBasisPoints / 10_000) * image.width,
								y: (selectedFocus.yBasisPoints / 10_000) * image.height,
							},
							scale: nextScale,
							viewport: nextViewportSize,
						})
					: constrainView(
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

	useEffect(() => {
		if (!selectedMarkerId) {
			centeredMarkerIdRef.current = undefined;
			return;
		}

		if (centeredMarkerIdRef.current === selectedMarkerId || !view) {
			return;
		}

		const marker = markers.find((item) => item.id === selectedMarkerId);
		const viewportSize = viewportSizeRef.current;

		if (!marker || !viewportSize) {
			return;
		}

		const nextScale =
			fitScaleRef.current * Math.max(zoomRatio, SELECTED_MARKER_ZOOM_RATIO);
		const centerPosition =
			selectedMarkerX !== undefined && selectedMarkerY !== undefined
				? { xBasisPoints: selectedMarkerX, yBasisPoints: selectedMarkerY }
				: marker;
		const markerPoint = {
			x: (centerPosition.xBasisPoints / 10_000) * image.width,
			y: (centerPosition.yBasisPoints / 10_000) * image.height,
		};

		centeredMarkerIdRef.current = selectedMarkerId;
		scheduleView(
			focusViewOnImagePoint({
				image: imageSize,
				point: markerPoint,
				scale: nextScale,
				viewport: viewportSize,
			}),
		);
	}, [
		image.height,
		image.width,
		imageSize,
		markers,
		scheduleView,
		selectedMarkerId,
		selectedMarkerX,
		selectedMarkerY,
		view,
		zoomRatio,
	]);

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
		const shouldPan =
			event.button !== 0 || event.pointerType === "touch" || !onMapPress;

		pointerSessionRef.current = {
			button: event.button,
			last: point,
			mode: shouldPan ? "pan" : "press",
			moved: false,
			pointerId: event.pointerId,
			start: point,
		};
		event.currentTarget.setPointerCapture(event.pointerId);

		if (event.button === 1 || event.button === 2) {
			event.preventDefault();
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

		if (session.mode === "press" && session.moved && panWithPrimaryButton) {
			session.mode = "pan";
		}

		if (session.mode !== "pan" || !session.moved) {
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

		setIsPanning(true);

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

		if (
			!cancelled &&
			(session.mode === "press" || event.pointerType === "touch") &&
			!session.moved &&
			onMapPress
		) {
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
					onMapPress(
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
		<section
			aria-label={ariaLabel}
			className={cn(
				"flex min-h-[50svh] min-w-0 flex-col bg-background lg:min-h-0",
				className,
			)}
		>
			<div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-border border-b bg-card px-3 py-2">
				{toolbarStart}
				<p className="min-w-36 flex-1 truncate text-muted-foreground text-sm">
					{instructions}
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
				<p className="w-12 text-center text-muted-foreground text-sm tabular-nums">
					{zoomPercent}%
				</p>
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

			<div className="min-h-0 flex-1 bg-muted/20 p-2 sm:p-4">
				{/* biome-ignore lint/a11y/noStaticElementInteractions: Pointer gestures supplement accessible marker and zoom controls. */}
				<div
					ref={viewportRef}
					className={cn(
						"relative size-full touch-none select-none overflow-hidden overscroll-contain bg-background",
						isPanning
							? "cursor-grabbing"
							: onMapPress
								? "cursor-crosshair"
								: "cursor-grab",
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
							ref={imageElementRef}
							src={image.path}
							alt={image.altText}
							width={image.width}
							height={image.height}
							decoding="async"
							fetchPriority="high"
							draggable={false}
							onLoad={() => setImageStatus("ready")}
							onError={() => setImageStatus("error")}
							className={cn(
								"pointer-events-none size-full max-w-none",
								!isImageReady && "opacity-0",
							)}
						/>

						{isImageReady
							? markers.map((marker) => (
									<MapMarker
										key={marker.id}
										marker={marker}
										image={imageSize}
										inverseScale={view ? 1 / view.scale : 1}
										isSelected={marker.id === selectedMarkerId}
										onClick={
											onSelectMarker
												? () => onSelectMarker(marker.id)
												: undefined
										}
									/>
								))
							: null}
					</div>

					{imageStatus === "loading" ? (
						<div className="pointer-events-none absolute inset-0 grid place-items-center bg-background">
							<p className="font-heading text-muted-foreground text-sm">
								Loading map…
							</p>
						</div>
					) : null}

					{imageStatus === "error" ? (
						<div className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
							<div className="flex max-w-sm flex-col gap-2">
								<p className="font-heading font-medium">Map unavailable</p>
								<p className="text-muted-foreground text-sm">
									The map image could not be loaded. Refresh the page to try
									again.
								</p>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}

type MapMarkerProps = {
	image: Size;
	inverseScale: number;
	isSelected: boolean;
	marker: MapWorkspaceMarker;
	onClick?: () => void;
};

function MapMarker({
	image,
	inverseScale,
	isSelected,
	marker,
	onClick,
}: MapMarkerProps) {
	const isSubmap = marker.kind === "submap";
	const className = cn(
		"absolute z-10 flex size-9 items-center justify-center rounded-full border-2 border-cosmic-ink bg-milk-mustache font-bold font-heading text-cosmic-ink text-lg shadow-[0_2px_8px_rgb(0_0_0/0.8)] outline-none ring-2 ring-milk-mustache after:absolute after:-bottom-1 after:left-1/2 after:size-2 after:-translate-x-1/2 after:rotate-45 after:border-cosmic-ink after:border-r-2 after:border-b-2 after:bg-milk-mustache focus-visible:ring-4 focus-visible:ring-rowdy-orange",
		isSubmap &&
			"h-11 w-auto min-w-14 gap-1.5 rounded-none bg-rowdy-orange px-2 text-rowdy-orange-foreground ring-rowdy-orange after:bg-rowdy-orange [&_svg]:size-5",
		isSelected &&
			!isSubmap &&
			"z-20 size-11 bg-rowdy-orange text-rowdy-orange-foreground ring-4 after:bg-rowdy-orange",
		marker.isActive === false && "opacity-60",
	);
	const style = {
		left: `${(marker.xBasisPoints / 10_000) * image.width}px`,
		top: `${(marker.yBasisPoints / 10_000) * image.height}px`,
		transform: `translate(-50%, -100%) scale(${inverseScale})`,
		transformOrigin: "50% 100%",
	};

	if (!onClick) {
		return (
			<span
				aria-hidden="true"
				className={cn(className, "pointer-events-none")}
				style={style}
			>
				{marker.label}
			</span>
		);
	}

	return (
		<button
			type="button"
			data-map-marker
			aria-label={`Open ${marker.name}`}
			aria-pressed={isSubmap ? undefined : isSelected}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={onClick}
			className={className}
			style={style}
		>
			{isSubmap ? <MapTrifoldIcon aria-hidden="true" weight="fill" /> : null}
			<span className="tabular-nums">{marker.label}</span>
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
