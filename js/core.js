/* ============================================================================
   FRUITS ISLAND — Chapter One ("The First Slice")
   js/core.js — constants, utils, RNG, pixel font, text rendering, panels

   Project layout (classic scripts, loaded in order by index.html):
     core.js     — this file: math, RNG, canvas helpers, font, text, panels
     audio.js    — WebAudio engine (all sound is procedural; no files needed)
     sprites.js  — palette, sheet factory, ALL character/portrait/icon art
     props.js    — procedural prop painters (trees, huts, shrine, wreck, ...)
     items.js    — item database + Inventory runtime
     dialogue.js — dialogue engine (nodes, typewriter, choices)
     npcs.js     — NPC definitions and dialogue scripts (story-flag aware)
     world.js    — areas (beach, jungle trail, village, tavern): terrain,
                  props, exits, encounter zones, interactables
     combat.js   — battle system: menu, timing attack, bullet-box dodging
     ui.js       — HUD, dialogue box, inventory screen, pause, title, intro
     game.js     — game state, player, camera, saves, transitions, main loop
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------- 1. CONSTANTS */
const VW = 384, VH = 216, TILE = 16;

/* ---------------------------------------------------------------- 2. UTILS */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, t, s) => v < t ? Math.min(t, v + s) : Math.max(t, v - s);
const mdist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
const ease = (t) => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

// deterministic RNG: the island must look identical on every run
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// stable 2D hash for per-pixel terrain noise
function hash2(x, y) {
  // 32-bit integer mix (Math.imul keeps everything in the int32 domain —
  // plain multiplication silently loses the high bits and biases the result)
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function distToPath(px, py, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, distToSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x };
}

// tiny painting helpers shared by every procedural painter
function fillCircle(x, cx, cy, r, col) {
  if (r <= 0) return;
  x.fillStyle = col;
  for (let dy = -Math.round(r); dy <= Math.round(r); dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    x.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
  }
}
function px(x, x0, y0, col) {
  x.fillStyle = col;
  x.fillRect(Math.round(x0), Math.round(y0), 1, 1);
}
function ring(x, cx, cy, r, squash, col) {
  for (let a = 0; a < Math.PI * 2; a += 0.055) {
    px(x, cx + Math.cos(a) * r, cy + Math.sin(a) * r * (squash || 1), col);
  }
}

