export const MAP_MASTER_MANIFEST_VERSION = 2;
export const MAP_RESPONSIVE_WIDTHS = [1_280, 2_560, 4_096] as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const WEBP_FILE_PATTERN = /^[^/\\]+\.webp$/i;

export type MapImageSource = {
	height: number;
	path: string;
	width: number;
};

export type MapMasterVariant = {
	file: string;
	height: number;
	sha256: string;
	size: number;
	width: number;
};

export type MapMasterImage = MapMasterVariant & {
	original: string;
	passthrough: boolean;
	variants: MapMasterVariant[];
};

export type MapMasterManifest = {
	version: typeof MAP_MASTER_MANIFEST_VERSION;
	settings: {
		backend: string;
		format: "webp";
		maxDimension: number;
		quality: number;
		responsiveWidths: number[];
	};
	images: MapMasterImage[];
};

export function parseMapMasterManifest(input: unknown): MapMasterManifest {
	const manifest = readRecord(input, "Map manifest");
	assertKeys(manifest, ["version", "settings", "images"], "Map manifest");

	if (manifest.version !== MAP_MASTER_MANIFEST_VERSION) {
		throw new Error(`Unsupported map manifest version: ${manifest.version}`);
	}

	const settings = readRecord(manifest.settings, "Map manifest settings");
	assertKeys(
		settings,
		["backend", "format", "maxDimension", "quality", "responsiveWidths"],
		"Map manifest settings",
	);
	const responsiveWidths = readPositiveIntegerArray(
		settings.responsiveWidths,
		"Map responsive widths",
	);
	const backend = settings.backend;
	const maxDimension = settings.maxDimension;
	const quality = settings.quality;

	if (
		typeof backend !== "string" ||
		backend.length === 0 ||
		settings.format !== "webp" ||
		!isPositiveSafeInteger(maxDimension) ||
		typeof quality !== "number" ||
		!Number.isSafeInteger(quality) ||
		quality < 1 ||
		quality > 100
	) {
		throw new Error("Map manifest settings are invalid");
	}
	if (responsiveWidths.some((width) => width > maxDimension)) {
		throw new Error("Map responsive widths exceed the master dimension");
	}

	if (!Array.isArray(manifest.images) || manifest.images.length === 0) {
		throw new Error("Map manifest contains no images");
	}

	const files = new Set<string>();
	const originals = new Set<string>();
	const images = manifest.images.map((value, index) => {
		const image = readRecord(value, `Map manifest image ${index}`);
		assertKeys(
			image,
			[
				"file",
				"height",
				"original",
				"passthrough",
				"sha256",
				"size",
				"variants",
				"width",
			],
			`Map manifest image ${index}`,
		);
		const master = parseAsset(image, `Map manifest image ${index}`);

		if (
			typeof image.original !== "string" ||
			image.original.length === 0 ||
			image.original.includes("/") ||
			image.original.includes("\\") ||
			typeof image.passthrough !== "boolean" ||
			!Array.isArray(image.variants) ||
			master.width > maxDimension ||
			master.height > maxDimension
		) {
			throw new Error(`Map manifest image ${index} metadata is invalid`);
		}

		registerUnique(files, master.file, "map image file");
		registerUnique(originals, image.original, "map image original");
		const variants = image.variants.map((variant, variantIndex) => {
			const parsed = parseAsset(
				readRecord(variant, `Map image ${master.file} variant ${variantIndex}`),
				`Map image ${master.file} variant ${variantIndex}`,
			);
			registerUnique(files, parsed.file, "map image file");

			if (
				parsed.width >= master.width ||
				!parsed.file.endsWith(
					`-${parsed.width}w-${parsed.sha256.slice(0, 12)}.webp`,
				) ||
				parsed.height !==
					Math.max(1, Math.round((master.height * parsed.width) / master.width))
			) {
				throw new Error(
					`Map image ${master.file} variant dimensions are invalid`,
				);
			}

			return parsed;
		});
		const expectedWidths = responsiveWidths.filter(
			(width) => width < master.width,
		);

		if (
			variants.length !== expectedWidths.length ||
			variants.some((variant, variantIndex) => {
				return variant.width !== expectedWidths[variantIndex];
			})
		) {
			throw new Error(`Map image ${master.file} variants are incomplete`);
		}

		return {
			...master,
			original: image.original,
			passthrough: image.passthrough,
			variants,
		};
	});

	return {
		version: MAP_MASTER_MANIFEST_VERSION,
		settings: {
			backend,
			format: "webp",
			maxDimension,
			quality,
			responsiveWidths,
		},
		images,
	};
}

export function getMapImageSources(
	manifest: MapMasterManifest,
	publicPath: string,
): MapImageSource[] {
	const prefix = "/maps/masters/";

	if (!publicPath.startsWith(prefix)) {
		throw new Error(`Invalid map master path: ${publicPath}`);
	}

	const file = publicPath.slice(prefix.length);
	const image = manifest.images.find((candidate) => candidate.file === file);

	if (!image) {
		throw new Error(`Map master is missing from manifest: ${file}`);
	}

	return [
		...image.variants.map((variant) => ({
			height: variant.height,
			path: `${prefix}${variant.file}`,
			width: variant.width,
		})),
		{ height: image.height, path: publicPath, width: image.width },
	];
}

function parseAsset(
	input: Record<string, unknown>,
	label: string,
): MapMasterVariant {
	assertKeys(input, ["file", "height", "sha256", "size", "width"], label, [
		"original",
		"passthrough",
		"variants",
	]);

	if (
		typeof input.file !== "string" ||
		!WEBP_FILE_PATTERN.test(input.file) ||
		input.file === "manifest.json" ||
		!isPositiveSafeInteger(input.height) ||
		!isPositiveSafeInteger(input.width) ||
		!isPositiveSafeInteger(input.size) ||
		typeof input.sha256 !== "string" ||
		!SHA256_PATTERN.test(input.sha256)
	) {
		throw new Error(`${label} asset metadata is invalid`);
	}

	return {
		file: input.file,
		height: input.height,
		sha256: input.sha256,
		size: input.size,
		width: input.width,
	};
}

function readRecord(input: unknown, label: string): Record<string, unknown> {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error(`${label} is invalid`);
	}

	return input as Record<string, unknown>;
}

function assertKeys(
	input: Record<string, unknown>,
	requiredKeys: string[],
	label: string,
	allowedAdditionalKeys: string[] = [],
) {
	const allowedKeys = new Set([...requiredKeys, ...allowedAdditionalKeys]);

	if (
		requiredKeys.some((key) => !(key in input)) ||
		Object.keys(input).some((key) => !allowedKeys.has(key))
	) {
		throw new Error(`${label} fields are invalid`);
	}
}

function readPositiveIntegerArray(input: unknown, label: string) {
	if (!Array.isArray(input) || input.length === 0) {
		throw new Error(`${label} are invalid`);
	}

	const values = input.map((value) => {
		if (!isPositiveSafeInteger(value)) {
			throw new Error(`${label} are invalid`);
		}

		return value;
	});

	if (values.some((value, index) => index > 0 && value <= values[index - 1])) {
		throw new Error(`${label} must be strictly ascending`);
	}

	return values;
}

function registerUnique(values: Set<string>, value: string, label: string) {
	if (values.has(value)) {
		throw new Error(`Duplicate ${label}: ${value}`);
	}

	values.add(value);
}

function isPositiveSafeInteger(input: unknown): input is number {
	return Number.isSafeInteger(input) && Number(input) > 0;
}
