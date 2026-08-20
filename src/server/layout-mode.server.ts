import "@tanstack/react-start/server-only";

import {
	getRequestHeader,
	setResponseHeader,
} from "@tanstack/react-start/server";

import {
	createLayoutModeCookie,
	type LayoutMode,
	readLayoutModeCookie,
} from "@/lib/layout-mode";
import { getServerEnvironment } from "@/server/env";

export function readPublicLayoutMode() {
	return readLayoutModeCookie(getRequestHeader("cookie") ?? null);
}

export function writePublicLayoutMode(layoutMode: LayoutMode) {
	const { appEnvironment } = getServerEnvironment();

	setResponseHeader(
		"Set-Cookie",
		createLayoutModeCookie(layoutMode, appEnvironment === "production"),
	);
}
