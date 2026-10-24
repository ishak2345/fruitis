/* ============================================================================
   js/world.js — areas, terrain, props, exits, encounter zones
   Two area types:
     'proc'  — pixel-procedural terrain (the Beach: shorelines via curves)
     'grid'  — tile-grid terrain (Trail / Village / Tavern: char maps +
               programmatic carving)
   Every area provides: terrainCanvas, collision grid (8px cells), props,
   npcs, exits, interactables, encounter config, ambience mix.
   Areas are built lazily once and cached; world state that can change
   (taken items, flags) lives in Game.flags, never in the area build.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------- tile painting */
const SOLID_TILES = { P: 1, T: 1, W: 1, x: 1, X: 1 };

function paintTile(x, ch, tx, ty) {
  const X = tx * TILE, Y = ty * TILE;
  const n = (a) => hash2(tx * 31 + a, ty * 57 + a * 7);
  switch (ch) {
    case 'P': { // jungle wall — dense dark canopy
      const base = n(1) > 0.5 ? '#1c3a29' : '#193425';
      x.fillStyle = base; x.fillRect(X, Y, TILE, TILE);
      for (let i = 0; i < 7; i++) {
        const lx = X + Math.floor(n(i + 2) * 15), ly = Y + Math.floor(n(i + 9) * 15);
        x.fillStyle = n(i + 20) > 0.5 ? '#255033' : '#142b1e';
        x.fillRect(lx, ly, 2 + Math.floor(n(i + 30) * 2), 1);
      }
      if (n(40) > 0.82) { x.fillStyle = '#0e2016'; x.fillRect(X + 4, Y + 6, 3, 9); x.fillStyle = '#173321'; x.fillRect(X + 5, Y + 6, 1, 9); }
      if (n(50) > 0.9) { x.fillStyle = '#488f56'; x.fillRect(X + Math.floor(n(60) * 13), Y + Math.floor(n(61) * 13), 1, 1); }
      break;
    }
    case 'T': { // big tree wall
      x.fillStyle = '#173321'; x.fillRect(X, Y, TILE, TILE);
      fillCircle(x, X + 8, Y + 6, 7.4, '#1e402c');
      fillCircle(x, X + 6, Y + 4, 5, '#27503a');
      fillCircle(x, X + 5, Y + 3, 2.6, '#33684a');
      x.fillStyle = '#0e2016'; x.fillRect(X + 7, Y + 12, 2, 4);
      break;
    }
    case 'W': { // water
      const b = n(1) > 0.5;
      x.fillStyle = b ? '#1e4a5e' : '#1c4458'; x.fillRect(X, Y, TILE, TILE);
      if (n(2) > 0.6) { x.fillStyle = 'rgba(126,206,204,0.25)'; x.fillRect(X + Math.floor(n(3) * 10), Y + Math.floor(n(4) * 12), 4, 1); }
      if (n(5) > 0.85) { x.fillStyle = 'rgba(190,240,232,0.2)'; x.fillRect(X + Math.floor(n(6) * 12), Y + Math.floor(n(7) * 12), 2, 1); }
      break;
    }
    case 'x': case 'X': { // generic wall (tavern)
      x.fillStyle = '#2c2013'; x.fillRect(X, Y, TILE, TILE);
      x.fillStyle = '#4d3722'; x.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
      x.fillStyle = '#3d2d1c';
      x.fillRect(X + 1, Y + 7, TILE - 2, 1); x.fillRect(X + 7, Y + 1, 1, 6); x.fillRect(X + 3, Y + 9, 1, 6);
      if (n(8) > 0.75) { x.fillStyle = '#5d452e'; x.fillRect(X + 2, Y + 2, 3, 1); }
      break;
    }
    case 'F': { // plank floor
      x.fillStyle = n(1) > 0.5 ? '#6b4f34' : '#75573b'; x.fillRect(X, Y, TILE, TILE);
      x.fillStyle = '#54371f';
      x.fillRect(X, Y + 7, TILE, 1);
      if ((tx + ty * 3) % 4 === 0) x.fillRect(X + 11, Y, 1, 7);
      if (n(2) > 0.75) { x.fillStyle = '#8a6a48'; x.fillRect(X + Math.floor(n(3) * 12), Y + Math.floor(n(4) * 6), 2, 1); }
      if (n(5) > 0.92) { x.fillStyle = '#4a3320'; x.fillRect(X + Math.floor(n(6) * 12), Y + 8 + Math.floor(n(7) * 6), 2, 1); }
      break;
    }
    case 'p': { // dirt path
      x.fillStyle = n(1) > 0.5 ? '#a08256' : '#987a4f'; x.fillRect(X, Y, TILE, TILE);
      if (n(2) > 0.72) { x.fillStyle = '#8a6f47'; x.fillRect(X + Math.floor(n(3) * 12), Y + Math.floor(n(4) * 12), 2, 1); }
      if (n(5) > 0.9) { x.fillStyle = '#b39468'; x.fillRect(X + Math.floor(n(6) * 13), Y + Math.floor(n(7) * 13), 1, 1); }
      if (n(8) > 0.94) { x.fillStyle = '#7d9a52'; x.fillRect(X + Math.floor(n(9) * 13), Y + Math.floor(n(10) * 13), 1, 2); }
      break;
    }
    case 'S': { // shrine stone
      x.fillStyle = n(1) > 0.5 ? '#4e5a64' : '#4a555f'; x.fillRect(X, Y, TILE, TILE);
      x.fillStyle = '#57626c';
      x.fillRect(X, Y, TILE, 1); x.fillRect(X, Y, 1, TILE);
      x.fillStyle = '#3f4a54';
      x.fillRect(X, Y + TILE - 1, TILE, 1); x.fillRect(X + TILE - 1, Y, 1, TILE);
      if (n(2) > 0.7) { x.fillStyle = '#3c5c46'; x.fillRect(X + Math.floor(n(3) * 12), Y + Math.floor(n(4) * 12), 2, 1); }
      break;
    }
    case ',': { // jungle floor (dark grass)
      x.fillStyle = n(1) > 0.5 ? '#2f5a3d' : '#2b543a'; x.fillRect(X, Y, TILE, TILE);
      if (n(2) > 0.62) { x.fillStyle = '#35654a'; x.fillRect(X + Math.floor(n(3) * 14), Y + Math.floor(n(4) * 14), 1, 2); }
      if (n(5) > 0.86) { x.fillStyle = '#25503a'; x.fillRect(X + Math.floor(n(6) * 13), Y + Math.floor(n(7) * 13), 2, 1); }
      break;
    }
    default: { // '.' village grass
      x.fillStyle = n(1) > 0.5 ? '#4a7a4e' : '#457349'; x.fillRect(X, Y, TILE, TILE);
      if (n(2) > 0.6) { x.fillStyle = '#54875a'; x.fillRect(X + Math.floor(n(3) * 14), Y + Math.floor(n(4) * 14), 1, 2); }
      if (n(5) > 0.85) { x.fillStyle = '#3c6843'; x.fillRect(X + Math.floor(n(6) * 13), Y + Math.floor(n(7) * 13), 2, 1); }
      if (n(8) > 0.965) { x.fillStyle = '#e8c45a'; x.fillRect(X + Math.floor(n(9) * 14), Y + Math.floor(n(10) * 14), 1, 1); }
      break;
    }
  }
}

