# Technical Notes — Fruits Island, Chapter One

Architecture, data flow, and the exact structure of the rebuilt assets.
Read this before touching anything; it is written to be *sufficient* —
each section ends with what you need to extend that system.

## 1. Loading order & runtime shape

`index.html` loads classic scripts in this order (order matters — they share
top-level `const`s in one global scope):

```
core      constants, utils, hash2, 5x7 font, drawText/textWidth/wrapText, panels
audio     AudioSys (procedural WebAudio, fully guarded)
sprites   PAL palette, sheet() string-art builder, all characters/portraits/icons
props     every environment painter + buildPropSprites()
items     ITEMS db + Inventory runtime
dialogue  SPEAKERS registry + Dialogue engine + node helpers L/FN/GIVE/FLAG/OBJ
npcs      mkNpc factory + NpcDefs (all dialogue scripts, story-flag aware)
world     paintTile, buildGridArea, beach terrain gen, Areas registry, World
combat    ENEMY_DEFS, Battle state machine (menus, timing bar, bullet patterns)
ui        HUD, dialogue box, inventory screen, pause, title, Intro, chapter card
game      Game/Player/Camera/Weather/SaveSys, input, update/render loop, boot
```

Resolution is 384×216 (16:9, crisp `image-rendering: pixelated`, auto-scaled
to the window). Everything runs offline — zero network fetches after load.

`boot()` runs when DOMContentLoaded fires: builds sprites → props → vignette →
attaches input listeners → starts the rAF loop → exposes `window.__game`
(test hooks: `step(dt,n)`, `act(a)`, `key(code,down)`, `loadArea`, `teleport`,
plus direct references to every module object).

## 2. Game modes (Game.mode)

`title → intro → play ⇄ dialogue / inventory / pause / battle → epilogue → play`

- `play` is the only mode that moves the player, checks exits, rolls
  encounters and updates NPCs. All other modes freeze the world.
- `dialogue` is entered by `tryInteract()` (or scripted); `Dialogue.start(nodes,
  onEnd)` drives it. ESC is intentionally *not* a skip in dialogue.
- `battle` is entered only through `Game.startBattle()` which fades out,
  calls `Battle.start(enemyId)`, then fades in. All exits go through
  `Game.exitBattle(result, drop)` so the world/music/inventory state is
  restored in one place.
- `epilogue` shows the chapter card; confirm (after 1s) returns to `play`.

## 3. Sprite structure (sailor, Vax, villagers)

All character art is **string sheets**: arrays of equal-length strings, one
char per pixel, mapped through the global `PAL` (or a per-sheet override).
`sheet(rows, pal)` rasterizes once at boot into an offscreen canvas.

```
const P_DOWN0 = [
  '.....hhh........',
  ...16 chars × 20 rows
];
SPR.p_down0 = sheet(P_DOWN0);
```

### Sailor (16×20)
- Frames: `p_{down,up,right}{0,1,2,3}` — 0/2 are **contact** frames (legs
  apart, opposite), 1/3 are **pass** frames (legs together, body 1px up).
  LEFT is drawn by mirroring the RIGHT frames with `ctx.scale(-1,1)` at
  draw time — the walk-cycle bug in the prototype came from asymmetric leg
  pixels; here frames 0 and 2 are pixel-mirrors of each other's leg block,
  which the harness asserts (legs of frame 0 ≠ frame 2, frame 1 == frame 3).
- Idle: `p_down_idle` (1px breathing dip via draw offset), `p_down_blink`
  (eyelid row), same for right; up reuses idle without blink frames.
- `p_lying` — horizontal sprite used while `Game.waking > 0`.
- Walk speed 70 px/s; frame rate `floor(animT * 7) % 4`; footstep SFX every
  0.28s with surface-aware timbre (sand/wood/grass).

### Vax (16×22) — LOCKED DESIGN
```
rows 0-5    messy dark-brown hair ('d'/'D'), stray strands
row 6-8     face ('x' pale), left eye grey ('Q' col 6), right eye RED ('R' col 9)
rows 9-10   neck + jacket collar ('j' black)
rows 11-12  thick red scarf wrap ('c'/'C')
rows 13-15  scarf TAIL hanging over chest (cols 6-7) + charcoal shirt ('n')
rows 16-18  black jacket sleeves + baggy light-grey trousers ('v'/'V')
rows 19-21  trousers + red-and-white sneakers ('z' red / 'w' white sole)
```
- `v_{down,up,right}{0,1,2}`: 0 = base, 1 = weight shift (torso 1px right,
  scarf tail swings 1px), 2 = hair-flick frame. The right eye never blinks.
