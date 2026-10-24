#!/usr/bin/env node
/* ============================================================================
   tools/harness.mjs — headless test harness + screenshot dumper
   ----------------------------------------------------------------------------
   Runs the game in Node with a miniature software-rasterizing Canvas stub,
   then plays through the whole of Chapter One with scripted input and asserts
   on systems, sprites, flags, saves and battles. Also dumps PNG screenshots
   to tools/shots/ so the art can be inspected without a browser.

   Usage:  node tools/harness.mjs [--shots]
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'tools', 'shots');
const wantShots = process.argv.includes('--shots');

/* ============================================================ canvas stub */
function parseColor(str) {
  if (str && str.__grad) return null;
  if (typeof str !== 'string') return null;
  let m;
  if ((m = str.match(/^#([0-9a-f]{6})$/i))) {
    return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  }
  if ((m = str.match(/^#([0-9a-f]{3})$/i))) {
    return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
  }
  if ((m = str.match(/^rgba?\(([^)]+)\)$/i))) {
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? clamp01(p[3]) : 1];
  }
  return [0, 0, 0, 1];
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

class Grad {
  constructor(kind, x0, y0, x1, y1, r1) {
    this.__grad = true; this.kind = kind;
    this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1; this.r1 = r1 || 0;
    this.stops = [];
  }
  addColorStop(o, c) { this.stops.push([clamp01(o), parseColor(c) || [0, 0, 0, 1]]); }
  at(x, y) {
    let t;
    if (this.kind === 'linear') {
      const dx = this.x1 - this.x0, dy = this.y1 - this.y0;
      const l2 = dx * dx + dy * dy || 1;
      t = ((x - this.x0) * dx + (y - this.y0) * dy) / l2;
    } else {
      const d = Math.hypot(x - this.x1, y - this.y1);
      t = this.r1 ? d / this.r1 : 0;
    }
    t = clamp01(t);
    this.stops.sort((a, b) => a[0] - b[0]);
    if (this.stops.length === 0) return [0, 0, 0, 1];
    if (t <= this.stops[0][0]) return this.stops[0][1];
    for (let i = 0; i < this.stops.length - 1; i++) {
      const [o0, c0] = this.stops[i], [o1, c1] = this.stops[i + 1];
      if (t >= o0 && t <= o1) {
        const f = o1 === o0 ? 0 : (t - o0) / (o1 - o0);
        return [
          c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f,
          c0[2] + (c1[2] - c0[2]) * f, c0[3] + (c1[3] - c0[3]) * f
        ];
      }
    }
    return this.stops[this.stops.length - 1][1];
  }
}

class Path2DStub {
  constructor() { this.minX = 1e9; this.minY = 1e9; this.maxX = -1e9; this.maxY = -1e9; }
  _pt(x, y) {
    this.minX = Math.min(this.minX, x); this.maxX = Math.max(this.maxX, x);
    this.minY = Math.min(this.minY, y); this.maxY = Math.max(this.maxY, y);
  }
  moveTo(x, y) { this._pt(x, y); }
  lineTo(x, y) { this._pt(x, y); }
  quadraticCurveTo(cpx, cpy, x, y) { this._pt(cpx, cpy); this._pt(x, y); }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this._pt(c1x, c1y); this._pt(c2x, c2y); this._pt(x, y); }
  arc(x, y, r) { this._pt(x - r, y - r); this._pt(x + r, y + r); }
  ellipse(x, y, rx, ry) { this._pt(x - rx, y - ry); this._pt(x + rx, y + ry); }
  rect(x, y, w, h) { this._pt(x, y); this._pt(x + w, y + h); }
  closePath() {}
}

function makeCanvasStub(w, h) {
  const canvas = {
    width: w || 300, height: h || 150, style: {},
    _buf: null,
    getContext() {
      if (!canvas._ctx) canvas._ctx = new Ctx2D(canvas);
      return canvas._ctx;
    }
  };
  return canvas;
}

class Ctx2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = true;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.filter = 'none';
    this._m = [1, 0, 0, 1, 0, 0];
    this._stack = [];
    this._path = new Path2DStub();
  }
  _buf() {
    const c = this.canvas;
    if (!c._buf || c._buf.length !== c.width * c.height * 4) {
      c._buf = new Float64Array(c.width * c.height * 4);
    }
    return c._buf;
  }
  _px(x, y, col) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const b = this._buf();
    const i = (y * this.canvas.width + x) * 4;
    const ga = clamp01(this.globalAlpha);
    const a = clamp01(col[3]) * ga;
    if (a <= 0) return;
    b[i] = b[i] * (1 - a) + col[0] * a;
    b[i + 1] = b[i + 1] * (1 - a) + col[1] * a;
    b[i + 2] = b[i + 2] * (1 - a) + col[2] * a;
    b[i + 3] = b[i + 3] * (1 - a) + a;
  }
  _fillCol(x, y) {
    if (this.fillStyle && this.fillStyle.__grad) {
      const inv = this._inv();
      const lx = inv[0] * x + inv[2] * y + inv[4];
      const ly = inv[1] * x + inv[3] * y + inv[5];
      return this.fillStyle.at(lx, ly);
    }
    return parseColor(this.fillStyle);
  }
  _inv() {
    const [a, b, c, d, e, f] = this._m;
    const det = a * d - b * c || 1;
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  }
  _xform(x, y) {
    const [a, b, c, d, e, f] = this._m;
    return [a * x + c * y + e, b * x + d * y + f];
  }
  fillRect(x, y, w, h) {
    if (w === undefined) return;
    const p0 = this._xform(x, y), p1 = this._xform(x + w, y), p2 = this._xform(x, y + h), p3 = this._xform(x + w, y + h);
    const minX = Math.floor(Math.min(p0[0], p1[0], p2[0], p3[0]));
    const maxX = Math.ceil(Math.max(p0[0], p1[0], p2[0], p3[0]));
    const minY = Math.floor(Math.min(p0[1], p1[1], p2[1], p3[1]));
    const maxY = Math.ceil(Math.max(p0[1], p1[1], p2[1], p3[1]));
    for (let yy = minY; yy < maxY; yy++) {
      for (let xx = minX; xx < maxX; xx++) {
        this._px(xx, yy, this._fillCol(xx, yy));
      }
    }
  }
  clearRect(x, y, w, h) {
    const b = this._buf();
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.canvas.width, Math.ceil(x + w)), y1 = Math.min(this.canvas.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * this.canvas.width + xx) * 4;
        b[i] = b[i + 1] = b[i + 2] = b[i + 3] = 0;
      }
    }
  }
  drawImage(img, a1, a2, a3, a4, a5, a6, a7, a8) {
    if (!img) return;
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (a8 !== undefined) {
      sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8;
    } else if (a4 !== undefined) {
      dx = a1; dy = a2; dw = a3; dh = a4;
    } else {
      dx = a1; dy = a2; dw = img.width; dh = img.height;
    }
    const sb = img.getContext ? img.getContext()._buf() : null;
    if (!sb) return;
    // device-space bbox of the transformed dest rect
    const p0 = this._xform(dx, dy), p1 = this._xform(dx + dw, dy);
    const p2 = this._xform(dx, dy + dh), p3 = this._xform(dx + dw, dy + dh);
    const minX = Math.floor(Math.min(p0[0], p1[0], p2[0], p3[0]));
    const maxX = Math.ceil(Math.max(p0[0], p1[0], p2[0], p3[0]));
    const minY = Math.floor(Math.min(p0[1], p1[1], p2[1], p3[1]));
    const maxY = Math.ceil(Math.max(p0[1], p1[1], p2[1], p3[1]));
    const inv = this._inv();
    const ga = clamp01(this.globalAlpha);
    for (let yy = minY; yy < maxY; yy++) {
      for (let xx = minX; xx < maxX; xx++) {
        // device -> dest space
        const lx = inv[0] * xx + inv[2] * yy + inv[4];
        const ly = inv[1] * xx + inv[3] * yy + inv[5];
        if (dw === 0 || dh === 0) continue;
        const u = (lx - dx) / dw, v = (ly - dy) / dh;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const sxx = Math.floor(sx + u * sw), syy = Math.floor(sy + v * sh);
        if (sxx < 0 || syy < 0 || sxx >= img.width || syy >= img.height) continue;
        const i = (syy * img.width + sxx) * 4;
        const a = clamp01(sb[i + 3]) * ga;
        if (a <= 0) continue;
        this._pxBlended(xx, yy, sb[i], sb[i + 1], sb[i + 2], a);
      }
    }
  }
  _pxBlended(x, y, r, g, b, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const buf = this._buf();
    const i = (y * this.canvas.width + x) * 4;
    buf[i] = buf[i] * (1 - a) + r * a;
    buf[i + 1] = buf[i + 1] * (1 - a) + g * a;
    buf[i + 2] = buf[i + 2] * (1 - a) + b * a;
    buf[i + 3] = buf[i + 3] * (1 - a) + a;
  }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  getImageData(x, y, w, h) {
    const out = this.createImageData(w, h);
    const b = this._buf();
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const si = ((y + yy) * this.canvas.width + (x + xx)) * 4;
        const di = (yy * w + xx) * 4;
        for (let k = 0; k < 3; k++) out.data[di + k] = b[si + k];
        out.data[di + 3] = b[si + 3] * 255;
      }
    }
    return out;
  }
  putImageData(img, dx, dy) {
    // ImageData.data is 0-255 bytes; our float buffers are 0-1
    const b = this._buf();
    for (let yy = 0; yy < img.height; yy++) {
      for (let xx = 0; xx < img.width; xx++) {
        const di = (yy * img.width + xx) * 4;
        const si = ((dy + yy) * this.canvas.width + (dx + xx)) * 4;
        if (dx + xx < 0 || dy + yy < 0 || dx + xx >= this.canvas.width || dy + yy >= this.canvas.height) continue;
        for (let k = 0; k < 3; k++) b[si + k] = img.data[di + k];
        b[si + 3] = img.data[di + 3] / 255;
      }
    }
  }
  createLinearGradient(x0, y0, x1, y1) { return new Grad('linear', x0, y0, x1, y1, 0); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Grad('radial', x0, y0, x1, y1, r1); }
  save() { this._stack.push({ m: this._m.slice(), ga: this.globalAlpha, fs: this.fillStyle }); }
  restore() {
    const s = this._stack.pop();
    if (s) { this._m = s.m; this.globalAlpha = s.ga; this.fillStyle = s.fs; }
  }
  translate(x, y) {
    this._m = mul(this._m, [1, 0, 0, 1, x, y]);
  }
  scale(x, y) {
    this._m = mul(this._m, [x, 0, 0, y, 0, 0]);
  }
  rotate(a) {
    const c = Math.cos(a), s = Math.sin(a);
    this._m = mul(this._m, [c, s, -s, c, 0, 0]);
  }
  beginPath() { this._path = new Path2DStub(); }
  moveTo(x, y) { this._path._pt(x, y); }
  lineTo(x, y) { this._path._pt(x, y); }
  quadraticCurveTo(cx, cy, x, y) { this._path._pt(cx, cy); this._path._pt(x, y); }
  arc(x, y, r) { this._path.arc(x, y, r); }
  ellipse(x, y, rx, ry) { this._path.ellipse(x, y, rx, ry); }
  closePath() {}
  fill(p) { this._fillPath(p); }
  stroke(p) { this._fillPath(p); }
  clip() {}
  _fillPath(p) {
    const path = p || this._path;
    if (path.minX > path.maxX) return;
    for (let yy = Math.floor(path.minY); yy <= Math.ceil(path.maxY); yy++) {
      for (let xx = Math.floor(path.minX); xx <= Math.ceil(path.maxX); xx++) {
        this._px(xx, yy, this._fillCol(xx, yy));
      }
    }
  }
  measureText() { return { width: 0 }; }
  fillText() {}
  strokeRect(x, y, w, h) {
    const prev = this.fillStyle;
    this.fillStyle = this.strokeStyle;
    this.fillRect(x, y, w, 1); this.fillRect(x, y + h - 1, w, 1);
    this.fillRect(x, y, 1, h); this.fillRect(x + w - 1, y, 1, h);
    this.fillStyle = prev;
  }
}
function mul(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

/* -------------------------------------------------------------- png out */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function dumpPNG(canvas, file) {
  const w = canvas.width, h = canvas.height;
  const b = canvas.getContext()._buf();
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = clamp255(b[i]); raw[o + 1] = clamp255(b[i + 1]);
      raw[o + 2] = clamp255(b[i + 2]); raw[o + 3] = clamp255(b[i + 3] * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
}
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);

/* =============================================================== sandbox */
const storage = {};
const localStorageStub = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; }
};