function buildGridArea(area, grid) {
  const tw = grid[0].length, th = grid.length;
  area.w = tw * TILE; area.h = th * TILE;
  const mk = makeCanvas(area.w, area.h);
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      paintTile(mk.x, grid[ty][tx], tx, ty);
    }
  }
  area.chars = grid;   // kept for surface lookups (footsteps etc.)
  area.terrainCanvas = mk.c;
  // collision grid at 8px
  const cell = 8;
  const gw = Math.ceil(area.w / cell), gh = Math.ceil(area.h / cell);
  const data = new Uint8Array(gw * gh);
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      const px0 = cx * cell + 4, py0 = cy * cell + 4;
      const ch = grid[Math.floor(py0 / TILE)] && grid[Math.floor(py0 / TILE)][Math.floor(px0 / TILE)];
      data[cy * gw + cx] = SOLID_TILES[ch] ? 1 : 0;
    }
  }
  area.grid = { cell, w: gw, h: gh, data };
}

/* ============================================================ THE BEACH === */
const BEACH = { w: 704, h: 544 };
// canonical beach spawn: on dry sand ABOVE the waterline (bShoreY(240) ~ 384)
const BEACH_SPAWN = { x: 240, y: 356, dir: 'down' };
function bShoreY(x) { return 392 + 18 * Math.sin(x * 0.013) + 8 * Math.sin(x * 0.037 + 2.0); }
function bGrassY(x) { return bShoreY(x) - 70 + 14 * Math.sin(x * 0.021 + 1.1) + 7 * Math.sin(x * 0.063); }
function bForestY(x) { return 150 + 10 * Math.sin(x * 0.021) + 5 * Math.sin(x * 0.07 + 1.0); }

const B_PATH_MAIN = [[238, 420], [252, 396], [268, 366], [290, 340], [316, 322], [352, 312], [392, 306], [430, 306], [470, 306], [510, 312], [552, 318], [600, 322], [650, 326], [700, 330]];
const B_PATH_VAX = [[352, 312], [330, 306], [304, 298], [280, 294]];
const B_PATHS = [B_PATH_MAIN, B_PATH_VAX];

function bTerrainId(x, y) {
  const sh = bShoreY(x);
  if (y > sh + 26) return 0;
  if (y > sh) return 1;
  if (y > sh - 6) return 2;
  if (y > bGrassY(x)) {
    for (const p of B_PATHS) if (distToPath(x, y, p) < 11) return 5;
    return 3;
  }
  if (y > bForestY(x)) {
    for (const p of B_PATHS) if (distToPath(x, y, p) < 10) return 5;
    return 4;
  }
  return 6;
}
const B_SOLID = { 0: 1, 1: 1, 6: 1 };
const B_COLORS = {
  0: [24, 56, 84], 1: [40, 98, 122], 2: [208, 188, 148],
  3: [224, 202, 158], 4: [80, 126, 86], 5: [188, 164, 124], 6: [36, 40, 48]
};

function buildBeachTerrain(area) {
  const mk = makeCanvas(area.w, area.h);
  const img = mk.x.createImageData(area.w, area.h);
  const d = img.data;
  for (let y = 0; y < area.h; y++) {
    for (let xx = 0; xx < area.w; xx++) {
      const id = bTerrainId(xx, y);
      let col = B_COLORS[id];
      const n = hash2(xx, y), n2 = hash2(xx >> 2, y >> 2);
      const amp = (id === 0 || id === 1) ? 10 : 14;
      let r = col[0] + (n - 0.5) * amp + (n2 - 0.5) * 10;
      let g = col[1] + (n - 0.5) * amp + (n2 - 0.5) * 10;
      let b = col[2] + (n - 0.5) * amp + (n2 - 0.5) * 10;
      if (id === 4 || id === 6) { g += 6; b -= 4; }
      if (id === 2) { r += 6; g += 2; }
      const i = (y * area.w + xx) * 4;
      d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = 255;
    }
  }
  mk.x.putImageData(img, 0, 0);
  // texture details
  for (let y = 0; y < area.h; y++) {
    for (let xx = 0; xx < area.w; xx++) {
      const id = bTerrainId(xx, y);
      const h = hash2(xx * 7 + 3, y * 13 + 5);
      if (id === 3 || id === 2) {
        if (h > 0.965) { mk.x.fillStyle = h > 0.99 ? '#c2ab80' : '#efdab4'; mk.x.fillRect(xx, y, 1, 1); }
      } else if (id === 4) {
        if (h > 0.95) { mk.x.fillStyle = h > 0.985 ? '#49855a' : '#93b478'; mk.x.fillRect(xx, y, 1, 2); }
      } else if (id === 5) {
        if (h > 0.955) { mk.x.fillStyle = '#a89066'; mk.x.fillRect(xx, y, 1, 1); }
      } else if (id === 1) {
        if (h > 0.985) { mk.x.fillStyle = '#7fd0c4'; mk.x.fillRect(xx, y, 2, 1); }
      } else if (id === 6) {
        if (h > 0.955) { mk.x.fillStyle = '#303742'; mk.x.fillRect(xx, y, 2, 1); }
      }
    }
  }
  // shoreline foam
  for (let xx = 0; xx < area.w; xx++) {
    const sh = Math.round(bShoreY(xx));
    const wob = Math.sin(xx * 0.09) * 1.5;
    for (let k = 0; k < 4; k++) {
      const yy = Math.round(sh - 2 + wob + k);
      mk.x.fillStyle = `rgba(233,249,240,${(0.3 * (1 - k * 0.22)).toFixed(2)})`;
      mk.x.fillRect(xx, yy, 1, 1);
    }
  }
  area.terrainCanvas = mk.c;
  // collision grid
  const cell = 8;
  const gw = Math.ceil(area.w / cell), gh = Math.ceil(area.h / cell);
  const data = new Uint8Array(gw * gh);
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      let solid = 0;
      for (let sy = 0; sy < 2 && !solid; sy++) {
        for (let sx = 0; sx < 2 && !solid; sx++) {
          const px0 = cx * cell + sx * 4 + 2, py0 = cy * cell + sy * 4 + 2;
          if (px0 < 10 || px0 > area.w - 10) { solid = 1; break; }
          if (B_SOLID[bTerrainId(px0, py0)]) solid = 1;
        }
      }
      data[cy * gw + cx] = solid;
    }
  }
  area.grid = { cell, w: gw, h: gh, data };
}

