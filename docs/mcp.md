# Local intake MCP

A local stdio MCP server that lets an agent turn contributions (messages and screenshots) into **drafts**. You review each draft in the local editor, place the point, and save it as a regular location. The MCP never publishes anything.

## Setup

**pi**: already configured in `.pi/mcp.json`. Trust the project when pi asks, then run `/reload` (or start a new session); `pi mcp list` should show `tarkov-farm: connected`.

Other clients: configure the client to launch the server. The client starts and stops it on its own; there is nothing to run by hand.

```json
{
  "mcpServers": {
    "tarkov-farm": {
      "command": "bun",
      "args": ["/home/me/dev/tarkov-farm/scripts/mcp/tarkov-farm.ts"]
    }
  }
}
```

- Put the game screenshots in `assets/intake/inbox`. It is created on startup and ignored by Git.
- Optional: `--import-root <absolute path>` (repeatable) allows another folder besides the inbox.
- The MCP reads screenshots only from allowed folders; anything else is rejected, including symlinks that point outside.
- Drafts are written to `assets/intake/drafts`, also ignored by Git and excluded from Docker builds.

## Tools

- `catalog_read`: maps and image IDs, documents and keys per map, and published location names.
- `draft_create`: one draft per contribution. Every field is optional; uncertainty goes in `notes`, and `contributor` holds the sender's handle when the message makes it clear. Identical content returns the existing draft. Warns when a screenshot is already published or in another draft.
- `drafts_list` / `draft_get`: read drafts, never image bytes. `drafts_list` with `status: "published"` and `publishedSince: "<last tag date>"` lists the contributors to credit in the next release.

The contributor handle is private to the drafts: the app never shows it.

Agents that load skills from `.agents/skills` get the full workflow from [`tarkov-intake`](../.agents/skills/tarkov-intake/SKILL.md): grouping screenshots per contribution, what to omit, and how to list release credits.

## Review

Run `bun run dev`, open `/editor` and select **Review drafts**. Opening a draft fills the regular new-location form with its values, notes, and screenshots. Place the point, complete what is missing, and save. Each draft reserves its location ID, so a retried save never creates a second location.

**Local MCP does not mean local inference.** A cloud model sees the images and text you give it.