- `_talk` variants mutate the mouth row (2px opening) while speaking.
- Idle cycle in `drawNpc`: alternate base/shift every 1.8s, hair-flick frame
  shown briefly every ~14s. He faces the player within 90px (`mkNpc.face`)
  and locks facing during dialogue.

### Villagers
`SPR.{ali,maj,levi,nad,ruta}_{down,up,right}{,_talk}` — same string-sheet
system, 16×20, distinct silhouettes and palettes (Ali warm tan + wine dress,
Majhool stone-robe, Levi child-sized, Nadia/Ruta villager greens/blues).

### Enemies & icons
`crabApple` (16×12), `bramblett` (18×20), `gullgazer` (20×14) painters;
item icons `it_*` (12×12); UI icons `soul0/1`, `bubble`, `diamond`;
portraits `por_*` (28×28) for the dialogue box.

### Art audit
`sheet()` stores `__rows`/`__pal` on the canvas; the harness re-checks every
sheet for row-length equality and unknown palette chars at test time. When
you add art, run the harness — it catches typos the browser silently ignores.

## 4. Props & terrain

- `js/props.js` — one painter function per prop (~60 sprites), all drawn at
  boot into `SPR` via `buildPropSprites()`. Shared outline color `#161a2b`,
  shared light direction (top-left), shared palette family.
- Props are data: `{ spr, x, y, col:{dx,dy,w,h}, flat?, flip?, sway?, dead?,
  lantern?, interact?{id,label,lines,once?} }`. `col` is the *feet* collision
  box; sprites draw anchored bottom-center at (x, y). `flat` renders under
  everything (footprints, sigils, jetty planks).
- **Beach** (`type:'proc'`): 704×544 generated per-pixel from shoreline curves
  (`bShoreY/bGrassY/bForestY` + `hash2` noise) into an ImageData buffer.
  Water animates at render time from a coarse `WaterGrid` of terrain ids.
- **Grid areas** (`type:'grid'`): ASCII maps (`TRAIL_GRID`, `VILLAGE_GRID`,
  `TAVERN_GRID`) — `P` jungle wall, `,` jungle floor, `p` path, `S` shrine
  stone, `W` water, `F` plank floor, `x/X` walls. `buildGridArea()` rasterizes
  each tile with `paintTile()` (per-tile hashed speckle noise), builds an 8px
  collision grid, and stores `area.chars` for footstep surfaces.
- `hash2` is a proper 32-bit `Math.imul` mix — the float-multiply version was
  biased and flattened all grid terrain (found via harness color counts).

## 5. Inventory

- `ITEMS` db entries: `{ id, name, cat: 'consumable'|'key'|'equip', desc,
  heal?, slot?, atk?, def?, battle?: true }`.
- `Inventory` runtime: `add/remove/count/has`, `use(id, hp, maxhp)` →
  `{healed, hpAfter}`, `equipItem/unequip/isEquipped`, `atk()/def()` (base
  4/1 + equips), `byCat(cat)`, `serialize()/deserialize()`.
- `serialize()` is embedded in `SaveSys` snapshots, so inventory persists
  across battles, area changes, reloads and Continue.
- UI (`drawInventory`): tabs ALL/FOOD/KEY/GEAR (TAB cycles), up/down scrolls,
  E uses/equips, ESC closes; detail panel shows examine text + stats.
- In battle: ITEM opens the consumable list; using one consumes the turn.

## 6. Combat lifecycle

```
Game.startBattle(id) ─ fade ─▶ Battle.start(id)
state: intro → menu → {target|act|item|mercy} → resolve → enemyline → dodge → menu ...
                         │                                        (3.4s, soul 92px/s)
                         └─▶ finish(result) ─▶ state win/spared/flee/lose ─▶ Game.exitBattle(result, drop)
```

- **FIGHT**: cursor sweeps the attack bar at 235px/s; damage =
  `round((atk + 1 + rand(0..2) − enemyDef) × (0.55 + accuracy))`, accuracy
  peaks at bar centre.
- **ACT**: per-enemy list (`check` always first). Crab Apple: Compliment →
  spareable, Boiling Joke → −1 ATK. Bramblett: Untangle → spareable,
  Whistle → slower darts. Gull Gazer: Stare Back → spareable,
  Avert Eyes → −1 ATK.