/* ---------------------------------------------------------- beach props */
function beachProps(add) {
  // ---------- shipwreck debris (the Marigold's last bad decision)
  add({ spr: 'wreck', x: 168, y: 404, col: { dx: -22, dy: -9, w: 44, h: 9 }, interact: {
    id: 'wreck', label: 'examine', lines: [
      { who: 'Sailor', text: 'The hull. Or most of it. The sea took the rest, and it isn\u2019t giving anything back.' },
      { who: 'Sailor', text: 'No mast, no cargo, no way home. Just splinters and salt in my mouth.' }
    ] } });
  add({ spr: 'mast', x: 108, y: 382, col: { dx: -7, dy: -6, w: 14, h: 6 }, interact: {
    id: 'mast', label: 'examine', lines: [
      { who: 'Sailor', text: 'A piece of the mast, snapped clean in half. I\u2019ve never seen a storm do that.' },
      { who: 'Sailor', text: 'I\u2019ll choose not to think about it for now.' }
    ] } });
  add({ spr: 'barrel', x: 206, y: 398, col: { dx: -6, dy: -5, w: 12, h: 5 }, interact: {
    id: 'barrel', label: 'examine', lines: [
      { who: 'Sailor', text: 'A barrel, still sealed. Fresh water, if I\u2019m lucky.' },
      { who: 'Sailor', text: 'It\u2019s empty. Of course it is.' }
    ] } });
  add({ spr: 'crate', x: 252, y: 366, col: { dx: -6, dy: -5, w: 12, h: 5 }, interact: {
    id: 'crate', label: 'examine', lines: [
      { who: 'Sailor', text: 'A crate from the hold. Whatever was inside is out, and probably swimming.' }
    ] } });
  add({ spr: 'plank', x: 196, y: 430, flat: true });
  add({ spr: 'plank', x: 300, y: 352, flat: true, flip: true });
  add({ spr: 'plank', x: 140, y: 424, flat: true });
  add({ spr: 'barrel', x: 100, y: 392, col: { dx: -6, dy: -5, w: 12, h: 5 }, flip: true });
  // the ship's bell, half-buried (one-time key item)
  add({ spr: 'it_bell', x: 232, y: 418, flat: true, scale: 1, interact: {
    id: 'bell', label: 'take', once: 'got_bell', item: 'bell', lines: [
      { who: 'Sailor', text: 'The Marigold\u2019s bell, half-buried and still warm from a sea that is anything but.' },
      { who: 'Sailor', text: 'It rings once when I lift it \u2014 pointing out to sea. Home, maybe.' }
    ] } });

  // ---------- memory lantern near the spawn (rest + save)
  add({ spr: 'lanternMem', x: 262, y: 414, col: { dx: -4, dy: -4, w: 8, h: 4 }, lantern: 'beach' });

  // ---------- palms & vegetation (kept clear of the map edges)
  const palms = [
    [72, 350], [140, 344], [232, 352], [300, 330], [356, 356],
    [430, 350], [500, 358], [566, 348], [636, 356], [30, 380],
    [612, 300], [650, 262], [96, 296], [44, 300], [528, 314],
    [588, 250], [676, 344]
  ];
  palms.forEach((p, i) => add({
    spr: ['palm', 'palm2', 'palm3'][i % 3], x: p[0], y: p[1],
    col: { dx: -3, dy: -5, w: 6, h: 5 }, sway: i
  }));

  const fruitTrees = [[210, 300], [268, 286], [368, 274], [520, 268], [616, 330], [150, 262], [660, 200], [468, 204]];
  fruitTrees.forEach((p, i) => add({
    spr: i % 2 ? 'fruitTree2' : 'fruitTree', x: p[0], y: p[1],
    col: { dx: -4, dy: -5, w: 8, h: 5 }, sway: i + 3,
    interact: i === 2 ? {
      id: 'fruittree', label: 'examine', lines: [
        { who: 'Sailor', text: 'Round fruit, bright as lanterns. Every tree here is heavy with them.' },
        { who: 'Sailor', text: 'Nothing on this island looks hungry. That should be a comfort.' },
        { who: 'Sailor', text: '...It is not.' }
      ]
    } : {
      id: 'fruittree' + i, label: 'examine', lines: [
        { who: 'Sailor', text: 'More fruit. Sweet, by the smell of it. The island is practically offering it to me.' }
      ]
    }
  }));
  const bushes = [[176, 316], [232, 330], [330, 300], [392, 316], [452, 330], [546, 292], [588, 330], [118, 330], [410, 246], [490, 244], [560, 236], [630, 286]];
  bushes.forEach((p, i) => add({
    spr: i % 3 === 1 ? 'fruitBush' : 'bush', x: p[0], y: p[1],
    col: { dx: -6, dy: -4, w: 12, h: 4 }, sway: i
  }));

  const rocks = [[60, 400], [206, 386], [322, 388], [404, 376], [468, 388], [540, 380], [608, 392], [660, 384], [24, 348], [676, 320], [380, 340], [464, 340]];
  rocks.forEach((p, i) => {
    const big = i % 3 === 0;
    add({
      spr: big ? 'rock' : (i % 2 ? 'rockSmall' : 'rock3'), x: p[0], y: p[1],
      col: big ? { dx: -7, dy: -5, w: 14, h: 5 } : { dx: -5, dy: -3, w: 10, h: 3 }
    });
  });
  add({ spr: 'shell', x: 256, y: 366, flat: true });
  add({ spr: 'shell', x: 344, y: 360, flat: true, flip: true });
  add({ spr: 'shell', x: 452, y: 356, flat: true });
  add({ spr: 'starfish', x: 292, y: 372, flat: true });
  add({ spr: 'starfish', x: 120, y: 400, flat: true, flip: true });

  [[210, 300], [268, 286], [368, 274], [520, 268], [616, 330], [150, 262]].forEach((p, i) => {
    add({ spr: i % 2 ? 'fallenFruit2' : 'fallenFruit', x: p[0] + 6, y: p[1] + 4, flat: true });
  });
  for (let i = 0; i < 22; i++) {
    const rng2 = mulberry32(900 + i * 17);
    const sx = 24 + rng2() * (BEACH.w - 48);
    const sy = 330 + rng2() * 50;
    if (bTerrainId(sx, sy) === 3) add({ spr: i % 2 ? 'scrub2' : 'scrub', x: Math.round(sx), y: Math.round(sy), flat: true });
  }
  const rng = mulberry32(1234);
  for (let i = 0; i < 150; i++) {
    const gx = 20 + rng() * (BEACH.w - 40);
    const gy = 165 + rng() * 220;
    const id = bTerrainId(gx, gy);
    if (id === 4 || id === 3) {
      const pick = rng();
      const name = pick > 0.94 ? 'flower2' : pick > 0.87 ? 'flower' : pick > 0.7 ? 'fern' : pick > 0.45 ? 'grass2' : 'grass';
      add({ spr: name, x: Math.round(gx), y: Math.round(gy), flat: true, sway: i });
    }
  }

  // ---------- the ominous north edge
  for (let i = 0; i < 26; i++) {
    const tx = 18 + i * 26 + (i % 3) * 5;
    const ty = 154 + Math.sin(i * 1.7) * 6 + (i % 2) * 4;
    if (tx > 392 && tx < 458) continue; // gap where the sealed cave watches
    add({ spr: i % 2 ? 'deadTree2' : 'deadTree', x: tx, y: ty, col: { dx: -7, dy: -5, w: 14, h: 5 }, dead: true });
  }
  add({ spr: 'monolith', x: 262, y: 150, dead: true, noShadow: true, interact: {
    id: 'monolith', label: 'examine', lines: [
      { who: 'Sailor', text: 'A standing stone, older than the trees around it. The carvings are hairline-fine, like someone wrote with a single hair.' },
      { who: 'Sailor', text: 'One groove is deeper than the rest. It points north, past the treeline, where the ground goes dark.' }
    ] } });
  add({ spr: 'cave', x: 426, y: 162, col: { dx: -9, dy: -4, w: 18, h: 4 }, dead: true, interact: {
    id: 'cave', label: 'examine', lines: [
      { who: 'Sailor', text: 'A split in the rock, at the top of the old path. Something has worn the ground smooth going in and out.' },
      { who: 'Sailor', text: 'The hairs on my arms are standing up. I don\u2019t think I\u2019m meant to go up there yet.' }
    ], marker: true } });
  add({ spr: 'vine', x: 404, y: 154, flat: true, dead: true });
  add({ spr: 'vine', x: 450, y: 152, flat: true, dead: true });

  // ---------- wrongness in the sand
  add({ spr: 'sigil', x: 566, y: 384, flat: true, interact: {
    id: 'sigil', label: 'examine', lines: [
      { who: 'Sailor', text: 'Something has been drawn in the sand here. Circles inside circles, pressed deep, like it took effort.' },
      { who: 'Sailor', text: 'The tide should have washed it away by now. It hasn\u2019t.' },
      { who: 'Sailor', text: 'I decide I don\u2019t want to touch it.' }
    ], marker: true } });
  add({ spr: 'footprint', x: 470, y: 366, flat: true, interact: {
    id: 'prints', label: 'examine', lines: [
      { who: 'Sailor', text: 'Prints. Large ones, coming out of the grass and going back into it.' },
      { who: 'Sailor', text: 'Three toes. Or four. I can\u2019t tell, and I\u2019m not sure I\u2019d like the answer.' }
    ], marker: true } });
  add({ spr: 'footprint', x: 492, y: 356, flat: true, flip: true });

  // ---------- signs & Vax's clearing
  add({ spr: 'sign', x: 316, y: 322, col: { dx: -5, dy: -4, w: 10, h: 4 }, interact: {
    id: 'sign', label: 'read', lines: [
      { who: 'Sailor', text: 'A wooden sign, hand-painted. It reads: \u201cFRUITS ISLAND \u2014 PLEASE DO NOT FEED THE ISLAND.\u201d' },
      { who: 'Sailor', text: 'Underneath, in much smaller letters: \u201cThis is not a joke.\u201d' },
      { who: 'Sailor', text: 'The path here is worn smooth. People walk it a lot.' }
    ] } });
  add({ spr: 'sign', x: 560, y: 316, col: { dx: -5, dy: -4, w: 10, h: 4 }, flip: true, interact: {
    id: 'signE', label: 'read', lines: [
      { who: 'Sailor', text: '\u201cBOUGA BOUGA VILLAGE \u2014 EAST PATH. KEEP TO THE TRAIL. THE TRAIL KEEPS TO ITSELF.\u201d' },
      { who: 'Sailor', text: 'Someone has scratched out a line at the bottom. You can still make out the word \u201csinging\u201d.' }
    ] } });
  add({ spr: 'mat', x: 272, y: 296, flat: true });
  add({ spr: 'lanternPost', x: 300, y: 280, col: { dx: -4, dy: -3, w: 8, h: 3 }, lantern: 'post' });
  add({ spr: 'crate', x: 226, y: 316, col: { dx: -6, dy: -5, w: 12, h: 5 }, interact: {
    id: 'vaxcrate', label: 'examine', lines: [
      { who: 'Sailor', text: 'A crate with \u201cLEADER\u201d painted on the side, in very careful handwriting.' },
      { who: 'Sailor', text: 'Inside: three coconuts and a wooden spoon. Leadership, I suppose.' }
    ] } });

  // ---------- distant landmark rocks on the meadow rise
  add({ spr: 'rock', x: 120, y: 214, col: { dx: -8, dy: -5, w: 16, h: 5 }, scale: 2 });
  add({ spr: 'rock', x: 138, y: 222, col: { dx: -8, dy: -5, w: 16, h: 5 } });
  add({ spr: 'deadTree', x: 182, y: 200, dead: true, col: { dx: -7, dy: -5, w: 14, h: 5 } });
  add({ spr: 'deadTree', x: 168, y: 196, dead: true, col: { dx: -7, dy: -5, w: 14, h: 5 }, flip: true });

  // ---------- safety pass: the shoreline is a sine wave, so fixed-y props can
  // end up in the water (that is how the ship's bell once drowned). Lift any
  // prop that matters back onto the wet-sand line.
}
function beachPropsDewater(props) {
  for (const p of props) {
    if (p.flat && !p.interact) continue;        // decoration may sit anywhere
    let guard = 0;
    while (guard++ < 90) {
      const id = bTerrainId(p.x, p.y + 3);
      if (id !== 0 && id !== 1) break;          // 0 deep water / 1 shallow
      p.y -= 2;
    }
  }
}

