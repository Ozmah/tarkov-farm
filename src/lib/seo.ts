export const SITE_NAME = "Tarkov Farm";
export const SITE_ORIGIN = "https://tarkov.farm";

type SeoHeadInput = {
	description: string;
	pathname: string;
	title: string;
};

export function createSeoHead({ description, pathname, title }: SeoHeadInput) {
	const canonicalUrl = createCanonicalUrl(pathname);

	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: SITE_NAME },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: canonicalUrl },
			{ name: "twitter:card", content: "summary" },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
		],
		links: [{ rel: "canonical", href: canonicalUrl }],
	};
}

export function createCanonicalUrl(pathname: string) {
	try {
		const url = new URL(pathname, SITE_ORIGIN);

		if (url.origin !== SITE_ORIGIN) {
			return `${SITE_ORIGIN}/`;
		}

		url.search = "";
		url.hash = "";

		return url.href;
	} catch {
		return `${SITE_ORIGIN}/`;
	}
}
