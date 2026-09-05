import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createLocationContributionThumbnail,
	verifyLocationContributionImage,
	verifyLocationContributionImageFile,
} from "./location-contribution-image";

const PNG_BYTES = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	),
);

afterEach(() => vi.unstubAllGlobals());

// Header fixtures: decoding is mocked so malformed metadata can be isolated.
function jpegExif(orientations = [6], littleEndian = true) {
	const segment = new Uint8Array(6 + 8 + 2 + orientations.length * 12 + 4);
	segment.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
	segment.set(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d], 6);
	const tiff = new DataView(segment.buffer, 6);
	tiff.setUint16(2, 42, littleEndian);
	tiff.setUint32(4, 8, littleEndian);
	tiff.setUint16(8, orientations.length, littleEndian);
	orientations.forEach((orientation, index) => {
		const entry = 10 + index * 12;
		tiff.setUint16(entry, 0x0112, littleEndian);
		tiff.setUint16(entry + 2, 3, littleEndian);
		tiff.setUint32(entry + 4, 1, littleEndian);
		tiff.setUint16(entry + 8, orientation, littleEndian);
	});
	return segment;
}

function jpegHeaders(
	exif: Uint8Array[] = [],
	width = 1920,
	height = 1080,
	exifAfterSof = false,
) {
	const sof = [
		0xff,
		0xc0,
		0,
		11,
		8,
		height >> 8,
		height & 0xff,
		width >> 8,
		width & 0xff,
		1,
		1,
		0x11,
		0,
	];
	const app1 = exif.flatMap((segment) => [
		0xff,
		0xe1,
		(segment.length + 2) >> 8,
		(segment.length + 2) & 0xff,
		...segment,
	]);
	return Uint8Array.from([
		0xff,
		0xd8,
		...(exifAfterSof ? [...sof, ...app1] : [...app1, ...sof]),
		0xff,
		0xda,
		0,
		8,
		1,
		1,
		0,
		0,
		63,
		0,
		0xff,
		0xd9,
	]);
}

describe("JPEG EXIF dimensions", () => {
	it.each([true, false])(
		"recognizes all orientations with littleEndian=%s",
		async (littleEndian) => {
			for (let orientation = 1; orientation <= 8; orientation += 1) {
				const dimensions =
					orientation >= 5
						? { width: 1080, height: 1920 }
						: { width: 1920, height: 1080 };
				await expect(
					verifyLocationContributionImage(
						jpegHeaders([jpegExif([orientation], littleEndian)]),
						"image/jpeg",
						{ decode: async () => dimensions },
					),
				).resolves.toEqual(dimensions);
			}
		},
	);

	it("reads EXIF after SOF and defaults absent orientation to unrotated", async () => {
		await expect(
			verifyLocationContributionImage(
				jpegHeaders([jpegExif()], 1920, 1080, true),
				"image/jpeg",
				{ decode: async () => ({ width: 1080, height: 1920 }) },
			),
		).resolves.toEqual({ width: 1080, height: 1920 });
		for (const segments of [[], [jpegExif([])]]) {
			await expect(
				verifyLocationContributionImage(jpegHeaders(segments), "image/jpeg", {
					decode: async () => ({ width: 1920, height: 1080 }),
				}),
			).resolves.toEqual({ width: 1920, height: 1080 });
		}
	});

	it.each([undefined, 1, 4, 6, 8])(
		"rejects decoder dimensions contradicting orientation %s",
		async (orientation) => {
			const close = vi.fn();
			const dimensions =
				orientation && orientation >= 5
					? { width: 1920, height: 1080 }
					: { width: 1080, height: 1920 };
			await expect(
				verifyLocationContributionImage(
					jpegHeaders(
						orientation === undefined ? [] : [jpegExif([orientation])],
					),
					"image/jpeg",
					{ decode: async () => ({ ...dimensions, close }) },
				),
			).rejects.toThrow("dimensions do not match");
			expect(close).toHaveBeenCalledOnce();
		},
	);

	it("rejects malformed and ambiguous EXIF before decoding", async () => {
		const invalidSegments = [
			jpegExif([0]),
			jpegExif([9]),
			jpegExif([6, 8]),
			jpegExif([6, 6]),
			jpegExif().slice(0, -1),
		];
		for (const [offset, value] of [
			[4, 1],
			[6, 0],
			[8, 0],
			[10, 0xff],
			[14, 0xff],
			[18, 4],
			[20, 2],
		] as const) {
			const segment = jpegExif();
			segment[offset] = value;
			invalidSegments.push(segment);
		}
		const decode = vi.fn();
		for (const segments of [
			...invalidSegments.map((segment) => [segment]),
			[jpegExif([6]), jpegExif([8])],
		]) {
			await expect(
				verifyLocationContributionImage(jpegHeaders(segments), "image/jpeg", {
					decode,
				}),
			).rejects.toThrow(/EXIF|truncated/);
		}
		expect(decode).not.toHaveBeenCalled();
	});

	it("enforces raw dimensions and pixel limits before decoding rotated JPEGs", async () => {
		const decode = vi.fn();
		for (const [width, height] of [
			[9000, 1],
			[8000, 8000],
		]) {
			await expect(
				verifyLocationContributionImage(
					jpegHeaders([jpegExif()], width, height),
					"image/jpeg",
					{ decode },
				),
			).rejects.toThrow("dimensions exceed");
		}
		expect(decode).not.toHaveBeenCalled();
	});

	it.each(["bitmap", "image"])(
		"creates an oriented thumbnail via %s and releases resources",
		async (decoder) => {
			const close = vi.fn();
			const removeAttribute = vi.fn();
			vi.stubGlobal(
				"createImageBitmap",
				decoder === "bitmap"
					? vi.fn().mockResolvedValue({ width: 1080, height: 1920, close })
					: undefined,
			);
			vi.stubGlobal(
				"Image",
				class {
					src = "";
					naturalWidth = 1080;
					naturalHeight = 1920;
					decode = async () => undefined;
					removeAttribute = removeAttribute;
				},
			);
			const revokeObjectURL = vi.fn();
			vi.stubGlobal("URL", {
				createObjectURL: () => "blob:jpeg",
				revokeObjectURL,
			});
			const drawImage = vi.fn();
			const blob = new Blob(["thumbnail"]);
			vi.stubGlobal("document", {
				createElement: () => ({
					width: 0,
					height: 0,
					getContext: () => ({ drawImage }),
					toBlob: (callback: BlobCallback) => callback(blob),
				}),
			});
			await expect(
				createLocationContributionThumbnail(
					new File([jpegHeaders([jpegExif()])], "rotated.jpg", {
						type: "image/jpeg",
					}),
					new AbortController().signal,
				),
			).resolves.toBe(blob);
			expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 360, 640);
			if (decoder === "bitmap") expect(close).toHaveBeenCalledOnce();
			else {
				expect(removeAttribute).toHaveBeenCalledWith("src");
				expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:jpeg");
			}
		},
	);
});

