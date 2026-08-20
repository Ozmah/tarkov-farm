import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
	type MapMasterManifest,
	parseMapMasterManifest,
} from "@/lib/map-master-manifest";

let manifestPromise: Promise<MapMasterManifest> | undefined;

export function readMapMasterManifest() {
	manifestPromise ??= readFile(
		resolve(process.cwd(), "public", "maps", "masters", "manifest.json"),
		"utf8",
	).then((source) => parseMapMasterManifest(JSON.parse(source)));

	return manifestPromise;
}
