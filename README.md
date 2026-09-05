# Tarkov-Farm for Season Documents

Why? I just wanted to have everything on the same page, not 10 wiki tabs.

## Development

Copy the required environment configuration before starting the application:

```bash
cp .env.example .env
bun install
bun run dev
```

Startup fails immediately when `APP_ENV` or `DATABASE_PATH` is missing or invalid.

Every server start replaces the local SQLite database from the versioned migrations, catalog seed, `data/publication/locations.json`, and `data/publication/updates.json`.

The local data editor is available at [`/editor`](http://localhost:3000/editor). Both the environment and request hostname are checked on the server, just works on local.

### Generate map masters

Maintainers with access to the ignored source images can regenerate the optimized WebP masters and their responsive variants with:

```bash
bun run images:masters
```

The command processes each image in an isolated subprocess and replaces `public/maps/masters` only after every image succeeds. To regenerate only the responsive variants from the tracked masters, without the ignored originals, run:

```bash
bun run images:responsive
```

### Document images

Place one source PNG per document in the ignored `assets/documents/originals` directory. Each filename must match its document ID in `data/catalog/documents.json`. Generate content-addressed WebP assets and refresh their catalog metadata with:

```bash
bun run documents:images
```

The command rejects missing or unexpected sources and publishes to `public/documents` only after all nine images are valid.

### Location screenshots

The local editor requires at least one screenshot per location. Uploaded JPEG, PNG, and WebP files are processed offline in isolated Bun subprocesses. The editor writes content-addressed 1000px and 1920px WebP variants to `public/screenshots/<location-id>`, using each generated file's SHA-256 in its name. Historical source-addressed filenames remain supported. Original uploads are kept locally under the ignored `assets/screenshots/originals` directory but are not required to run or reconstruct the application.

Verify the versioned publication manifest and its static assets with:

```bash
bun run screenshots:check
```

`bun run release:check` runs the complete code, build, and static-asset validation suite.

### Publication data

Every successful location or project-update mutation refreshes its corresponding manifest under `data/publication`. To verify or regenerate both manifests manually, stop the development server and run:

```bash
bun run db:manifest
```

Commit each changed publication manifest together with any new files under `public/screenshots`. A fresh clone reconstructs SQLite from those versioned files automatically.

Project updates are public announcements, not a requirement for every location correction. Each update captures a canonical snapshot of the active public locations and screenshots. Release context therefore represents changes since the newest announcement, even when location-only releases happened afterward. When publishing an update, verify that its snapshot covers the current publication:

```bash
bun run updates:snapshot:check
```

Do not synchronize an older update merely to release an unannounced location correction. Before the first update, release context compares the current database with `data/publication/locations.json` from Git `HEAD`.

Application date logic uses Temporal with `America/Mexico_City` as its display and authoring timezone. Publication timestamps remain canonical UTC instants in SQLite and JSON. Native `Date` is reserved for external library boundaries that explicitly require it.

## Deployment

The production image rebuilds the database before starting the HTTP server. Configure one service with:

- `APP_ENV=production`
- `DATABASE_PATH=/data/tarkov-season-docs.sqlite`
- A persistent volume mounted at `/data`

## Analytics

Production builds initialize PostHog when `VITE_POSTHOG_KEY` is configured. Set `VITE_POSTHOG_HOST` to the ingest host for the project. Docker builds require both values as build arguments because Vite embeds them at compile time.

The client records pathname-only pageviews, layout mode usage and changes, map selections, document filter changes, location views, explicit screenshot opens, and application errors. Acquisition is limited to `utm_source`, `utm_medium`, `utm_campaign`, and the referring domain; unsafe campaign values, search keywords, full referrers, query strings, and URL fragments are discarded. Cookieless mode avoids cookies and browser storage, and application-level Do Not Track handling disables analytics entirely. The application does not show a consent banner. Web Vitals are sampled at 20%. Autocapture, pageleave events, session replay, surveys, heatmaps, feature flags, and person profiles are disabled.

## Built with

- [TanStack Start](https://tanstack.com/start/latest)
- [shadcn/ui](https://ui.shadcn.com/)

## Visual attribution

- Most map artwork was created by [re3mr](https://reemr.se/) and is used under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.
- The Lab map was sourced from the [Escape from Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Map:The_Lab).
- The color palette is [Mindful Palette 013](https://alexcristache.gumroad.com/) by [Alex Cristache](https://x.com/AlexCristache).

See [`public/maps/ATTRIBUTION.md`](public/maps/ATTRIBUTION.md) for complete attribution details.

Key names and icon source references are derived from the [Escape from Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Keys_%26_Intel). The icons remain property of their respective rights holders and are not covered by this repository's MIT license.

## License

The source code is licensed under the [MIT License](LICENSE).

Map images are excluded from the MIT License and remain subject to their respective source terms and licenses.

Escape from Tarkov and its related trademarks belong to Battlestate Games. This is an unofficial fan project and is not affiliated with or endorsed by Battlestate Games.