describe("contribution thumbnails", () => {
	it("releases fallback image URLs when decoding fails", async () => {
		vi.stubGlobal("createImageBitmap", undefined);
		const removeAttribute = vi.fn();
		const image = {
			src: "",
			decode: vi.fn().mockRejectedValue(new Error("bad image")),
			removeAttribute,
		};
		vi.stubGlobal(
			"Image",
			class {
				src = "";
				decode = image.decode;
				removeAttribute = removeAttribute;
			},
		);
		const revokeObjectURL = vi.fn();
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => "blob:original"),
			revokeObjectURL,
		});
		await expect(
			createLocationContributionThumbnail(
				new File([PNG_BYTES], "original.png", { type: "image/png" }),
				new AbortController().signal,
			),
		).rejects.toThrow("bad image");
		expect(removeAttribute).toHaveBeenCalledWith("src");
		expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:original");
	});

	it("closes contradictory decodes without creating a canvas", async () => {
		const close = vi.fn();
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn().mockResolvedValue({ width: 2, height: 1, close }),
		);
		const createElement = vi.fn();
		vi.stubGlobal("document", { createElement });
		await expect(
			createLocationContributionThumbnail(
				new File([PNG_BYTES], "original.png", { type: "image/png" }),
				new AbortController().signal,
			),
		).rejects.toThrow("dimensions do not match");
		expect(createElement).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledOnce();
	});

	it("rejects spoofed and oversized headers before any browser decode", async () => {
		const decode = vi.fn();
		vi.stubGlobal("createImageBitmap", decode);
		const bytes = PNG_BYTES.slice();
		new DataView(bytes.buffer).setUint32(16, 100_000, false);
		for (const file of [
			new File([PNG_BYTES], "spoof.jpg", { type: "image/jpeg" }),
			new File([bytes], "huge.png", { type: "image/png" }),
		]) {
			await expect(
				createLocationContributionThumbnail(file, new AbortController().signal),
			).rejects.toThrow();
		}
		expect(decode).not.toHaveBeenCalled();
	});

	it("bounds the thumbnail, closes the original, and retains the file bytes", async () => {
		const bytes = PNG_BYTES.slice();
		new DataView(bytes.buffer).setUint32(16, 1920, false);
		new DataView(bytes.buffer).setUint32(20, 1080, false);
		const close = vi.fn();
		const source = { width: 1920, height: 1080, close };
		vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(source));
		const drawImage = vi.fn();
		const blob = new Blob(["thumbnail"], { type: "image/webp" });
		const canvas = {
			width: 0,
			height: 0,
			getContext: () => ({ drawImage }),
			toBlob: (callback: BlobCallback) => callback(blob),
		};
		vi.stubGlobal("document", { createElement: () => canvas });
		const file = new File([bytes], "original.png", { type: "image/png" });
		await expect(
			createLocationContributionThumbnail(file, new AbortController().signal),
		).resolves.toBe(blob);
		expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 640, 360);
		expect(close).toHaveBeenCalledOnce();
		expect(canvas.width).toBe(0);
		expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
	});

	it("serializes decoding, skips cancelled queued files, and recovers after errors", async () => {
		let finish!: (value: {
			width: number;
			height: number;
			close: () => void;
		}) => void;
		const close = vi.fn();
		const decode = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			)
			.mockRejectedValue(new Error("bad decode"));
		vi.stubGlobal("createImageBitmap", decode);
		const file = new File([PNG_BYTES], "original.png", { type: "image/png" });
		const first = new AbortController();
		const second = new AbortController();
		const results = Promise.allSettled([
			createLocationContributionThumbnail(file, first.signal),
			createLocationContributionThumbnail(file, second.signal),
			createLocationContributionThumbnail(file, new AbortController().signal),
		]);
		await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
		first.abort();
		second.abort();
		expect(decode).toHaveBeenCalledOnce();
		finish({ width: 1, height: 1, close });
		expect((await results).map(({ status }) => status)).toEqual([
			"rejected",
			"rejected",
			"rejected",
		]);
		expect(decode).toHaveBeenCalledTimes(2);
		expect(close).toHaveBeenCalledOnce();
	});
});

