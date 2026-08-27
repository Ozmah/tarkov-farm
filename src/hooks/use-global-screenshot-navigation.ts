import { useEffect, useEffectEvent } from "react";

import {
	handleScreenshotNavigationKeyDown,
	type ScreenshotNavigationCallbacks,
} from "@/lib/screenshot-navigation";

type UseGlobalScreenshotNavigationOptions = ScreenshotNavigationCallbacks & {
	active?: boolean;
};

export function useGlobalScreenshotNavigation({
	active = true,
	onNext,
	onPrevious,
}: UseGlobalScreenshotNavigationOptions) {
	const enabled = active && Boolean(onNext || onPrevious);
	const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
		handleScreenshotNavigationKeyDown(event, { onNext, onPrevious });
	});

	useEffect(() => {
		if (!enabled) return;

		document.addEventListener("keydown", handleKeyDown, true);
		return () => document.removeEventListener("keydown", handleKeyDown, true);
	}, [enabled]);
}
