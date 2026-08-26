import { strToU8, Zip, ZipPassThrough } from "fflate";

import {
	MAX_CONTRIBUTION_ARCHIVE_BYTES,
	MAX_CONTRIBUTION_MANIFEST_BYTES,
	serializeLocationContributionBundle,
} from "./location-contribution";
import {
	sha256Hex,
	verifyLocationContributionImage,
} from "./location-contribution-image";
import {
	getLocationContributionWorkspaceBundle,
	type LocationContributionWorkspace,
} from "./location-contribution-workspace";

const MANIFEST_ENTRY = "manifest.json";
const ZIP_MEDIA_TYPE = "application/zip";
const ZIP_MTIME = new Date(1980, 0, 1, 0, 0, 0);
const OBJECT_URL_LIFETIME_MS = 60_000;

export type LocationContributionArchive = {
	blob: Blob;
	filename: string;
};

export async function createLocationContributionArchive(
	workspace: LocationContributionWorkspace,
): Promise<LocationContributionArchive> {
	const bundle = getLocationContributionWorkspaceBundle(workspace);
	await verifyWorkspaceFiles(workspace, bundle);
	const manifestBytes = strToU8(serializeLocationContributionBundle(bundle));
	if (manifestBytes.byteLength > MAX_CONTRIBUTION_MANIFEST_BYTES) {
		throw new Error("Contribution manifest is too large");
	}

	const blob = await createZip(async (zip) => {
		pushBytes(zip, MANIFEST_ENTRY, manifestBytes);

		for (const location of workspace.locations) {
			for (const screenshot of location.screenshots) {
				await pushFile(zip, screenshot.entry, screenshot.file);
			}
		}
	});
	if (blob.size > MAX_CONTRIBUTION_ARCHIVE_BYTES) {
		throw new Error("Contribution archive is too large");
	}

	return {
		blob,
		filename: `tarkov-farm-location-contribution-${bundle.bundleId}.zip`,
	};
}

export function downloadLocationContributionArchive(
	archive: LocationContributionArchive,
) {
	const objectUrl = URL.createObjectURL(archive.blob);
	const anchor = document.createElement("a");
	anchor.href = objectUrl;
	anchor.download = archive.filename;
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

async function verifyWorkspaceFiles(
	workspace: LocationContributionWorkspace,
	bundle: ReturnType<typeof getLocationContributionWorkspaceBundle>,
) {
	for (const [locationIndex, location] of workspace.locations.entries()) {
		const manifestLocation = bundle.locations[locationIndex];

		if (!manifestLocation || manifestLocation.id !== location.id) {
			throw new Error("Contribution workspace location order is invalid");
		}

		for (const [
			screenshotIndex,
			screenshot,
		] of location.screenshots.entries()) {
			const manifestScreenshot = manifestLocation.screenshots[screenshotIndex];
			const { file } = screenshot;

			if (
				!manifestScreenshot ||
				manifestScreenshot.id !== screenshot.id ||
				manifestScreenshot.entry !== screenshot.entry
			) {
				throw new Error("Contribution workspace screenshot order is invalid");
			}

			if (!(file instanceof File)) {
				throw new Error("A contribution screenshot is no longer available");
			}

			if (
				file.size !== manifestScreenshot.byteLength ||
				file.type !== manifestScreenshot.mediaType
			) {
				throw new Error("A contribution screenshot changed before export");
			}

			const bytes = new Uint8Array(await file.arrayBuffer());
			try {
				await verifyLocationContributionImage(
					bytes,
					manifestScreenshot.mediaType,
				);
			} catch {
				throw new Error(
					"A screenshot's contents do not match its JPEG, PNG, or WebP type",
				);
			}

			if ((await sha256Hex(bytes)) !== manifestScreenshot.sourceSha256) {
				throw new Error(
					"A contribution screenshot failed integrity verification",
				);
			}
		}
	}
}

async function createZip(addEntries: (zip: Zip) => Promise<void>) {
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let archiveError: Error | undefined;
	let resolveArchive: ((blob: Blob) => void) | undefined;
	let rejectArchive: ((error: Error) => void) | undefined;
	const archive = new Promise<Blob>((resolve, reject) => {
		resolveArchive = resolve;
		rejectArchive = reject;
	});
	const zip = new Zip((error, chunk, final) => {
		if (error) {
			archiveError = error;
			rejectArchive?.(error);
			return;
		}

		chunks.push(chunk);
		if (final) resolveArchive?.(new Blob(chunks, { type: ZIP_MEDIA_TYPE }));
	});

	try {
		await addEntries(zip);
		if (archiveError) throw archiveError;
		zip.end();
		return await archive;
	} catch (error) {
		throw toError(error);
	} finally {
		zip.terminate();
	}
}

function pushBytes(zip: Zip, path: string, bytes: Uint8Array) {
	const entry = createEntry(path);
	zip.add(entry);
	entry.push(bytes, true);
}

async function pushFile(zip: Zip, path: string, file: File) {
	const entry = createEntry(path);
	zip.add(entry);
	const reader = file.stream().getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			entry.push(value);
		}
		entry.push(new Uint8Array(0), true);
	} finally {
		reader.releaseLock();
	}
}

function createEntry(path: string) {
	const entry = new ZipPassThrough(path);
	entry.mtime = ZIP_MTIME;
	entry.os = 0;
	entry.attrs = 0;
	return entry;
}

function toError(error: unknown) {
	return error instanceof Error
		? error
		: new Error("The contribution ZIP could not be created");
}
