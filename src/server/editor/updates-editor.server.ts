import "@tanstack/react-start/server-only";

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { asc, desc, eq } from "drizzle-orm";
import { parsePublicationData } from "@/lib/publication-data";
import {
	type PublicationUpdate,
	type PublicationUpdatesData,
	parsePublicationUpdatesData,
	serializePublicationUpdatesData,
} from "@/lib/publication-updates";
import {
	compareReleaseSnapshots,
	serializeReleaseSnapshot,
} from "@/lib/release-context";
import type {
	DeleteUpdateInput,
	SaveUpdateInput,
} from "@/lib/update-editor-validation";
import {
	type getDatabase,
	runDatabaseTransaction,
} from "@/server/db/client.server";
import { writePublicationUpdatesManifest } from "@/server/db/publication-manifest";
import { parseStoredSnapshot } from "@/server/db/publication-updates-store";
import {
	buildReleaseSnapshotFromPublication,
	readCurrentReleaseSnapshot,
	readSnapshotCatalog,
} from "@/server/db/release-snapshot";
import { updates } from "@/server/db/schema";
import { assertLocalEditorAccess } from "./access.server";

const publicationPath = resolve(process.cwd(), "data/publication/updates.json");
const projectRoot = resolve(process.cwd());
const execFileAsync = promisify(execFile);
type UpdatesEditorRuntime = { mutationTail: Promise<void> };
const globalUpdatesEditorRuntime = globalThis as typeof globalThis & {
	__tarkovUpdatesEditorRuntime?: UpdatesEditorRuntime;
};
const updatesEditorRuntime =
	globalUpdatesEditorRuntime.__tarkovUpdatesEditorRuntime ?? {
		mutationTail: Promise.resolve(),
	};
globalUpdatesEditorRuntime.__tarkovUpdatesEditorRuntime = updatesEditorRuntime;

export async function readEditorUpdates() {
	assertLocalEditorAccess();
	return runDatabaseTransaction(async (transaction) => {
		const updatesMetadata = await transaction
			.select({
				description: updates.description,
				id: updates.id,
				publishedAt: updates.publishedAt,
				title: updates.title,
			})
			.from(updates)
			.orderBy(desc(updates.publishedAt), asc(updates.id))
			.all();
		const current = await readCurrentReleaseSnapshot(transaction);
		const latest = await transaction
			.select({ snapshot: updates.snapshot })
			.from(updates)
			.orderBy(desc(updates.publishedAt), asc(updates.id))
			.limit(1)
			.get();

		if (latest) {
			return {
				updates: updatesMetadata,
				releaseContext: compareReleaseSnapshots(
					parseStoredSnapshot(latest.snapshot),
					current,
					"latest-update",
				),
			};
		}

		const baselinePublication = await readHeadPublication();
		const catalog = await readSnapshotCatalog(transaction);
		const baseline = buildReleaseSnapshotFromPublication(
			baselinePublication,
			catalog,
		);
		return {
			updates: updatesMetadata,
			releaseContext: compareReleaseSnapshots(baseline, current, "git-head"),
		};
	});
}

export async function saveEditorUpdate(input: SaveUpdateInput) {
	assertLocalEditorAccess({ mutation: true });
	return serializeUpdateMutation(() => saveEditorUpdateLocked(input));
}

export async function deleteEditorUpdate(input: DeleteUpdateInput) {
	assertLocalEditorAccess({ mutation: true });
	return serializeUpdateMutation(() => deleteEditorUpdateLocked(input));
}

