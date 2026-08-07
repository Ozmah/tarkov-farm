import "@tanstack/react-start/server-only";

import { asc, eq } from "drizzle-orm";

import { getDatabase } from "./db/client.server";
import { documentMaps, documents, maps } from "./db/schema";

export async function readCatalog() {
	const { db } = await getDatabase();

	return {
		maps: await db
			.select({ id: maps.id, name: maps.name })
			.from(maps)
			.where(eq(maps.isActive, true))
			.orderBy(asc(maps.name))
			.all(),
		documents: await db
			.select({
				id: documents.id,
				name: documents.name,
				isFilterable: documents.isFilterable,
				isWildcard: documents.isWildcard,
				acquisitionType: documents.acquisitionType,
				acquisitionSource: documents.acquisitionSource,
			})
			.from(documents)
			.where(eq(documents.isActive, true))
			.orderBy(asc(documents.name))
			.all(),
		documentMaps: await db
			.select({
				documentId: documentMaps.documentId,
				mapId: documentMaps.mapId,
			})
			.from(documentMaps)
			.all(),
	};
}
