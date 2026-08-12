import type { Database } from "@tursodatabase/database";
import { asc, count, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";

import {
	type PublicationUpdate,
	type PublicationUpdatesData,
	type PublicUpdate,
	parsePublicationUpdatesData,
} from "../../lib/publication-updates";
import {
	parseReleaseSnapshot,
	serializeReleaseSnapshot,
} from "../../lib/release-context";
import { updates } from "./schema";

export async function importPublicationUpdates(
	client: Database,
	input: PublicationUpdatesData,
) {
	const data = parsePublicationUpdatesData(input);
	const db = drizzle({ client });

	await db.transaction(async (transaction) => {
		const row = await transaction
			.select({ count: count() })
			.from(updates)
			.get();

		if (row?.count !== 0) {
			throw new Error(
				"Publication updates can only be imported into an empty updates table",
			);
		}

		if (data.updates.length === 0) return;

		await transaction
			.insert(updates)
			.values(
				data.updates.map((update) => ({
					...update,
					snapshot: serializeReleaseSnapshot(update.snapshot),
				})),
			)
			.run();
	});

	return { updates: data.updates.length };
}

export async function assertPublicationUpdatesImportCount(
	client: Database,
	expected: number,
) {
	const db = drizzle({ client });
	const row = await db.select({ count: count() }).from(updates).get();

	if (!row || row.count !== expected) {
		throw new Error(
			"Imported update row count does not match the canonical data",
		);
	}
}

export async function readPublicationUpdatesFromDatabase(
	client: Database,
): Promise<PublicationUpdatesData> {
	return parsePublicationUpdatesData({
		formatVersion: 1,
		updates: await readFullUpdatesFromDatabase(client),
	});
}

export async function readFullUpdatesFromDatabase(
	client: Database,
): Promise<PublicationUpdate[]> {
	const db = drizzle({ client });
	const rows = await db
		.select()
		.from(updates)
		.orderBy(desc(updates.publishedAt), asc(updates.id))
		.all();

	return parsePublicationUpdatesData({
		formatVersion: 1,
		updates: rows.map(({ snapshot, ...metadata }) => ({
			...metadata,
			snapshot: parseStoredSnapshot(snapshot),
		})),
	}).updates;
}

export async function readUpdatesFromDatabase(
	client: Database,
): Promise<PublicUpdate[]> {
	const db = drizzle({ client });

	return db
		.select({
			description: updates.description,
			id: updates.id,
			publishedAt: updates.publishedAt,
			title: updates.title,
		})
		.from(updates)
		.orderBy(desc(updates.publishedAt), asc(updates.id))
		.all();
}

export function parseStoredSnapshot(source: string) {
	try {
		return parseReleaseSnapshot(JSON.parse(source));
	} catch (error) {
		throw new Error("Stored update snapshot is invalid", { cause: error });
	}
}