async function saveEditorUpdateLocked(input: SaveUpdateInput) {
	const id = input.id ?? randomUUID();

	await withManifestRollback(() =>
		runDatabaseTransaction(async (transaction) => {
			if (input.id) {
				const existing = await transaction
					.select({ id: updates.id, publishedAt: updates.publishedAt })
					.from(updates)
					.where(eq(updates.id, input.id))
					.get();

				if (!existing) {
					throw new Error("The selected update no longer exists");
				}

				await transaction
					.update(updates)
					.set({
						description: input.description,
						title: input.title,
					})
					.where(eq(updates.id, input.id))
					.run();
			} else {
				const latest = await transaction
					.select({ publishedAt: updates.publishedAt })
					.from(updates)
					.orderBy(desc(updates.publishedAt), asc(updates.id))
					.limit(1)
					.get();

				if (latest && input.publishedAt <= latest.publishedAt) {
					throw new Error(
						"A new update must be published after the most recent update",
					);
				}

				const snapshot = await readCurrentReleaseSnapshot(transaction);
				await transaction
					.insert(updates)
					.values({
						description: input.description,
						id,
						publishedAt: input.publishedAt,
						snapshot: serializeReleaseSnapshot(snapshot),
						title: input.title,
					})
					.run();
			}

			const data = await readFullUpdates(transaction);
			await publishUpdatesManifest(data, { id, type: "saved" });
		}),
	);
	return { id };
}

async function deleteEditorUpdateLocked(input: DeleteUpdateInput) {
	await withManifestRollback(() =>
		runDatabaseTransaction(async (transaction) => {
			const existing = await transaction
				.select({ id: updates.id })
				.from(updates)
				.where(eq(updates.id, input.id))
				.get();

			if (!existing) {
				throw new Error("The selected update no longer exists");
			}

			await transaction.delete(updates).where(eq(updates.id, input.id)).run();
			const data = await readFullUpdates(transaction);
			await publishUpdatesManifest(data, {
				id: input.id,
				type: "deleted",
			});
		}),
	);
	return { id: input.id };
}

async function readHeadPublication() {
	try {
		const { stdout } = await execFileAsync(
			"git",
			["show", "HEAD:data/publication/locations.json"],
			{ cwd: projectRoot, maxBuffer: 2 * 1024 * 1024, encoding: "utf8" },
		);
		return parsePublicationData(JSON.parse(stdout));
	} catch (error) {
		throw new Error(
			"Cannot build the first release baseline from Git HEAD. Ensure data/publication/locations.json exists in HEAD and the repository is available, then retry.",
			{ cause: error },
		);
	}
}

type UpdateTransaction = Parameters<
	Parameters<Awaited<ReturnType<typeof getDatabase>>["db"]["transaction"]>[0]
>[0];

async function readFullUpdates(
	transaction: UpdateTransaction,
): Promise<PublicationUpdatesData> {
	const rows = await transaction
		.select()
		.from(updates)
		.orderBy(desc(updates.publishedAt), asc(updates.id))
		.all();

	return parsePublicationUpdatesData({
		formatVersion: 1,
		updates: rows.map(
			({ snapshot, ...metadata }): PublicationUpdate => ({
				...metadata,
				snapshot: parseStoredSnapshot(snapshot),
			}),
		),
	});
}

async function publishUpdatesManifest(
	data: PublicationUpdatesData,
	expectation: {
		id: string;
		type: "deleted" | "saved";
	},
) {
	const updateExists = data.updates.some(({ id }) => id === expectation.id);

	if (
		(expectation.type === "saved" && !updateExists) ||
		(expectation.type === "deleted" && updateExists)
	) {
		throw new Error(
			"Updates publication data does not match the saved database",
		);
	}

	await writePublicationUpdatesManifest(data, publicationPath);

	if (
		(await readFile(publicationPath, "utf8")) !==
		serializePublicationUpdatesData(data)
	) {
		throw new Error(
			"Published updates manifest does not match the saved database",
		);
	}
}

async function serializeUpdateMutation<Result>(
	operation: () => Promise<Result>,
) {
	const previous = updatesEditorRuntime.mutationTail.catch(() => undefined);
	const result = previous.then(operation);
	updatesEditorRuntime.mutationTail = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}

async function withManifestRollback<Result>(operation: () => Promise<Result>) {
	const source = await readFile(publicationPath, "utf8");
	const previous = parsePublicationUpdatesData(JSON.parse(source));

	if (serializePublicationUpdatesData(previous) !== source) {
		throw new Error("Updates publication manifest is not canonical");
	}

	try {
		return await operation();
	} catch (error) {
		try {
			await writePublicationUpdatesManifest(previous, publicationPath);
		} catch (rollbackError) {
			throw new AggregateError(
				[error, rollbackError],
				"Update mutation failed and its publication manifest could not be restored",
			);
		}

		throw error;
	}
}