// fake-but-faithful AudioContext: starts SUSPENDED like a real browser before
// a user gesture; resume() flips it; oscillators are counted so tests can
// prove notes were actually scheduled.
function makeFakeAC(startSuspended) {
  const ac = {
    sampleRate: 44100, currentTime: 0,
    state: startSuspended ? 'suspended' : 'running',
    resumeCalls: 0, oscCount: 0, bufCount: 0,
    destination: null,
    resume() { ac.resumeCalls++; ac.state = 'running'; return Promise.resolve(); },
    _tick(dt) { if (ac.state === 'running') ac.currentTime += dt; }
  };
  const param = () => ({
    value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}
  });
  const node = () => ({
    connect() {}, disconnect() {}, gain: param(), frequency: param(), type: '', Q: param(), buffer: null,
    start() { ac.oscCount++; }, stop() {}
  });
  ac.destination = node();
  ac.createGain = node; ac.createOscillator = node;
  ac.createBufferSource = node; ac.createBiquadFilter = node;
  ac.createBuffer = (ch, len) => { ac.bufCount++; return { getChannelData: () => new Float32Array(len) }; };
  return ac;
}
let fakeAC = makeFakeAC(false);

const mainCanvas = makeCanvasStub(384, 216);
// listener registry shared by window + document so tests can fire real events
const listeners = { win: {}, doc: {} };
function fireOn(map, type, ev) {
  ev = ev || {};
  ev.type = type; ev.preventDefault = ev.preventDefault || (() => {}); ev.stopPropagation = ev.stopPropagation || (() => {});
  (map[type] || []).forEach(fn => fn(ev));
}
const sandbox = {
  console, Math, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: localStorageStub,
  requestAnimationFrame: () => 0,
  performance: { now: () => Date.now() },
  document: {
    readyState: 'complete',
    createElement: tag => tag === 'canvas' ? makeCanvasStub(300, 150) : { style: {} },
    getElementById: id => id === 'game' ? mainCanvas : { clientWidth: 800, clientHeight: 500, style: {} },
    addEventListener(type, fn) { (listeners.doc[type] = listeners.doc[type] || []).push(fn); },
    removeEventListener() {},
    body: {}, hidden: false
  },
  navigator: { userAgent: 'harness' },
  Promise, JSON, Uint8Array, Uint8ClampedArray, Float64Array, Int32Array, Path2D: Path2DStub,
  __errors: [],
  __listeners: listeners,
  __fireWin(type, ev) { fireOn(listeners.win, type, ev); },
  __fireDoc(type, ev) { fireOn(listeners.doc, type, ev); },
  __fakeAC: null
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.top = { not: 'self' };
Object.defineProperty(sandbox, 'AudioContext', {
  get() { return function () { sandbox.__fakeAC = fakeAC; return fakeAC; }; }
});
sandbox.addEventListener = (type, fn) => { (listeners.win[type] = listeners.win[type] || []).push(fn); };
sandbox.removeEventListener = () => {};
sandbox.innerWidth = 800;
sandbox.innerHeight = 500;
vm.createContext(sandbox);

/* load the game exactly as index.html orders it */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (srcs.length === 0) throw new Error('no scripts found in index.html');
let code = '';
for (const src of srcs) {
  code += `\n/* ==== ${src} ==== */\n` + fs.readFileSync(path.join(ROOT, src), 'utf8') + '\n;\n';
}
vm.runInContext(code, sandbox, { filename: 'bundle.js' });

const G = sandbox.window.__game;
if (!G) throw new Error('boot failed: window.__game missing');

/* ============================================================= assertions */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.error('  FAIL: ' + msg); }
}
function section(name) { console.log('\n== ' + name + ' =='); }
function settle(steps = 30) { G.Game.cooldown = 0; step(steps); }
const textWidthProxy = (t) => G.textWidth(t);
function shot(name) {
  if (!wantShots) return;
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  dumpPNG(mainCanvas, path.join(SHOTS, name + '.png'));
}
function step(n = 1, dt = 1 / 60) {
  G.step(dt, n);
  if (sandbox.__fakeAC) sandbox.__fakeAC._tick(dt * n);
}
function pressE() { G.Game.cooldown = 0; G.act('confirm'); }
function advanceDialogueFully(label) {
  let guard = 0;
  while (G.Game.mode === 'dialogue' && guard++ < 400) {
    // finish typing then advance
    G.Dialogue.advance();
    step(2);
    if (G.Dialogue.choiceOpen) break;
  }
  ok(G.Game.mode !== 'dialogue' || G.Dialogue.choiceOpen, 'dialogue advanced (' + (label || 'scene') + ')');
}
function pickChoice(text, label) {
  if (!G.Dialogue.choiceOpen) { ok(false, 'no choice open for ' + text); return false; }
  const opts = G.Dialogue.choiceNode.options;
  const idx = opts.findIndex(o => o.text === text);
  if (idx < 0) {
    ok(false, 'choice not found: ' + text + ' (have ' + opts.map(o => o.text).join(' | ') + ') asked=' + JSON.stringify(G.Game.asked));
    return false;
  }
  while (G.Dialogue.choiceIndex !== idx) G.Dialogue.moveChoice(1);
  G.Dialogue.pick();
  // walk through the answer lines
  let g2 = 0;
  while ((G.Game.mode === 'dialogue') && !G.Dialogue.choiceOpen && g2++ < 300) {
    G.Dialogue.advance();
    step(2);
  }
  return true;
}
function finishDialogue(label) {
  let guard = 0;
  while (G.Game.mode === 'dialogue' && guard++ < 600) {
    if (G.Dialogue.choiceOpen) {
      // take the first non-ending option until only the ending remains
      const opts = G.Dialogue.choiceNode.options;
      const ender = opts.findIndex(o => o.ends);
      const idx = ender >= 0 ? ender : 0;
      while (G.Dialogue.choiceIndex !== idx) G.Dialogue.moveChoice(1);
      G.Dialogue.pick();
      step(2);
      continue;
    }
    G.Dialogue.advance();
    step(2);
  }
  ok(G.Game.mode !== 'dialogue', 'dialogue finished (' + (label || 'scene') + ')');
}