/* ====================================================== THE JUNGLE TRAIL == */
function buildTrailGrid() {
  // 30 x 34 tiles. A winding safe-ish corridor south -> north.
  const tw = 30, th = 34;
  const g = [];
  for (let y = 0; y < th; y++) g.push(new Array(tw).fill('P'));
  // corridor centerline (in tiles)
  const line = [[15, 33], [14, 30], [12, 27], [12, 24], [14, 21], [16, 18], [16, 15], [14, 12], [12, 9], [13, 6], [15, 3], [15, 0]];
  const carve = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        if (y < 0 || y >= th || x < 1 || x >= tw - 1) continue;
        const d = Math.hypot((x - cx) * 1.15, y - cy);
        if (d <= r + 0.9) g[y][x] = ',';
      }
    }
  };
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, y0] = line[i], [x1, y1] = line[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(lerp(x0, x1, s / steps));
      const cy = Math.round(lerp(y0, y1, s / steps));
      carve(cx, cy, 2);
    }
  }
  // dirt path along the centerline
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, y0] = line[i], [x1, y1] = line[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3;
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(lerp(x0, x1, s / steps));
      const cy = Math.round(lerp(y0, y1, s / steps));
      if (g[cy] && g[cy][cx] === ',') {
        g[cy][cx] = 'p';
        if (g[cy][cx + 1] === ',') g[cy][cx + 1] = 'p';
      }
    }
  }
  // a small clearing mid-trail (the scripted first encounter spot)
  carve(16, 17, 3);
  return g.map(r => r.join(''));
}

