import {
	type CSSProperties,
	type PointerEventHandler,
	type TransitionEventHandler,
	useEffect,
	useRef,
	useState,
} from "react";

type SwipeNavigationOptions = {
	active: boolean;
	onNext?: () => void;
	onPrevious?: () => void;
};

type SwipeGesture = {
	axis?: "horizontal" | "vertical";
	latestX: number;
	pointerId: number;
	startTime: number;
	startX: number;
	startY: number;
};

const AXIS_LOCK_DISTANCE = 8;
const EDGE_RESISTANCE = 0.2;
const MIN_SWIPE_DISTANCE = 48;
const MAX_SWIPE_DISTANCE = 96;
const SWIPE_VELOCITY = 0.5;

export function useSwipeNavigation({
	active,
	onNext,
	onPrevious,
}: SwipeNavigationOptions) {
	const [offset, setOffset] = useState(0);
	const [transitionEnabled, setTransitionEnabled] = useState(false);
	const gestureRef = useRef<SwipeGesture | undefined>(undefined);
	const animationFramesRef = useRef<number[]>([]);

	useEffect(
		() => () => {
			cancelAnimationFrames(animationFramesRef.current);
		},
		[],
	);

	useEffect(() => {
		if (active) return;

		cancelAnimationFrames(animationFramesRef.current);
		animationFramesRef.current = [];
		gestureRef.current = undefined;
		setOffset(0);
		setTransitionEnabled(false);
	}, [active]);

	const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
		if (
			!active ||
			!event.isPrimary ||
			event.pointerType === "mouse" ||
			(!onNext && !onPrevious)
		) {
			return;
		}

		cancelAnimationFrames(animationFramesRef.current);
		animationFramesRef.current = [];
		setTransitionEnabled(false);
		gestureRef.current = {
			latestX: event.clientX,
			pointerId: event.pointerId,
			startTime: event.timeStamp,
			startX: event.clientX,
			startY: event.clientY,
		};
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};

	const onPointerMove: PointerEventHandler<HTMLElement> = (event) => {
		const gesture = gestureRef.current;
		if (!gesture || gesture.pointerId !== event.pointerId) return;

		const deltaX = event.clientX - gesture.startX;
		const deltaY = event.clientY - gesture.startY;
		gesture.latestX = event.clientX;

		if (!gesture.axis) {
			if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < AXIS_LOCK_DISTANCE) {
				return;
			}
			gesture.axis =
				Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
		}

		if (gesture.axis !== "horizontal") return;

		event.preventDefault();
		const canNavigate = deltaX < 0 ? Boolean(onNext) : Boolean(onPrevious);
		setOffset(canNavigate ? deltaX : deltaX * EDGE_RESISTANCE);
	};

	const finishGesture: PointerEventHandler<HTMLElement> = (event) => {
		const gesture = gestureRef.current;
		if (!gesture || gesture.pointerId !== event.pointerId) return;

		gestureRef.current = undefined;
		releasePointer(event.currentTarget, event.pointerId);

		if (gesture.axis !== "horizontal") {
			setOffset(0);
			return;
		}

		const deltaX = gesture.latestX - gesture.startX;
		const elapsed = Math.max(1, event.timeStamp - gesture.startTime);
		const velocity = Math.abs(deltaX) / elapsed;
		const viewportWidth =
			event.currentTarget.clientWidth || window.innerWidth || 320;
		const distanceThreshold = Math.min(
			MAX_SWIPE_DISTANCE,
			Math.max(MIN_SWIPE_DISTANCE, viewportWidth * 0.2),
		);
		const callback = deltaX < 0 ? onNext : onPrevious;

		if (
			callback &&
			(Math.abs(deltaX) >= distanceThreshold || velocity >= SWIPE_VELOCITY)
		) {
			showIncomingScreenshot(
				deltaX < 0 ? viewportWidth : -viewportWidth,
				callback,
			);
			return;
		}

		setTransitionEnabled(true);
		setOffset(0);
	};

	const cancelGesture: PointerEventHandler<HTMLElement> = (event) => {
		const gesture = gestureRef.current;
		if (!gesture || gesture.pointerId !== event.pointerId) return;

		gestureRef.current = undefined;
		releasePointer(event.currentTarget, event.pointerId);
		setTransitionEnabled(true);
		setOffset(0);
	};

	function showIncomingScreenshot(
		incomingOffset: number,
		navigate: () => void,
	) {
		setTransitionEnabled(false);
		setOffset(incomingOffset);
		navigate();

		const firstFrame = requestAnimationFrame(() => {
			const secondFrame = requestAnimationFrame(() => {
				setTransitionEnabled(true);
				setOffset(0);
			});
			animationFramesRef.current = [secondFrame];
		});
		animationFramesRef.current = [firstFrame];
	}

	const style: CSSProperties = {
		touchAction: "pan-y pinch-zoom",
		transform:
			offset !== 0 || transitionEnabled
				? `translate3d(${offset}px, 0, 0)`
				: undefined,
	};

	const onTransitionEnd: TransitionEventHandler<HTMLElement> = (event) => {
		if (event.propertyName === "transform") setTransitionEnabled(false);
	};

	return {
		isActive: offset !== 0 || transitionEnabled,
		isTransitioning: transitionEnabled,
		onPointerCancel: cancelGesture,
		onPointerDown,
		onPointerMove,
		onPointerUp: finishGesture,
		onTransitionEnd,
		style,
	};
}

function cancelAnimationFrames(animationFrames: number[]) {
	for (const animationFrame of animationFrames) {
		cancelAnimationFrame(animationFrame);
	}
}

function releasePointer(element: HTMLElement, pointerId: number) {
	if (element.hasPointerCapture?.(pointerId)) {
		element.releasePointerCapture(pointerId);
	}
}