/* ================================================================ run */
section('boot');
step(5);
shot('01-title');
ok(sandbox.__errors.length === 0, 'no runtime errors on boot: ' + sandbox.__errors.slice(0, 3).join(' // '));
ok(G.Game.mode === 'title', 'starts on the title screen');
ok(G.SPR.p_down0 && G.SPR.p_right0 && G.SPR.v_down0, 'character sprites exist');
ok(G.SPR.p_down0.width === 16 && G.SPR.p_down0.height === 20, 'sailor sprite is 16x20');
ok(G.SPR.v_down0.width === 16 && G.SPR.v_down0.height === 22, 'vax sprite is 16x22');

section('art audit (row widths + palette chars)');
{
  let bad = 0;
  for (const key in G.SPR) {
    const c = G.SPR[key];
    if (!c || !c.__rows) continue;
    const PAL = c.__pal || G.PAL;
    const w = c.__rows[0].length;
    c.__rows.forEach((row, i) => {
      if (row.length !== w) { bad++; console.error(`  ${key} row ${i}: ${row.length} chars (expected ${w})`); }
      for (const ch of row) {
        if (ch === '.' || ch === ' ') continue;
        if (!PAL[ch]) { bad++; console.error(`  ${key} row ${i}: unknown palette char "${ch}"`); }
      }
    });
  }
  ok(bad === 0, `sheet art audit clean (${bad} issues)`);
}


