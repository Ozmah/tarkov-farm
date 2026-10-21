import { constants } from "node:fs";
import { type FileHandle, open, realpath, stat } from "node:fs/promises";
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
 * The file is opened once and checked through its descriptor, so swapping
 * the path after validation cannot change what gets read.
 */
export async function importImage(
	path: string,
	allowedRoots: string[],
	decode: ContributionImageDecoder = decodeWithBun,
): Promise<VerifiedIntakeImage> {
	if (!isAbsolute(path))
		throw new Error(`Screenshot path must be absolute: ${path}`);
	const canonical = await realpath(path).catch(() => {
		throw new Error(`Screenshot not found: ${path}`);
	});
	const roots = await Promise.all(
		allowedRoots.map((root) => realpath(root).catch(() => undefined)),
	);
	if (!roots.some((root) => root && isInside(root, canonical)))
		throw new Error(
			`Screenshot is outside the allowed import folders: ${path}`,
		);
	const bytes = await readVerified(canonical, path);
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

/**
 * Opens without following a final symlink and without blocking on FIFOs,
 * then confirms the descriptor is still the file at `canonical` (same
 * dev/ino), which catches any path component swapped since `realpath`.
 */
async function readVerified(canonical: string, path: string) {
	const handle = await open(
		canonical,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
	).catch(() => {
		throw new Error(`Screenshot could not be opened: ${path}`);
	});
	const changed = () =>
		new Error(`Screenshot changed while importing: ${path}`);
	try {
		const info = await handle.stat();
		if (
			!info.isFile() ||
			info.size < 1 ||
			info.size > MAX_INTAKE_SCREENSHOT_BYTES
		)
			throw new Error(`Screenshot must be a file up to 20 MiB: ${path}`);
		const current = await stat(canonical);
		if (current.dev !== info.dev || current.ino !== info.ino) throw changed();
		const bytes = await readExactly(handle, info.size);
		if (!bytes) throw changed();
		return bytes;
	} finally {
		await handle.close();
	}
}

/**
 * Reads exactly the `size` bytes `fstat` reported, with one byte of room to
 * notice growth; `undefined` if the file grew or shrank since.
 */
async function readExactly(handle: FileHandle, size: number) {
	const buffer = new Uint8Array(size + 1);
	let length = 0;
	while (length < buffer.length) {
		const { bytesRead } = await handle.read(
			buffer,
			length,
			buffer.length - length,
			length,
		);
		if (bytesRead === 0) break;
		length += bytesRead;
	}
	return length === size ? buffer.subarray(0, length) : undefined;
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
