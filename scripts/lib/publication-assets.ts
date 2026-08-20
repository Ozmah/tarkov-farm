import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { parseDocumentCatalog } from "../../src/lib/document-catalog";
import { parseKeyCatalog } from "../../src/lib/key-catalog";
import {
	type MapMasterVariant,
	parseMapMasterManifest,
} from "../../src/lib/map-master-manifest";
import {
	type PublicationAsset,
	type PublicationData,
	parsePublicationData,
} from "../../src/lib/publication-data";

const MAX_SCREENSHOT_PIXELS = 40_000_000;

export async function verifyPublicationAssets(
	input: PublicationData,
	options: {
		projectRoot: string;
		rejectOrphans: boolean;
	},
) {
	const data = parsePublicationData(input);
	const publicRoot = resolve(options.projectRoot, "public");
	const screenshotRoot = resolve(publicRoot, "screenshots");
	const expectedPaths = new Set<string>();

	for (const location of data.locations) {
		for (const screenshot of location.screenshots) {
			await Promise.all([
				verifyVariant(publicRoot, screenshot.full, 1_920),
				verifyVariant(publicRoot, screenshot.preview, 1_000),
			]);
			expectedPaths.add(screenshot.full.path);
			expectedPaths.add(screenshot.preview.path);
		}
	}

	if (options.rejectOrphans) {
		const actualPaths = await listRegularFiles(screenshotRoot, publicRoot);
		const missing = [...expectedPaths].filter((path) => !actualPaths.has(path));
		const orphaned = [...actualPaths].filter(
			(path) => !expectedPaths.has(path),
		);

		if (missing.length > 0 || orphaned.length > 0) {
			throw new Error(
				`Screenshot inventory mismatch: ${missing.length} missing and ${orphaned.length} orphaned file(s)`,
			);
		}
	}

	return { referencedFiles: expectedPaths.size };
}

export async function verifyMapMasterAssets(projectRoot: string) {
	const masterRoot = resolve(projectRoot, "public", "maps", "masters");
	const manifestPath = resolve(masterRoot, "manifest.json");
	await assertRegularContainedFile(manifestPath, masterRoot, "Map manifest");
	const manifest = parseMapMasterManifest(
		JSON.parse(await readFile(manifestPath, "utf8")),
	);

	const expectedFiles = new Set(["manifest.json"]);

	for (const image of manifest.images) {
		await verifyMapImageAsset(masterRoot, image, expectedFiles, "Map master");

		for (const variant of image.variants) {
			await verifyMapImageAsset(
				masterRoot,
				variant,
				expectedFiles,
				"Responsive map variant",
			);
		}
	}

	const actualFiles = await readdir(masterRoot, { withFileTypes: true });

	if (
		actualFiles.some(
			(entry) =>
				!entry.isFile() ||
				entry.isSymbolicLink() ||
				!expectedFiles.has(entry.name),
		) ||
		actualFiles.length !== expectedFiles.size
	) {
		throw new Error("Map master inventory does not match its manifest");
	}

	return {
		mapFiles: manifest.images.length,
		responsiveMapFiles: manifest.images.reduce(
			(count, image) => count + image.variants.length,
			0,
		),
	};
}

async function verifyMapImageAsset(
	masterRoot: string,
	asset: MapMasterVariant,
	expectedFiles: Set<string>,
	label: string,
) {
	if (expectedFiles.has(asset.file)) {
		throw new Error(`Map manifest contains duplicate file ${asset.file}`);
	}

	const imagePath = resolve(masterRoot, asset.file);
	await assertRegularContainedFile(imagePath, masterRoot, label);
	const metadata = await new Bun.Image(imagePath, {
		maxPixels: MAX_SCREENSHOT_PIXELS,
	}).metadata();
	const stats = await lstat(imagePath);

	if (
		metadata.format !== "webp" ||
		metadata.width !== asset.width ||
		metadata.height !== asset.height ||
		stats.size !== asset.size ||
		(await hashFile(imagePath)) !== asset.sha256
	) {
		throw new Error(`${label} does not match manifest: ${asset.file}`);
	}

	expectedFiles.add(asset.file);
}

