import "@tanstack/react-start/server-only";

import { notFound } from "@tanstack/react-router";
import {
	getRequest,
	getRequestIP,
	getRequestUrl,
} from "@tanstack/react-start/server";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLoopbackHostname(hostname: string) {
	return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

export function assertLocalEditorAccess(options?: { mutation?: boolean }) {
	if (
		process.env.APP_ENV?.trim().toLowerCase() !== "local" ||
		process.env.NODE_ENV === "production"
	) {
		throw notFound();
	}

	const requestUrl = getRequestUrl({
		xForwardedHost: false,
		xForwardedProto: false,
	});

	if (!isLoopbackHostname(requestUrl.hostname)) {
		throw notFound();
	}

	const requestIp = getRequestIP({ xForwardedFor: false });

	if (requestIp && !isLoopbackAddress(requestIp)) {
		throw notFound();
	}

	if (!options?.mutation) {
		return;
	}

	const request = getRequest();
	const origin = request.headers.get("origin");
	const fetchSite = request.headers.get("sec-fetch-site");

	if (!origin || fetchSite === "cross-site") {
		throw notFound();
	}

	let originUrl: URL;

	try {
		originUrl = new URL(origin);
	} catch {
		throw notFound();
	}

	if (originUrl.origin !== requestUrl.origin) {
		throw notFound();
	}
}

function isLoopbackAddress(address: string) {
	const normalized = address.toLowerCase();

	return (
		normalized === "::1" ||
		normalized === "0:0:0:0:0:0:0:1" ||
		normalized.startsWith("127.") ||
		normalized.startsWith("::ffff:127.")
	);
}