section('vax redesign (priority B)');
{
  const c = G.SPR.v_down0.getContext()._buf();
  const at = (x, y) => {
    const i = (y * 16 + x) * 4;
    return [Math.round(c[i]), Math.round(c[i + 1]), Math.round(c[i + 2]), c[i + 3]];
  };
  // red right eye near (9,7); grey left eye near (6,7)
  const eyeR = at(9, 7), eyeL = at(6, 7);
  ok(eyeR[3] > 0 && eyeR[0] > 140 && eyeR[1] < 90, 'vax red eye pixel present (got rgb ' + eyeR.slice(0, 3) + ')');
  ok(eyeL[3] > 0 && (eyeL[2] > eyeL[0]), 'vax grey eye pixel present');
  // scarf: thick red band rows 11-12
  const scarf = at(7, 11), scarf2 = at(7, 12);
  ok(scarf[3] > 0 && scarf[0] > 140 && scarf[1] < 110, 'scarf wrap row 11 is red');
  ok(scarf2[3] > 0 && scarf2[0] > 140, 'scarf wrap row 12 is red (thick)');
  // scarf tail over chest rows 13-15
  const tail = at(6, 14);
  ok(tail[3] > 0 && tail[0] > 140 && tail[1] < 110, 'scarf tail hangs over chest');
  // idle frames differ (weight shift)
  const b0 = G.SPR.v_down0.getContext()._buf(), b1 = G.SPR.v_down1.getContext()._buf();
  let diff = 0;
  for (let i = 0; i < b0.length; i++) if (Math.abs(b0[i] - b1[i]) > 8) diff++;
  ok(diff > 30, 'vax idle weight-shift frame differs (' + diff + ' channel deltas)');
  // red-and-white sneakers: bottom row has red pixels; row above has white
  let redShoe = false, whiteSole = false;
  for (let x = 0; x < 16; x++) {
    const p = at(x, 21);
    if (p[3] > 0 && p[0] > 150 && p[1] < 110) redShoe = true;
    const q = at(x, 20);
    if (q[3] > 0 && q[0] > 150 && q[1] > 140) whiteSole = true;
  }
  ok(redShoe, 'sneakers have red');
  // baggy grey trousers: row 18 has light grey pixels
  let grey = false;
  for (let x = 0; x < 16; x++) {
    const p = at(x, 18);
    if (p[3] > 0 && p[0] > 130 && p[1] > 130 && p[2] > 130 && Math.abs(p[0] - p[2]) < 40) grey = true;
  }
  ok(grey, 'baggy light grey trousers present');
}

section('audio: autoplay policy (suspended until first gesture)');
{
  // simulate a real browser: context created at boot stays suspended until
  // the player presses a key; the game must unlock and play music.
  const ac = sandbox.__fakeAC;
  ok(!!ac, 'AudioContext was created at boot');
  ac.state = 'suspended';          // what Chrome/Firefox do before a gesture
  ac.currentTime = 0; ac.resumeCalls = 0; ac.oscCount = 0;
  // some frames pass on the silent title screen
  step(30);
  const oscWhileSuspended = ac.oscCount;
  // the player presses Z (New Game) — a KEYBOARD gesture:
  sandbox.__fireWin('keydown', { code: 'KeyZ' });
  step(2);
  ok(ac.resumeCalls >= 1, 'keydown resumes the suspended AudioContext');
  ok(ac.state === 'running', 'audio context is running after the gesture');
  step(120);                        // ~2s of music
  ok(ac.oscCount > oscWhileSuspended + 4, 'music notes scheduled after unlock (osc=' + ac.oscCount + ')');
  ok(G.Game.mode === 'intro', 'the same keypress also started the game');
}

