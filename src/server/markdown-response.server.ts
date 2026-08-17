import "@tanstack/react-start/server-only";

import { readCatalogId } from "@/lib/catalog-search";
import {
	renderDocumentsMarkdown,
	renderHomeMarkdown,
	renderMapMarkdown,
} from "@/lib/markdown-representations";
import { readCatalog, readPublicMap } from "./catalog.server";

const MARKDOWN_HEADERS = {
	"Cache-Control":
		"public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
	"Content-Language": "en",
	"Content-Security-Policy":
		"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
	"Content-Type": "text/markdown; charset=utf-8",
	Vary: "Accept",
	"X-Content-Type-Options": "nosniff",
};

export async function createMarkdownResponse(request: Request) {
	const url = new URL(request.url);
	const pathname = normalizePathname(url.pathname);
	let body: string | undefined;
	let status = 200;

	if (pathname === "/") {
		body = renderHomeMarkdown(await readCatalog());
	} else if (pathname === "/documents") {
		body = renderDocumentsMarkdown(await readCatalog());
	} else {
		const rawMapId = /^\/maps\/([^/]+)$/.exec(pathname)?.[1];
		const mapId = rawMapId ? readMapId(rawMapId) : undefined;

		if (!rawMapId) return undefined;

		if (!mapId) {
			body = "# Map not found\n";
			status = 404;
		} else {
			const [catalog, mapData] = await Promise.all([
				readCatalog(),
				readPublicMap(mapId),
			]);

			if (mapData) {
				body = renderMapMarkdown(catalog, mapData, url);
			} else {
				body = "# Map not found\n";
				status = 404;
			}
		}
	}

	return new Response(request.method === "HEAD" ? null : body, {
		headers: MARKDOWN_HEADERS,
		status,
	});
}

function normalizePathname(pathname: string) {
	return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

function readMapId(value: string) {
	try {
		return readCatalogId(decodeURIComponent(value));
	} catch {
		return undefined;
	}
}
