export const DEFAULT_LAYOUT_MODE = "standard";
export const LAYOUT_MODE_COOKIE = "tarkov-farm-layout";

export type LayoutMode = "standard" | "vertical";

export function parseLayoutMode(value: unknown): LayoutMode {
	return value === "vertical" ? "vertical" : DEFAULT_LAYOUT_MODE;
}

export function parseLayoutModeInput(input: unknown): {
	layoutMode: LayoutMode;
} {
	if (
		!input ||
		typeof input !== "object" ||
		!("layoutMode" in input) ||
		(input.layoutMode !== "standard" && input.layoutMode !== "vertical")
	) {
		throw new Error("Invalid layout mode");
	}

	return { layoutMode: input.layoutMode };
}

export function readLayoutModeCookie(cookieHeader: string | null): LayoutMode {
	if (!cookieHeader) return DEFAULT_LAYOUT_MODE;

	for (const cookie of cookieHeader.split(/;\s*/)) {
		const separatorIndex = cookie.indexOf("=");

		if (
			separatorIndex !== -1 &&
			cookie.slice(0, separatorIndex) === LAYOUT_MODE_COOKIE
		) {
			return parseLayoutMode(cookie.slice(separatorIndex + 1));
		}
	}

	return DEFAULT_LAYOUT_MODE;
}

export function createLayoutModeCookie(
	layoutMode: LayoutMode,
	secure: boolean,
) {
	return [
		`${LAYOUT_MODE_COOKIE}=${layoutMode}`,
		"Path=/",
		"Max-Age=31536000",
		"HttpOnly",
		"SameSite=Lax",
		...(secure ? ["Secure"] : []),
	].join("; ");
}
