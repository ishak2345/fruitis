# Changelog — Fruits Island: Chapter One ("The First Slice")

This build replaces the uploaded GameMaker-era HTML prototype with a complete,
original chapter-1 vertical slice. Everything is regenerated from scratch:
art (procedural pixel strings + Canvas painters), audio (procedural WebAudio),
world, systems and story. No third-party or Undertale-derived assets anywhere.

## The prototype → this build

| Prototype problem | Now |
|---|---|
| Sailor walk animation broken (one leg permanently forward on horizontal movement) | Full 4-frame directional walk cycles (DOWN/UP/SIDE × contact/pass frames), runtime mirror for LEFT, idle breathe + rare blink, lying sprite for the intro wash-up. Verified by pixel-level assertions in `tools/harness.mjs`. |
| Vax placeholder design | Exact redesign per spec: 16×22, messy dark brown hair, pale complexion, grey left eye + **red right eye** (never blinks), thick red scarf rows 11–12 with a long tail hanging over the chest (cols 6–7, rows 13–15), black long-sleeved jacket over charcoal shirt, baggy light-grey trousers, red-dominant red-and-white sneakers. Idle animation alternates a weight-shift frame and a rare hair-flick frame; he turns to face the player when dialogue starts and when they approach. |
| Main menu / controls text clipped | All screens measure text with `textWidth()` before drawing; controls screen rows are measured and centered — nothing clips at 384×216. |
| Clipped/out-of-frame environment sprites | Prop audit in the harness asserts every prop sprite sits fully inside its map bounds. |
| "Peaceful farming island" tone | Chaotic multi-biome identity: storm intro, wrongness cues (omen eyes in the treeline, humming monolith, welded-shut hut, footprints that stop mid-sand), decaying village, locked volcano gate, "The Great Deletion" lore. |
| No intro | 10 timed Undertale-style intro panels (typewriter + fades, storm rain/lightning/crack stings, ship loss, waking on an unknown shore) after the title screen, skippable with ESC. |
| No real systems | Inventory (categories, examine text, use/equip, persists across battles/areas/reloads), turn-based combat (FIGHT timing bar / ACT / ITEM / MERCY, enemy intents, 6 bullet patterns, spare/kill tracking), encounters (random + scripted, zone-aware rates), pause menu (Resume/Inventory/Controls/Save/Restart/Sound/Title), objective tracker, localStorage saves, area transitions with fade, interaction prompts, examinable lore objects. |
| No audio | Full procedural WebAudio engine: ~30 SFX, 5 ambience layers, 3 songs, master volume + mute cycling (M), every call guarded so audio failure never crashes the game. |

## Content in this build

- **Intro**: title screen (night sea, Continue if a save exists) → 10-panel storm intro → wake up on South Beach.
- **South Beach** — Vax encounter (full first talk with 4 askable topics + repeat stages), ship's bell equip pickup, Memory Lantern (rest/save), examinable wreck/mast/signs/sigil/monolith/cave, random crab-apple encounters on the east path.
- **The Jungle Trail** — scripted first encounter, gloves pickup, heavier random encounters (crab apple / bramblett / gull gazer), mile marker and trail lore.
- **Bouga Bouga Village** — Majhool at the Old Fruit Shrine (Deletion lore, shrine token), Levi by the well (dream of "the other scarf-man"), Nadia's time-rotating observations, tavern with Ali Sama (torchlight tea) and Ruta, welded hut, locked north gate (chapter 2 tease), Memory Lantern.
- **Chapter close**: bring the shrine token back to Majhool → END OF CHAPTER ONE card.

## Story flags (save-relevant)

`metVax`, `vaxStage`, `trailFirstEncounter`, `metAli`, `metMajhool`, `metLevi`,
`gotToken`, `shrineWarm`, `chapterOneEnd`, `chapterCardShown`, `got_bell`,
`got_gloves`; asked-topic keys: `authority`, `danger`, `forge`, `scarf`,
`song`, `vax`, `fruits`. All persist through save/continue.

## Known limitations

- North gate is closed (Sacrification Volcano is chapter 2 per the roadmap).
- Battle bullet patterns are hand-tuned, not data-driven per-enemy yet.
- The `sounds/` folder from the prototype is unused (all audio is procedural).

## Testing

`node tools/harness.mjs --shots` — 116 headless assertions covering the full
chapter (intro → Vax → battles → village → token → chapter card → save/continue),
sprite-sheet art audit, walk-cycle leg alternation, Vax design pixel checks,
prop bounds, and soft-lock safety. Dumps PNG screenshots to `tools/shots/`.
