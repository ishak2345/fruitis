# Fruits Island — Chapter One: The First Slice

An atmospheric HTML5 Canvas RPG chapter in the *spirit* of Undertale —
original world, characters, art and music. 100% procedural assets, zero
dependencies, fully offline.

## Run it

**Easiest:** open **`fruits-island.html`** — the whole game in one
self-contained file (works straight from your Downloads folder, no server,
no internet). This is the file distributed in the release package.

Or open `index.html` (modular version, loads the `js/` folder — keep them
together). Rebuild the single file any time with
`node tools/build_single.mjs`.

- **Move** — Arrow keys / WASD
- **Confirm / talk / examine** — Z / E / Enter / Space (or click)
- **Inventory** — I or Tab  • **Pause** — Esc  • **Mute** — M

Best played with sound on. Headphones recommended for the shore.

## What's inside (Chapter One)

Storm. Shipwreck. A sailor looking for **The Forge** washes up on Fruits
Island — a beautiful, fractured place that used to belong to the Fruits
guild and quietly rots underneath. Meet **Vax** (the leader nobody listens
to), reach **Bouga Bouga Village**, earn the shrine token, and close the
chapter — or wander off the path and see how wrong the island can feel.

Areas: South Beach → Jungle Trail → Bouga Bouga Village (+ tavern).
Enemies: Crab Apple, Bramblett, Gull Gazer — every one of them can be
spared, and the island remembers which ones you were kind to.

## Repository layout

```
index.html            entry point (script order documented inside)
js/                   core, audio, sprites, props, items, dialogue,
                      npcs, world, combat, ui, game
docs/STORYLINE.md     LOCKED storyline v1.0 — single source of truth
docs/TECH_NOTES.md    architecture + asset structure + systems
docs/CHANGELOG.md     what changed vs the uploaded prototype
tools/harness.mjs     headless test harness + screenshot dumper
tools/shots/          PNG screenshots from the last harness run
legacy/               the original uploaded prototype (reference only)
sounds/               prototype audio (unused — audio is procedural)
```

## Test it

```bash
node tools/harness.mjs            # 116 assertions, full chapter playthrough
node tools/harness.mjs --shots    # also dump PNGs to tools/shots/
```

No dependencies; pure Node. The harness rasterizes the real game with a
software canvas, so the screenshots are what the game actually renders.

## How to continue (chapter 2+)

The roadmap (locked in `docs/STORYLINE.md`): Sacrification Volcano →
Epilepsy City → Deserted Snows → Monimonia → The Thread LAB → Truthobia.

**Add a new area**
1. Draw an ASCII grid (copy `VILLAGE_GRID` style) or write a `type:'proc'`
   generator like the beach.
2. Register it in `Areas` (`js/world.js`): `build()`, `exits`, `npcs`,
   `encounters`, `ambience`, optional `onEnterFirst`.
3. Wire an exit from an existing area (that's the door in — `exits` entries
   carry the return position and facing).
4. See `docs/TECH_NOTES.md` §4 for prop data and terrain chars.

**Add a new enemy** — one entry in `ENEMY_DEFS` (`js/combat.js`): stats,
check text, flavor lines, ACT options, bullet patterns, drops. Done.

**Add a new item** — one entry in `ITEMS` (`js/items.js`): category
(consumable / key / equip), examine text, heal or stat bonus, and an
`it_*` icon in `js/sprites.js`. It automatically appears in the right
inventory tab and works in battle if `battle: true`.

**Add a new NPC** — `mkNpc({...})` in `NpcDefs` (`js/npcs.js`), a sprite
family `SPR.<name>_{down,up,right}{,_talk}`, a `script()` that branches on
`Game.flags`, and the NPC's id in the area's `npcs` list. Dialogue nodes:
`L(who, text)`, `FN(() => {})`, `GIVE('itemid')`, `FLAG('key')`,
`OBJ('objectiveId', 'text')`, choice nodes with `key`/`ends`.

**Rules of the house**
- `docs/STORYLINE.md` is locked — implementations follow it, never the
  other way around. If something must change, change the doc *first*.
- Run `node tools/harness.mjs` after every change; keep it green.
- The art audit runs in the harness — new string sheets get their row
  lengths and palette chars checked automatically.

## Credits & licensing

All code, pixel art, world text and audio in `js/`, `docs/` and this README
were produced for this project. No Undertale assets, music, characters or
scenes were used or referenced — only its *spirit*: kindness as a mechanic,
small sad monsters, and a world that remembers.
