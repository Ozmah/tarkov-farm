# Tarkov Season Documents

An unofficial route-planning reference for farming seasonal documents in Escape from Tarkov.

I just wanted to have everything in the same page, not 10 wiki tabs.

## Development

Copy `.env.example` to `.env`, then run:

```bash
bun install
bun run dev
```

On first run, the project creates the local SQLite database from the versioned migration, catalog seed, and `data/publication/locations.json`. If the database already exists, startup leaves it untouched.

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

After editing locations, stop the development server and replace the versioned publication manifest with the current local data:

```bash
bun run db:manifest
```

Commit `data/publication/locations.json` together with any new files under `public/screenshots`. A fresh clone reconstructs SQLite from those versioned files automatically.

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
