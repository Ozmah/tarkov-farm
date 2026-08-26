import { Zip, ZipPassThrough } from "fflate";
import { describe, expect, it } from "vitest";

import {
	indexLocationContributionZip,
	readLocationContributionZipEntry,
} from "./location-contribution-zip";

const LOCATION_ID = "5b79d7e8-fd87-4c8c-a08a-53791777876b";
const SCREENSHOT_ID = "15bccba8-db3c-4363-8a61-424d77918b03";
const SCREENSHOT_ENTRY = `locations/${LOCATION_ID}/screenshots/${SCREENSHOT_ID}.png`;

describe("location contribution ZIP index", () => {
	it("indexes only contiguous STORE entries emitted by the app writer", async () => {
		const archive = createZip([
			["manifest.json", new TextEncoder().encode("{}\n")],
			[SCREENSHOT_ENTRY, new Uint8Array([1, 2, 3])],
		]);
		const indexed = await indexLocationContributionZip(archive);

		expect(indexed.entries.map(({ name, size }) => ({ name, size }))).toEqual([
			{ name: "manifest.json", size: 3 },
			{ name: SCREENSHOT_ENTRY, size: 3 },
		]);
		expect(
			new Uint8Array(await indexed.entries[1]?.data.arrayBuffer()),
		).toEqual(new Uint8Array([1, 2, 3]));
	});

	it.each([
		["duplicate names", ["manifest.json", "manifest.json"]],
		["traversal", ["manifest.json", "../screenshot.png"]],
		["absolute paths", ["manifest.json", "/screenshot.png"]],
		["backslashes", ["manifest.json", "locations\\screenshot.png"]],
		["case variants", ["manifest.json", "MANIFEST.JSON"]],
	])("rejects %s", async (_label, names) => {
		const archive = createZip(
			names.map((name) => [name, new Uint8Array([1])] as const),
		);

		await expect(indexLocationContributionZip(archive)).rejects.toThrow(
			/duplicate entries|entry name is invalid/,
		);
	});

	it("rejects central/local mismatches and trailing archive comments", async () => {
		const archive = createZip([
			["manifest.json", new TextEncoder().encode("{}\n")],
			[SCREENSHOT_ENTRY, new Uint8Array([1])],
		]);
		const mismatched = new Uint8Array(await archive.arrayBuffer());
		new DataView(mismatched.buffer).setUint16(8, 8, true);

		await expect(
			indexLocationContributionZip(new Blob([mismatched])),
		).rejects.toThrow("unsupported container metadata");
		await expect(
			indexLocationContributionZip(new Blob([mismatched, new Uint8Array([0])])),
		).rejects.toThrow("unsupported container metadata");
	});

	it("supports cancellation before allocating archive metadata", async () => {
		const controller = new AbortController();
		controller.abort();
		const archive = createZip([
			["manifest.json", new TextEncoder().encode("{}\n")],
			[SCREENSHOT_ENTRY, new Uint8Array([1])],
		]);

		await expect(
			indexLocationContributionZip(archive, { signal: controller.signal }),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	it("rejects entry data whose CRC no longer matches", async () => {
		const archive = createZip([
			["manifest.json", new TextEncoder().encode("{}\n")],
			[SCREENSHOT_ENTRY, new Uint8Array([1, 2, 3])],
		]);
		const bytes = new Uint8Array(await archive.arrayBuffer());
		const firstDataOffset = 30 + "manifest.json".length;
		bytes[firstDataOffset] ^= 0xff;
		const indexed = await indexLocationContributionZip(new Blob([bytes]));
		const manifest = indexed.entries[0];
		if (!manifest) throw new Error("Expected a manifest entry");

		await expect(readLocationContributionZipEntry(manifest)).rejects.toThrow(
			"failed CRC validation",
		);
	});
});

function createZip(entries: ReadonlyArray<readonly [string, Uint8Array]>) {
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let output: Blob | undefined;
	const zip = new Zip((error, chunk, final) => {
		if (error) throw error;
		chunks.push(chunk);
		if (final) output = new Blob(chunks);
	});

	for (const [name, bytes] of entries) {
		const entry = new ZipPassThrough(name);
		entry.mtime = new Date(1980, 0, 1);
		entry.os = 0;
		entry.attrs = 0;
		zip.add(entry);
		entry.push(bytes, true);
	}
	zip.end();
	zip.terminate();

	if (!output) throw new Error("Expected a ZIP output");
	return output;
}
