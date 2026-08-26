import type { KeyboardEvent } from "react";

type ScreenshotNavigationCallbacks = {
	onNext?: () => void;
	onPrevious?: () => void;
};

const EDITABLE_SELECTOR =
	"input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']";

export function handleScreenshotNavigationKeyDown(
	event: KeyboardEvent<HTMLElement>,
	{ onNext, onPrevious }: ScreenshotNavigationCallbacks,
) {
	if (
		(!onNext && !onPrevious) ||
		event.defaultPrevented ||
		event.nativeEvent.isComposing ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		isEditableTarget(event.target)
	) {
		return;
	}

	const key = event.key.toLowerCase();
	const isPrevious = key === "a" || key === "arrowleft";
	const isNext = key === "d" || key === "arrowright";

	if (!isPrevious && !isNext) return;

	event.preventDefault();
	event.stopPropagation();
	if (isPrevious) onPrevious?.();
	else onNext?.();
}

function isEditableTarget(target: EventTarget | null) {
	return (
		target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR))
	);
}
