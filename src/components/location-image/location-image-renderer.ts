import logoUrl from "@/assets/tarkov-farm-logo.svg";
import type { MapImageSource } from "@/lib/map-master-manifest";

export const LOCATION_REPLY_IMAGE_WIDTH = 1_440;
export const LOCATION_REPLY_IMAGE_HEIGHT = 720;
export const PUBLIC_LOCATION_IMAGE_WIDTH = 1_440;
export const PUBLIC_LOCATION_IMAGE_HEIGHT = 720;
export const DEFAULT_LOCATION_REPLY_MESSAGE =
	"Thanks for the contribution, will be up soon!";

const MAP_ZOOM = 2;
const MEDIA_X = 32;
const MEDIA_WIDTH = 680;
const MEDIA_GAP = 16;
const REPLY_MEDIA_Y = 148;
const REPLY_MEDIA_HEIGHT = 382;
const PUBLIC_MEDIA_Y = 124;
const PUBLIC_MEDIA_HEIGHT = 564;
const MAX_CACHED_IMAGES = 3;

const palette = {
	background: "#062540",
	border: "#1b4f70",
	foreground: "#faf3e6",
	muted: "#b8c5c9",
	accent: "#eaa007",
};

export type LocationImageInput = {
	documentName: string;
	map: {
		height: number;
		name: string;
		path: string;
		sources: MapImageSource[];
		viewKey: string;
		viewName: string;
		width: number;
	};
	location: {
		markerLabel: string;
		name: string;
		xBasisPoints: number;
		yBasisPoints: number;
	};
	requiredKeyNames: string[];
	screenshot: {
		height: number;
		path: string;
		width: number;
	};
};

export type LocationReplyImageInput = LocationImageInput & {
	message: string;
};

export type MapCrop = {
	height: number;
	markerX: number;
	markerY: number;
	width: number;
	x: number;
	y: number;
};

export type MarkerGeometry = {
	centerX: number;
	centerY: number;
	tipX: number;
	tipY: number;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export async function renderLocationReplyImage(
	canvas: HTMLCanvasElement,
	input: LocationReplyImageInput,
) {
	canvas.width = LOCATION_REPLY_IMAGE_WIDTH;
	canvas.height = LOCATION_REPLY_IMAGE_HEIGHT;

	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("This browser could not create the reply image.");
	}

	const mapSource = selectMapSource(input.map);
	const [, screenshot, map, logo] = await Promise.all([
		loadLocationImageFonts(),
		loadImage(input.screenshot.path),
		loadImage(mapSource.path),
		loadImage(logoUrl, { allowEmbeddedAsset: true }),
	]);

	context.clearRect(
		0,
		0,
		LOCATION_REPLY_IMAGE_WIDTH,
		LOCATION_REPLY_IMAGE_HEIGHT,
	);
	context.fillStyle = palette.background;
	context.fillRect(
		0,
		0,
		LOCATION_REPLY_IMAGE_WIDTH,
		LOCATION_REPLY_IMAGE_HEIGHT,
	);

	drawMetadata(context, input);
	drawContainedMediaPanel(
		context,
		screenshot,
		MEDIA_X,
		REPLY_MEDIA_Y,
		REPLY_MEDIA_HEIGHT,
		palette.border,
	);
	drawMapPanel(
		context,
		map,
		MEDIA_X + MEDIA_WIDTH + MEDIA_GAP,
		REPLY_MEDIA_Y,
		REPLY_MEDIA_HEIGHT,
		input.location,
		palette.border,
	);
	drawFooter(context, input.message, logo);
}