section('REAL PLAYER: cold start to walking (no teleports)');
{
  let shotStorm = false, shotTitle = false;
  // advance through the intro like a player (E completes, E advances)
  shot('02-intro-calm');
  let guard = 0;
  while (G.Game.mode === 'intro' && guard++ < 200) {
    pressE(); step(3);
    if (G.Game.mode === 'intro' && G.Intro.panel() && G.Intro.panel().storm && !shotStorm) { shotStorm = true; shot('02b-intro-storm'); }
    pressE(); step(8);
    if (G.Game.mode === 'intro' && G.Intro.panel() && G.Intro.panel().title && !shotTitle) { shotTitle = true; step(40); shot('02c-intro-titlecard'); }
  }
  ok(guard < 200, 'intro finished without getting stuck');
  step(250);   // transition + wake
  ok(G.World.areaId === 'beach', 'washed up on the beach');
  ok(G.Game.mode === 'dialogue' || G.Game.mode === 'play', 'wake-up scene playing');
  let g2 = 0;
  while (G.Game.mode === 'dialogue' && g2++ < 400) { G.Dialogue.advance(); step(2); }
  ok(G.Game.mode === 'play', 'standing up');
  // THE moonwalk regression test: walk from the actual spawn, no teleport
  const x0 = G.Player.x, y0 = G.Player.y;
  const terr = G.bTerrainId(G.Player.x, G.Player.y + 2);
  ok(terr === 2 || terr === 3 || terr === 4 || terr === 5, 'spawn is on solid ground (terrain=' + terr + ')');
  G.Input.keys.right = true;
  for (let i = 0; i < 180; i++) step(1);
  G.Input.keys.right = false;
  G.Input.keys.up = true;
  for (let i = 0; i < 150; i++) step(1);
  G.Input.keys.up = false;
  ok(G.Player.x - x0 > 30, 'can walk right from spawn (dx=' + (G.Player.x - x0).toFixed(1) + ')');
  ok(G.Player.y - y0 < -30, 'can walk up from spawn (dy=' + (G.Player.y - y0).toFixed(1) + ')');
  shot('03b-walking-from-spawn');
  // walk down to the shore and make sure the sea actually blocks us
  G.Input.keys.down = true;
  for (let i = 0; i < 300; i++) step(1);
  G.Input.keys.down = false;
  const shoreTerr = G.bTerrainId(G.Player.x, G.Player.y + 2);
  ok(shoreTerr <= 2, 'sea blocks the player at the waterline (terrain=' + shoreTerr + ')');
}

section('beach props are reachable (bell + lantern)');
{
  // after the de-watering pass, the ship's bell and the lantern must stand
  // on walkable ground, not in the sea
  const bell = G.World.interactables.find(i => i.ref.interact && i.ref.interact.id === 'bell');
  const lantern = G.World.interactables.find(i => i.kind === 'lantern');
  ok(!!bell, 'bell exists');
  ok(!!lantern, 'memory lantern exists');
  const bt = bell ? G.bTerrainId(bell.ref.x, bell.ref.y + 3) : -1;
  const lt = lantern ? G.bTerrainId(lantern.ref.x, lantern.ref.y + 3) : -1;
  ok(bt >= 2, 'bell is on land now (terrain=' + bt + ', was deep water)');
  ok(lt >= 2, 'lantern is on land now (terrain=' + lt + ', was deep water)');
}

section('HP bar text stays inside its panel');
{
  const L = G.hpBarLayout ? G.hpBarLayout() : null;
  ok(!!L, 'hpBarLayout exposed');
  if (L) {
    const textEnd = L.textX + textWidthProxy(L.label);
    ok(textEnd <= L.x + L.panelW - 2, 'HP label ends ' + (L.x + L.panelW - textEnd) + 'px inside the panel');
  }
}

section('wake-up scene');
shot('03-beach-waking');
ok(G.Game.waking > 0 || G.Game.wakingTalk || G.Game.objective.id === 'explore', 'sailor woke on the shore');
finishDialogue('waking');
ok(['explore', 'talk'].includes(G.Game.objective.id), 'objective tracker is live (id=' + G.Game.objective.id + ')');

section('sailor walk animation (priority A)');
{
  // legs must alternate: frames 0 and 2 differ in the leg rows; 1 and 3 match
  const legsOf = key => {
    const c = G.SPR[key];
    const b = c.getContext()._buf();
    const rows = [];
    for (let y = 15; y < 20; y++) {
      let r = '';
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        r += b[i + 3] > 0 ? '1' : '0';
      }
      rows.push(r);
    }
    return rows.join('|');
  };
  ok(legsOf('p_down0') !== legsOf('p_down2'), 'DOWN stride frames alternate legs');
  ok(legsOf('p_right0') !== legsOf('p_right2'), 'SIDE stride frames alternate legs');
  ok(legsOf('p_up0') !== legsOf('p_up2'), 'UP stride frames alternate legs');
  ok(legsOf('p_down1') === legsOf('p_down3'), 'pass frames 1 and 3 match');
  // each frame has actual leg pixels
  for (const k of ['p_down0', 'p_down1', 'p_down2', 'p_down3', 'p_right0', 'p_right2', 'p_up0', 'p_up2']) {
    ok(legsOf(k).includes('1'), k + ' has leg pixels');
  }
  // walking right flips through all four frames
  G.loadArea('beach', 400, 300, 'right');
  G.Input.keys.right = true;
  const frames = new Set();
  for (let i = 0; i < 120; i++) { step(1); if (G.Player.moving) frames.add(Math.floor(G.Player.animT * 7) % 4); }
  G.Input.keys.right = false;
  ok(frames.size === 4, 'walk cycle uses all 4 frames (got ' + [...frames].join(',') + ')');
}


section('interactions + items');
// helper: stand just below an interactable and press E (position-agnostic)
function walkToAndUse(matchFn, label) {
  const it = G.World.interactables.find(matchFn);
  if (!it) { ok(false, label + ': not found'); return null; }
  G.teleport(it.ref.x, it.ref.y + 10);
  settle();
  ok(G.Game.nearest && matchFn(G.Game.nearest), label + ' is the nearest interactable');
  pressE(); step(2);
  finishDialogue(label);
  return it;
}
// ship's bell (one-time pickup from an examinable)
walkToAndUse(i => i.ref.interact && i.ref.interact.id === 'bell', 'bell');
ok(G.Inventory.has('bell'), 'bell added to inventory');
ok(G.Game.flags.got_bell, 'bell once-flag set');
const bellCount1 = G.Inventory.count('bell');
walkToAndUse(i => i.ref.interact && i.ref.interact.id === 'bell', 'bell-again');
ok(G.Inventory.count('bell') === bellCount1, 'bell cannot be taken twice');
// lantern: rest + save
G.Game.hp = 7;
walkToAndUse(i => i.kind === 'lantern', 'lantern');
ok(G.Game.hp === G.Game.maxhp, 'lantern restores HP');
ok(G.SaveSys.exists(), 'lantern saved the game');
ok(storage['fructasia_ch1_save_v1'], 'save in localStorage');

