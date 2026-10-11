# Tarkov-Farm for Season Documents

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Ozmah/tarkov-farm?utm_source=oss&utm_medium=github&utm_campaign=Ozmah%2Ftarkov-farm&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

Why? I just wanted to have everything on the same page, not 10 wiki tabs.

## Development

Requires the Bun version pinned in `package.json` and Node.js 24.15+ within the 24.x release line for tests.

```bash
cp .env.example .env
bun install
bun run dev
```

Open the local editor at [`/editor`](http://localhost:3000/editor).

SQLite is rebuilt on every server start from the versioned data. Commit changes under `data/publication` together with new files under `public/screenshots`.

## Validation

- `bun run glados`: lint, formatting, types, and build.
- `bun run shodan`: tests and static assets.
- `bun run release:check`: both.

CI runs on pull requests targeting `master` or `develop`.

## Images

Place map originals in `assets/maps/originals`. Update one existing map with:

```bash
bun run images:masters --only re3mrLighthouseVERT.png
```

- `bun run images:masters`: regenerate all maps; requires all originals.
- `bun run images:responsive`: regenerate variants from the tracked masters.
- `bun run documents:images`: generate document images from `assets/documents/originals/<document-id>.png`.

## Deployment

On Railway, use `Dockerfile` and `railway.toml` with `APP_ENV=production` and no persistent volume. Health check: `/health`. The editor is local-only.

Optional analytics: set `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` at build time (Docker build arguments).

## Built with

- [TanStack Start](https://tanstack.com/start/latest)
- [shadcn/ui](https://ui.shadcn.com/)

## Attribution and license

- Most maps: [re3mr](https://reemr.se/), [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- The Lab map: [Escape from Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Map:The_Lab).
- Color palette: [Mindful Palette 013](https://alexcristache.gumroad.com/) by [Alex Cristache](https://x.com/AlexCristache).

See [`public/maps/ATTRIBUTION.md`](public/maps/ATTRIBUTION.md) for complete attribution details.

Key names and icon references: [Escape from Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Keys_%26_Intel). Icons belong to their respective rights holders and are excluded from the MIT license.

The source code is licensed under the [MIT License](LICENSE).

Map images are excluded from the MIT License and remain subject to their respective source terms and licenses.

Unofficial fan project, not affiliated with or endorsed by Battlestate Games. Escape from Tarkov and its trademarks belong to Battlestate Games.