describe("location contribution image verification", () => {
	it("checks parsed and decoded dimensions and closes the decoder result", async () => {
		const close = vi.fn();

		await expect(
			verifyLocationContributionImage(PNG_BYTES, "image/png", {
				decode: async () => ({ close, height: 1, width: 1 }),
			}),
		).resolves.toEqual({ height: 1, width: 1 });
		expect(close).toHaveBeenCalledOnce();
	});

	it("closes a decoded image when verification is aborted", async () => {
		const controller = new AbortController();
		const close = vi.fn();

		await expect(
			verifyLocationContributionImage(PNG_BYTES, "image/png", {
				decode: async () => {
					controller.abort();
					return { close, height: 1, width: 1 };
				},
				signal: controller.signal,
			}),
		).rejects.toThrow(/abort/i);
		expect(close).toHaveBeenCalledOnce();
	});

	it("rejects signature-only, trailing, and contradictory images", async () => {
		await expect(
			verifyLocationContributionImage(PNG_BYTES.slice(0, 20), "image/png"),
		).rejects.toThrow(/valid PNG|truncated/);
		await expect(
			verifyLocationContributionImage(
				new Uint8Array([...PNG_BYTES, 0]),
				"image/png",
			),
		).rejects.toThrow("ending is invalid");
		await expect(
			verifyLocationContributionImage(PNG_BYTES, "image/png", {
				decode: async () => ({ height: 2, width: 1 }),
			}),
		).rejects.toThrow("dimensions do not match");
	});

	it("rejects dimensions above the pixel limit before decoding", async () => {
		const bytes = PNG_BYTES.slice();
		const view = new DataView(bytes.buffer);
		view.setUint32(16, 8_000, false);
		view.setUint32(20, 8_000, false);
		const decode = vi.fn();

		await expect(
			verifyLocationContributionImage(bytes, "image/png", { decode }),
		).rejects.toThrow("dimensions exceed");
		expect(decode).not.toHaveBeenCalled();
	});

	it("validates replacement files and returns their integrity metadata", async () => {
		const file = new File([PNG_BYTES], "replacement.png", {
			type: "image/png",
		});

		await expect(
			verifyLocationContributionImageFile(file, {
				decode: async () => ({ height: 1, width: 1 }),
			}),
		).resolves.toMatchObject({
			file,
			height: 1,
			mediaType: "image/png",
			width: 1,
		});
		await expect(
			verifyLocationContributionImageFile(
				new File([PNG_BYTES], "spoofed.jpg", { type: "image/jpeg" }),
			),
		).rejects.toThrow("valid JPEG");
		await expect(
			verifyLocationContributionImageFile(
				new File([PNG_BYTES], "unsupported.gif", { type: "image/gif" }),
			),
		).rejects.toThrow("JPEG, PNG, or WebP");
	});
});
