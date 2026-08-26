import { MapTrifoldIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useEffectEvent,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

import { MapMarkerCluster } from "@/components/map/map-marker-cluster";
import { MapMarkerPreview } from "@/components/map/map-marker-preview";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { pointerToBasisPoints } from "@/lib/map-coordinates";
import { groupOverlappingMapMarkers } from "@/lib/map-marker-groups";
import type { MapMarkerPreview as MapMarkerPreviewData } from "@/lib/map-marker-preview";
import type { MapImageSource } from "@/lib/map-master-manifest";
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
const MAX_ZOOM_RATIO = 8;
const ZOOM_BUTTON_STEP = 0.25;
const WHEEL_SENSITIVITY = 0.0015;
const DRAG_THRESHOLD = 5;
const SELECTED_MARKER_ZOOM_RATIO = 1.5;

export type MapWorkspaceImage = {
	altText: string;
	height: number;
	path: string;
	sources: MapImageSource[];
	width: number;
};

export type MapWorkspaceMarker = {
	appearance?: "default" | "reference";
	clusterable?: boolean;
	focusOnSelect?: boolean;
	id: string;
	isActive?: boolean;
	kind?: "location" | "submap";
	label?: string;
	name: string;
	preview?: MapMarkerPreviewData;
	secondaryLabel?: string;
	selectable?: boolean;
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
	rightViewportInset?: number;
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
	onImageError?: () => void;
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
	rightViewportInset = 0,
	selectedMarkerId,
	selectedMarkerPosition,
	toolbarStart,
	onImageError,
	onMapPress,
	onSelectMarker,
}: MapWorkspaceProps) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const instructionsId = useId();
	const imageElementRef = useRef<HTMLImageElement>(null);
	const viewRef = useRef<ViewTransform | undefined>(undefined);
	const viewportSizeRef = useRef<Size | undefined>(undefined);
	const rightViewportInsetRef = useRef(rightViewportInset);
	const fitScaleRef = useRef(1);
	const frameRef = useRef<number | undefined>(undefined);
	const pointerSessionRef = useRef<PointerSession | undefined>(undefined);
	const suppressContextMenuRef = useRef(false);
	const centeredMarkerIdRef = useRef<string | undefined>(undefined);
	const reportedImageErrorRef = useRef(false);
	const pendingSourcePathsRef = useRef(new Set<string>());
	const failedSourcePathsRef = useRef(new Set<string>());
	const mountedRef = useRef(true);
	const [view, setView] = useState<ViewTransform>();
	const [isPanning, setIsPanning] = useState(false);
	const [sourceSelection, setSourceSelection] = useState<{
		imagePath: string;
		source: MapImageSource;
	}>();
	const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const isImageReady = imageStatus === "ready";
	rightViewportInsetRef.current = rightViewportInset;
	const selectedMarkerX = selectedMarkerPosition?.xBasisPoints;
	const selectedMarkerY = selectedMarkerPosition?.yBasisPoints;
	const selectedMarker = selectedMarkerId
		? markers.find((marker) => marker.id === selectedMarkerId)
		: undefined;
	const selectedFocusX = selectedMarkerX ?? selectedMarker?.xBasisPoints;
	const selectedFocusY = selectedMarkerY ?? selectedMarker?.yBasisPoints;
	const selectedMarkerFocus =
		selectedMarkerId &&
		selectedFocusX !== undefined &&
		selectedFocusY !== undefined
			? {
					xBasisPoints: selectedFocusX,
					yBasisPoints: selectedFocusY,
				}
			: undefined;
	const getSelectedMarkerFocus = useEffectEvent(() => selectedMarkerFocus);
	const reportCachedImageError = useEffectEvent(() => {
		if (!reportedImageErrorRef.current) {
			reportedImageErrorRef.current = true;
			onImageError?.();
		}
	});
	const imageSize = useMemo(
		() => ({ width: image.width, height: image.height }),
		[image.height, image.width],
	);
	const clusterableLocationMarkers = useMemo(
		() =>
			markers.filter(
				(marker) =>
					marker.kind !== "submap" &&
					marker.clusterable !== false &&
					marker.selectable !== false,
			),
		[markers],
	);
	const standaloneLocationMarkers = useMemo(
		() =>
			markers.filter(
				(marker) =>
					marker.kind !== "submap" &&
					(marker.clusterable === false || marker.selectable === false),
			),
		[markers],
	);
	const submapMarkers = useMemo(
		() => markers.filter((marker) => marker.kind === "submap"),
		[markers],
	);
	const markerGroups = useMemo(
		() =>
			groupOverlappingMapMarkers(
				clusterableLocationMarkers,
				imageSize,
				view?.scale ?? fitScaleRef.current,
			),
		[clusterableLocationMarkers, imageSize, view?.scale],
	);
	const zoomRatio = view ? view.scale / fitScaleRef.current : 1;
	const zoomPercent = Math.round(zoomRatio * 100);
	const responsiveSrcSet = image.sources
		.map((source) => `${source.path} ${source.width}w`)
		.join(", ");
	const activeSource =
		sourceSelection?.imagePath === image.path
			? sourceSelection.source
			: undefined;
	const currentViewScale = view?.scale;
	const registerLoadedSource = useCallback(
		(element: HTMLImageElement) => {
			const loadedSource = findLoadedMapSource(
				image.sources,
				element.currentSrc,
			);

			if (!loadedSource) return;

			setSourceSelection((current) => {
				const currentSource =
					current?.imagePath === image.path ? current.source : undefined;

				return currentSource && currentSource.width >= loadedSource.width
					? current
					: { imagePath: image.path, source: loadedSource };
			});
		},
		[image.path, image.sources],
	);

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
		mountedRef.current = true;

		return () => {
			mountedRef.current = false;

			if (frameRef.current !== undefined) {
				cancelAnimationFrame(frameRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const imageElement = imageElementRef.current;

		if (imageElement?.complete) {
			if (imageElement.naturalWidth > 0) {
				setImageStatus("ready");
				registerLoadedSource(imageElement);
			} else {
				setImageStatus("error");
				reportCachedImageError();
			}
		}
	}, [registerLoadedSource]);

	useEffect(() => {
		if (!activeSource || !isImageReady || currentViewScale === undefined)
			return;

		const requiredWidth = Math.ceil(
			image.width *
				currentViewScale *
				Math.max(1, window.devicePixelRatio || 1),
		);
		const desiredSource =
			image.sources.find((source) => source.width >= requiredWidth) ??
			image.sources.at(-1);

		if (
			!desiredSource ||
			desiredSource.width <= activeSource.width ||
			pendingSourcePathsRef.current.size > 0 ||
			failedSourcePathsRef.current.has(desiredSource.path)
		) {
			return;
		}

		pendingSourcePathsRef.current.add(desiredSource.path);
		void preloadMapSource(desiredSource.path)
			.then(() => {
				if (!mountedRef.current) return;

				setSourceSelection((current) => {
					const currentSource =
						current?.imagePath === image.path ? current.source : undefined;

					return currentSource && currentSource.width >= desiredSource.width
						? current
						: { imagePath: image.path, source: desiredSource };
				});
			})
			.catch(() => {
				failedSourcePathsRef.current.add(desiredSource.path);
			})
			.finally(() => {
				pendingSourcePathsRef.current.delete(desiredSource.path);
			});
	}, [
		activeSource,
		currentViewScale,
		image.path,
		image.sources,
		image.width,
		isImageReady,
	]);

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
			const nextInteractionViewport = getInteractionViewport(
				nextViewportSize,
				rightViewportInsetRef.current,
			);
			const currentView = viewRef.current;
			const previousViewportSize = viewportSizeRef.current;
			const previousFitScale = fitScaleRef.current;
			let nextView = nextFitView;

			if (currentView && previousViewportSize) {
				const previousInteractionViewport = getInteractionViewport(
					previousViewportSize,
					rightViewportInsetRef.current,
				);
				const previousCenter = viewportPointToImagePoint(
					{
						x: previousInteractionViewport.width / 2,
						y: previousInteractionViewport.height / 2,
					},
					currentView,
				);
				const preservedZoomRatio = clamp(
					currentView.scale / previousFitScale,
					MIN_ZOOM_RATIO,
					MAX_ZOOM_RATIO,
				);
				const nextScale = nextFitView.scale * preservedZoomRatio;
				const selectedFocus = getSelectedMarkerFocus();

				nextView = selectedFocus
					? focusViewOnImagePoint({
							image: imageSize,
							point: {
								x: (selectedFocus.xBasisPoints / 10_000) * imageSize.width,
								y: (selectedFocus.yBasisPoints / 10_000) * imageSize.height,
							},
							scale: nextScale,
							viewport: nextInteractionViewport,
						})
					: constrainView(
							{
								scale: nextScale,
								x:
									nextInteractionViewport.width / 2 -
									previousCenter.x * nextScale,
								y:
									nextInteractionViewport.height / 2 -
									previousCenter.y * nextScale,
							},
							nextInteractionViewport,
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

	useEffect(() => {
		const currentView = viewRef.current;
		const viewportSize = viewportSizeRef.current;

		if (!currentView || !viewportSize) return;

		const interactionViewport = getInteractionViewport(
			viewportSize,
			rightViewportInset,
		);
		const selectedFocus = getSelectedMarkerFocus();
		const nextView = selectedFocus
			? focusViewOnImagePoint({
					image: imageSize,
					point: {
						x: (selectedFocus.xBasisPoints / 10_000) * imageSize.width,
						y: (selectedFocus.yBasisPoints / 10_000) * imageSize.height,
					},
					scale: currentView.scale,
					viewport: interactionViewport,
				})
			: constrainView(currentView, interactionViewport, imageSize);

		scheduleView(nextView);
	}, [imageSize, rightViewportInset, scheduleView]);

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
			const interactionViewport = getInteractionViewport(
				viewportSize,
				rightViewportInset,
			);

			scheduleView(
				zoomViewAtPoint({
					image: imageSize,
					nextScale,
					point,
					view: currentView,
					viewport: interactionViewport,
				}),
			);
		},
		[imageSize, rightViewportInset, scheduleView],
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

		if (marker?.focusOnSelect === false) {
			centeredMarkerIdRef.current = selectedMarkerId;
			return;
		}

		const viewportSize = viewportSizeRef.current;

		if (!marker || !viewportSize) {
			return;
		}

		const nextScale =
			fitScaleRef.current * Math.max(zoomRatio, SELECTED_MARKER_ZOOM_RATIO);
		const interactionViewport = getInteractionViewport(
			viewportSize,
			rightViewportInset,
		);
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
				viewport: interactionViewport,
			}),
		);
	}, [
		image.height,
		image.width,
		imageSize,
		markers,
		scheduleView,
		rightViewportInset,
		selectedMarkerId,
		selectedMarkerX,
		selectedMarkerY,
		view,
		zoomRatio,
	]);

	const zoomFromCenter = (nextZoomRatio: number) => {
		const viewportSize = viewportSizeRef.current;

		if (viewportSize) {
			const interactionViewport = getInteractionViewport(
				viewportSize,
				rightViewportInset,
			);
			zoomAtPoint(nextZoomRatio, {
				x: interactionViewport.width / 2,
				y: interactionViewport.height / 2,
			});
		}
	};

	const fitMap = () => {
		const viewportSize = viewportSizeRef.current;

		if (viewportSize) {
			const fit = fitView(viewportSize, imageSize);
			const selectedFocus = getSelectedMarkerFocus();

			scheduleView(
				selectedFocus && rightViewportInset > 0
					? focusViewOnImagePoint({
							image: imageSize,
							point: {
								x: (selectedFocus.xBasisPoints / 10_000) * imageSize.width,
								y: (selectedFocus.yBasisPoints / 10_000) * imageSize.height,
							},
							scale: fit.scale,
							viewport: getInteractionViewport(
								viewportSize,
								rightViewportInset,
							),
						})
					: fit,
			);
		}
	};

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const currentView = viewRef.current;
		const viewportSize = viewportSizeRef.current;

		if (!currentView || !viewportSize) {
			return;
		}

		const panStep = 48;
		const panDelta =
			event.key === "ArrowLeft"
				? { x: panStep, y: 0 }
				: event.key === "ArrowRight"
					? { x: -panStep, y: 0 }
					: event.key === "ArrowUp"
						? { x: 0, y: panStep }
						: event.key === "ArrowDown"
							? { x: 0, y: -panStep }
							: undefined;

		if (panDelta) {
			event.preventDefault();
			const interactionViewport = getInteractionViewport(
				viewportSize,
				rightViewportInset,
			);
			scheduleView(
				panView({
					delta: panDelta,
					image: imageSize,
					view: currentView,
					viewport: interactionViewport,
				}),
			);
			return;
		}

		if (["+", "="].includes(event.key)) {
			event.preventDefault();
			zoomFromCenter(zoomRatio + ZOOM_BUTTON_STEP);
		} else if (event.key === "-") {
			event.preventDefault();
			zoomFromCenter(zoomRatio - ZOOM_BUTTON_STEP);
		} else if (event.key === "0") {
			event.preventDefault();
			fitMap();
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
			const interactionViewport = getInteractionViewport(
				viewportSize,
				rightViewportInset,
			);
			scheduleView(
				panView({
					delta: {
						x: point.x - session.last.x,
						y: point.y - session.last.y,
					},
					image: imageSize,
					view: currentView,
					viewport: interactionViewport,
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

	// biome-ignore-start lint/a11y/noNoninteractiveTabindex: The map viewport is intentionally keyboard-focusable for panning and zooming.
	return (
		<section
			aria-label={ariaLabel}
			className={cn(
				"flex min-h-[50svh] min-w-0 flex-col bg-background lg:min-h-0",
				className,
			)}
		>
			<div className="flex h-[var(--map-controls-row-height)] shrink-0 items-center gap-2 border-border border-b bg-card px-3 py-2">
				{toolbarStart}
				<p className="hidden min-w-0 flex-1 truncate text-muted-foreground text-sm xl:block">
					{instructions}
				</p>
				<div className="ml-auto flex shrink-0 items-center gap-1">
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
			</div>
			<p id={instructionsId} className="sr-only">
				{instructions}. Focus the map and use arrow keys to pan, plus and minus
				to zoom, or zero to fit.
			</p>

			<div className="flex min-h-0 flex-1 flex-col bg-muted/20 p-2 sm:p-4">
				<div
					ref={viewportRef}
					role="application"
					aria-label={ariaLabel}
					aria-busy={imageStatus === "loading"}
					tabIndex={0}
					aria-describedby={instructionsId}
					className={cn(
						"relative min-h-0 w-full flex-1 touch-none select-none overflow-hidden overscroll-contain bg-background",
						isPanning
							? "cursor-grabbing"
							: onMapPress
								? "cursor-crosshair"
								: "cursor-grab",
					)}
					onPointerDown={handlePointerDown}
					onKeyDown={handleKeyDown}
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
						className={cn("absolute", view ? "top-0 left-0" : "inset-0")}
						style={{
							width: view ? image.width : undefined,
							height: view ? image.height : undefined,
							transform: view
								? `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
								: undefined,
							transformOrigin: "top left",
							willChange: view ? "transform" : undefined,
						}}
					>
						<img
							ref={imageElementRef}
							src={
								activeSource?.path ??
								(responsiveSrcSet ? undefined : image.path)
							}
							srcSet={activeSource ? undefined : responsiveSrcSet || undefined}
							sizes={
								activeSource
									? undefined
									: responsiveSrcSet
										? "100vw"
										: undefined
							}
							alt={image.altText}
							width={image.width}
							height={image.height}
							decoding="async"
							fetchPriority="high"
							draggable={false}
							onLoad={(event) => {
								setImageStatus("ready");
								registerLoadedSource(event.currentTarget);
							}}
							onError={() => {
								setImageStatus("error");

								if (!reportedImageErrorRef.current) {
									reportedImageErrorRef.current = true;
									onImageError?.();
								}
							}}
							className={cn(
								"pointer-events-none size-full",
								view ? "max-w-none" : "object-contain",
							)}
						/>
					</div>

					{isImageReady && view ? (
						<TooltipProvider delay={200}>
							<div
								className="pointer-events-none absolute isolate"
								style={{ left: view.x, top: view.y }}
							>
								{markerGroups.map((group) => {
									const marker = group.markers[0];

									return group.markers.length === 1 && marker ? (
										<MapMarker
											key={marker.id}
											marker={marker}
											position={getMarkerPosition(
												marker,
												imageSize,
												view.scale,
											)}
											isSelected={marker.id === selectedMarkerId}
											onClick={
												onSelectMarker && marker.selectable !== false
													? () => onSelectMarker(marker.id)
													: undefined
											}
										/>
									) : onSelectMarker ? (
										<MapMarkerCluster
											key={group.id}
											markers={group.markers}
											position={getMarkerPosition(group, imageSize, view.scale)}
											selectedMarkerId={selectedMarkerId}
											onSelect={(markerId) => {
												viewportRef.current?.focus();
												onSelectMarker(markerId);
											}}
										/>
									) : null;
								})}
								{standaloneLocationMarkers.map((marker) => (
									<MapMarker
										key={marker.id}
										marker={marker}
										position={getMarkerPosition(marker, imageSize, view.scale)}
										isSelected={marker.id === selectedMarkerId}
										onClick={
											onSelectMarker && marker.selectable !== false
												? () => onSelectMarker(marker.id)
												: undefined
										}
									/>
								))}
								{submapMarkers.map((marker) => (
									<MapMarker
										key={marker.id}
										marker={marker}
										position={getMarkerPosition(marker, imageSize, view.scale)}
										isSelected={false}
										onClick={
											onSelectMarker && marker.selectable !== false
												? () => onSelectMarker(marker.id)
												: undefined
										}
									/>
								))}
							</div>
						</TooltipProvider>
					) : null}

					{imageStatus === "error" ? (
						<div
							role="alert"
							className="absolute inset-0 grid place-items-center bg-background p-6 text-center"
						>
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
	// biome-ignore-end lint/a11y/noNoninteractiveTabindex: The map viewport is intentionally keyboard-focusable for panning and zooming.
}

type MapMarkerProps = {
	isSelected: boolean;
	marker: MapWorkspaceMarker;
	onClick?: () => void;
	position: Point;
};

function MapMarker({ isSelected, marker, onClick, position }: MapMarkerProps) {
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const isSubmap = marker.kind === "submap";
	const className = cn(
		"group/marker pointer-events-auto absolute z-10 flex size-9 items-center justify-center rounded-full border-2 border-cosmic-ink bg-milk-mustache font-bold font-heading text-cosmic-ink text-lg shadow-[0_2px_8px_rgb(0_0_0/0.8)] outline-none ring-2 ring-milk-mustache after:absolute after:-bottom-1 after:left-1/2 after:size-2 after:-translate-x-1/2 after:rotate-45 after:border-cosmic-ink after:border-r-2 after:border-b-2 after:bg-milk-mustache focus-visible:ring-4 focus-visible:ring-rowdy-orange",
		isSubmap &&
			"h-11 w-auto min-w-14 gap-1.5 rounded-none bg-rowdy-orange px-2 text-rowdy-orange-foreground ring-rowdy-orange after:bg-rowdy-orange [&_svg]:size-5",
		isSelected &&
			!isSubmap &&
			"z-20 size-11 bg-rowdy-orange text-rowdy-orange-foreground ring-4 after:bg-rowdy-orange",
		marker.isActive === false && "opacity-60",
		marker.appearance === "reference" &&
			"size-6 border-2 border-cosmic-ink bg-milk-mustache text-transparent opacity-95 shadow-[0_2px_6px_rgb(0_0_0/0.9)] ring-1 ring-milk-mustache before:size-2 before:rounded-full before:bg-blue-opal after:-bottom-1 after:size-2 after:border-r after:border-b after:bg-milk-mustache",
	);
	const style = {
		left: position.x,
		top: position.y,
		transform: "translate(-50%, -100%)",
		transformOrigin: "50% 100%",
	};

	if (!onClick) {
		if (marker.appearance === "reference") {
			const referenceMarker = (
				<span
					data-map-marker
					role="img"
					aria-label={`Existing location: ${marker.name}`}
					className={className}
					style={style}
				/>
			);

			return (
				<Tooltip>
					<TooltipTrigger render={referenceMarker} />
					<TooltipContent>{marker.name}</TooltipContent>
				</Tooltip>
			);
		}

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

	const trigger = (
		<button
			type="button"
			data-map-marker
			aria-label={`Open ${marker.name}`}
			aria-pressed={isSubmap ? undefined : isSelected}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={() => {
				setTooltipOpen(false);
				onClick();
			}}
			className={className}
			style={style}
		>
			{isSubmap ? <MapTrifoldIcon aria-hidden="true" weight="fill" /> : null}
			<span className="tabular-nums">{marker.label}</span>
		</button>
	);

	return (
		<Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
			<TooltipTrigger render={trigger} />
			<TooltipContent
				className={cn(
					marker.preview &&
						"max-w-none flex-col items-stretch gap-0 overflow-hidden p-0",
				)}
			>
				{marker.preview ? (
					<MapMarkerPreview name={marker.name} preview={marker.preview} />
				) : (
					marker.name
				)}
			</TooltipContent>
		</Tooltip>
	);
}

function getMarkerPosition(
	marker: Pick<MapWorkspaceMarker, "xBasisPoints" | "yBasisPoints">,
	image: Size,
	scale: number,
): Point {
	return {
		x: (marker.xBasisPoints / 10_000) * image.width * scale,
		y: (marker.yBasisPoints / 10_000) * image.height * scale,
	};
}

function findLoadedMapSource(
	sources: MapImageSource[],
	currentSourceUrl: string,
) {
	if (!currentSourceUrl) return undefined;

	const currentPath = new URL(currentSourceUrl, window.location.href).pathname;
	return sources.find((source) => source.path === currentPath);
}

function preloadMapSource(path: string) {
	return new Promise<void>((resolve, reject) => {
		const candidate = new Image();
		candidate.decoding = "async";
		candidate.onload = () => {
			const decoded =
				typeof candidate.decode === "function"
					? candidate.decode().catch(() => undefined)
					: Promise.resolve();

			void decoded.then(resolve);
		};
		candidate.onerror = () => reject(new Error(`Failed to preload ${path}`));
		candidate.src = path;
	});
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

function getInteractionViewport(
	viewport: Size,
	rightViewportInset: number,
): Size {
	const boundedInset = Number.isFinite(rightViewportInset)
		? clamp(rightViewportInset, 0, Math.max(0, viewport.width - 1))
		: 0;

	return {
		height: viewport.height,
		width: viewport.width - boundedInset,
	};
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value));
}
