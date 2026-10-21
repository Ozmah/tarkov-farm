# Changelog

Tarkov Farm has no version numbers. Each release is a dated tag with a codename (`2026.09.05-tarpon`), listed newest first. New and corrected document locations are announced on [tarkov.farm/updates](https://tarkov.farm/updates); this file covers changes to the app itself and credits the people who contributed locations.

## Unreleased

- Local intake for contributions: an agent reads the messages and screenshots people send, and drafts one location per contribution through a local MCP server. Each draft carries whatever the agent could identify (name, description, map, document, keys) and notes about what it could not. The editor's new **Review drafts** section opens a draft in the regular location form, with its screenshots attached, so only the point and the doubtful details are left. Nothing is published without a human save. See [docs/mcp.md](docs/mcp.md).
- A map can be updated from its single original image (`bun run images:masters --only <file>`) instead of requiring every original. The Lighthouse map was updated this way.
- The SQLite database lives inside the project and is rebuilt from the versioned data on every start, so the deployment no longer needs a persistent volume.
- Runtime and tooling upgrades: Bun 1.4.3, TypeScript 7, TanStack Start and Vite together, React 19.3 and Base UI 1.9, Vitest 5 and jsdom 30, Nitro, and PostHog. Vulnerable transitive dependencies were refreshed, DOMPurify included.
- CI runs on GitHub-hosted runners for pull requests to `master` and `develop`.

## 2026.09.05-tarpon — The one with just fixes

- Contributions can be packed into a ZIP from the public contribution editor and attached to a GitHub issue. The bundle format only adds locations, keeps the screenshots byte for byte, and is checked on import. Oversized bundles are rejected and ZIP timestamps are normalized.
- The local editor imports those ZIPs for review, flags possible duplicates of nearby locations, and saves each accepted location through the regular editor.
- Full-screen screenshots can be browsed with the keyboard (`A`, `D`, `←`, `→`) and by swiping.
- Location markers show when a location needs a key.
- Share buttons for a location's link and its screenshot.
- Screenshots preload only while the viewer is open, instead of on every map.
- ZIP checks are much faster, and image processing can no longer hang forever.
- Screenshot variants get their own hashes, and map variants stay cached longer.
- Fixed: previews could show before their screenshots were checked.
- Fixed: duplicate location detection.
- Fixed: the server-rendered page now shows the static map image before hydration.

## 2026.08.21-marlin — Locations!

- Map markers show a preview of the location's screenshot.
- In vertical mode, maps have their own secondary menu.
- Fixed: the locations button disappeared when switching maps.

### Location contributors

@BiggestNwah

## 2026.08.20-sturgeon — Vertical mode and new menu

- Vertical mode, an experimental layout for vertical monitors. The choice is saved, also behind the production proxy.
- A new map menu to move between maps faster. The map resizes when the location sheet opens.
- Responsive map images, so phones download a size that fits instead of the full master.
- A contribution flow with dedicated GitHub issue templates and guidelines.
- Markdown versions of the pages for agents, a sitemap, documents in the SEO metadata, a logo, and a social image.
- Fixed: a layout shift caused by fonts loading late.
- Fixed: wrong coordinates for a Lighthouse location.

## 2026.08.17-mako — Grouped Locations!

- Nearby locations group into a single marker with a count and a tooltip, so crowded places like Factory and the Crackhouse stay readable. The map zooms in further.
- Tooltips on the zoomed map are no longer blurry.
- Creating a new location in the editor no longer moves the current view.
- A documents page.
- Analytics moved to PostHog in cookieless mode.
- React Doctor cleanup: state resets, effects, map rendering, and an unused dependency.

### Location contributors

@viniciuslfaria, HITRvQ, JustiTryz

## 2026.08.15-bluefin — Changes in UI

- Redesigned home page and public navigation.
- The awkward document filters were replaced by simpler ones that show each document's image.
- Battle Pass document images and metadata on maps and locations.
- One click switches between locations.
- Releases are blocked when the latest update's snapshot is stale.
- Locations show the keys they require, with a link to the wiki.

### Location contributors

@viniciuslfaria, @Hrodvitnir-Fenrir

## 2026.08.12-swordfish — Updates in homepage

- Project updates: a public feed announcing new content.
- Complementary screenshots for some locations, such as the bench in Nakatani.

## 2026.08.11-barracuda

The first release.

- Interactive maps with document locations and their screenshots, with submap navigation.
- Persistent document filters.
- A local-only editor that writes the versioned publication data. The database is rebuilt from it, so Git is the source of truth.
- Required environment variables are validated at startup.
- Railway deployment.
- An About page with attributions and contributor credits.

### Location contributors

@EliHelfen
