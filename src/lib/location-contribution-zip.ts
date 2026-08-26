import {
	MAX_CONTRIBUTION_ARCHIVE_BYTES,
	MAX_CONTRIBUTION_ARCHIVE_ENTRIES,
	MAX_CONTRIBUTION_ARCHIVE_METADATA_BYTES,
	MAX_CONTRIBUTION_BUNDLE_BYTES,
	MAX_CONTRIBUTION_MANIFEST_BYTES,
	MAX_CONTRIBUTION_SCREENSHOT_BYTES,
} from "./location-contribution";

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const CENTRAL_HEADER_BYTES = 46;
const LOCAL_HEADER_BYTES = 30;
const DATA_DESCRIPTOR_BYTES = 16;
const WRITER_VERSION = 20;
const WRITER_FLAGS = 0x0008;
const STORE_METHOD = 0;
const WRITER_DOS_TIME = 0;
const WRITER_DOS_DATE = 0x0021;
const MANIFEST_ENTRY = "manifest.json";
const SCREENSHOT_ENTRY_PATTERN =
	/^locations\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/screenshots\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type LocationContributionZipEntry = {
	crc32: number;
	data: Blob;
	name: string;
	size: number;
};

export type LocationContributionZip = {
	entries: readonly LocationContributionZipEntry[];
};

type CentralEntry = {
	crc32: number;
	localHeaderOffset: number;
	name: string;
	nameBytes: Uint8Array;
	size: number;
};

export async function indexLocationContributionZip(
	input: Blob,
	options: { signal?: AbortSignal } = {},
): Promise<LocationContributionZip> {
	if (!(input instanceof Blob)) {
		throw new Error("Expected a contribution ZIP file");
	}
	if (
		input.size < END_OF_CENTRAL_DIRECTORY_BYTES ||
		input.size > MAX_CONTRIBUTION_ARCHIVE_BYTES
	) {
		throw new Error("Contribution ZIP size is invalid");
	}

	const endOffset = input.size - END_OF_CENTRAL_DIRECTORY_BYTES;
	const endBytes = await readRange(
		input,
		endOffset,
		input.size,
		options.signal,
	);
	const end = view(endBytes);
	requireValue(end.getUint32(0, true), END_OF_CENTRAL_DIRECTORY_SIGNATURE);
	requireValue(end.getUint16(4, true), 0);
	requireValue(end.getUint16(6, true), 0);
	const entriesOnDisk = end.getUint16(8, true);
	const entryCount = end.getUint16(10, true);
	if (
		entryCount < 2 ||
		entryCount > MAX_CONTRIBUTION_ARCHIVE_ENTRIES ||
		entriesOnDisk !== entryCount
	) {
		throw new Error("Contribution ZIP entry count is invalid");
	}
	const centralSize = end.getUint32(12, true);
	const centralOffset = end.getUint32(16, true);
	requireValue(end.getUint16(20, true), 0);
	if (
		centralSize > MAX_CONTRIBUTION_ARCHIVE_METADATA_BYTES ||
		centralOffset + centralSize !== endOffset
	) {
		throw new Error("Contribution ZIP central directory is invalid");
	}

	const centralBytes = await readRange(
		input,
		centralOffset,
		endOffset,
		options.signal,
	);
	const centralEntries = parseCentralDirectory(centralBytes, entryCount);
	const entries = await validateLocalEntries(
		input,
		centralEntries,
		centralOffset,
		options.signal,
	);

	return Object.freeze({ entries: Object.freeze(entries) });
}

export async function readLocationContributionZipEntry(
	entry: LocationContributionZipEntry,
	options: { signal?: AbortSignal } = {},
) {
	options.signal?.throwIfAborted();
	const bytes = new Uint8Array(await entry.data.arrayBuffer());
	options.signal?.throwIfAborted();
	if (bytes.byteLength !== entry.size || crc32(bytes) !== entry.crc32) {
		throw new Error(
			`Contribution ZIP entry ${entry.name} failed CRC validation`,
		);
	}
	return bytes;
}

function parseCentralDirectory(bytes: Uint8Array, entryCount: number) {
	const data = view(bytes);
	const entries: CentralEntry[] = [];
	const names = new Set<string>();
	let offset = 0;
	let screenshotBytes = 0;

	for (let index = 0; index < entryCount; index += 1) {
		if (offset + CENTRAL_HEADER_BYTES > bytes.byteLength) {
			throw new Error("Contribution ZIP central directory is truncated");
		}
		requireValue(data.getUint32(offset, true), CENTRAL_HEADER_SIGNATURE);
		requireValue(data.getUint16(offset + 4, true), WRITER_VERSION);
		requireValue(data.getUint16(offset + 6, true), WRITER_VERSION);
		requireValue(data.getUint16(offset + 8, true), WRITER_FLAGS);
		requireValue(data.getUint16(offset + 10, true), STORE_METHOD);
		requireValue(data.getUint16(offset + 12, true), WRITER_DOS_TIME);
		requireValue(data.getUint16(offset + 14, true), WRITER_DOS_DATE);

		const crc32 = data.getUint32(offset + 16, true);
		const compressedSize = data.getUint32(offset + 20, true);
		const size = data.getUint32(offset + 24, true);
		const nameLength = data.getUint16(offset + 28, true);
		const extraLength = data.getUint16(offset + 30, true);
		const commentLength = data.getUint16(offset + 32, true);
		requireValue(data.getUint16(offset + 34, true), 0);
		requireValue(data.getUint16(offset + 36, true), 0);
		requireValue(data.getUint32(offset + 38, true), 0);
		const localHeaderOffset = data.getUint32(offset + 42, true);
		const recordEnd =
			offset + CENTRAL_HEADER_BYTES + nameLength + extraLength + commentLength;

		if (
			nameLength === 0 ||
			extraLength !== 0 ||
			commentLength !== 0 ||
			compressedSize !== size ||
			recordEnd > bytes.byteLength
		) {
			throw new Error("Contribution ZIP entry metadata is invalid");
		}

		const nameBytes = bytes.slice(
			offset + CENTRAL_HEADER_BYTES,
			offset + CENTRAL_HEADER_BYTES + nameLength,
		);
		const name = readEntryName(nameBytes);
		if (names.has(name)) {
			throw new Error("Contribution ZIP contains duplicate entries");
		}
		names.add(name);

		if (name === MANIFEST_ENTRY) {
			if (size === 0 || size > MAX_CONTRIBUTION_MANIFEST_BYTES) {
				throw new Error("Contribution manifest size is invalid");
			}
		} else {
			if (size === 0 || size > MAX_CONTRIBUTION_SCREENSHOT_BYTES) {
				throw new Error("Contribution screenshot size is invalid");
			}
			screenshotBytes += size;
			if (screenshotBytes > MAX_CONTRIBUTION_BUNDLE_BYTES) {
				throw new Error("Contribution screenshot total is too large");
			}
		}

		entries.push({ crc32, localHeaderOffset, name, nameBytes, size });
		offset = recordEnd;
	}

	if (offset !== bytes.byteLength) {
		throw new Error("Contribution ZIP central directory has trailing data");
	}

	return entries;
}