function trailProps(add) {
  add({ spr: 'milestone', x: 232, y: 300, col: { dx: -5, dy: -4, w: 10, h: 4 }, interact: {
    id: 'milestone', label: 'read', lines: [
      { who: 'Sailor', text: 'A milestone. \u201cBOUGA BOUGA \u00bd\u201d \u2014 the right half of the inscription has been chiseled away. Deliberately.' },
      { who: 'Sailor', text: 'Half a distance to somewhere. Or a whole distance to half a place.' }
    ] } });
  add({ spr: 'crate', x: 238, y: 268, col: { dx: -6, dy: -5, w: 12, h: 5 }, interact: {
    id: 'trailcrate', label: 'examine', once: 'got_gloves', item: 'gloves', lines: [
      { who: 'Sailor', text: 'A supply crate, off some older wreck. Inside, packed in dry leaves: a pair of patched sailor\u2019s gloves.' },
      { who: 'Sailor', text: 'They smell of tar and rope. My grip feels older and steadier with them on.' }
    ] } });
  add({ spr: 'fern', x: 232, y: 306, flat: true });
  add({ spr: 'fern', x: 236, y: 288, flat: true, flip: true });
  add({ spr: 'fallenFruit', x: 240, y: 260, flat: true });
  add({ spr: 'fallenFruit2', x: 208, y: 220, flat: true });
  // carved-fruit tree right beside the path (the famous frowning fruit)
  add({ spr: 'fruitTree2', x: 244, y: 216, col: { dx: -4, dy: -5, w: 8, h: 5 }, sway: 2, interact: {
    id: 'carvedfruit', label: 'examine', lines: [
      { who: 'Sailor', text: 'Someone has carved little faces into the fruit. All of them are frowning.' },
      { who: 'Sailor', text: 'One of them is frowning at me specifically. I keep walking.' }
    ] } });
  const rng = mulberry32(4242);
  let placed = 0, guard = 0;
  while (placed < 14 && guard++ < 200) {
    const sx = 176 + Math.floor(rng() * 96), sy = 140 + Math.floor(rng() * 280);
    const ch = TRAIL_GRID[Math.floor(sy / TILE)] && TRAIL_GRID[Math.floor(sy / TILE)][Math.floor(sx / TILE)];
    if (ch && ch !== 'P') {
      add({ spr: placed % 2 ? 'scrub2' : 'scrub', x: sx, y: sy, flat: true });
      placed++;
    }
  }
}

