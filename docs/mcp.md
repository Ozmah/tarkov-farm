# Local intake MCP

A local stdio MCP server that lets an agent turn contributions (messages and screenshots) into **drafts**. You review each draft in the local editor, place the point, and save it as a regular location. The MCP never publishes anything.

## Setup

Configure your MCP client to launch:

```text
bun /absolute/path/to/tarkov-farm/scripts/mcp/tarkov-farm.ts --import-root /absolute/path/to/screenshots
```

- `--import-root` is required and repeatable. The MCP reads screenshots only from these folders; anything else is rejected, including symlinks that point outside.
- In WSL, Windows paths given by the agent (`C:\Users\...`) are converted to `/mnt/c/Users/...` automatically, but the import root itself must be the `/mnt/c/...` path.
- Drafts are written to `assets/intake/drafts`, which is ignored by Git and excluded from Docker builds.

Example for clients using `mcpServers`:

```json
{
  "mcpServers": {
    "tarkov-farm": {
      "command": "bun",
      "args": [
        "/home/me/dev/tarkov-farm/scripts/mcp/tarkov-farm.ts",
        "--import-root",
        "/mnt/c/Users/me/Desktop/tarkov-screenshots"
      ]
    }
  }
}
```

## Tools

- `catalog_read`: maps and image IDs, documents and keys per map, and published location names.
- `draft_create`: one draft per contribution. Every field is optional; uncertainty goes in `notes`, and `contributor` holds the sender's handle when the message makes it clear. Identical content returns the existing draft. Warns when a screenshot is already published or in another draft.
- `drafts_list` / `draft_get`: read drafts, never image bytes. `drafts_list` with `status: "published"` and `publishedSince: "<last tag date>"` lists the contributors to credit in the next release.

The contributor handle is private to the drafts: the app never shows it.

## Review

Run `bun run dev`, open `/editor` and select **Review drafts**. Opening a draft fills the regular new-location form with its values, notes, and screenshots. Place the point, complete what is missing, and save. Each draft reserves its location ID, so a retried save never creates a second location.

**Local MCP does not mean local inference.** A cloud model sees the images and text you give it.
