const OBJECT_URL_LIFETIME_MS = 60_000;

export function downloadBrowserBlob(blob: Blob, filename: string) {
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = objectUrl;
	anchor.download = filename;
	anchor.hidden = true;
	document.body.append(anchor);

	try {
		anchor.click();
	} finally {
		anchor.remove();
		window.setTimeout(
			() => URL.revokeObjectURL(objectUrl),
			OBJECT_URL_LIFETIME_MS,
		);
	}
}
