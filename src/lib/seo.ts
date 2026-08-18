export const SITE_NAME = "Tarkov Farm";
export const SITE_ORIGIN = "https://tarkov.farm";

const SOCIAL_IMAGE_PATH = "/tarkov-farm-social.jpg";

export const SOCIAL_IMAGE_URL = import.meta.env.DEV
	? SOCIAL_IMAGE_PATH
	: `${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}`;

const SOCIAL_IMAGE_ALT = "Tarkov Farm Kord Breach seasonal documents guide";

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
			{ property: "og:image", content: SOCIAL_IMAGE_URL },
			{ property: "og:image:type", content: "image/jpeg" },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ property: "og:image:alt", content: SOCIAL_IMAGE_ALT },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
			{ name: "twitter:url", content: canonicalUrl },
			{ name: "twitter:image", content: SOCIAL_IMAGE_URL },
			{ name: "twitter:image:alt", content: SOCIAL_IMAGE_ALT },
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
