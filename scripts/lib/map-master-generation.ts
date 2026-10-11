import { rename, rm } from "node:fs/promises";
import { extname, parse } from "node:path";

export type MapGenerationOptions = {
	responsiveOnly: boolean;
	only?: string;
};

export function isMapOriginalFilename(file: string) {
	return (
		file.length > 0 &&
		!/[/\\\0:*?"<>|]/.test(file) &&
		[".jpeg", ".jpg", ".png", ".webp"].includes(extname(file).toLowerCase())
	);
}

export function parseMapGenerationArguments(
	args: string[],
): MapGenerationOptions {
	if (args.length === 0) return { responsiveOnly: false };
	if (args.length === 1 && args[0] === "--responsive-only") {
		return { responsiveOnly: true };
	}
	if (
		args.length === 2 &&
		args[0] === "--only" &&
		args[1] &&
		isMapOriginalFilename(args[1])
	) {
		return { responsiveOnly: false, only: args[1] };
	}
	throw new Error(
		"Usage: images:masters [--only <original-filename> | --responsive-only]",
	);
}

export function planMapMasterSources(
	sourceFiles: string[],
	existingImages: ReadonlyArray<{ file: string }>,
	only?: string,
) {
	const outputs = new Map<string, string>();
	for (const source of sourceFiles) {
		if (!isMapOriginalFilename(source)) {
			throw new Error(`Invalid map original filename: ${source}`);
		}
		if (/-[0-9]+w(?:\.tmp|-[a-f0-9]{12})$/i.test(parse(source).name)) {
			throw new Error(
				`Map original uses a reserved variant filename: ${source}`,
			);
		}
		const output = `${parse(source).name}.webp`.toLowerCase();
		if (outputs.has(output)) {
			throw new Error(
				`Map originals collide: ${outputs.get(output)} and ${source}`,
			);
		}
		outputs.set(output, source);
	}

	if (only) {
		if (!isMapOriginalFilename(only) || !sourceFiles.includes(only)) {
			throw new Error(`Map original is missing or not a regular file: ${only}`);
		}
		const output = `${parse(only).name}.webp`;
		if (!existingImages.some((image) => image.file === output)) {
			throw new Error(
				`Selective generation requires an existing map: ${output}`,
			);
		}
		return [only];
	}

	const files = new Set(sourceFiles.map((file) => `${parse(file).name}.webp`));
	const missing = existingImages.filter((image) => !files.has(image.file));
	if (missing.length > 0) {
		throw new Error(
			`Missing originals for: ${missing.map((image) => image.file).join(", ")}. Restore the complete source collection or use --only <original-filename>. Published maps were not changed.`,
		);
	}
	if (sourceFiles.length === 0) throw new Error("No map originals found");
	return sourceFiles;
}

// Both directories must be siblings on the same filesystem. The backup path
// is unique to this run; never discard it if restoring the old collection fails.
export async function replaceMapMasterDirectory(
	staged: string,
	output: string,
	backup: string,
) {
	let existingOutputMoved = false;
	try {
		await rename(output, backup);
		existingOutputMoved = true;
	} catch (error) {
		if (!isMissingFileError(error)) throw error;
	}

	try {
		await rename(staged, output);
	} catch (error) {
		if (existingOutputMoved) {
			try {
				await rename(backup, output);
			} catch (restoreError) {
				throw new AggregateError(
					[error, restoreError],
					`Map publication and restoration failed. Previous assets are preserved at ${backup}`,
				);
			}
		}
		throw error;
	}
	if (existingOutputMoved) await rm(backup, { recursive: true, force: true });
}

function isMissingFileError(error: unknown) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
