import { describe, expect, it, vi } from "vitest";

import { verifyLocationContributionImage } from "./location-contribution-image";

const PNG_BYTES = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	),
);

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
});
