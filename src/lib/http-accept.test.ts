import { describe, expect, it } from "vitest";

import { prefersMarkdown } from "./http-accept";

describe("prefersMarkdown", () => {
	it.each([
		["text/markdown", true],
		["TEXT/MARKDOWN", true],
		["text/markdown; charset=utf-8", true],
		["text/markdown, text/html", true],
		["text/html;q=0.5, text/markdown;q=0.9", true],
		["application/json, text/markdown;q=0.5", true],
		["text/html", false],
		["*/*", false],
		["text/*", false],
		["text/markdown;q=0", false],
		["text/html;q=1, text/markdown;q=0.9", false],
		["text/*;q=1, text/markdown;q=0.9", false],
		["*/*;q=1, text/markdown;q=0.9", false],
		["text/markdown;q=invalid", false],
		["text/markdown;q=2", false],
	] as const)("negotiates %s as %s", (accept, expected) => {
		expect(prefersMarkdown(accept)).toBe(expected);
	});

	it("does not negotiate a missing Accept header", () => {
		expect(prefersMarkdown(null)).toBe(false);
	});
});