export async function verifyKeyAssets(projectRoot: string) {
	const keyRoot = resolve(projectRoot, "public", "keys");
	const catalogPath = resolve(projectRoot, "data", "catalog", "keys.json");
	await assertRegularContainedFile(
		catalogPath,
		resolve(projectRoot, "data", "catalog"),
		"Key catalog",
	);
	const catalog = parseKeyCatalog(
		JSON.parse(await readFile(catalogPath, "utf8")),
	);
	const expectedFiles = new Set<string>();

	for (const key of catalog.keys) {
		const file = key.image.path.replace(/^\/keys\//, "");
		if (!file || file.includes("/") || file.includes("\\")) {
			throw new Error(`Key image path is invalid: ${key.image.path}`);
		}
		if (expectedFiles.has(file)) {
			throw new Error(`Key catalog contains duplicate image ${file}`);
		}
		expectedFiles.add(file);

		const imagePath = resolve(keyRoot, file);
		await assertRegularContainedFile(imagePath, keyRoot, "Key image");
		const metadata = await new Bun.Image(imagePath, {
			maxPixels: 128 * 128,
		}).metadata();

		if (
			metadata.format !== "webp" ||
			metadata.width !== key.image.width ||
			metadata.height !== key.image.height ||
			(await hashFile(imagePath)) !== key.image.sha256
		) {
			throw new Error(`Key image does not match catalog: ${file}`);
		}
	}

	const actualFiles = await readdir(keyRoot, { withFileTypes: true });
	if (
		actualFiles.some(
			(entry) =>
				!entry.isFile() ||
				entry.isSymbolicLink() ||
				!expectedFiles.has(entry.name),
		) ||
		actualFiles.length !== expectedFiles.size
	) {
		throw new Error("Key image inventory does not match its catalog");
	}

	return { keyFiles: catalog.keys.length };
}

export async function verifyDocumentAssets(projectRoot: string) {
	const documentRoot = resolve(projectRoot, "public", "documents");
	const catalogPath = resolve(projectRoot, "data", "catalog", "documents.json");
	const catalog = parseDocumentCatalog(
		JSON.parse(await readFile(catalogPath, "utf8")),
	);
	const expectedFiles = new Set<string>();

	for (const document of catalog.documents) {
		const file = document.image.path.replace(/^\/documents\//, "");
		if (!file || file.includes("/") || file.includes("\\")) {
			throw new Error(`Document image path is invalid: ${document.image.path}`);
		}
		if (expectedFiles.has(file)) {
			throw new Error(`Document catalog contains duplicate image ${file}`);
		}
		expectedFiles.add(file);

		const imagePath = resolve(documentRoot, file);
		await assertRegularContainedFile(imagePath, documentRoot, "Document image");
		const metadata = await new Bun.Image(imagePath, {
			maxPixels: 768 * 768,
		}).metadata();

		if (
			metadata.format !== "webp" ||
			metadata.width !== document.image.width ||
			metadata.height !== document.image.height ||
			(await hashFile(imagePath)) !== document.image.sha256
		) {
			throw new Error(`Document image does not match catalog: ${file}`);
		}
	}

	const actualFiles = await readdir(documentRoot, { withFileTypes: true });
	if (
		actualFiles.some(
			(entry) =>
				!entry.isFile() ||
				entry.isSymbolicLink() ||
				!expectedFiles.has(entry.name),
		) ||
		actualFiles.length !== expectedFiles.size
	) {
		throw new Error("Document image inventory does not match its catalog");
	}

	return { documentFiles: catalog.documents.length };
}

async function verifyVariant(
	publicRoot: string,
	asset: PublicationAsset,
	maxDimension: number,
) {
	const absolutePath = resolve(publicRoot, asset.path.replace(/^\/+/, ""));
	await assertRegularContainedFile(
		absolutePath,
		publicRoot,
		"Screenshot asset",
	);
	const metadata = await new Bun.Image(absolutePath, {
		maxPixels: MAX_SCREENSHOT_PIXELS,
	}).metadata();

	if (
		metadata.format !== "webp" ||
		metadata.width !== asset.width ||
		metadata.height !== asset.height ||
		metadata.width > maxDimension ||
		metadata.height > maxDimension
	) {
		throw new Error(`Screenshot metadata does not match ${asset.path}`);
	}

	if ((await hashFile(absolutePath)) !== asset.sha256) {
		throw new Error(`Screenshot hash does not match ${asset.path}`);
	}
}

async function listRegularFiles(directory: string, publicRoot: string) {
	await assertContainedPath(directory, publicRoot, "Screenshot directory");
	const paths = new Set<string>();
	await visit(directory);
	return paths;

	async function visit(currentDirectory: string): Promise<void> {
		for (const entry of await readdir(currentDirectory, {
			withFileTypes: true,
		})) {
			const entryPath = resolve(currentDirectory, entry.name);

			if (entry.isSymbolicLink()) {
				throw new Error(`Screenshot inventory contains symlink ${entry.name}`);
			}

			if (entry.isDirectory()) {
				await visit(entryPath);
				continue;
			}

			if (!entry.isFile()) {
				throw new Error(`Screenshot inventory contains non-file ${entry.name}`);
			}

			const publicPath = `/${relative(publicRoot, entryPath).split(sep).join("/")}`;
			paths.add(publicPath);
		}
	}
}

async function assertRegularContainedFile(
	path: string,
	root: string,
	label: string,
) {
	const stats = await lstat(path);

	if (!stats.isFile() || stats.isSymbolicLink()) {
		throw new Error(`${label} must be a regular file`);
	}

	await assertContainedPath(path, root, label);
}

async function assertContainedPath(path: string, root: string, label: string) {
	const [resolvedPath, resolvedRoot] = await Promise.all([
		realpath(path),
		realpath(root),
	]);

	if (
		resolvedPath !== resolvedRoot &&
		!resolvedPath.startsWith(`${resolvedRoot}${sep}`)
	) {
		throw new Error(`${label} resolves outside its allowed directory`);
	}
}

export async function hashFile(path: string) {
	const hash = createHash("sha256");

	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}

	return hash.digest("hex");
}
