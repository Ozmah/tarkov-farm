export async function writeClipboardText(
	text: string,
	unavailableMessage = "Clipboard access is unavailable in this browser.",
) {
	if (!window.isSecureContext || !navigator.clipboard?.writeText) {
		throw new Error(unavailableMessage);
	}

	await navigator.clipboard.writeText(text);
}

export function readClipboardError(error: unknown) {
	return error instanceof Error
		? error.message
		: "The clipboard operation failed. Try again.";
}