- **MERCY**: Spare works when `spareable || hp ≤ 18%`; Flee is 75% on normal
  encounters (never on scripted story fights).
- **Dodge**: 6 bullet patterns (`pinch` darts, `thorn` sine drift, `feathers`
  fall, `sweep`, `rain`, `orbit`); touch damage `max(1, atk+2−DEF)`,
  0.9s invulnerability.
- **Exits**: `exitBattle` restores world ambience/music, grants drops, sets
  `flags.hurt/spared` counters, applies 7s encounter immunity. Defeat does
  NOT reload a menu — the nearest Memory Lantern "re-kinds" you: reload last
  save (or beach spawn) at full HP.
- Adding an enemy = one `ENEMY_DEFS` entry `{ id, name, hp, atk, def, spr,
  check, flavor[], intents{}, acts[], patterns[], drops[] }`. Nothing else.

## 7. Encounters

Per-area config: `{ rects|null, rate (s), chance, pool[] }`. `rects:null`
means the whole map. Movement accumulates `walkT`; when `walkT > rate` a roll
happens (`chance`), reset on fire. Scripted encounter: trail first-visit
fires after 3.2s of walking (`trailFirstEncounter` flag). Post-battle
immunity 7s. Dangerous-area feedback: toast + zap sting + heavier rates.

## 8. Story flags & objectives

- `Game.flags` — story booleans/counters (see CHANGELOG list). Never branch
  on anything else; the locked storyline (docs/STORYLINE.md) is the source of
  truth for what each flag means.
- `Game.asked` — per-topic asked markers so dialogue choices don't repeat.
- `Game.setObjective(id, text)` — HUD objective + flash + chime. The chain:
  `explore → talk → village → findali → villagefolk → token → chapter1end`.
- Objectives are nodes in dialogue scripts (`OBJ('village', '...')`), so
  story beats and tracker state can't drift apart.

## 9. Saves

`SaveSys` (key `fructasia_ch1_save_v1`, localStorage) snapshots: area, x, y,
dir, hp, maxhp, playTime, flags, asked, objective, inventory. Written by the
pause menu *Save Game* and by every Memory Lantern rest (which also heals).
`Continue` on the title screen appears only when a snapshot exists. New Game
never deletes the old save (saving overwrites).

## 10. Intro panels

`Intro` (ui.js) is a data array of panels: `{ lines[], style?, storm?, crash?,
title? }`. Typewriter at ~46cps, first press completes the line, second
advances; ESC skips the whole sequence. Panel 3 triggers thunder + screen
flash, panel 5 the ship-crash sting, the last panel is the FRUITS ISLAND
title card. `Intro.begin()` starts title music; finishing calls
`Game.introDone()` → fade → beach with `Game.waking = 2.6` (lying sprite) →
auto inner-monologue → objective `explore`. Adding a panel = one array entry.

## 11. Audio

`AudioSys` synthesizes everything: footsteps (surface-tuned noise bursts),
UI blips, dialogue type/advance, item/heal/save stings, battle start/hits/
hurt/spare/victory/defeat/flee, ambient layers (ocean, wind, rain, hum,
hearth — mixed per-area via `setMix`), and three songs (title, village,
battle) scheduled through a lookahead ticker. Volume cycles 1 → 0.5 → 0 with
M or the pause *Sound* item. Every entry point is try/catch-guarded and
no-ops when `AudioContext` is missing — audio can fail silently, never
fatally.

## 12. Testing harness

`tools/harness.mjs` (Node, no deps) implements a miniature software
rasterizer (fillRect / drawImage with transforms / gradients / ImageData /
paths-as-bboxes) plus DOM/localStorage/AudioContext stubs, evals the bundle
in `index.html` order, and plays the entire chapter with scripted input.
116 assertions: art audit, walk-cycle leg alternation, Vax design pixels,
intro, interactions, inventory, battles (spare/win/item/defeat), NPC scripts,
prop bounds, save/continue roundtrip, soft-lock safety. `--shots` dumps
PNGs to `tools/shots/` (pure-node PNG encoder, zlib + CRC32).

Watch out: canvas-stub buffers store alpha as 0–1 floats; `putImageData`
converts from 0–255 bytes (mixing conventions once made every fillRect-painted
canvas invisible in blits — if screenshots go black, check that first).