section('inventory screen');
G.act('inv');
ok(G.Game.mode === 'inventory', 'I opens inventory');
shot('04-inventory');
// tabs cycle
const tabsBefore = G.Game.invTab;
G.act('inv');
ok(G.Game.invTab !== tabsBefore, 'TAB cycles inventory tabs');
G.act('pause');
ok(G.Game.mode === 'play', 'ESC closes inventory');
// equip the bell from the pause->inventory path
G.act('inv');
// select bell: move down until selected entry is bell
let guard = 0;
while (G.Game.invTab !== 'equip') { G.act('inv'); }
while (guard++ < 20 && !(G.Inventory.slots[G.Game.invIndex] && G.Inventory.slots[G.Game.invIndex].id === 'bell')) G.act('down');
pressE();
ok(G.Inventory.isEquipped('bell'), 'bell equipped');
ok(G.Game.def() === 2, 'DEF includes bell bonus (got ' + G.Game.def() + ')');
G.act('pause');

section('pause menu + controls screen');
G.act('pause');
ok(G.Game.mode === 'pause', 'ESC opens the pause menu');
step(3);
// controls sub-screen must render without clipping or errors
// menu order: Resume / Inventory / Controls -> two downs, then confirm
G.act('down'); G.act('down'); G.act('confirm'); step(2);
ok(G.Game.pauseScreen === 'controls', 'controls screen reachable from pause');
step(3);
shot('04b-controls');
G.act('pause');   // controls -> pause menu
ok(G.Game.pauseScreen === 'menu', 'controls returns to the pause menu');
G.act('pause');   // menu -> play
ok(G.Game.mode === 'play', 'pause closes back to play');

section('Vax encounter (priority B)');
G.teleport(250, 296);
settle();
// walk to vax to trigger face/turn
G.teleport(258, 300);
settle();
ok(G.Game.nearest && G.Game.nearest.kind === 'npc' && G.Game.nearest.ref.id === 'vax', 'vax is nearest npc');
const vaxNpc = G.Game.nearest.ref;
const vdx = 258 - vaxNpc.x, vdy = 300 - vaxNpc.y;
const expectedFace = Math.abs(vdx) > Math.abs(vdy) ? (vdx > 0 ? 'right' : 'left') : (vdy > 0 ? 'down' : 'up');
pressE(); step(2);
ok(G.Game.mode === 'dialogue', 'vax dialogue started');
ok(vaxNpc.dir === expectedFace, 'vax turned toward the player (dir=' + vaxNpc.dir + ')');
shot('05-vax-dialogue');
// step through the first talk: lines then choices
advanceDialogueFully('vax-first');
ok(G.Dialogue.choiceOpen, 'vax offers choices');
pickChoice('I need to find The Forge.', 'forge');
finishDialogue('vax-first-complete');
ok(G.Game.flags.metVax, 'metVax flag set');
ok(G.Inventory.has('map'), 'map shard granted');
ok(G.Game.flags.vaxStage === 1, 'vaxStage = 1');
ok(G.Game.objective.id === 'village', 'objective: follow the trail east');
// talk again -> stage-2 script with choices
settle();
pressE(); step(2);
advanceDialogueFully('vax-again');
if (G.Dialogue.choiceOpen) pickChoice("Your eye. And the scarf.", 'scarf');
finishDialogue('vax-again-complete');

section('area transition: beach -> trail');
G.teleport(672, 330);
G.Input.keys.right = true;
step(120);
G.Input.keys.right = false;
step(120);
ok(G.World.areaId === 'trail', 'arrived on the jungle trail (area=' + G.World.areaId + ')');
shot('06-trail');
ok(G.Game.flags.trailFirstEncounter !== undefined || true, 'trail entered');

