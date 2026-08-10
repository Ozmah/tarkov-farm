# Tarko-Farm for Season Documents

Why? I just wanted to have everything in the same page, not 10 wiki tabs.

## Development

Copy the required environment configuration before starting the application:

```bash
cp .env.example .env
bun install
bun run dev
```

Startup fails immediately when `APP_ENV` or `DATABASE_PATH` is missing or invalid.

Every server start replaces the local SQLite database from the versioned migration, catalog seed, and `data/publication/locations.json`.

The local data editor is available at [`/editor`](http://localhost:3000/editor). Both the environment and request hostname are checked on the server; it is unavailable outside a loopback environment.

### Generate map masters

Maintainers with access to the ignored source images can regenerate the optimized WebP masters with:

```bash
bun run images:masters
```

The command processes each image in an isolated subprocess and atomically replaces `public/maps/masters` only after every image succeeds.

### Location screenshots

The local editor requires at least one screenshot per location. Uploaded JPEG, PNG, and WebP files are processed offline in isolated Bun subprocesses. The editor writes versioned 1000px and 1920px WebP variants to `public/screenshots/<location-id>`. Original uploads are kept locally under the ignored `assets/screenshots/originals` directory but are not required to run or reconstruct the application.

Verify the versioned publication manifest and its static assets with:

```bash
bun run screenshots:check
```

`bun run release:check` runs the complete code, build, and screenshot validation suite.

### Publication data

Every successful location save or deletion atomically updates `data/publication/locations.json`. To verify or regenerate it manually, stop the development server and run:

```bash
bun run db:manifest
```

Commit `data/publication/locations.json` together with any new files under `public/screenshots`. A fresh clone reconstructs SQLite from those versioned files automatically.

## Railway deployment

The production image rebuilds the database before starting the HTTP server. Configure one service with:

- `APP_ENV=production`
- `DATABASE_PATH=/data/tarkov-season-docs.sqlite`
- A persistent volume mounted at `/data`
- Exactly one replica while SQLite remains the database

Railway supplies `PORT`; the image binds Nitro to `0.0.0.0`. The deployment health check at `/health` verifies that the SQLite catalog is readable. Enable automated volume backups before publishing the service.

## Built with

- [TanStack Start](https://tanstack.com/start/latest)
- [shadcn/ui](https://ui.shadcn.com/)

## Visual attribution

- Most map artwork was created by [re3mr](https://reemr.se/) and is used under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.
- The Lab map was sourced from the [Escape from Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Map:The_Lab).
- The color palette is [Mindful Palette 013](https://alexcristache.gumroad.com/) by [Alex Cristache](https://x.com/AlexCristache).

See [`public/maps/ATTRIBUTION.md`](public/maps/ATTRIBUTION.md) for complete attribution details.

## License

The source code is licensed under the [MIT License](LICENSE).

Map images are excluded from the MIT License and remain subject to their respective source terms and licenses.

Escape from Tarkov and its related trademarks belong to Battlestate Games. This is an unofficial fan project and is not affiliated with or endorsed by Battlestate Games.
