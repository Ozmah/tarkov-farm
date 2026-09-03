import {
	type LocationContributionScreenshot,
	MAX_CONTRIBUTION_SCREENSHOT_BYTES,
} from "./location-contribution";

export const MAX_CONTRIBUTION_IMAGE_DIMENSION = 8_192;
export const MAX_CONTRIBUTION_IMAGE_PIXELS = 40_000_000;

type ScreenshotMediaType = LocationContributionScreenshot["mediaType"];

type DecodedImage = {
	close?: () => void;
	height: number;
	width: number;
};

export type ContributionImageDecoder = (blob: Blob) => Promise<DecodedImage>;

export type VerifiedContributionImageFile = {
	file: File;
	height: number;
	mediaType: ScreenshotMediaType;
	sourceSha256: string;
	width: number;
};

export async function verifyLocationContributionImageFile(
	file: File,
	options: {
		decode?: ContributionImageDecoder;
		signal?: AbortSignal;
	} = {},
): Promise<VerifiedContributionImageFile> {
	if (
		file.size === 0 ||
		file.size > MAX_CONTRIBUTION_SCREENSHOT_BYTES ||
		!isScreenshotMediaType(file.type)
	) {
		throw new Error(
			"Screenshot must be a JPEG, PNG, or WebP file up to 20 MiB",
		);
	}

	options.signal?.throwIfAborted();
	const bytes = new Uint8Array(await file.arrayBuffer());
	const dimensions = await verifyLocationContributionImage(
		bytes,
		file.type,
		options,
	);

	const sourceSha256 = await sha256Hex(bytes);
	options.signal?.throwIfAborted();

	return {
		file,
		...dimensions,
		mediaType: file.type,
		sourceSha256,
	};
}

export async function verifyLocationContributionImage(
	bytes: Uint8Array,
	mediaType: ScreenshotMediaType,
	options: {
		decode?: ContributionImageDecoder;
		signal?: AbortSignal;
	} = {},
) {
	options.signal?.throwIfAborted();
	const dimensions = inspectImage(bytes, mediaType);
	assertSafeDimensions(dimensions.width, dimensions.height);
	const blob = new Blob([copyToArrayBuffer(bytes)], { type: mediaType });
	const decoded = options.decode
		? await options.decode(blob)
		: await decodeInBrowser(blob);
	try {
		options.signal?.throwIfAborted();
		if (decoded) {
			assertSafeDimensions(decoded.width, decoded.height);
			if (
				decoded.width !== dimensions.width ||
				decoded.height !== dimensions.height
			) {
				throw new Error(
					"Decoded screenshot dimensions do not match its header",
				);
			}
		}
	} finally {
		decoded?.close?.();
	}

	return dimensions;
}