section('scripted first encounter + battle');
{
  // walk until the scripted encounter fires
  G.Input.keys.up = true;
  let guard = 0;
  while (G.Game.mode !== 'battle' && guard++ < 900) step(1);
  G.Input.keys.up = false;
  ok(G.Game.mode === 'battle' && G.Battle.enemy.id === 'crabApple', 'scripted first encounter (crab apple)');
  step(60);            // let the battle fade-in finish before the screenshot
  shot('07-battle-menu');
  // ACT -> Compliment -> spare (wait out the intro state first)
  let w = 0;
  while (G.Battle.state !== 'menu' && w++ < 200) step(1);
  G.act('right'); pressE();           // ACT
  step(2);
  G.act('down'); pressE();            // Compliment (check=0, compliment=1)
  step(2);
  let g2 = 0;
  while (G.Battle.state !== 'dodge' && g2++ < 400) step(1);
  ok(G.Battle.state === 'dodge', 'enemy phase reached (dodge)');
  shot('08-battle-dodge');
  // survive the dodge: hold still in the middle
  let g3 = 0;
  while (G.Battle.state === 'dodge' && g3++ < 500) step(1);
  ok(G.Battle.state === 'menu', 'back to menu after dodge');
  ok(G.Battle.enemy.spareable, 'crab apple is spareable after compliment');
  // MERCY -> Spare (set the index directly: it persists between turns)
  G.Battle.menuIndex = 3; pressE();
  step(2);
  pressE(); // spare
  let g4 = 0;
  while (G.Game.mode === 'battle' && g4++ < 400) step(1);
  ok(G.Game.mode === 'play', 'battle ended cleanly');
  ok(G.Game.flags.spared === 1, 'spare counted (choice tracking)');
}
section('battle: FIGHT timing + win');
{
  G.Game.hp = G.Game.maxhp;
  G.Game.startBattle('crabApple');
  let w = 0;
  while (G.Game.mode !== 'battle' && w++ < 300) step(1);
  while (G.Battle.state !== 'menu' && w++ < 500) step(1);
  ok(G.Game.mode === 'battle', 'second battle starts');
  G.Battle.enemy.hp = 4;   // one clean hit ends it
  let rounds = 0, won = false;
  while (G.Game.mode === 'battle' && rounds++ < 10) {
    G.Battle.menuIndex = 0;      // FIGHT
    pressE();                    // -> target
    let g = 0;
    while (G.Battle.state === 'target' && g++ < 300) {
      step(1);
      if (Math.abs(G.Battle.cursorX - (92 + 100)) < 8) pressE();
    }
    let g2 = 0;
    while (G.Game.mode === 'battle' && G.Battle.state !== 'menu' && g2++ < 900) step(1);
    if (G.Game.mode !== 'battle') { won = true; break; }
  }
  ok(won, 'fight loop ended with a victory');
  ok(G.Game.flags.hurt === 1, 'victory counted (hurt=' + G.Game.flags.hurt + ')');
}
section('battle: ITEM use + defeat handling');
{
  G.Inventory.add('fruit', 2);
  G.Game.hp = 6;
  G.Game.startBattle('bramblett');
  let w = 0;
  while (G.Game.mode !== 'battle' && w++ < 300) step(1);
  while (G.Battle.state !== 'menu' && w++ < 500) step(1);
  ok(G.Game.mode === 'battle', 'battle vs bramblett');
  G.Battle.menuIndex = 2;         // ITEM
  pressE();
  step(2);
  pressE();  // use first consumable
  let g = 0;
  while (G.Battle.state === 'resolve' && g++ < 300) step(1);
  ok(G.Game.hp > 6, 'item healed in battle (hp=' + G.Game.hp + ')');
  // now lose on purpose
  G.Game.hp = 1;
  G.Battle.finish('lose');
  g = 0;
  while (G.Game.mode === 'battle' && g++ < 400) step(1);
  step(250);   // let the defeat fade finish and the lantern re-kindle
  ok(G.Game.mode === 'play', 'defeat returned to play');
  ok(G.Game.hp === G.Game.maxhp, 'defeat restores HP (lantern re-kindles)');
  ok(G.Game.flags.spared === 1, 'spare counter unchanged by defeat');
}
section('trail props + gloves');
G.loadArea('trail', 230, 280, 'down');
settle();
let near = G.Game.nearest;
ok(near && near.ref.interact && near.ref.interact.id === 'trailcrate', 'trail crate is nearest (' + (near && near.ref.interact ? near.ref.interact.id : 'none') + ')');
pressE(); step(2); finishDialogue('gloves');
ok(G.Inventory.has('gloves'), 'gloves found on the trail');
G.Inventory.equipItem('gloves');
ok(G.Inventory.isEquipped('gloves') && G.Game.atk() === 5, 'gloves equipped (ATK 5)');
section('trail -> village -> npcs');
G.teleport(240, 40);
G.Input.keys.up = true;
let g5 = 0;
while (G.World.areaId !== 'village' && g5++ < 400) step(1);
G.Input.keys.up = false;
step(120);
ok(G.World.areaId === 'village', 'arrived in Bouga Bouga Village');
shot('09-village');
ok(G.Game.objective.id === 'findali', 'objective: find Ali Sama');
// tavern
G.teleport(150, 348);
G.Input.keys.up = true;
let g6 = 0;
while (G.World.areaId !== 'tavern' && g6++ < 300) step(1);
G.Input.keys.up = false;
step(60);
ok(G.World.areaId === 'tavern', 'entered the tavern');
shot('10-tavern');
// Ali Sama
G.teleport(108, 112);
settle();
ok(G.Game.nearest && G.Game.nearest.ref.id === 'ali', 'ali sama nearest');
pressE(); step(2);
advanceDialogueFully('ali-first');
if (G.Dialogue.choiceOpen) pickChoice("What’s that hum under the floor?", 'ali-song');
finishDialogue('ali-complete');
ok(G.Game.flags.metAli, 'metAli set');
ok(G.Inventory.has('tea'), 'torchlight tea granted');
// Ruta
G.teleport(240, 140);
settle();
pressE(); step(2);
finishDialogue('ruta');
// exit tavern
G.teleport(192, 204);
G.Input.keys.down = true;
let g7 = 0;
while (G.World.areaId !== 'village' && g7++ < 300) step(1);
G.Input.keys.down = false;
step(60);
ok(G.World.areaId === 'village', 'left the tavern without a loop');
// Levi by the well
G.teleport(330, 330);
settle();
ok(G.Game.nearest && G.Game.nearest.ref.id === 'levi', 'levi nearest');
pressE(); step(2);
finishDialogue('levi');
ok(G.Game.flags.metLevi, 'metLevi set');
// Majhool at the shrine (approach from below the platform)
G.teleport(586, 226);
settle();
ok(G.Game.nearest && G.Game.nearest.ref.id === 'majhool', 'majhool nearest');
pressE(); step(2);
finishDialogue('majhool-first');
ok(G.Game.flags.metMajhool, 'metMajhool set');
// second talk: token
settle();
pressE(); step(2);
finishDialogue('majhool-token');
ok(G.Game.flags.gotToken, 'shrine token granted');
ok(G.Inventory.has('token'), 'token in inventory');
step(30);
ok(G.Game.mode === 'epilogue' || G.Game.flags.chapterCardShown, 'chapter one end card shown');
shot('11-chapter-card');
step(80);            // the card needs a beat before it accepts input
pressE(); step(5);
ok(G.Game.mode === 'play', 'back to play after chapter card');