export async function renderPublicLocationImage(
	canvas: HTMLCanvasElement,
	input: LocationImageInput,
) {
	canvas.width = PUBLIC_LOCATION_IMAGE_WIDTH;
	canvas.height = PUBLIC_LOCATION_IMAGE_HEIGHT;

	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("This browser could not create the location image.");
	}

	const mapSource = selectMapSource(input.map);
	const [, screenshot, map, logo] = await Promise.all([
		loadLocationImageFonts(),
		loadImage(input.screenshot.path),
		loadImage(mapSource.path),
		loadImage(logoUrl, { allowEmbeddedAsset: true }),
	]);

	context.clearRect(
		0,
		0,
		PUBLIC_LOCATION_IMAGE_WIDTH,
		PUBLIC_LOCATION_IMAGE_HEIGHT,
	);
	context.fillStyle = "#0a3152";
	context.fillRect(
		0,
		0,
		PUBLIC_LOCATION_IMAGE_WIDTH,
		PUBLIC_LOCATION_IMAGE_HEIGHT,
	);
	context.fillStyle = palette.accent;
	context.fillRect(0, 0, PUBLIC_LOCATION_IMAGE_WIDTH, 6);

	drawPublicMetadata(context, input);
	drawCoveredMediaPanel(
		context,
		screenshot,
		MEDIA_X,
		PUBLIC_MEDIA_Y,
		PUBLIC_MEDIA_HEIGHT,
		palette.accent,
	);
	const markerPosition = drawMapPanel(
		context,
		map,
		MEDIA_X + MEDIA_WIDTH + MEDIA_GAP,
		PUBLIC_MEDIA_Y,
		PUBLIC_MEDIA_HEIGHT,
		input.location,
		palette.accent,
		false,
	);
	drawPublicBrandLockup(
		context,
		logo,
		MEDIA_X + MEDIA_WIDTH + MEDIA_GAP,
		PUBLIC_MEDIA_Y,
		PUBLIC_MEDIA_HEIGHT,
	);
	drawSelectedMarker(
		context,
		markerPosition.x,
		markerPosition.y,
		input.location.markerLabel,
		{
			maxX: MEDIA_X + MEDIA_WIDTH * 2 + MEDIA_GAP,
			maxY: PUBLIC_MEDIA_Y + PUBLIC_MEDIA_HEIGHT,
			minX: MEDIA_X + MEDIA_WIDTH + MEDIA_GAP,
			minY: PUBLIC_MEDIA_Y,
		},
	);
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) {
				resolve(blob);
				return;
			}

			reject(new Error("The browser could not encode the reply image."));
		}, "image/png");
	});
}

export function createLocationReplyImageFileName(
	mapName: string,
	markerLabel: string,
) {
	const mapSlug = mapName
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);
	const markerSlug = markerLabel.toLowerCase().replace(/[^a-z0-9]+/g, "");

	return `tarkov-farm-${mapSlug || "location"}-${markerSlug || "marker"}.png`;
}

export function calculateMapCrop(input: {
	imageHeight: number;
	imageWidth: number;
	markerXBasisPoints: number;
	markerYBasisPoints: number;
	outputHeight: number;
	outputWidth: number;
	zoom: number;
}): MapCrop {
	const outputAspect = input.outputWidth / input.outputHeight;
	let width = input.imageWidth / input.zoom;
	let height = width / outputAspect;

	if (height > input.imageHeight) {
		height = input.imageHeight / input.zoom;
		width = height * outputAspect;
	}
	if (width > input.imageWidth) {
		width = input.imageWidth;
		height = width / outputAspect;
	}
	if (height > input.imageHeight) {
		height = input.imageHeight;
		width = height * outputAspect;
	}

	const markerX = (input.markerXBasisPoints / 10_000) * input.imageWidth;
	const markerY = (input.markerYBasisPoints / 10_000) * input.imageHeight;
	const x = clamp(markerX - width / 2, 0, input.imageWidth - width);
	const y = clamp(markerY - height / 2, 0, input.imageHeight - height);

	return {
		height,
		markerX: ((markerX - x) / width) * input.outputWidth,
		markerY: ((markerY - y) / height) * input.outputHeight,
		width,
		x,
		y,
	};
}

export function calculateMarkerGeometry(input: {
	markerX: number;
	markerY: number;
	maxX: number;
	maxY: number;
	minX: number;
	minY: number;
	radius: number;
}): MarkerGeometry {
	return {
		centerX: clamp(
			input.markerX,
			input.minX + input.radius,
			input.maxX - input.radius,
		),
		centerY: clamp(
			input.markerY - input.radius - 4,
			input.minY + input.radius,
			input.maxY - input.radius,
		),
		tipX: input.markerX,
		tipY: input.markerY,
	};
}

