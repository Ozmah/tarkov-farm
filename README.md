# Tarkov Season Documents

An unofficial route-planning reference for farming seasonal documents in Escape from Tarkov.

I just wanted to have everything in the same page, not 10 wiki tabs.

## Development

Copy `.env.example` to `.env`, then run:

```bash
bun install
bun run dev
```

The local data editor is available at [`/editor`](http://localhost:3000/editor). Both the environment and request hostname are checked on the server; it is unavailable outside a loopback environment.

### Generate map masters

Maintainers with access to the ignored source images can regenerate the optimized WebP masters with:

```bash
bun run images:masters
```

The command processes each image in an isolated subprocess and atomically replaces `public/maps/masters` only after every image succeeds.

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