/* ======================================================= BOUGA BOUGA ===== */
function buildVillageGrid() {
  const tw = 44, th = 34;
  const g = [];
  for (let y = 0; y < th; y++) { g.push(new Array(tw).fill('.')); }
  // jungle ring (3 tiles), openings at south + north gates (center x=22)
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const edge = Math.min(x, y, tw - 1 - x, th - 1 - y);
      if (edge < 3) g[y][x] = (edge < 2 || hash2(x, y) > 0.35) ? 'P' : ',';
    }
  }
  // gate corridors
  for (let y = th - 4; y < th; y++) { g[y][21] = 'p'; g[y][22] = 'p'; }
  for (let y = 0; y < 5; y++) { g[y][21] = 'p'; g[y][22] = 'p'; }
  // paths: south gate -> plaza -> north gate; plaza -> tavern; plaza -> shrine
  const vline = (x0, y0, x1, y1, w) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(lerp(x0, x1, s / steps));
      const cy = Math.round(lerp(y0, y1, s / steps));
      for (let dy = -w; dy <= w; dy++) {
        for (let dx = -w; dx <= w + 1; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx > 2 && xx < tw - 3 && yy > 2 && yy < th - 3 && g[yy][xx] !== 'P') g[yy][xx] = 'p';
        }
      }
    }
  };
  vline(22, 30, 22, 21, 1);          // south to plaza
  vline(22, 14, 22, 4, 1);           // plaza to north gate
  vline(20, 21, 8, 21, 1);           // plaza to tavern door
  vline(24, 21, 32, 21, 1);          // plaza toward shrine
  vline(32, 20, 34, 14, 1);          // up to the shrine
  vline(22, 24, 30, 29, 1);          // toward the pond jetty
  // plaza: packed dirt circle at tile (22,21)
  for (let y = 17; y <= 25; y++) {
    for (let x = 17; x <= 27; x++) {
      if (Math.hypot((x - 22) * 1.0, (y - 21) * 1.25) < 5.2 && g[y][x] !== 'P') g[y][x] = 'p';
    }
  }
  // pond (SE)
  for (let y = 24; y < 32; y++) {
    for (let x = 28; x < 40; x++) {
      const d = Math.hypot((x - 34) * 0.85, (y - 28) * 1.35);
      if (d < 4.6) g[y][x] = 'W';
      else if (d < 5.4 && g[y][x] !== 'W') g[y][x] = ',';
    }
  }
  // shrine stone platform (NE)
  for (let y = 7; y <= 13; y++) {
    for (let x = 30; x <= 39; x++) g[y][x] = 'S';
  }
  // walkable dock under the jetty planks
  g[28][29] = 'p'; g[28][30] = 'p'; g[28][31] = 'p'; g[29][30] = 'p';
  return g.map(r => r.join(''));
}

function villageProps(add) {
  // plaza
  add({ spr: 'well', x: 352, y: 332, col: { dx: -10, dy: -6, w: 20, h: 6 }, interact: {
    id: 'well', label: 'examine', lines: [
      { who: 'Sailor', text: 'The village well. The bucket is new; the rope is older than the village.' },
      { who: 'Sailor', text: 'Something far below politely knocks back. Once. Like a landlord.' }
    ] } });
  add({ spr: 'lanternMem', x: 380, y: 340, col: { dx: -4, dy: -4, w: 8, h: 4 }, lantern: 'village' });
  add({ spr: 'noticeBoard', x: 320, y: 372, col: { dx: -8, dy: -5, w: 16, h: 5 }, interact: {
    id: 'board', label: 'read', lines: [
      { who: 'Sailor', text: '\u201cNOTICE: Fruit-gathering moved to the SOUTH grove. The north grove is resting.\u201d' },
      { who: 'Sailor', text: '\u201cNOTICE: Do not count the wells.\u201d' },
      { who: 'Sailor', text: 'There is one well. I checked. Twice.' }
    ] } });
  // tavern (west)
  add({ spr: 'tavern', x: 150, y: 342, col: { dx: -40, dy: -10, w: 80, h: 10 }, interact: null });
  // huts
  add({ spr: 'hut1', x: 236, y: 200, col: { dx: -26, dy: -8, w: 52, h: 8 }, interact: {
    id: 'hut1', label: 'examine', lines: [
      { who: 'Sailor', text: 'A village hut, thatch sagging like a tired shoulder. Someone still waters the flowers under the window.' }
    ] } });
  add({ spr: 'hut2', x: 442, y: 190, col: { dx: -24, dy: -8, w: 48, h: 8 }, lit: true, interact: {
    id: 'hut2', label: 'examine', lines: [
      { who: 'Sailor', text: 'Warm light behind the shutter. Inside, someone is humming a tune I almost know.' },
      { who: 'Sailor', text: 'The tune stops when my shadow touches the door. I step back. It resumes.' }
    ] } });
  add({ spr: 'hut3', x: 250, y: 470, col: { dx: -27, dy: -8, w: 54, h: 8 }, interact: {
    id: 'hut3', label: 'examine', lines: [
      { who: 'Sailor', text: 'A hut with a very tidy garden of withered vegetables. Everything is dead and arranged in perfect rows.' }
    ] } });
  add({ spr: 'hutWelded', x: 500, y: 262, col: { dx: -25, dy: -8, w: 50, h: 8 }, interact: {
    id: 'hutW', label: 'examine', lines: [
      { who: 'Sailor', text: 'This hut\u2019s door has been welded shut. From the inside.' },
      { who: 'Sailor', text: 'The weld is neat. Patient. Whoever did it had time, and wanted to be sure.' }
    ], marker: true } });
  // shrine + Majhool's stool
  add({ spr: 'shrine', x: 560, y: 196, col: { dx: -30, dy: -8, w: 60, h: 8 }, interact: {
    id: 'shrine', label: 'examine', lines: [
      { who: 'Sailor', text: 'The Old Fruit Shrine. Seven niches cut into the top step, each shaped to hold a fruit.' },
      { who: 'Sailor', text: 'Six are empty. The fourth still holds something small and dull, the color of a bruise.' }
    ] } });
  add({ spr: 'crate', x: 522, y: 212, col: { dx: -6, dy: -5, w: 12, h: 5 }, interact: {
    id: 'shrinecrate', label: 'examine', lines: [
      { who: 'Sailor', text: 'Majhool\u2019s crate: candle stubs, a chisel, and a hundred little notes in handwriting that keeps changing.' }
    ] } });
  // north gate (locked — chapter 2)
  add({ spr: 'gate', x: 352, y: 96, col: { dx: -38, dy: -8, w: 76, h: 8 }, interact: {
    id: 'gate', label: 'read', lines: [
      { who: 'Sailor', text: 'The north gate. A sign reads: \u201cSACRIFICATION VOLCANO \u2014 PILGRIMS ONLY. THE MOUNTAIN IS INDISPOSED.\u201d' },
      { who: 'Sailor', text: 'The wood is scarred with old claw marks. On the outside. Of a gate that faces the village.' },
      { who: 'Sailor', text: 'It isn\u2019t locked. It\u2019s just... closed. There is a difference, and the difference is important to someone.' }
    ], marker: true } });
  // pond + jetty
  add({ spr: 'jetty', x: 470, y: 452, flat: true });
  add({ spr: 'fence', x: 262, y: 408, col: { dx: -18, dy: -2, w: 36, h: 2 } });
  add({ spr: 'fence2', x: 262, y: 440, col: { dx: -18, dy: -2, w: 36, h: 2 } });
  add({ spr: 'fence', x: 232, y: 424, col: { dx: -18, dy: -2, w: 36, h: 2 }, flip: true });
  // withered garden inside the fences
  for (let i = 0; i < 6; i++) add({ spr: i % 2 ? 'scrub' : 'scrub2', x: 252 + i * 9, y: 424 + (i % 2) * 6, flat: true });
  // trees + bushes for depth
  const trees = [[320, 170], [420, 300], [280, 250], [480, 380], [610, 330], [200, 320], [420, 440], [600, 240]];
  trees.forEach((p, i) => add({
    spr: i % 2 ? 'jungleTree2' : 'jungleTree', x: p[0], y: p[1],
    col: { dx: -4, dy: -5, w: 8, h: 5 }, sway: i
  }));
  const bushes2 = [[300, 396], [390, 300], [430, 230], [540, 320], [270, 180], [560, 400]];
  bushes2.forEach((p, i) => add({
    spr: i % 3 === 1 ? 'fruitBush' : 'bush', x: p[0], y: p[1],
    col: { dx: -6, dy: -4, w: 12, h: 4 }, sway: i + 2
  }));
  // flowers
  const rng = mulberry32(777);
  for (let i = 0; i < 40; i++) {
    const gx = 60 + rng() * (700 - 60), gy = 60 + rng() * (480 - 60);
    const tx = Math.floor(gx / TILE), ty = Math.floor(gy / TILE);
    // only on plain grass
    if (VILLAGE_GRID[ty] && VILLAGE_GRID[ty][tx] === '.') {
      add({ spr: rng() > 0.5 ? 'grass' : 'grass2', x: Math.round(gx), y: Math.round(gy), flat: true, sway: i });
    }
  }
}

