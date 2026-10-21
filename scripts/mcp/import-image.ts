import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";

import {
	type IntakeMediaType,
	MAX_INTAKE_SCREENSHOT_BYTES,
} from "../../src/lib/intake-draft";
import {
	type ContributionImageDecoder,
	MAX_CONTRIBUTION_IMAGE_PIXELS,
	verifyLocationContributionImage,
} from "../../src/lib/location-contribution-image";
import type { VerifiedIntakeImage } from "../../src/server/intake/draft-store";

/** `C:\Users\me\x.png` → `/mnt/c/Users/me/x.png` when running inside WSL/Linux. */
export function toLocalPath(path: string, platform = process.platform) {
	const windows = /^([a-zA-Z]):[\\/](.*)$/.exec(path);
	if (!windows || platform === "win32") return path;
	const [, drive = "", rest = ""] = windows;
	return `/mnt/${drive.toLowerCase()}/${rest.replaceAll("\\", "/")}`;
}

/** A real decode: header metadata alone accepts corrupted pixel data. */
export const decodeWithBun: ContributionImageDecoder = async (blob) => {
	const image = new Bun.Image(new Uint8Array(await blob.arrayBuffer()), {
		maxPixels: MAX_CONTRIBUTION_IMAGE_PIXELS,
		autoOrient: true,
	});
	const { width, height } = await image.metadata();
	await image.resize(1, 1).png().bytes();
	return { width, height };
};

/**
 * Reads one screenshot that must resolve (after symlinks) inside an allowed
 * root, be a regular file within the size limit, and decode as PNG/JPEG/WebP.
 */
export async function importImage(
	path: string,
	allowedRoots: string[],
	decode: ContributionImageDecoder = decodeWithBun,
): Promise<VerifiedIntakeImage> {
	const localPath = toLocalPath(path);
	if (!isAbsolute(localPath))
		throw new Error(`Screenshot path must be absolute: ${path}`);
	const canonical = await realpath(localPath).catch(() => {
		throw new Error(`Screenshot not found: ${path}`);
	});
	const roots = await Promise.all(
		allowedRoots.map((root) => realpath(root).catch(() => undefined)),
	);
	if (!roots.some((root) => root && isInside(root, canonical)))
		throw new Error(
			`Screenshot is outside the allowed import folders: ${path}`,
		);
	const info = await stat(canonical);
	if (
		!info.isFile() ||
		info.size < 1 ||
		info.size > MAX_INTAKE_SCREENSHOT_BYTES
	)
		throw new Error(`Screenshot must be a file up to 20 MiB: ${path}`);

	const bytes = new Uint8Array(await readFile(canonical));
	const mediaType = sniffMediaType(bytes);
	try {
		const { width, height } = await verifyLocationContributionImage(
			bytes,
			mediaType,
			{ decode },
		);
		return { bytes, mediaType, width, height };
	} catch {
		throw new Error(`Screenshot is not a valid image: ${path}`);
	}
}

function isInside(root: string, path: string) {
	const child = relative(root, path);
	return (
		child !== "" &&
		child !== ".." &&
		!child.startsWith(`..${sep}`) &&
		!isAbsolute(child)
	);
}

function sniffMediaType(bytes: Uint8Array): IntakeMediaType {
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e)
		return "image/png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
		return "image/jpeg";
	const header = new TextDecoder().decode(bytes.subarray(0, 12));
	if (header.startsWith("RIFF") && header.endsWith("WEBP")) return "image/webp";
	throw new Error("Screenshots must be PNG, JPEG, or WebP");
}
