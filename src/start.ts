import {
	createCsrfMiddleware,
	createMiddleware,
	createStart,
} from "@tanstack/react-start";

import { prefersMarkdown } from "@/lib/http-accept";

const markdownMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		if (
			(request.method !== "GET" && request.method !== "HEAD") ||
			!supportsMarkdown(new URL(request.url).pathname)
		) {
			return next();
		}

		if (prefersMarkdown(request.headers.get("accept"))) {
			const { createMarkdownResponse } = await import(
				"@/server/markdown-response.server"
			);
			const response = await createMarkdownResponse(request);
			if (response) return response;
		}

		const result = await next();
		appendVary(result.response.headers, "Accept");
		return result;
	},
);

const csrfMiddleware = createCsrfMiddleware({
	filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
	requestMiddleware: [csrfMiddleware, markdownMiddleware],
}));

function supportsMarkdown(pathname: string) {
	const normalizedPathname =
		pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
	return (
		normalizedPathname === "/" ||
		normalizedPathname === "/documents" ||
		/^\/maps\/[^/]+$/.test(normalizedPathname)
	);
}

function appendVary(headers: Headers, value: string) {
	const values = (headers.get("Vary") ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

	if (
		!values.some(
			(item) => item.toLocaleLowerCase("en") === value.toLocaleLowerCase("en"),
		)
	) {
		values.push(value);
		headers.set("Vary", values.join(", "));
	}
}