function drawMetadata(
	context: CanvasRenderingContext2D,
	input: LocationReplyImageInput,
) {
	const view = input.map.viewKey === "main" ? "" : ` · ${input.map.viewName}`;
	const mapLine =
		`${input.map.name}${view} · #${input.location.markerLabel}`.toUpperCase();

	drawFittedText(context, {
		color: palette.accent,
		family: headingFont,
		fontSize: 18,
		fontWeight: 700,
		maxWidth: 760,
		minFontSize: 14,
		text: mapLine,
		x: 32,
		y: 48,
	});
	drawFittedText(context, {
		color: palette.foreground,
		family: headingFont,
		fontSize: 38,
		fontWeight: 700,
		maxWidth: 760,
		minFontSize: 24,
		text: input.location.name,
		x: 32,
		y: 103,
	});

	context.fillStyle = palette.border;
	context.fillRect(816, 28, 1, 88);
	drawFittedText(context, {
		color: palette.foreground,
		family: bodyFont,
		fontSize: 23,
		fontWeight: 700,
		maxWidth: 574,
		minFontSize: 17,
		text: input.documentName,
		x: 842,
		y: input.requiredKeyNames.length > 0 ? 61 : 82,
	});

	if (input.requiredKeyNames.length > 0) {
		drawFittedText(context, {
			color: palette.muted,
			family: bodyFont,
			fontSize: 18,
			fontWeight: 500,
			maxWidth: 574,
			minFontSize: 14,
			text: `KEY · ${input.requiredKeyNames.join(" · ")}`,
			x: 842,
			y: 99,
		});
	}
}

function drawPublicMetadata(
	context: CanvasRenderingContext2D,
	input: LocationImageInput,
) {
	const view = input.map.viewKey === "main" ? "" : ` · ${input.map.viewName}`;
	const mapLine =
		`${input.map.name}${view} · #${input.location.markerLabel}`.toUpperCase();

	drawFittedText(context, {
		color: palette.accent,
		family: headingFont,
		fontSize: 17,
		fontWeight: 800,
		maxWidth: 760,
		minFontSize: 13,
		text: mapLine,
		x: 32,
		y: 42,
	});
	drawFittedText(context, {
		color: palette.foreground,
		family: headingFont,
		fontSize: 34,
		fontWeight: 700,
		maxWidth: 760,
		minFontSize: 22,
		text: input.location.name,
		x: 32,
		y: 92,
	});

	context.fillStyle = palette.accent;
	context.fillRect(816, 20, 2, 80);
	drawFittedText(context, {
		color: palette.foreground,
		family: bodyFont,
		fontSize: 22,
		fontWeight: 750,
		maxWidth: 574,
		minFontSize: 16,
		text: input.documentName,
		x: 844,
		y: input.requiredKeyNames.length > 0 ? 54 : 73,
	});

	if (input.requiredKeyNames.length > 0) {
		drawFittedText(context, {
			color: palette.muted,
			family: bodyFont,
			fontSize: 17,
			fontWeight: 600,
			maxWidth: 574,
			minFontSize: 13,
			text: `KEY · ${input.requiredKeyNames.join(" · ")}`,
			x: 844,
			y: 88,
		});
	}
}

function drawContainedMediaPanel(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	height: number,
	borderColor: string,
) {
	context.fillStyle = "#02080d";
	context.fillRect(x, y, MEDIA_WIDTH, height);
	drawContainedImage(context, image, x, y, MEDIA_WIDTH, height);
	strokeMediaPanel(context, x, y, height, borderColor);
}

function drawCoveredMediaPanel(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	height: number,
	borderColor: string,
) {
	drawCoveredImage(context, image, x, y, MEDIA_WIDTH, height);
	strokeMediaPanel(context, x, y, height, borderColor);
}

function drawMapPanel(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	height: number,
	location: LocationImageInput["location"],
	borderColor: string,
	drawMarker = true,
) {
	const crop = calculateMapCrop({
		imageHeight: image.naturalHeight,
		imageWidth: image.naturalWidth,
		markerXBasisPoints: location.xBasisPoints,
		markerYBasisPoints: location.yBasisPoints,
		outputHeight: height,
		outputWidth: MEDIA_WIDTH,
		zoom: MAP_ZOOM,
	});

	context.drawImage(
		image,
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		x,
		y,
		MEDIA_WIDTH,
		height,
	);
	strokeMediaPanel(context, x, y, height, borderColor);
	const markerPosition = { x: x + crop.markerX, y: y + crop.markerY };
	if (drawMarker) {
		drawSelectedMarker(
			context,
			markerPosition.x,
			markerPosition.y,
			location.markerLabel,
			{
				maxX: x + MEDIA_WIDTH,
				maxY: y + height,
				minX: x,
				minY: y,
			},
		);
	}
	return markerPosition;
}