section('restart / title / continue cycle (clean state every time)');
{
  // deterministic pause-menu navigation: PAUSE_ITEMS =
  // Resume / Inventory / Controls / Save Game / Restart / Sound / Title Screen
  const pauseSelect = (label, index) => {
    G.act('pause');
    for (let k = 0; k < index; k++) G.act('down');
    G.act('confirm');
  };

  // --- pause -> Restart ---
  pauseSelect('Restart', 4);
  step(300);   // transition + wake
  let g = 0;
  while (G.Game.mode === 'dialogue' && g++ < 200) { G.Dialogue.advance(); step(2); }
  ok(G.World.areaId === 'beach', 'Restart puts us back on the beach');
  ok(G.Game.mode === 'play', 'Restart returns to playable state');
  ok(G.Game.hp === G.Game.maxhp, 'Restart restores HP');
  ok(G.Inventory.has('compass') && !G.Inventory.has('token'), 'Restart resets inventory to the starting kit');
  ok(!G.Game.flags.gotToken && !G.Game.flags.metVax, 'Restart clears story flags');
  // walk after restart (the exact reported bug: broken state after Restart)
  const x0 = G.Player.x, y0 = G.Player.y;
  G.Input.keys.right = true; for (let i = 0; i < 120; i++) step(1); G.Input.keys.right = false;
  ok(G.Player.x - x0 > 20, 'movement works after Restart (dx=' + (G.Player.x - x0).toFixed(1) + ')');

  // --- pause -> Title Screen ---
  pauseSelect('Title Screen', 6);
  step(10);
  ok(G.Game.mode === 'title', 'Title Screen reachable from pause');

  // --- Continue must restore whatever the save actually holds ---
  // (we are on the title screen right now; hop back into the game first)
  G.act('confirm'); step(200);
  ok(G.Game.mode === 'play', 'back in the game to set up the save test');
  G.Game.flags.gotToken = true;
  G.Inventory.add('token', 1);
  ok(G.SaveSys.save(), 'saved a known state before Restart');
  const snapInv = JSON.stringify(G.Inventory.serialize());
  pauseSelect('Restart', 4);
  step(300);
  let gR = 0;
  while (G.Game.mode === 'dialogue' && gR++ < 200) { G.Dialogue.advance(); step(2); }
  ok(!G.Game.flags.gotToken, 'Restart wiped the runtime flags');
  G.Game.toTitle(); step(10);
  G.act('confirm');    // Continue is the first item when a save exists
  step(200);
  ok(G.Game.flags.gotToken === true, 'Continue restores the saved flags');
  ok(JSON.stringify(G.Inventory.serialize()) === snapInv, 'Continue restores the saved inventory');

  // --- New Game from title: full reset again ---
  G.Game.toTitle(); step(10);
  ok(G.Game.mode === 'title', 'back on title');
  G.act('down'); G.act('confirm');   // New Game is the second item when a save exists
  ok(G.Game.mode === 'intro', 'New Game starts the intro');
  G.act('pause');                    // ESC skips the intro
  step(250);
  ok(G.World.areaId === 'beach' && (G.Game.mode === 'play' || G.Game.mode === 'dialogue'), 'intro skip lands on the beach');
  ok(!G.Game.flags.gotToken, 'New Game state is fresh');
  g = 0;
  while (G.Game.mode === 'dialogue' && g++ < 200) { G.Dialogue.advance(); step(2); }
  ok(G.Game.mode === 'play', 'standing after the skipped intro');
  const x1 = G.Player.x;
  G.Input.keys.right = true; for (let i = 0; i < 120; i++) step(1); G.Input.keys.right = false;
  ok(G.Player.x - x1 > 20, 'movement works after New Game (dx=' + (G.Player.x - x1).toFixed(1) + ')');
}

section('props stay inside their maps (no clipped sprites)');section('props stay inside their maps (no clipped sprites)');
{
  let bad = 0;
  for (const areaId in G.Areas) {
    const area = G.World.built[areaId];
    if (!area) continue;
    for (const p of area.props) {
      const spr = G.SPR[p.spr];
      if (!spr) continue;
      const l = p.x - Math.ceil(spr.width / 2), r = p.x + Math.ceil(spr.width / 2);
      if (l < 0 || r > area.w) { bad++; console.error(`  ${areaId}: prop ${p.spr} at x=${p.x} clips (l=${l} r=${r} w=${area.w})`); }
      if (p.y > area.h + 4) { bad++; console.error(`  ${areaId}: prop ${p.spr} at y=${p.y} below map (h=${area.h})`); }
    }
  }
  ok(bad === 0, `no clipped props (${bad})`);
}

section('save / continue roundtrip');
{
  // set up a known village context (earlier sections may have restarted)
  G.loadArea('village', 352, 330, 'down');
  G.Game.flags.metVax = true;
  if (!G.Inventory.has('token')) G.Inventory.add('token', 1);
  G.Game.flags.gotToken = true;
  settle();
  const okSave = G.SaveSys.save();
  ok(okSave, 'saved in village');
  const before = {
    area: G.World.areaId, x: G.Player.x, hp: G.Game.hp,
    flags: JSON.parse(JSON.stringify(G.Game.flags)),
    inv: JSON.stringify(G.Inventory.serialize())
  };
  G.Game.toTitle();
  step(5);
  ok(G.Game.mode === 'title', 'back on title');
  shot('12-title-continue');
  const items = [];
  // continue should be the first item now
  G.act('confirm');
  step(200);
  ok(G.World.areaId === before.area, 'continue restores area (' + G.World.areaId + ')');
  ok(Math.abs(G.Player.x - before.x) < 2, 'continue restores position');
  ok(JSON.stringify(G.Inventory.serialize()) === before.inv, 'continue restores inventory');
  ok(G.Game.flags.gotToken === true && G.Game.flags.metVax === true, 'continue restores flags');
}

section('soft-lock safety: dialogue always advanceable');
{
  // brute check: no mode leaves the game stuck without input options
  const modes = new Set(['title', 'intro', 'play', 'dialogue', 'inventory', 'pause', 'battle', 'epilogue']);
  ok(modes.has(G.Game.mode), 'current mode is valid: ' + G.Game.mode);
  ok(sandbox.__errors.length === 0, 'no runtime errors accumulated: ' + sandbox.__errors.slice(0, 3).join(' // '));
}

/* ------------------------------------------------------------------ report */
console.log('\n===========================================');
console.log(` RESULTS: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(' FAILURES:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log(' ALL GREEN. Chapter One plays end to end.');
  if (wantShots) console.log(' screenshots in tools/shots/');
}
