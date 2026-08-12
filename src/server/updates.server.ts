import "@tanstack/react-start/server-only";

import { getDatabase } from "./db/client.server";
import { readUpdatesFromDatabase } from "./db/publication-updates-store";

export async function readPublicUpdates() {
	const { client } = await getDatabase();
	return readUpdatesFromDatabase(client);
}