export async function sha256Hex(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		copyToArrayBuffer(bytes),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function inspectImage(bytes: Uint8Array, mediaType: ScreenshotMediaType) {
	if (mediaType === "image/png") return inspectPng(bytes);
	if (mediaType === "image/jpeg") return inspectJpeg(bytes);
	return inspectWebp(bytes);
}

function isScreenshotMediaType(value: string): value is ScreenshotMediaType {
	return (
		value === "image/jpeg" || value === "image/png" || value === "image/webp"
	);
}

function inspectPng(bytes: Uint8Array) {
	const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	if (
		bytes.byteLength < 33 ||
		!matches(bytes, signature) ||
		readUint32(bytes, 8, false) !== 13 ||
		readAscii(bytes, 12, 4) !== "IHDR"
	) {
		throw new Error("Screenshot is not a valid PNG image");
	}

	let offset = 8;
	let ended = false;
	while (offset + 12 <= bytes.byteLength) {
		const length = readUint32(bytes, offset, false);
		const type = readAscii(bytes, offset + 4, 4);
		const nextOffset = offset + 12 + length;
		if (nextOffset > bytes.byteLength) {
			throw new Error("PNG screenshot is truncated");
		}
		if (type === "acTL") {
			throw new Error("Animated screenshots are not supported");
		}
		if (type === "IEND") {
			ended = nextOffset === bytes.byteLength;
			break;
		}
		offset = nextOffset;
	}
	if (!ended) throw new Error("PNG screenshot ending is invalid");

	return {
		height: readUint32(bytes, 20, false),
		width: readUint32(bytes, 16, false),
	};
}

function inspectJpeg(bytes: Uint8Array) {
	if (
		bytes.byteLength < 4 ||
		bytes[0] !== 0xff ||
		bytes[1] !== 0xd8 ||
		bytes[2] !== 0xff ||
		bytes.at(-2) !== 0xff ||
		bytes.at(-1) !== 0xd9
	) {
		throw new Error("Screenshot is not a valid JPEG image");
	}

	let offset = 2;
	while (offset < bytes.byteLength) {
		if (bytes[offset] !== 0xff) {
			throw new Error("JPEG screenshot marker is invalid");
		}
		while (bytes[offset] === 0xff) offset += 1;
		const marker = bytes[offset];
		offset += 1;
		if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
		if (offset + 2 > bytes.byteLength) break;
		const length = readUint16(bytes, offset, false);
		if (length < 2 || offset + length > bytes.byteLength) {
			throw new Error("JPEG screenshot is truncated");
		}
		if (isStartOfFrame(marker)) {
			if (length < 7) throw new Error("JPEG dimensions are invalid");
			return {
				height: readUint16(bytes, offset + 3, false),
				width: readUint16(bytes, offset + 5, false),
			};
		}
		offset += length;
	}

	throw new Error("JPEG screenshot dimensions are missing");
}

function inspectWebp(bytes: Uint8Array) {
	if (
		bytes.byteLength < 20 ||
		readAscii(bytes, 0, 4) !== "RIFF" ||
		readAscii(bytes, 8, 4) !== "WEBP" ||
		readUint32(bytes, 4, true) + 8 !== bytes.byteLength
	) {
		throw new Error("Screenshot is not a valid WebP image");
	}

	let offset = 12;
	while (offset + 8 <= bytes.byteLength) {
		const type = readAscii(bytes, offset, 4);
		const length = readUint32(bytes, offset + 4, true);
		const dataOffset = offset + 8;
		const nextOffset = dataOffset + length + (length % 2);
		if (nextOffset > bytes.byteLength) {
			throw new Error("WebP screenshot is truncated");
		}

		if (type === "VP8X") {
			if (length < 10) throw new Error("WebP dimensions are invalid");
			if ((bytes[dataOffset] ?? 0) & 0x02) {
				throw new Error("Animated screenshots are not supported");
			}
			return {
				height: readUint24(bytes, dataOffset + 7) + 1,
				width: readUint24(bytes, dataOffset + 4) + 1,
			};
		}

		if (type === "VP8L") {
			if (length < 5 || bytes[dataOffset] !== 0x2f) {
				throw new Error("WebP lossless header is invalid");
			}
			const bits = readUint32(bytes, dataOffset + 1, true);
			return {
				height: ((bits >>> 14) & 0x3fff) + 1,
				width: (bits & 0x3fff) + 1,
			};
		}

		if (type === "VP8 ") {
			if (length < 10 || !matches(bytes, [0x9d, 0x01, 0x2a], dataOffset + 3)) {
				throw new Error("WebP lossy header is invalid");
			}
			return {
				height: readUint16(bytes, dataOffset + 8, true) & 0x3fff,
				width: readUint16(bytes, dataOffset + 6, true) & 0x3fff,
			};
		}

		offset = nextOffset;
	}

	throw new Error("WebP screenshot dimensions are missing");
}

function assertSafeDimensions(width: number, height: number) {
	if (
		!Number.isSafeInteger(width) ||
		!Number.isSafeInteger(height) ||
		width < 1 ||
		height < 1 ||
		width > MAX_CONTRIBUTION_IMAGE_DIMENSION ||
		height > MAX_CONTRIBUTION_IMAGE_DIMENSION ||
		width * height > MAX_CONTRIBUTION_IMAGE_PIXELS
	) {
		throw new Error("Screenshot dimensions exceed the contribution limits");
	}
}

async function decodeInBrowser(blob: Blob): Promise<DecodedImage | undefined> {
	if (typeof createImageBitmap === "function") {
		return createImageBitmap(blob);
	}
	if (
		typeof Image === "undefined" ||
		typeof URL.createObjectURL !== "function"
	) {
		return undefined;
	}

	const objectUrl = URL.createObjectURL(blob);
	const image = new Image();
	try {
		image.src = objectUrl;
		await image.decode();
		return { height: image.naturalHeight, width: image.naturalWidth };
	} finally {
		image.src = "";
		URL.revokeObjectURL(objectUrl);
	}
}

function isStartOfFrame(marker: number) {
	return START_OF_FRAME_MARKERS.has(marker);
}

const START_OF_FRAME_MARKERS = new Set([
	0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function matches(bytes: Uint8Array, signature: number[], offset = 0) {
	return signature.every((byte, index) => bytes[offset + index] === byte);
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
	return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian: boolean) {
	if (offset + 2 > bytes.byteLength) throw new Error("Image is truncated");
	return new DataView(
		bytes.buffer,
		bytes.byteOffset,
		bytes.byteLength,
	).getUint16(offset, littleEndian);
}

function readUint24(bytes: Uint8Array, offset: number) {
	if (offset + 3 > bytes.byteLength) throw new Error("Image is truncated");
	return (
		(bytes[offset] ?? 0) |
		((bytes[offset + 1] ?? 0) << 8) |
		((bytes[offset + 2] ?? 0) << 16)
	);
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean) {
	if (offset + 4 > bytes.byteLength) throw new Error("Image is truncated");
	return new DataView(
		bytes.buffer,
		bytes.byteOffset,
		bytes.byteLength,
	).getUint32(offset, littleEndian);
}

function copyToArrayBuffer(bytes: Uint8Array) {
	return bytes.slice().buffer;
}