async function validateLocalEntries(
	input: Blob,
	centralEntries: CentralEntry[],
	centralOffset: number,
	signal?: AbortSignal,
) {
	const entries: LocationContributionZipEntry[] = [];
	let expectedOffset = 0;

	for (const central of centralEntries) {
		if (central.localHeaderOffset !== expectedOffset) {
			throw new Error("Contribution ZIP entries are not contiguous");
		}
		const headerEnd =
			expectedOffset + LOCAL_HEADER_BYTES + central.nameBytes.length;
		const headerBytes = await readRange(
			input,
			expectedOffset,
			headerEnd,
			signal,
		);
		const header = view(headerBytes);
		requireValue(header.getUint32(0, true), LOCAL_HEADER_SIGNATURE);
		requireValue(header.getUint16(4, true), WRITER_VERSION);
		requireValue(header.getUint16(6, true), WRITER_FLAGS);
		requireValue(header.getUint16(8, true), STORE_METHOD);
		requireValue(header.getUint16(10, true), WRITER_DOS_TIME);
		requireValue(header.getUint16(12, true), WRITER_DOS_DATE);
		requireValue(header.getUint32(14, true), 0);
		requireValue(header.getUint32(18, true), 0);
		requireValue(header.getUint32(22, true), 0);
		requireValue(header.getUint16(26, true), central.nameBytes.length);
		requireValue(header.getUint16(28, true), 0);
		if (!equalBytes(headerBytes.slice(LOCAL_HEADER_BYTES), central.nameBytes)) {
			throw new Error("Contribution ZIP entry names do not match");
		}

		const dataOffset = headerEnd;
		const descriptorOffset = dataOffset + central.size;
		const descriptorEnd = descriptorOffset + DATA_DESCRIPTOR_BYTES;
		if (descriptorEnd > centralOffset) {
			throw new Error("Contribution ZIP entry data is out of bounds");
		}
		const descriptorBytes = await readRange(
			input,
			descriptorOffset,
			descriptorEnd,
			signal,
		);
		const descriptor = view(descriptorBytes);
		requireValue(descriptor.getUint32(0, true), DATA_DESCRIPTOR_SIGNATURE);
		requireValue(descriptor.getUint32(4, true), central.crc32);
		requireValue(descriptor.getUint32(8, true), central.size);
		requireValue(descriptor.getUint32(12, true), central.size);

		entries.push(
			Object.freeze({
				crc32: central.crc32,
				data: input.slice(dataOffset, descriptorOffset),
				name: central.name,
				size: central.size,
			}),
		);
		expectedOffset = descriptorEnd;
	}

	if (expectedOffset !== centralOffset) {
		throw new Error("Contribution ZIP contains hidden local data");
	}

	return entries;
}

function readEntryName(bytes: Uint8Array) {
	if (bytes.some((byte) => byte < 0x20 || byte > 0x7e)) {
		throw new Error("Contribution ZIP entry name must be ASCII");
	}
	const name = String.fromCharCode(...bytes);
	if (name !== MANIFEST_ENTRY && !SCREENSHOT_ENTRY_PATTERN.test(name)) {
		throw new Error("Contribution ZIP entry name is invalid");
	}
	return name;
}

async function readRange(
	input: Blob,
	start: number,
	end: number,
	signal?: AbortSignal,
) {
	signal?.throwIfAborted();
	if (start < 0 || end < start || end > input.size) {
		throw new Error("Contribution ZIP range is invalid");
	}
	const bytes = new Uint8Array(await input.slice(start, end).arrayBuffer());
	signal?.throwIfAborted();
	if (bytes.byteLength !== end - start) {
		throw new Error("Contribution ZIP is truncated");
	}
	return bytes;
}

function view(bytes: Uint8Array) {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function requireValue(actual: number, expected: number) {
	if (actual !== expected) {
		throw new Error("Contribution ZIP uses unsupported container metadata");
	}
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
	return (
		left.byteLength === right.byteLength &&
		left.every((byte, index) => byte === right[index])
	);
}

function crc32(bytes: Uint8Array) {
	let value = 0xffffffff;
	for (const byte of bytes) {
		value ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
		}
	}
	return (value ^ 0xffffffff) >>> 0;
}