/* ====================================================== TAVERN INTERIOR == */
function buildTavernGrid() {
  const rows = [];
  rows.push('xxxxxxxxxxxxxxxxxxxxxxxx');
  for (let y = 1; y < 13; y++) rows.push('x' + 'F'.repeat(22) + 'x');
  rows.push('xxxxxxxxxxx..xxxxxxxxxxx');
  return rows;
}

function tavernProps(add) {
  add({ spr: 'counter', x: 108, y: 100, col: { dx: -42, dy: -12, w: 84, h: 10 } });
  add({ spr: 'hearth', x: 44, y: 56, col: { dx: -14, dy: -8, w: 28, h: 6 }, hearth: true, interact: {
    id: 'hearth', label: 'examine', lines: [
      { who: 'Sailor', text: 'The hearth fire has burned, unattended, for as long as anyone in the village can remember.' },
      { who: 'Sailor', text: 'It is exactly as warm as a fire should be. Exactly. Not a degree of personality to it.' }
    ] } });
  add({ spr: 'stairs', x: 330, y: 56, col: { dx: -14, dy: -6, w: 28, h: 6 }, interact: {
    id: 'stairs', label: 'examine', lines: [
      { who: 'Sailor', text: 'Stairs to the guest rooms. Ali Sama shakes her head when I look at them, so I stop looking at them.' }
    ] } });
  add({ spr: 'table', x: 232, y: 132, col: { dx: -12, dy: -6, w: 24, h: 6 } });
  add({ spr: 'stool', x: 216, y: 138, col: { dx: -4, dy: -3, w: 8, h: 3 } });
  add({ spr: 'stool', x: 250, y: 138, col: { dx: -4, dy: -3, w: 8, h: 3 } });
  add({ spr: 'table', x: 300, y: 172, col: { dx: -12, dy: -6, w: 24, h: 6 } });
  add({ spr: 'stool', x: 284, y: 178, col: { dx: -4, dy: -3, w: 8, h: 3 } });
  add({ spr: 'stool', x: 318, y: 178, col: { dx: -4, dy: -3, w: 8, h: 3 } });
  add({ spr: 'barrel', x: 70, y: 148, col: { dx: -5, dy: -5, w: 10, h: 5 }, interact: {
    id: 'tbarrel', label: 'examine', lines: [
      { who: 'Sailor', text: 'A barrel stamped with a little painted fruit. Inside: lamp oil. Everything on this island is fruit-shaped if you give it time.' }
    ] } });
  add({ spr: 'crate', x: 356, y: 132, col: { dx: -6, dy: -5, w: 12, h: 5 }, interact: {
    id: 'tcrate', label: 'examine', lines: [
      { who: 'Sailor', text: 'Deliveries for the tavern. The manifest lists \u201cherbs, honey, quiet\u201d \u2014 in that order, with quantities.' }
    ] } });
}

/* ============================================================ REGISTRY === */
const VILLAGE_GRID = buildVillageGrid();   // built once at load (pure data)
const TRAIL_GRID = buildTrailGrid();
const TAVERN_GRID = buildTavernGrid();

