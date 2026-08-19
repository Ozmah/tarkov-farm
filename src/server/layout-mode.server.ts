import "@tanstack/react-start/server-only";

import {
	getRequest,
	getRequestHeader,
	getRequestUrl,
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
	assertSameOriginMutation();
	const { appEnvironment } = getServerEnvironment();

	setResponseHeader(
		"Set-Cookie",
		createLayoutModeCookie(layoutMode, appEnvironment === "production"),
	);
}

function assertSameOriginMutation() {
	const request = getRequest();
	const origin = request.headers.get("origin");
	const fetchSite = request.headers.get("sec-fetch-site");

	if (!origin || fetchSite === "cross-site") {
		throw new Error("Invalid preference request origin");
	}

	let originUrl: URL;

	try {
		originUrl = new URL(origin);
	} catch {
		throw new Error("Invalid preference request origin");
	}

	if (
		originUrl.origin !==
		getRequestUrl({ xForwardedHost: false, xForwardedProto: false }).origin
	) {
		throw new Error("Invalid preference request origin");
	}
}