function strokeMediaPanel(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	height: number,
	borderColor: string,
) {
	context.strokeStyle = borderColor;
	context.lineWidth = 2;
	context.strokeRect(x + 1, y + 1, MEDIA_WIDTH - 2, height - 2);
}

function drawSelectedMarker(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	label: string,
	bounds: { maxX: number; maxY: number; minX: number; minY: number },
) {
	const geometry = calculateMarkerGeometry({
		markerX: x,
		markerY: y,
		maxX: bounds.maxX,
		maxY: bounds.maxY,
		minX: bounds.minX,
		minY: bounds.minY,
		radius: 25,
	});

	context.save();
	context.shadowColor = "rgba(0, 0, 0, 0.75)";
	context.shadowBlur = 14;
	context.shadowOffsetY = 5;
	context.fillStyle = palette.accent;
	context.strokeStyle = palette.background;
	context.lineWidth = 4;
	context.beginPath();
	context.moveTo(geometry.centerX - 15, geometry.centerY + 14);
	context.lineTo(geometry.tipX, geometry.tipY);
	context.lineTo(geometry.centerX + 15, geometry.centerY + 14);
	context.closePath();
	context.fill();
	context.stroke();
	context.beginPath();
	context.arc(geometry.centerX, geometry.centerY, 25, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.shadowColor = "transparent";
	context.fillStyle = palette.background;
	context.font = `800 22px ${headingFont}`;
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(label, geometry.centerX, geometry.centerY + 1, 38);
	context.restore();
}

function drawPublicBrandLockup(
	context: CanvasRenderingContext2D,
	logo: HTMLImageElement,
	mapX: number,
	mapY: number,
	mapHeight: number,
) {
	const width = 258;
	const height = 70;
	const x = mapX + MEDIA_WIDTH - width - 16;
	const y = mapY + mapHeight - height - 16;
	context.fillStyle = "rgba(6, 37, 64, 0.94)";
	context.fillRect(x, y, width, height);
	context.fillStyle = palette.accent;
	context.fillRect(x, y, width, 3);
	context.drawImage(logo, x + 14, y + 13, 44, 44);
	context.fillStyle = palette.foreground;
	context.font = `750 23px ${headingFont}`;
	context.textAlign = "left";
	context.textBaseline = "middle";
	context.fillText("tarkov.farm", x + 70, y + height / 2 + 2);
}

function drawFooter(
	context: CanvasRenderingContext2D,
	message: string,
	logo: HTMLImageElement,
) {
	context.fillStyle = palette.border;
	context.fillRect(32, 562, 1_376, 1);

	drawWrappedText(context, {
		color: palette.foreground,
		family: bodyFont,
		fontSize: 28,
		fontWeight: 600,
		lineHeight: 38,
		maxLines: 2,
		maxWidth: 1_030,
		text: message.trim() || DEFAULT_LOCATION_REPLY_MESSAGE,
		x: 32,
		y: 616,
	});

	const logoSize = 36;
	const brandText = "tarkov.farm";
	context.font = `700 22px ${headingFont}`;
	const textWidth = context.measureText(brandText).width;
	const brandX = LOCATION_REPLY_IMAGE_WIDTH - 32 - logoSize - 12 - textWidth;
	const brandY = 643;
	context.drawImage(logo, brandX, brandY, logoSize, logoSize);
	context.fillStyle = palette.foreground;
	context.textAlign = "left";
	context.textBaseline = "middle";
	context.fillText(brandText, brandX + logoSize + 12, brandY + logoSize / 2);
}

function drawContainedImage(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const scale = Math.min(
		width / image.naturalWidth,
		height / image.naturalHeight,
	);
	const drawnWidth = image.naturalWidth * scale;
	const drawnHeight = image.naturalHeight * scale;

	context.drawImage(
		image,
		x + (width - drawnWidth) / 2,
		y + (height - drawnHeight) / 2,
		drawnWidth,
		drawnHeight,
	);
}

function drawCoveredImage(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const scale = Math.max(
		width / image.naturalWidth,
		height / image.naturalHeight,
	);
	const sourceWidth = width / scale;
	const sourceHeight = height / scale;
	const sourceX = (image.naturalWidth - sourceWidth) / 2;
	const sourceY = (image.naturalHeight - sourceHeight) / 2;

	context.drawImage(
		image,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
		x,
		y,
		width,
		height,
	);
}

function drawFittedText(
	context: CanvasRenderingContext2D,
	input: {
		color: string;
		family: string;
		fontSize: number;
		fontWeight: number;
		maxWidth: number;
		minFontSize: number;
		text: string;
		x: number;
		y: number;
	},
) {
	let fontSize = input.fontSize;
	while (fontSize > input.minFontSize) {
		context.font = `${input.fontWeight} ${fontSize}px ${input.family}`;
		if (context.measureText(input.text).width <= input.maxWidth) break;
		fontSize -= 1;
	}

	context.fillStyle = input.color;
	context.font = `${input.fontWeight} ${fontSize}px ${input.family}`;
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	context.fillText(input.text, input.x, input.y, input.maxWidth);
}

function drawWrappedText(
	context: CanvasRenderingContext2D,
	input: {
		color: string;
		family: string;
		fontSize: number;
		fontWeight: number;
		lineHeight: number;
		maxLines: number;
		maxWidth: number;
		text: string;
		x: number;
		y: number;
	},
) {
	context.fillStyle = input.color;
	context.font = `${input.fontWeight} ${input.fontSize}px ${input.family}`;
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	const words = input.text.replace(/\s+/g, " ").trim().split(" ");
	const lines: string[] = [];
	let line = "";

	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word;
		if (context.measureText(candidate).width <= input.maxWidth || !line) {
			line = candidate;
			continue;
		}

		lines.push(line);
		line = word;
		if (lines.length === input.maxLines) break;
	}
	if (line && lines.length < input.maxLines) lines.push(line);

	const consumedWords = lines.join(" ").split(" ").length;
	if (consumedWords < words.length && lines.length > 0) {
		let finalLine = lines.at(-1) ?? "";
		while (
			finalLine.length > 0 &&
			context.measureText(`${finalLine}…`).width > input.maxWidth
		) {
			finalLine = finalLine.slice(0, -1).trimEnd();
		}
		lines[lines.length - 1] = `${finalLine}…`;
	}

	for (const [index, text] of lines.entries()) {
		context.fillText(
			text,
			input.x,
			input.y + index * input.lineHeight,
			input.maxWidth,
		);
	}
}