const Areas = {
  beach: {
    id: 'beach', type: 'proc', w: 704, h: 544,
    name: 'The South Beach',
    music: null,
    ambience: { ocean: 0.2, wind: 0.012, rain: 0, hum: 0.03, hearth: 0 },
    encounters: { rects: [{ x: 420, y: 230, w: 284, h: 160 }], rate: 10, chance: 0.055, pool: ['crabApple'] },
    spawn: BEACH_SPAWN,
    build(area) { buildBeachTerrain(area); area.props = []; const add = (p) => { area.props.push(p); return p; }; beachProps(add); beachPropsDewater(area.props); area.npcs = [NpcDefs.vax()]; },
    exits: [
      { x: 686, y: 300, w: 18, h: 76, to: 'trail', tx: 244, ty: 520, dir: 'up' }
    ],
    onEnterFirst() { Game.showToast('The gulls have gone quiet.'); }
  },
  trail: {
    id: 'trail', type: 'grid', grid: TRAIL_GRID,
    name: 'The Jungle Trail',
    music: null,
    ambience: { ocean: 0.06, wind: 0.02, rain: 0.05, hum: 0.05, hearth: 0 },
    encounters: { rects: null, rate: 6.5, chance: 0.1, pool: ['crabApple', 'bramblett', 'crabApple', 'gullgazer'] },
    rain: true,
    build(area) { buildGridArea(area, TRAIL_GRID); area.props = []; const add = (p) => { area.props.push(p); return p; }; trailProps(add); area.npcs = []; },
    exits: [
      { x: 216, y: 524, w: 48, h: 20, to: 'beach', tx: 672, ty: 332, dir: 'left' },
      { x: 216, y: 0, w: 48, h: 14, to: 'village', tx: 352, ty: 508, dir: 'up' }
    ],
    onEnterFirst() { Game.showToast('The birds stop singing here.'); AudioSys.moan(); }
  },
  village: {
    id: 'village', type: 'grid', grid: VILLAGE_GRID,
    name: 'Bouga Bouga Village',
    music: 'village',
    ambience: { ocean: 0.03, wind: 0.008, rain: 0, hum: 0.025, hearth: 0 },
    encounters: null,
    build(area) { buildGridArea(area, VILLAGE_GRID); area.props = []; const add = (p) => { area.props.push(p); return p; }; villageProps(add); area.npcs = [NpcDefs.majhool(), NpcDefs.levi(), NpcDefs.nadia()]; },
    exits: [
      { x: 328, y: 530, w: 48, h: 14, to: 'trail', tx: 240, ty: 20, dir: 'down' },
      { x: 132, y: 341, w: 36, h: 12, to: 'tavern', tx: 192, ty: 200, dir: 'up' }
    ],
    onEnterFirst() { Game.showToast('Bouga Bouga Village. It smells of bread and rain.'); }
  },
  tavern: {
    id: 'tavern', type: 'grid', grid: TAVERN_GRID,
    name: 'The Fruit & Lantern',
    music: 'village',
    ambience: { ocean: 0, wind: 0, rain: 0, hum: 0.012, hearth: 0.05 },
    encounters: null,
    indoor: true,
    build(area) { buildGridArea(area, TAVERN_GRID); area.props = []; const add = (p) => { area.props.push(p); return p; }; tavernProps(add); area.npcs = [NpcDefs.ali(), NpcDefs.ruta()]; },
    exits: [
      { x: 168, y: 210, w: 48, h: 12, to: 'village', tx: 150, ty: 357, dir: 'down' }
    ]
  }
};

/* ------------------------------------------------------------- the World */
const World = {
  areaId: null,
  area: null,
  props: [],
  npcs: [],
  exits: [],
  solidRects: [],
  terrainCanvas: null,
  grid: null,
  built: {},
  visited: {},

  load(id, px, py, dir) {
    const def = Areas[id];
    if (!def) return false;
    if (!this.built[id]) {
      const area = { id, type: def.type, w: def.w, h: def.h };
      def.build(area);
      this.built[id] = area;
    }
    const area = this.built[id];
    this.areaId = id;
    this.area = area;
    this.terrainCanvas = area.terrainCanvas;
    this.grid = area.grid;
    this.props = area.props;
    this.npcs = area.npcs.map(n => n); // npc objects are shared per build
    this.interactables = collectInteractables();
    this.exits = def.exits;
    this.rebuildCollision();
    Player.x = px; Player.y = py; Player.dir = dir || 'down';
    Player.moving = false;
    // never let a load leave the player inside a solid (bad spawn, old save,
    // future area bug): walk them up/out until they stand on clear ground
    for (let i = 0; i < 90 && blockedAt(Player.x, Player.y); i++) {
      Player.y -= 2;
      if (i % 6 === 5) Player.x += (Math.floor(i / 6) % 2 === 0) ? 3 : -3;
    }
    // ambience + music + first-visit hooks
    AudioSys.setMix(def.ambience, 0.5);
    if (def.music) AudioSys.playSong(def.music); else AudioSys.stopSong();
    if (!this.visited[id]) {
      this.visited[id] = true;
      if (def.onEnterFirst) def.onEnterFirst();
    }
    if (def.rain) Weather.setIntensity(0.5); else Weather.setIntensity(1);
    return true;
  },

  rebuildCollision() {
    const rects = [];
    for (const p of this.props) {
      if (p.col) rects.push({ x: p.x + p.col.dx, y: p.y + p.col.dy, w: p.col.w, h: p.col.h });
    }
    for (const n of this.npcs) {
      if (n.solid) rects.push({ x: n.x - 6, y: n.y - 5, w: 12, h: 5 });
    }
    this.solidRects = rects;
  },

  tileSolidAt(px, py) {
    const g = this.grid;
    if (!g) return true;
    if (px < 0 || py < 0 || px >= this.area.w || py >= this.area.h) return true;
    const cx = Math.floor(px / g.cell), cy = Math.floor(py / g.cell);
    if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return true;
    return g.data[cy * g.w + cx] === 1;
  },

  encounterAt(px, py) {
    const def = Areas[this.areaId];
    if (!def || !def.encounters) return null;
    const enc = def.encounters;
    if (enc.rects) {
      let inside = false;
      for (const r of enc.rects) {
        if (px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h) { inside = true; break; }
      }
      if (!inside) return null;
    }
    return enc;
  }
};

// collision check used by the player: terrain grid + prop rects
function blockedAt(px, py) {
  const b = { x: px - 5, y: py - 6, w: 10, h: 6 };
  const pts = [
    [b.x, py], [b.x + b.w - 1, py], [b.x + b.w / 2, py],
    [b.x, b.y], [b.x + b.w - 1, b.y], [px, py - 3]
  ];
  for (const pt of pts) if (World.tileSolidAt(pt[0], pt[1])) return true;
  for (const r of World.solidRects) {
    if (rectsOverlap(b, r)) return true;
  }
  return false;
}

/* ----------------------------------------------- interaction collection */
function collectInteractables() {
  const list = [];
  for (const p of World.props) {
    const isMemLantern = p.lantern === 'beach' || p.lantern === 'village';
    if (!p.interact && !isMemLantern) continue;
    const spr = SPR[p.spr];
    const hw = p.col ? p.col.w / 2 + 3 : 7;
    list.push({
      kind: isMemLantern ? 'lantern' : 'obj',
      ref: p,
      x: p.x + (p.col ? p.col.dx + p.col.w / 2 : 0), y: p.y - 2, hw, hh: 6,
      top: p.y - (spr ? spr.height : 8)
    });
  }
  for (const n of World.npcs) {
    list.push({ kind: 'npc', ref: n, x: n.x, y: n.y - 3, hw: 10, hh: 8, top: n.y - 26 });
  }
  return list;
}