/* ------------------------------------------------------------ 3. PIXEL FONT */
// 5x7 bitmap font. Every glyph is 7 rows of 5 bits. Advance is 6px.
const FONT_SRC = {
  'A':'01110|10001|10001|11111|10001|10001|10001',
  'B':'11110|10001|10001|11110|10001|10001|11110',
  'C':'01110|10001|10000|10000|10000|10001|01110',
  'D':'11110|10001|10001|10001|10001|10001|11110',
  'E':'11111|10000|10000|11110|10000|10000|11111',
  'F':'11111|10000|10000|11110|10000|10000|10000',
  'G':'01110|10001|10000|10111|10001|10001|01111',
  'H':'10001|10001|10001|11111|10001|10001|10001',
  'I':'11111|00100|00100|00100|00100|00100|11111',
  'J':'00111|00010|00010|00010|00010|10010|01100',
  'K':'10001|10010|10100|11000|10100|10010|10001',
  'L':'10000|10000|10000|10000|10000|10000|11111',
  'M':'10001|11011|10101|10101|10001|10001|10001',
  'N':'10001|11001|10101|10011|10001|10001|10001',
  'O':'01110|10001|10001|10001|10001|10001|01110',
  'P':'11110|10001|10001|11110|10000|10000|10000',
  'Q':'01110|10001|10001|10001|10101|10010|01101',
  'R':'11110|10001|10001|11110|10100|10010|10001',
  'S':'01111|10000|10000|01110|00001|00001|11110',
  'T':'11111|00100|00100|00100|00100|00100|00100',
  'U':'10001|10001|10001|10001|10001|10001|01110',
  'V':'10001|10001|10001|10001|10001|01010|00100',
  'W':'10001|10001|10001|10101|10101|11011|10001',
  'X':'10001|10001|01010|00100|01010|10001|10001',
  'Y':'10001|10001|01010|00100|00100|00100|00100',
  'Z':'11111|00001|00010|00100|01000|10000|11111',
  '0':'01110|10001|10011|10101|11001|10001|01110',
  '1':'00100|01100|00100|00100|00100|00100|01110',
  '2':'01110|10001|00001|00110|01000|10000|11111',
  '3':'11111|00010|00100|00010|00001|10001|01110',
  '4':'00010|00110|01010|10010|11111|00010|00010',
  '5':'11111|10000|11110|00001|00001|10001|01110',
  '6':'00110|01000|10000|11110|10001|10001|01110',
  '7':'11111|00001|00010|00100|01000|01000|01000',
  '8':'01110|10001|10001|01110|10001|10001|01110',
  '9':'01110|10001|10001|01111|00001|00010|01100',
  'a':'00000|00000|01110|00001|01111|10001|01111',
  'b':'10000|10000|11110|10001|10001|10001|11110',
  'c':'00000|00000|01111|10000|10000|10000|01111',
  'd':'00001|00001|01111|10001|10001|10001|01111',
  'e':'00000|00000|01110|10001|11111|10000|01110',
  'f':'00110|01001|01000|11100|01000|01000|01000',
  'g':'00000|01111|10001|10001|01111|00001|01110',
  'h':'10000|10000|11110|10001|10001|10001|10001',
  'i':'00100|00000|01100|00100|00100|00100|01110',
  'j':'00010|00000|00110|00010|00010|10010|01100',
  'k':'10000|10000|10010|10100|11000|10100|10010',
  'l':'01100|00100|00100|00100|00100|00100|01110',
  'm':'00000|00000|11110|10101|10101|10101|10101',
  'n':'00000|00000|11110|10001|10001|10001|10001',
  'o':'00000|00000|01110|10001|10001|10001|01110',
  'p':'00000|00000|11110|10001|10001|11110|10000',
  'q':'00000|00000|01111|10001|10001|01111|00001',
  'r':'00000|00000|10110|11001|10000|10000|10000',
  's':'00000|00000|01111|10000|01110|00001|11110',
  't':'01000|01000|11100|01000|01000|01001|00110',
  'u':'00000|00000|10001|10001|10001|10011|01101',
  'v':'00000|00000|10001|10001|10001|01010|00100',
  'w':'00000|00000|10001|10001|10101|10101|01010',
  'x':'00000|00000|10001|01010|00100|01010|10001',
  'y':'00000|00000|10001|10001|01101|00001|01110',
  'z':'00000|00000|11111|00010|00100|01000|11111',
  ' ':'00000|00000|00000|00000|00000|00000|00000',
  '.':'00000|00000|00000|00000|00000|00000|00100',
  ',':'00000|00000|00000|00000|00100|00100|01000',
  '!':'00100|00100|00100|00100|00100|00000|00100',
  '?':'01110|10001|00001|00110|00100|00000|00100',
  "'":'00100|00100|00000|00000|00000|00000|00000',
  '"':'01010|01010|00000|00000|00000|00000|00000',
  '-':'00000|00000|00000|01110|00000|00000|00000',
  ':':'00000|00100|00000|00000|00100|00000|00000',
  ';':'00000|00100|00000|00000|00100|00100|01000',
  '(':'00010|00100|01000|01000|01000|00100|00010',
  ')':'01000|00100|00010|00010|00010|00100|01000',
  '/':'00001|00010|00010|00100|01000|01000|10000',
  '&':'01100|10010|10100|01000|10101|10010|01101',
  '>':'01000|00100|00010|00001|00010|00100|01000',
  '<':'00010|00100|01000|10000|01000|00100|00010',
  '[':'00110|00100|00100|00100|00100|00100|00110',
  ']':'01100|00100|00100|00100|00100|00100|01100',
  '%':'10001|00010|00100|00100|01000|10001|00000',
  '*':'00000|10101|01110|11111|01110|10101|00000',
  '+':'00000|00100|00100|11111|00100|00100|00000',
  '=':'00000|00000|11111|00000|11111|00000|00000',
  '#':'01010|01010|11111|01010|11111|01010|01010',
  '_':'00000|00000|00000|00000|00000|00000|11111',
  '·':'00000|00000|00000|01100|01100|00000|00000'
};
const FONT = {};
for (const ch in FONT_SRC) FONT[ch] = FONT_SRC[ch].split('|');
const FONT_FALLBACK = FONT['?'];

function drawText(ctx, str, x, y, color, scale, shadow) {
  scale = scale || 1;
  if (shadow) drawTextRaw(ctx, str, x + scale, y + scale, shadow, scale);
  drawTextRaw(ctx, str, x, y, color, scale);
}
function drawTextRaw(ctx, str, x, y, color, scale) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]] || (str[i] === ' ' ? FONT[' '] : FONT_FALLBACK);
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === '1') ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
      }
    }
    cx += 6 * scale;
  }
}
function textWidth(str, scale) {
  scale = scale || 1;
  return str.length === 0 ? 0 : str.length * 6 * scale - scale;
}

// word wrap with cache (used by dialogue + panels)
const WRAP_CACHE = {};
function wrapText(text, maxChars) {
  const key = maxChars + '|' + text;
  if (WRAP_CACHE[key]) return WRAP_CACHE[key];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  WRAP_CACHE[key] = lines;
  return lines;
}

/* ---------------------------------------------------------------- 4. PANELS */
// The one and only panel style, used by every menu / box in the game.
// Dark slate with a soft bevel and gold corner ticks — pixel-consistent.
function drawPanel(ctx, x, y, w, h, alpha) {
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = '#0b141c'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#17252f'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#243a48'; ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillStyle = '#0f1a22'; ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  ctx.fillStyle = '#e4c97c';
  ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + 1, y + 1, 1, 2);
  ctx.fillRect(x + w - 3, y + 1, 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, 2);
  ctx.fillRect(x + 1, y + h - 3, 1, 2); ctx.fillRect(x + 1, y + h - 2, 2, 1);
  ctx.fillRect(x + w - 2, y + h - 3, 1, 2); ctx.fillRect(x + w - 3, y + h - 2, 2, 1);
  ctx.globalAlpha = 1;
}

// subtle "key item gold" divider used in menus
function drawDivider(ctx, x, y, w) {
  ctx.fillStyle = '#e4c97c';
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = '#6b5a2e';
  ctx.fillRect(x, y + 1, w, 1);
}
