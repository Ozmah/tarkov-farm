import { createCanonicalUrl } from "./seo";

const STATIC_PATHS = ["/", "/documents", "/updates", "/about", "/contribute"];

export function createSitemapXml(mapIds: readonly string[]) {
	const mapPaths = Array.from(new Set(mapIds)).map(
		(mapId) => `/maps/${encodeURIComponent(mapId)}`,
	);
	const urls = [...STATIC_PATHS, ...mapPaths].map(createCanonicalUrl);
	const entries = urls.map(
		(url) => `  <url><loc>${escapeXml(url)}</loc></url>`,
	);

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries,
		"</urlset>",
		"",
	].join("\n");
}

function escapeXml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}