function selectMapSource(map: LocationImageInput["map"]) {
	const targetWidth = MEDIA_WIDTH * MAP_ZOOM;
	return (
		map.sources.find((source) => source.width >= targetWidth) ??
		map.sources.at(-1) ?? {
			height: map.height,
			path: map.path,
			width: map.width,
		}
	);
}

function loadImage(
	path: string,
	options: { allowEmbeddedAsset?: boolean } = {},
) {
	const url = new URL(path, window.location.href);
	const isEmbeddedAsset = url.protocol === "data:";
	if (
		url.origin !== window.location.origin &&
		!(options.allowEmbeddedAsset && isEmbeddedAsset)
	) {
		return Promise.reject(
			new Error("Reply images must use same-origin assets."),
		);
	}

	const cached = imageCache.get(url.href);
	if (cached) {
		imageCache.delete(url.href);
		imageCache.set(url.href, cached);
		return cached;
	}

	const pending = new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.decoding = "async";
		image.onload = () => resolve(image);
		image.onerror = () =>
			reject(new Error(`Could not load image asset: ${url.pathname}`));
		image.src = url.href;
	}).catch((error) => {
		imageCache.delete(url.href);
		throw error;
	});
	imageCache.set(url.href, pending);
	while (imageCache.size > MAX_CACHED_IMAGES) {
		const oldestKey = imageCache.keys().next().value;
		if (oldestKey === undefined) break;
		imageCache.delete(oldestKey);
	}
	return pending;
}

async function loadLocationImageFonts() {
	if (!document.fonts) return;
	await Promise.allSettled([
		document.fonts.load('700 38px "JetBrains Mono Variable"'),
		document.fonts.load('700 23px "Manrope Variable"'),
		document.fonts.load('600 28px "Manrope Variable"'),
	]);
}

const headingFont = '"JetBrains Mono Variable", Consolas, monospace';
const bodyFont = '"Manrope Variable", system-ui, sans-serif';

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}
