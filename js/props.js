/* ============================================================================
   js/props.js — every environment prop, painted procedurally at load time.
   Lighting canon: light from the TOP-LEFT (pale pixels up-left, shadow
   down-right), 1-2px dark outlines, greens slightly desaturated so the
   "tropical paradise" reads a touch dead under the sunshine.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ palms */
function paintPalm(seed, opt) {
  opt = Object.assign({ H: 56, W: 54, trunkH: 21, lean: 1, fronds: 9, coconuts: true }, opt);
  const rng = mulberry32(seed);
  const { c, x } = makeCanvas(opt.W, opt.H);
  const baseX = Math.round(opt.W / 2);
  const line = [];
  for (let i = 0; i <= opt.trunkH; i++) {
    const t = i / opt.trunkH;
    const cx = baseX + Math.round((Math.sin(t * 1.9) * 0.9 + t * 0.5) * opt.lean * 2.6);
    line.push([cx, opt.H - 1 - i]);
  }
  for (let i = 0; i < line.length; i++) {
    const [cx, cy] = line[i];
    const q = i / (line.length - 1);
    const half = q < 0.18 ? 2 : 1;
    x.fillStyle = '#5a2c19'; x.fillRect(cx - half - 1, cy, half * 2 + 3, 1);
    x.fillStyle = '#9c4b29'; x.fillRect(cx - half, cy, half * 2 + 1, 1);
    x.fillStyle = '#b5693c'; x.fillRect(cx - half, cy, half, 1);
    if (i % 3 === 1) { x.fillStyle = '#6b3520'; x.fillRect(cx - half, cy, half * 2 + 1, 1); }
  }
  const [rtx, rty] = line[0];
  x.fillStyle = '#5a2c19'; x.fillRect(rtx - 4, rty, 9, 1);
  x.fillStyle = '#9c4b29'; x.fillRect(rtx - 3, rty - 1, 2, 1); x.fillRect(rtx + 2, rty - 1, 2, 1);
  const [tx, ty] = line[line.length - 1];
  const blade = (ang, len, drop, colTop, colMid, colLow) => {
    for (let s2 = 0; s2 <= len; s2++) {
      const q = s2 / len;
      const fx = tx + Math.cos(ang) * s2 * 1.02;
      const fy = ty + Math.sin(ang) * s2 * 0.72 + q * q * drop;
      const wHalf = (2.6 - q * 2.1) * (1 - q * 0.15);
      const perp = ang + Math.PI / 2;
      const span = Math.max(0, Math.round(wHalf));
      for (let w = -span; w <= span; w++) {
        const col = w < 0 ? colTop : (w === 0 ? colMid : colLow);
        x.fillStyle = col;
        x.fillRect(Math.round(fx + Math.cos(perp) * w), Math.round(fy + Math.sin(perp) * w * 0.7), 1, 1);
      }
    }
  };
  const fronds = [];
  for (let f = 0; f < opt.fronds; f++) {
    const t = f / (opt.fronds - 1);
    const ang = -Math.PI + 0.16 + t * (Math.PI - 0.32) + (rng() - 0.5) * 0.14;
    const len = 14 + Math.sin(f * 1.9) * 3 + rng() * 3;
    fronds.push([ang, len, 10 + rng() * 4]);
  }
  fronds.forEach(([a, l, d]) => blade(a, l, d + 1, '#1c4229', '#274f33', '#224a2d'));
  fronds.forEach(([a, l, d]) => blade(a, l, d, '#57a15c', '#488f56', '#33704a'));
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.55;
    blade(a, 8 + i * 2, 4, '#71b46c', '#57a15c', '#488f56');
  }
  x.fillStyle = '#274f33'; x.fillRect(tx - 1, ty - 1, 3, 2);
  if (opt.coconuts) {
    x.fillStyle = '#42291a';
    x.fillRect(tx - 3, ty + 2, 2, 2); x.fillRect(tx + 2, ty + 3, 2, 2);
    x.fillStyle = '#5f3d26';
    x.fillRect(tx - 3, ty + 2, 1, 1); x.fillRect(tx + 2, ty + 3, 1, 1);
  }
  return c;
}

/* ----------------------------------------------------------- canopy trees */
function paintCanopyTree(seed, opt) {
  opt = Object.assign({ W: 52, H: 50, fruit: true, fruitColor: '#e9a23b', canopyY: 24 }, opt);
  const rng = mulberry32(seed);
  const { c, x } = makeCanvas(opt.W, opt.H);
  const cx = Math.round(opt.W / 2), baseY = opt.H - 1;
  for (let i = 0; i < 15; i++) {
    const y = baseY - i, off = Math.round(Math.sin(i * 0.22) * 1.2);
    x.fillStyle = i % 4 === 0 ? '#6b3520' : '#9c4b29';
    x.fillRect(cx - 1 + off, y, 3, 1);
    if (i < 8) px(x, cx - 2 + off, y, '#7d4224');
  }
  x.fillStyle = '#6b3520';
  x.fillRect(cx - 5, baseY - 1, 4, 1); x.fillRect(cx + 2, baseY - 1, 4, 1);
  x.fillStyle = '#6b3520';
  x.fillRect(cx - 4, baseY - 13, 4, 1); x.fillRect(cx + 2, baseY - 15, 4, 1);
  x.fillRect(cx - 7, baseY - 17, 4, 1); x.fillRect(cx + 4, baseY - 19, 4, 1);
  const blobs = [[cx, baseY - opt.canopyY, 10]];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    blobs.push([
      cx + Math.cos(a) * 11 + (rng() - 0.5) * 3,
      baseY - opt.canopyY + Math.sin(a) * 6 + (rng() - 0.5) * 3,
      6 + rng() * 3.5
    ]);
  }
  blobs.forEach(b => fillCircle(x, b[0], b[1], b[2] + 1, '#274f33'));
  blobs.forEach(b => fillCircle(x, b[0], b[1], b[2], '#3c7549'));
  blobs.forEach(b => fillCircle(x, b[0] - 2, b[1] - 2, b[2] - 3.2, '#4b8f57'));
  blobs.forEach(b => fillCircle(x, b[0] - 2, b[1] - 3, b[2] - 5, '#5a9f60'));
  for (let i = 0; i < 40; i++) {
    const b = blobs[(rng() * blobs.length) | 0];
    x.fillStyle = rng() > 0.45 ? '#71b46c' : '#33684a';
    x.fillRect(Math.round(b[0] + (rng() - 0.5) * b[2] * 1.7), Math.round(b[1] + (rng() - 0.5) * b[2] * 1.5), 1, 1);
  }
  if (opt.fruit) {
    for (let i = 0; i < 8; i++) {
      const b = blobs[(rng() * blobs.length) | 0];
      const fx = Math.round(b[0] + (rng() - 0.5) * b[2] * 1.6);
      const fy = Math.round(b[1] + (rng() - 0.5) * b[2] * 1.3) + 2;
      x.fillStyle = '#8f4a28'; x.fillRect(fx, fy, 3, 3);
      x.fillStyle = opt.fruitColor; x.fillRect(fx, fy, 2, 2);
      px(x, fx, fy, '#ffe6a8');
    }
  }
  return c;
}

/* ------------------------------------------------------------------ bush */
function paintBush(seed, opt) {
  opt = Object.assign({ W: 30, H: 20, fruit: false, fruitColor: '#cf4b57' }, opt);
  const rng = mulberry32(seed);
  const { c, x } = makeCanvas(opt.W, opt.H);
  const cy = opt.H - 6, cx = Math.round(opt.W / 2);
  const blobs = [];
  for (let i = 0; i < 4; i++) blobs.push([cx + (i - 1.5) * 5 + (rng() - 0.5) * 2, cy + (rng() - 0.5) * 3, 5 + rng() * 3]);
  blobs.forEach(b => fillCircle(x, b[0], b[1], b[2] + 1, '#274f33'));
  blobs.forEach(b => fillCircle(x, b[0], b[1], b[2], '#3c7549'));
  blobs.forEach(b => fillCircle(x, b[0] - 1.5, b[1] - 2, b[2] - 2.2, '#4b8f57'));
  blobs.forEach(b => fillCircle(x, b[0] - 2.5, b[1] - 3, b[2] - 4, '#5a9f60'));
  for (let i = 0; i < 16; i++) {
    const b = blobs[(rng() * blobs.length) | 0];
    x.fillStyle = rng() > 0.5 ? '#71b46c' : '#33684a';
    x.fillRect(Math.round(b[0] + (rng() - 0.5) * b[2] * 1.6), Math.round(b[1] + (rng() - 0.5) * b[2] * 1.4), 1, 1);
  }
  if (opt.fruit) {
    for (let i = 0; i < 6; i++) {
      const b = blobs[(rng() * blobs.length) | 0];
      const fx = Math.round(b[0] + (rng() - 0.5) * b[2] * 1.5);
      const fy = Math.round(b[1] + (rng() - 0.5) * b[2] * 1.2) + 1;
      x.fillStyle = '#8f2b38'; x.fillRect(fx, fy, 2, 2);
      px(x, fx, fy, opt.fruitColor);
    }
  }
  x.fillStyle = 'rgba(20,40,30,0.20)';
  x.fillRect(cx - 9, opt.H - 2, 18, 1);
  return c;
}

/* ------------------------------------------------------------ small flora */
function paintGrass(seed) {
  const rng = mulberry32(seed);
  const W = 11, H = 9;
  const { c, x } = makeCanvas(W, H);
  for (let i = 0; i < 5; i++) {
    const bx = 2 + i * 2 + (rng() < 0.5 ? 0 : 1);
    const hgt = 3 + Math.floor(rng() * 4);
    const lean = (rng() - 0.5) * 2.4;
    for (let s = 0; s < hgt; s++) {
      const q = s / hgt;
      px(x, bx + lean * q * q * 2.2, H - 1 - s, s > hgt - 2 ? '#33684a' : '#488f56');
    }
  }
  return c;
}
function paintFlower(seed) {
  const cols = ['#e8c45a', '#e08a4c', '#c9a6e0', '#f4efe4'];
  const rng = mulberry32(seed);
  const W = 9, H = 10;
  const { c, x } = makeCanvas(W, H);
  const cx = 4, baseY = H - 1;
  for (let i = 0; i < 4; i++) px(x, cx + (i % 2 ? 1 : 0), baseY - i, '#33684a');
  const col = cols[(rng() * cols.length) | 0];
  fillCircle(x, cx, baseY - 6, 2.2, col);
  px(x, cx, baseY - 6, '#f7e2a0');
  return c;
}
function paintFern(seed) {
  const rng = mulberry32(seed);
  const W = 24, H = 18;
  const { c, x } = makeCanvas(W, H);
  const bx = W / 2, by = H - 1;
  for (let f = 0; f < 6; f++) {
    const ang = -Math.PI + 0.35 + (f / 5) * (Math.PI - 0.7);
    const len = 9 + rng() * 5;
    for (let s = 0; s < len; s++) {
      const q = s / len;
      const fx = bx + Math.cos(ang) * s * 0.9;
      const fy = by + Math.sin(ang) * s * 0.75 + q * q * 4;
      px(x, fx, fy, s % 2 ? '#33684a' : '#488f56');
      if (s > 1 && s % 2 === 0) px(x, fx + 1, fy + 1, '#274f33');
    }
  }
  return c;
}
function paintScrub(seed) {
  const rng = mulberry32(seed);
  const { c, x } = makeCanvas(13, 8);
  for (let i = 0; i < 7; i++) {
    const bx = 1 + Math.floor(rng() * 10), hgt = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < hgt; s++) {
      x.fillStyle = s > hgt - 2 ? '#74905a' : '#8aa368';
      x.fillRect(bx + (s > 1 && rng() > 0.5 ? 1 : 0), 7 - s, 1, 1);
    }
  }
  return c;
}
function paintFallenFruit(seed) {
  const rng = mulberry32(seed);
  const { c, x } = makeCanvas(7, 5);
  const cols = ['#e9a23b', '#d9663f', '#c4543f'];
  for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
    const fx = 1 + Math.floor(rng() * 4), fy = 1 + Math.floor(rng() * 2);
    x.fillStyle = '#8f4a28'; x.fillRect(fx, fy + 1, 3, 2);
    x.fillStyle = cols[(rng() * cols.length) | 0]; x.fillRect(fx, fy, 2, 2);
    x.fillStyle = '#a4552a'; x.fillRect(fx + 2, fy + 1, 1, 1);
  }
  return c;
}

/* ------------------------------------------------------------------ rocks */
function paintRock(seed, size) {
  const rng = mulberry32(seed);
  const W = size, H = Math.round(size * 0.72) + 2;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2, cy = H * 0.62;
  fillCircle(x, cx, cy, W * 0.5, '#20262e');
  fillCircle(x, cx, cy - 0.5, W * 0.46, '#4e5a64');
  fillCircle(x, cx - 1, cy - 2, W * 0.38, '#74808a');
  fillCircle(x, cx - 2, cy - 3.5, W * 0.24, '#8d99a3');
  for (let i = 0; i < 8; i++) {
    x.fillStyle = rng() > 0.5 ? '#838f98' : '#434e58';
    x.fillRect(Math.round(cx + (rng() - 0.45) * W * 0.7), Math.round(cy - 1 + (rng() - 0.5) * H * 0.6), 1, 1);
  }
  return c;
}

/* ------------------------------------------------------- shipwreck pieces */
function paintWreck() {
  const W = 64, H = 36;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 4;
  x.fillStyle = '#c6ad81';
  x.fillRect(9, baseY + 1, 40, 1);
  x.fillRect(14, baseY + 2, 26, 1);
  x.fillStyle = '#d4bd91';
  x.fillRect(12, baseY, 22, 1);
  const hull = new Path2D();
  hull.moveTo(4, 22);
  hull.quadraticCurveTo(6, 9, 20, 6);
  hull.quadraticCurveTo(36, 3, 50, 9);
  hull.quadraticCurveTo(61, 14, 60, 22);
  hull.quadraticCurveTo(58, 30, 44, 31);
  hull.quadraticCurveTo(24, 32, 10, 29);
  hull.closePath();
  try {
    x.save();
    x.clip(hull);
    x.fillStyle = '#7d4224'; x.fillRect(0, 0, W, H);
    for (let y = 6; y < H; y += 3) {
      x.fillStyle = '#934a2c'; x.fillRect(0, y, W, 2);
      x.fillStyle = '#54291a'; x.fillRect(0, y + 2, W, 1);
    }
    x.fillStyle = '#a55738'; x.fillRect(0, 6, W, 3);
    x.fillStyle = '#b4694a'; x.fillRect(0, 9, W, 1);
    fillCircle(x, 48, 20, 9, '#26170f');
    fillCircle(x, 51, 22, 6, '#171008');
    for (let i = 0; i < 12; i++) {
      x.fillStyle = '#422417';
      x.fillRect(8 + i * 4, 12 + (i % 3) * 5, 1, 1);
    }
    x.fillStyle = 'rgba(226,244,238,0.14)'; x.fillRect(0, 26, W, 5);
    x.restore();
    x.strokeStyle = '#1d110a'; x.lineWidth = 1; x.stroke(hull);
  } catch (e) { /* Path2D unavailable in exotic contexts: skip fine details */ }
  const ribs = [[14, 7, 5, -1], [22, 4, 6, 0], [30, 3, 5, 0], [37, 6, 4, 1]];
  ribs.forEach(([rx, ry, rh, sk]) => {
    for (let i = 0; i < rh; i++) {
      const xx = rx + (i > rh * 0.55 ? sk : 0);
      x.fillStyle = '#1d110a'; x.fillRect(xx, ry + i, 2, 1);
      x.fillStyle = '#a55738'; x.fillRect(xx, ry + i, 1, 1);
    }
  });
  x.fillStyle = '#1d110a'; x.fillRect(9, baseY - 16, 4, 16);
  x.fillStyle = '#7d4224'; x.fillRect(10, baseY - 15, 2, 15);
  x.fillStyle = '#a55738'; x.fillRect(10, baseY - 15, 1, 6);
  x.fillStyle = '#422417'; x.fillRect(10, baseY - 17, 3, 2);
  x.fillStyle = '#33684a'; x.fillRect(26, 26, 1, 5); x.fillRect(27, 28, 2, 1);
  x.fillStyle = '#274f33'; x.fillRect(45, 24, 1, 6);
  x.fillStyle = '#6b3520'; x.fillRect(56, baseY - 2, 7, 2);
  return c;
}
function paintMast() {
  const W = 32, H = 36;
  const { c, x } = makeCanvas(W, H);
  for (let y = 0; y < 32; y++) {
    const xx = 12 + Math.round(y * 0.16);
    x.fillStyle = '#33190d'; x.fillRect(xx, y, 4, 1);
    x.fillStyle = '#934a2c'; x.fillRect(xx + 1, y, 2, 1);
  }
  x.fillStyle = '#33190d'; x.fillRect(6, 7, 22, 3);
  x.fillStyle = '#7d4224'; x.fillRect(7, 8, 20, 1);
  x.fillStyle = '#26140c'; x.fillRect(27, 6, 3, 5);
  const sail = new Path2D();
  sail.moveTo(9, 10); sail.lineTo(25, 10); sail.lineTo(24, 22);
  sail.lineTo(21, 18); sail.lineTo(19, 25); sail.lineTo(16, 19);
  sail.lineTo(13, 24); sail.lineTo(11, 17); sail.lineTo(9, 20);
  sail.closePath();
  try {
    x.save(); x.clip(sail);
    x.fillStyle = '#c7bfae'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#aba189'; x.fillRect(0, 16, W, 1); x.fillRect(13, 10, 1, 8);
    x.fillStyle = '#ddd6c6'; x.fillRect(10, 11, 5, 4);
    x.fillStyle = 'rgba(84,74,60,0.25)'; x.fillRect(0, 20, W, 6);
    x.restore();
    x.strokeStyle = '#524a3f'; x.lineWidth = 1; x.stroke(sail);
  } catch (e) {}
  x.fillStyle = '#61523a';
  for (let i = 0; i < 4; i++) x.fillRect(9 + i * 2, 10, 1, 1);
  x.fillStyle = '#33684a'; x.fillRect(6, 30, 3, 1); x.fillRect(23, 31, 4, 1);
  x.fillStyle = '#274f33'; x.fillRect(16, 32, 2, 1);
  x.fillStyle = '#33190d'; x.fillRect(14, 31, 6, 2);
  return c;
}

/* -------------------------------------------------------------- dead wood */
function paintDeadTree(seed) {
  const rng = mulberry32(seed);
  const W = 34, H = 40;
  const { c, x } = makeCanvas(W, H);
  const branch = (x0, y0, ang, len, wid, depth) => {
    for (let s = 0; s < len; s++) {
      const q = s / len;
      const bx = x0 + Math.cos(ang) * s;
      const by = y0 + Math.sin(ang) * s;
      const w = Math.max(1, Math.round(wid * (1 - q * 0.6)));
      x.fillStyle = depth > 1 ? '#171223' : '#221a30';
      x.fillRect(Math.round(bx), Math.round(by), w, 1);
    }
    if (depth > 0) {
      const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
      branch(ex, ey, ang - 0.45 - rng() * 0.35, len * 0.68, Math.max(1, wid - 1), depth - 1);
      branch(ex, ey, ang + 0.4 + rng() * 0.35, len * 0.62, Math.max(1, wid - 1), depth - 1);
      if (depth === 2 && rng() > 0.5) branch(ex, ey, ang + 0.05, len * 0.5, 1, depth - 2);
    }
  };
  branch(W / 2, H - 1, -Math.PI / 2 + (rng() - 0.5) * 0.15, 15, 3, 3);
  x.fillStyle = '#221a30';
  x.fillRect(W / 2 - 5, H - 2, 4, 2); x.fillRect(W / 2 + 2, H - 2, 5, 2);
  return c;
}

/* ------------------------------------------------------- eerie landmarks */
function paintCave() {
  const W = 58, H = 34;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2, baseY = H - 1;
  fillCircle(x, cx, baseY - 5, 25, '#151823');
  fillCircle(x, cx - 4, baseY - 7, 20, '#2a3038');
  fillCircle(x, cx - 9, baseY - 11, 10, '#383f47');
  fillCircle(x, cx + 9, baseY - 4, 9, '#21262d');
  fillCircle(x, cx - 14, baseY - 2, 7, '#2a3038');
  fillCircle(x, cx + 15, baseY - 1, 6, '#1e232a');
  for (let i = 0; i < 10; i++) {
    x.fillStyle = i % 2 ? '#2c5439' : '#244430';
    x.fillRect(Math.round(cx - 22 + (i * 4.6) % 44), Math.round(baseY - 16 + Math.sin(i) * 6), 2, 1);
  }
  const arch = new Path2D();
  arch.moveTo(cx - 11, baseY - 1);
  arch.quadraticCurveTo(cx - 12, baseY - 20, cx, baseY - 21);
  arch.quadraticCurveTo(cx + 12, baseY - 20, cx + 11, baseY - 1);
  arch.closePath();
  try {
    x.fillStyle = '#10121c'; x.fill(arch);
    const inner = new Path2D();
    inner.moveTo(cx - 7, baseY - 1);
    inner.quadraticCurveTo(cx - 8, baseY - 16, cx, baseY - 17);
    inner.quadraticCurveTo(cx + 8, baseY - 16, cx + 7, baseY - 1);
    inner.closePath();
    x.fillStyle = '#060709'; x.fill(inner);
    x.strokeStyle = '#565f68'; x.lineWidth = 1; x.stroke(arch);
  } catch (e) {}
  x.fillStyle = '#2c5439'; x.fillRect(cx - 14, baseY - 16, 5, 2); x.fillRect(cx + 9, baseY - 13, 5, 2);
  x.fillStyle = '#3c7549'; x.fillRect(cx - 13, baseY - 17, 3, 1); x.fillRect(cx + 10, baseY - 14, 3, 1);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = '#1b3527';
    x.fillRect(cx - 9 + i * 5, baseY - 20 + (i % 2), 1, 3 + (i % 3));
  }
  x.fillStyle = 'rgba(150,170,190,0.13)';
  x.fillRect(cx - 3, baseY - 10, 2, 2); x.fillRect(cx + 2, baseY - 6, 1, 1);
  return c;
}
function paintMonolith() {
  const W = 24, H = 42;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2, baseY = H - 1;
  const shape = new Path2D();
  shape.moveTo(cx - 6, baseY);
  shape.lineTo(cx - 5, baseY - 26);
  shape.lineTo(cx - 2, baseY - 34);
  shape.lineTo(cx + 3, baseY - 33);
  shape.lineTo(cx + 5, baseY - 24);
  shape.lineTo(cx + 6, baseY);
  shape.closePath();
  try {
    x.fillStyle = '#131120'; x.fill(shape);
    x.save(); x.clip(shape);
    x.fillStyle = '#1e1b2c'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#292541'; x.fillRect(cx - 5, 0, 4, H);
    x.fillStyle = '#171422'; x.fillRect(cx + 1, 0, 6, H);
    x.fillStyle = '#383260';
    x.fillRect(cx - 3, baseY - 22, 6, 1);
    x.fillRect(cx - 2, baseY - 15, 4, 1);
    x.fillRect(cx - 1, baseY - 26, 1, 5);
    x.fillRect(cx + 1, baseY - 12, 1, 4);
    x.fillStyle = '#484279'; x.fillRect(cx - 1, baseY - 29, 2, 1);
    x.restore();
    x.strokeStyle = '#0d0b15'; x.lineWidth = 1; x.stroke(shape);
  } catch (e) {}
  x.fillStyle = '#274f33'; x.fillRect(cx - 8, baseY - 1, 5, 1); x.fillRect(cx + 4, baseY - 1, 5, 1);
  return c;
}
function paintSigil() {
  const W = 26, H = 20;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2, cy = H / 2 - 1;
  ring(x, cx, cy, 10, 0.62, '#b8a179');
  ring(x, cx, cy, 8.5, 0.62, '#84755c');
  ring(x, cx, cy, 5, 0.62, '#84755c');
  ring(x, cx, cy, 3.6, 0.62, '#584e40');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    for (let r = 5.5; r < 8; r += 0.5) {
      px(x, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62, '#685c48');
    }
  }
  x.fillStyle = '#453a2f'; x.fillRect(cx - 1, cy - 1, 2, 2);
  return c;
}
function paintMat() {
  const W = 34, H = 16;
  const { c, x } = makeCanvas(W, H);
  for (let y = 0; y < H; y++) {
    const half = Math.round(W / 2 * Math.sqrt(1 - Math.pow((y - H / 2) / (H / 2), 2)));
    for (let xx = W / 2 - half; xx < W / 2 + half; xx++) {
      const stripe = (Math.floor((xx + y) / 4) % 2 === 0);
      x.fillStyle = y % 3 === 0 ? '#7d5636' : (stripe ? '#997043' : '#856039');
      x.fillRect(Math.round(xx), y, 1, 1);
    }
  }
  x.fillStyle = '#54371f';
  x.fillRect(6, 2, 1, 12); x.fillRect(W - 7, 2, 1, 12);
  return c;
}
function paintMilestone() {
  const W = 18, H = 22;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2, baseY = H - 1;
  fillCircle(x, cx, baseY - 8, 7, '#20262e');
  fillCircle(x, cx, baseY - 8, 6.2, '#57626c');
  fillCircle(x, cx - 1, baseY - 10, 4.6, '#74808a');
  // inscription: "BOUGA..." — the right half is chiseled away
  x.fillStyle = '#2c353d';
  x.fillRect(cx - 4, baseY - 11, 1, 1); x.fillRect(cx - 2, baseY - 11, 1, 1);
  x.fillRect(cx - 4, baseY - 9, 3, 1); x.fillRect(cx - 4, baseY - 7, 1, 1);
  x.fillRect(cx - 2, baseY - 7, 1, 1);
  x.fillStyle = '#161a2b';
  x.fillRect(cx + 1, baseY - 12, 4, 7); // the chiseled-out half
  x.fillStyle = '#3c4750'; x.fillRect(cx + 1, baseY - 12, 4, 1);
  return c;
}

/* ===================================================== VILLAGE PROPS ===== */
function paintHut(seed, opt) {
  // decaying village hut: sagging thatch, mossy planks, dark doorway
  opt = Object.assign({ W: 74, H: 62, lit: false }, opt || {});
  const rng = mulberry32(seed);
  const { c, x } = makeCanvas(opt.W, opt.H);
  const baseY = opt.H - 2;
  const wallTop = Math.round(opt.H * 0.44);
  const wl = 8, wr = opt.W - 8;
  // walls (weathered planks)
  for (let y = wallTop; y < baseY; y++) {
    for (let xx = wl; xx <= wr; xx++) {
      const shade = (xx - wl) / (wr - wl);
      let col = shade < 0.18 ? '#8a6a48' : shade > 0.86 ? '#5d452e' : '#75573b';
      if ((y + xx) % 13 === 0) col = '#66492f';
      if (y === wallTop) col = '#4d3722';
      x.fillStyle = col; x.fillRect(xx, y, 1, 1);
    }
  }
  // plank gaps
  for (let y = wallTop + 3; y < baseY; y += 5) {
    x.fillStyle = '#4d3722'; x.fillRect(wl, y, wr - wl + 1, 1);
  }
  // moss patches on the wall
  for (let i = 0; i < 14; i++) {
    const mx = wl + Math.floor(rng() * (wr - wl)), my = wallTop + 3 + Math.floor(rng() * (baseY - wallTop - 5));
    x.fillStyle = rng() > 0.5 ? '#3c5c46' : '#48683f';
    x.fillRect(mx, my, 1 + Math.floor(rng() * 2), 1);
  }
  // sagging thatch roof
  const roof = new Path2D();
  roof.moveTo(2, wallTop + 6);
  roof.quadraticCurveTo(opt.W * 0.2, 2, opt.W * 0.5, 5 + rng() * 3);
  roof.quadraticCurveTo(opt.W * 0.85, 2, opt.W - 2, wallTop + 8);
  roof.lineTo(opt.W - 7, wallTop + 10);
  roof.quadraticCurveTo(opt.W * 0.5, wallTop - 2, 7, wallTop + 8);
  roof.closePath();
  try {
    x.save(); x.clip(roof);
    for (let y = 0; y < wallTop + 12; y++) {
      for (let xx = 0; xx < opt.W; xx++) {
        const t = y / (wallTop + 12);
        const n = hash2(xx, y + seed);
        if (n > 0.12) {
          let col = t < 0.35 ? '#9c8a54' : t < 0.7 ? '#87743f' : '#6b5a30';
          if (n > 0.9) col = '#5d4d2a';
          if (n < 0.2) col = '#ab9a63';
          x.fillStyle = col; x.fillRect(xx, y, 1, 1);
        }
      }
    }
    x.restore();
    x.strokeStyle = '#3d3117'; x.lineWidth = 1; x.stroke(roof);
  } catch (e) {}
  // roof moss + a broken patch
  x.fillStyle = '#48683f';
  x.fillRect(opt.W * 0.2, 6, 6, 2); x.fillRect(opt.W * 0.68, 8, 5, 2);
  x.fillStyle = '#2f2412'; x.fillRect(opt.W * 0.42, 4, 5, 3);
  // door (dark) or window (lit)
  const dw = 12, dx = Math.round(opt.W / 2 - dw / 2);
  x.fillStyle = '#241a10'; x.fillRect(dx, baseY - 16, dw, 16);
  x.fillStyle = '#3d2d1c'; x.fillRect(dx, baseY - 16, dw, 1); x.fillRect(dx, baseY - 16, 1, 16); x.fillRect(dx + dw - 1, baseY - 16, 1, 16);
  if (opt.lit) {
    x.fillStyle = '#e8b45a'; x.fillRect(dx + 2, baseY - 14, dw - 4, 13);
    x.fillStyle = '#c28f3d'; x.fillRect(dx + 2, baseY - 14, dw - 4, 2);
    x.fillStyle = '#241a10'; x.fillRect(dx + Math.floor(dw / 2) - 1, baseY - 14, 2, 13);
  }
  // side window, shutter askew
  const wx = wl + 6;
  x.fillStyle = '#2c2013'; x.fillRect(wx, wallTop + 8, 10, 8);
  x.fillStyle = '#4d3722'; x.fillRect(wx - 1, wallTop + 7, 12, 1);
  x.fillStyle = '#5d452e'; x.fillRect(wx - 2, wallTop + 6, 4, 11); // tilted shutter
  // ground shadow
  x.fillStyle = 'rgba(20,26,34,0.25)';
  x.fillRect(wl - 2, baseY, wr - wl + 5, 2);
  return c;
}

function paintTavernBuilding() {
  // The village tavern: bigger, friendlier, still slightly wrong.
  const W = 118, H = 84;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 2, wallTop = 34;
  // stone footing
  for (let xx = 6; xx < W - 6; xx++) {
    const n = hash2(xx, 3);
    x.fillStyle = n > 0.7 ? '#57626c' : n > 0.35 ? '#4e5a64' : '#434e58';
    x.fillRect(xx, baseY - 10, 1, 10);
    if (xx % 9 === 0) { x.fillStyle = '#333c44'; x.fillRect(xx, baseY - 10, 1, 10); }
  }
  // plank walls
  for (let y = wallTop; y < baseY - 10; y++) {
    for (let xx = 8; xx < W - 8; xx++) {
      const shade = (xx - 8) / (W - 16);
      let col = shade < 0.14 ? '#8f6f4c' : shade > 0.85 ? '#5f4830' : '#7a5c3e';
      if ((y + xx) % 15 === 0) col = '#6a4f34';
      x.fillStyle = col; x.fillRect(xx, y, 1, 1);
    }
  }
  // big thatch roof
  const roof = new Path2D();
  roof.moveTo(0, wallTop + 8);
  roof.quadraticCurveTo(W * 0.22, 2, W * 0.5, 7);
  roof.quadraticCurveTo(W * 0.8, 2, W, wallTop + 10);
  roof.lineTo(W - 10, wallTop + 13);
  roof.quadraticCurveTo(W * 0.5, wallTop - 4, 10, wallTop + 11);
  roof.closePath();
  try {
    x.save(); x.clip(roof);
    for (let y = 0; y < wallTop + 16; y++) {
      for (let xx = 0; xx < W; xx++) {
        const t = y / (wallTop + 16);
        const n = hash2(xx + 91, y);
        if (n > 0.12) {
          let col = t < 0.35 ? '#a08d57' : t < 0.7 ? '#8a7742' : '#6e5d32';
          if (n > 0.9) col = '#5f502c';
          x.fillStyle = col; x.fillRect(xx, y, 1, 1);
        }
      }
    }
    x.restore();
    x.strokeStyle = '#3d3117'; x.lineWidth = 1; x.stroke(roof);
  } catch (e) {}
  // warm lit windows
  const win = (wx) => {
    x.fillStyle = '#241a10'; x.fillRect(wx, wallTop + 10, 16, 12);
    x.fillStyle = '#e8b45a'; x.fillRect(wx + 2, wallTop + 12, 12, 9);
    x.fillStyle = '#c28f3d'; x.fillRect(wx + 2, wallTop + 12, 12, 2);
    x.fillStyle = '#241a10'; x.fillRect(wx + 7, wallTop + 12, 2, 9); x.fillRect(wx + 2, wallTop + 16, 12, 1);
    x.fillStyle = '#4d3722'; x.fillRect(wx - 1, wallTop + 9, 18, 1); x.fillRect(wx - 1, wallTop + 22, 18, 1);
  };
  win(18); win(W - 34);
  // door with a little step
  const dx = Math.round(W / 2) - 11;
  x.fillStyle = '#3d2d1c'; x.fillRect(dx - 2, baseY - 30, 26, 3);
  x.fillStyle = '#241a10'; x.fillRect(dx, baseY - 27, 22, 27);
  x.fillStyle = '#e8b45a'; x.fillRect(dx + 3, baseY - 24, 16, 21); // light spilling out
  x.fillStyle = '#241a10'; x.fillRect(dx + 10, baseY - 24, 2, 21);
  x.fillStyle = '#f4e2b0'; x.fillRect(dx + 16, baseY - 14, 2, 2); // handle
  // hanging sign: a mug with a fruit in it
  x.fillStyle = '#3d2d1c'; x.fillRect(W / 2 + 20, wallTop + 2, 2, 12);
  x.fillStyle = '#241a10'; x.fillRect(W / 2 + 14, wallTop + 12, 16, 12);
  x.fillStyle = '#e8a23b'; x.fillRect(W / 2 + 17, wallTop + 15, 10, 6);
  x.fillStyle = '#c4543f'; x.fillRect(W / 2 + 20, wallTop + 17, 4, 3);
  x.fillStyle = '#f4efe4'; x.fillRect(W / 2 + 25, wallTop + 16, 3, 2); // foam
  x.fillStyle = 'rgba(20,26,34,0.25)';
  x.fillRect(6, baseY, W - 8, 2);
  return c;
}

function paintWell() {
  const W = 34, H = 40;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2, baseY = H - 2;
  // stone ring
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    px(x, cx + Math.cos(a) * 10, baseY - 6 + Math.sin(a) * 4.4, '#20262e');
    px(x, cx + Math.cos(a) * 9, baseY - 6 + Math.sin(a) * 3.8, '#57626c');
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    px(x, cx + Math.cos(a) * 6, baseY - 6 + Math.sin(a) * 2.6, '#3c4750');
  }
  // dark water + a pale reflection that isn't the sky
  fillCircle(x, cx, baseY - 6, 3.4, '#0a0d12');
  px(x, cx - 1, baseY - 7, '#3a4a52');
  // posts + little roof
  x.fillStyle = '#5a2c19'; x.fillRect(5, baseY - 26, 3, 21); x.fillRect(W - 8, baseY - 26, 3, 21);
  x.fillStyle = '#7d4224'; x.fillRect(6, baseY - 26, 1, 21); x.fillRect(W - 7, baseY - 26, 1, 21);
  const roof = new Path2D();
  roof.moveTo(0, baseY - 24); roof.lineTo(W / 2, baseY - 34); roof.lineTo(W, baseY - 24);
  roof.lineTo(W - 3, baseY - 22); roof.lineTo(W / 2, baseY - 31); roof.lineTo(3, baseY - 22);
  roof.closePath();
  try {
    x.save(); x.clip(roof);
    for (let y = baseY - 34; y < baseY - 21; y++) {
      for (let xx = 0; xx < W; xx++) {
        const n = hash2(xx, y + 7);
        x.fillStyle = n > 0.4 ? '#87743f' : '#6b5a30';
        x.fillRect(xx, y, 1, 1);
      }
    }
    x.restore();
    x.strokeStyle = '#3d3117'; x.lineWidth = 1; x.stroke(roof);
  } catch (e) {}
  // crossbar + rope + bucket
  x.fillStyle = '#5a2c19'; x.fillRect(4, baseY - 25, W - 8, 2);
  x.fillStyle = '#c7bfae'; x.fillRect(cx - 1, baseY - 23, 1, 9);
  x.fillStyle = '#75573b'; x.fillRect(cx - 3, baseY - 14, 6, 5);
  x.fillStyle = '#5d452e'; x.fillRect(cx - 3, baseY - 10, 6, 1);
  return c;
}

function paintShrine() {
  // The Old Fruit Shrine: a mossy stone altar with seven niches.
  // Six niches are empty. One still holds something dull.
  const W = 86, H = 58;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2, baseY = H - 2;
  // stepped base
  for (let s = 0; s < 3; s++) {
    const bw = 74 - s * 16, bh = 5;
    const by = baseY - s * bh;
    for (let y = 0; y < bh; y++) {
      for (let xx = cx - bw / 2; xx < cx + bw / 2; xx++) {
        const n = hash2(xx + s * 17, y + 40);
        let col = n > 0.75 ? '#57626c' : n > 0.4 ? '#4a555f' : '#3f4a54';
        if (y === 0) col = '#616c76';
        if (y === bh - 1) col = '#333c44';
        x.fillStyle = col; x.fillRect(Math.round(xx), by - y, 1, 1);
      }
    }
  }
  // back slab
  const slabTop = baseY - 34;
  for (let y = 0; y < 20; y++) {
    for (let xx = cx - 20; xx < cx + 20; xx++) {
      const n = hash2(xx + 60, y);
      let col = n > 0.7 ? '#4a555f' : n > 0.35 ? '#434e58' : '#39434c';
      if (xx < cx - 17 || xx > cx + 17) col = '#333c44';
      x.fillStyle = col; x.fillRect(Math.round(xx), slabTop + y, 1, 1);
    }
  }
  // carved fruit motif on the slab (the old guild mark)
  fillCircle(x, cx, slabTop + 9, 6, '#2c353d');
  fillCircle(x, cx, slabTop + 9, 5, '#39434c');
  ring(x, cx, slabTop + 9, 5, 1, '#242b32');
  x.fillStyle = '#242b32';
  x.fillRect(cx - 3, slabTop + 8, 2, 1); x.fillRect(cx + 1, slabTop + 8, 2, 1); // two small carved eyes
  px(x, cx, slabTop + 3, '#2c353d'); px(x, cx, slabTop + 2, '#2c353d');
  // SEVEN niches along the top step — six empty, one occupied
  const nicheY = baseY - 16;
  for (let i = 0; i < 7; i++) {
    const nx = cx - 24 + i * 8;
    x.fillStyle = '#20262e'; x.fillRect(nx, nicheY, 5, 8);
    x.fillStyle = '#151a20'; x.fillRect(nx + 1, nicheY + 2, 3, 6);
    if (i === 3) { // the remaining token: a dull purple fruit-shape
      x.fillStyle = '#533a75'; x.fillRect(nx + 1, nicheY + 3, 3, 4);
      x.fillStyle = '#7d5ba6'; x.fillRect(nx + 1, nicheY + 3, 2, 2);
      px(x, nx + 1, nicheY + 3, '#a884c9');
    }
  }
  // moss over everything
  for (let i = 0; i < 30; i++) {
    const mx = cx - 38 + hash2(i, 1) * 76, my = slabTop + hash2(i, 2) * (baseY - slabTop);
    x.fillStyle = hash2(i, 3) > 0.5 ? '#3c5c46' : '#2f5038';
    x.fillRect(Math.round(mx), Math.round(my), 1 + Math.floor(hash2(i, 4) * 2), 1);
  }
  // offering: one small fruit somebody left
  x.fillStyle = '#a4552a'; x.fillRect(cx - 30, baseY - 3, 3, 2);
  x.fillStyle = '#d9663f'; x.fillRect(cx - 30, baseY - 3, 2, 1);
  return c;
}

function paintGate() {
  // The north gate to the volcano path. Closed. Not locked — "closed".
  const W = 96, H = 74;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 2;
  // posts
  const post = (pxx) => {
    x.fillStyle = '#33190d'; x.fillRect(pxx, baseY - 52, 12, 52);
    x.fillStyle = '#75573b'; x.fillRect(pxx + 2, baseY - 52, 8, 52);
    x.fillStyle = '#8a6a48'; x.fillRect(pxx + 2, baseY - 52, 3, 52);
    x.fillStyle = '#33190d'; x.fillRect(pxx + 1, baseY - 50, 10, 1); x.fillRect(pxx + 1, baseY - 20, 10, 1);
    // carved warning marks
    x.fillStyle = '#8f2b38';
    x.fillRect(pxx + 4, baseY - 44, 4, 1); x.fillRect(pxx + 5, baseY - 45, 2, 3);
    x.fillRect(pxx + 4, baseY - 12, 4, 1); x.fillRect(pxx + 5, baseY - 13, 2, 3);
  };
  post(4); post(W - 16);
  // lintel
  x.fillStyle = '#33190d'; x.fillRect(2, baseY - 58, W - 4, 8);
  x.fillStyle = '#5d452e'; x.fillRect(4, baseY - 56, W - 8, 4);
  // crossed planks blocking the way
  x.save();
  x.translate(0, 0);
  const plank = (x0, y0, w, h, col, colD) => {
    x.fillStyle = colD; x.fillRect(x0, y0, w, h);
    x.fillStyle = col; x.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  };
  plank(18, baseY - 40, 60, 8, '#75573b', '#33190d');
  x.restore();
  // diagonal second plank
  for (let i = 0; i < 64; i++) {
    const yy = baseY - 34 + i * 0.42;
    x.fillStyle = '#33190d'; x.fillRect(16 + i, Math.round(yy), 8, 5);
    x.fillStyle = '#75573b'; x.fillRect(17 + i, Math.round(yy) + 1, 6, 3);
  }
  // warning sign nailed on
  x.fillStyle = '#33190d'; x.fillRect(W / 2 - 22, baseY - 44, 44, 14);
  x.fillStyle = '#9c8a54'; x.fillRect(W / 2 - 20, baseY - 42, 40, 10);
  x.fillStyle = '#3d3117';
  x.fillRect(W / 2 - 14, baseY - 39, 8, 1); x.fillRect(W / 2 - 11, baseY - 42, 1, 7);
  x.fillRect(W / 2 + 2, baseY - 39, 10, 1); x.fillRect(W / 2 + 6, baseY - 42, 1, 7);
  x.fillStyle = 'rgba(20,26,34,0.25)'; x.fillRect(2, baseY, W - 4, 2);
  return c;
}

function paintMemoryLantern() {
  // A Guild Memory Lantern: old brass, fruit-glass, still burning after
  // everything else stopped. Rest + save point.
  const W = 22, H = 44;
  const { c, x } = makeCanvas(W, H);
  const cx = W / 2;
  // post
  x.fillStyle = '#20262e'; x.fillRect(cx - 2, 14, 4, 28);
  x.fillStyle = '#434e58'; x.fillRect(cx - 2, 14, 1, 28);
  x.fillStyle = '#57626c'; x.fillRect(cx - 3, 40, 6, 2);
  x.fillStyle = '#333c44'; x.fillRect(cx - 4, 42, 8, 2);
  // crossarm + hooks
  x.fillStyle = '#20262e'; x.fillRect(cx - 8, 18, 16, 2);
  x.fillStyle = '#434e58'; x.fillRect(cx - 8, 18, 16, 1);
  // hanging lamp body
  x.fillStyle = '#20262e'; x.fillRect(cx - 5, 4, 11, 14);
  x.fillStyle = '#8a6a2e'; x.fillRect(cx - 4, 5, 9, 12);
  x.fillStyle = '#b8934a'; x.fillRect(cx - 4, 5, 3, 12);
  // fruit-glass with the flame inside (flame is animated at draw time)
  x.fillStyle = '#2b2016'; x.fillRect(cx - 3, 7, 7, 9);
  x.fillStyle = '#e8a23b'; x.fillRect(cx - 2, 8, 5, 7);
  x.fillStyle = '#f6c96b'; x.fillRect(cx - 1, 9, 3, 5);
  x.fillStyle = '#fff2c8'; x.fillRect(cx, 10, 1, 3);
  // top cap + ring
  x.fillStyle = '#20262e'; x.fillRect(cx - 4, 2, 9, 3);
  x.fillStyle = '#b8934a'; x.fillRect(cx - 3, 3, 7, 1);
  px(x, cx, 1, '#8a6a2e');
  return c;
}

function paintNoticeBoard() {
  const W = 40, H = 40;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 2;
  x.fillStyle = '#33190d'; x.fillRect(6, baseY - 12, 4, 12); x.fillRect(W - 10, baseY - 12, 4, 12);
  x.fillStyle = '#75573b'; x.fillRect(7, baseY - 12, 2, 12); x.fillRect(W - 9, baseY - 12, 2, 12);
  x.fillStyle = '#33190d'; x.fillRect(2, 4, W - 4, 26);
  x.fillStyle = '#75573b'; x.fillRect(4, 6, W - 8, 22);
  x.fillStyle = '#5d452e';
  for (let y = 8; y < 26; y += 4) x.fillRect(4, y, W - 8, 1);
  // papers: one fresh, one old, one torn
  x.fillStyle = '#e6dcc4'; x.fillRect(8, 9, 10, 12);
  x.fillStyle = '#8d99a1';
  x.fillRect(10, 11, 6, 1); x.fillRect(10, 13, 6, 1); x.fillRect(10, 15, 4, 1);
  x.fillStyle = '#d3c7ab'; x.fillRect(21, 12, 10, 9);
  x.fillStyle = '#8d99a1'; x.fillRect(23, 14, 6, 1); x.fillRect(23, 16, 5, 1);
  x.fillStyle = '#e6dcc4'; x.fillRect(14, 22, 8, 6);
  x.fillStyle = '#8f2b38'; x.fillRect(16, 24, 4, 2); // a red mark on the third
  return c;
}

function paintJetty() {
  const W = 76, H = 22;
  const { c, x } = makeCanvas(W, H);
  for (let i = 0; i < 8; i++) {
    const px0 = 6 + i * 9;
    x.fillStyle = '#33190d'; x.fillRect(px0, 10, 3, 12);
    x.fillStyle = '#75573b'; x.fillRect(px0 + 1, 10, 1, 12);
  }
  for (let y = 0; y < 5; y++) {
    for (let xx = 2; xx < W - 2; xx++) {
      const n = hash2(xx, y + 80);
      x.fillStyle = n > 0.6 ? '#8a6a48' : n > 0.25 ? '#75573b' : '#66492f';
      if ((xx + y * 3) % 17 === 0) x.fillStyle = '#54371f';
      x.fillRect(xx, 4 + y, 1, 1);
    }
  }
  x.fillStyle = '#3d2d1c'; x.fillRect(2, 4, W - 4, 1); x.fillRect(2, 8, W - 4, 1);
  return c;
}

function paintFence(seed) {
  const rng = mulberry32(seed);
  const W = 42, H = 22;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 1;
  for (let i = 0; i < 3; i++) {
    const fx = 4 + i * 16 + Math.floor(rng() * 2);
    x.fillStyle = '#33190d'; x.fillRect(fx, baseY - 16, 4, 16);
    x.fillStyle = '#75573b'; x.fillRect(fx + 1, baseY - 16, 2, 16);
    if (rng() > 0.5) { x.fillStyle = '#33190d'; x.fillRect(fx, baseY - 18, 2, 2); }
  }
  x.fillStyle = '#5d452e'; x.fillRect(0, baseY - 12, W, 2); x.fillRect(0, baseY - 6, W, 2);
  x.fillStyle = '#8a6a48'; x.fillRect(0, baseY - 12, W, 1); x.fillRect(0, baseY - 6, W, 1);
  return c;
}

/* ------------------------------------------------- tavern interior props */
function paintCounter() {
  const W = 88, H = 34;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 1;
  for (let y = 8; y < baseY; y++) {
    for (let xx = 0; xx < W; xx++) {
      const n = hash2(xx + 5, y);
      let col = n > 0.6 ? '#75573b' : n > 0.25 ? '#66492f' : '#5d452e';
      if ((xx + y) % 21 === 0) col = '#54371f';
      x.fillStyle = col; x.fillRect(xx, y, 1, 1);
    }
  }
  x.fillStyle = '#8a6a48'; x.fillRect(0, 0, W, 8);
  x.fillStyle = '#a5825a'; x.fillRect(0, 0, W, 3);
  x.fillStyle = '#54371f'; x.fillRect(0, 7, W, 1);
  x.fillStyle = '#3d2d1c'; x.fillRect(0, 8, W, 1);
  // mugs on the counter
  x.fillStyle = '#c7bfae'; x.fillRect(10, -0 + 1, 6, 5); x.fillStyle = '#e8e1d1'; x.fillRect(11, 2, 4, 3);
  x.fillStyle = '#c7bfae'; x.fillRect(64, 1, 6, 5); x.fillStyle = '#e8e1d1'; x.fillRect(65, 2, 4, 3);
  return c;
}
function paintTable() {
  const W = 34, H = 30;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 1;
  x.fillStyle = '#33190d'; x.fillRect(6, baseY - 12, 3, 12); x.fillRect(W - 9, baseY - 12, 3, 12);
  x.fillStyle = '#75573b'; x.fillRect(7, baseY - 12, 1, 12); x.fillRect(W - 8, baseY - 12, 1, 12);
  x.fillStyle = '#33190d'; x.fillRect(2, baseY - 16, W - 4, 6);
  x.fillStyle = '#8a6a48'; x.fillRect(3, baseY - 15, W - 6, 4);
  x.fillStyle = '#a5825a'; x.fillRect(3, baseY - 15, W - 6, 1);
  return c;
}
function paintStool() {
  const { c, x } = makeCanvas(12, 14);
  x.fillStyle = '#33190d'; x.fillRect(5, 4, 2, 10);
  x.fillStyle = '#33190d'; x.fillRect(1, 3, 10, 4);
  x.fillStyle = '#8a6a48'; x.fillRect(2, 4, 8, 2);
  x.fillStyle = '#a5825a'; x.fillRect(2, 4, 8, 1);
  return c;
}
function paintHearth() {
  const W = 34, H = 44;
  const { c, x } = makeCanvas(W, H);
  const baseY = H - 1;
  // stone fireplace
  for (let y = 0; y < 40; y++) {
    for (let xx = 2; xx < W - 2; xx++) {
      const n = hash2(xx + 31, y);
      let col = n > 0.65 ? '#57626c' : n > 0.3 ? '#4a555f' : '#3f4a54';
      if (y > 12 && xx > 8 && xx < W - 8) continue; // opening
      x.fillStyle = col; x.fillRect(xx, y, 1, 1);
    }
  }
  x.fillStyle = '#20262e'; x.fillRect(7, 14, W - 14, 26);
  x.fillStyle = '#0a0d12'; x.fillRect(9, 16, W - 18, 24);
  // fire glow (animated flicker is drawn over at runtime)
  x.fillStyle = '#8f3a2a'; x.fillRect(12, 34, 10, 4);
  x.fillStyle = '#e08a4c'; x.fillRect(14, 32, 6, 5);
  x.fillStyle = '#f6c96b'; x.fillRect(15, 33, 4, 4);
  x.fillStyle = '#fff2c8'; x.fillRect(16, 35, 2, 2);
  // mantel + a small carved fruit
  x.fillStyle = '#5d452e'; x.fillRect(2, 10, W - 4, 3);
  x.fillStyle = '#8a6a48'; x.fillRect(2, 10, W - 4, 1);
  x.fillStyle = '#a4552a'; x.fillRect(15, 6, 4, 4); x.fillStyle = '#d9663f'; x.fillRect(15, 6, 3, 3);
  x.fillStyle = 'rgba(20,26,34,0.25)'; x.fillRect(2, baseY, W - 4, 1);
  return c;
}
function paintStairs() {
  const W = 34, H = 40;
  const { c, x } = makeCanvas(W, H);
  for (let s = 0; s < 5; s++) {
    const sw = W - s * 6, sx = (W - sw) / 2;
    x.fillStyle = '#33190d'; x.fillRect(sx, 4 + s * 7, sw, 7);
    x.fillStyle = '#75573b'; x.fillRect(sx + 1, 5 + s * 7, sw - 2, 5);
    x.fillStyle = '#a5825a'; x.fillRect(sx + 1, 5 + s * 7, sw - 2, 1);
  }
  x.fillStyle = 'rgba(6,8,12,0.45)'; x.fillRect(0, 0, W, 4);
  return c;
}

/* ------------------------------------------------------------ build all */
function buildPropSprites() {
  SPR.palm = paintPalm(11, { H: 56, W: 54, trunkH: 21, lean: 1.2, fronds: 9 });
  SPR.palm2 = paintPalm(29, { H: 46, W: 48, trunkH: 16, lean: -1.1, fronds: 8 });
  SPR.palm3 = paintPalm(53, { H: 50, W: 50, trunkH: 19, lean: 0.4, fronds: 10 });
  SPR.fruitTree = paintCanopyTree(7, { W: 52, H: 50, fruit: true });
  SPR.fruitTree2 = paintCanopyTree(19, { W: 44, H: 42, fruit: true, fruitColor: '#d9663f', canopyY: 20 });
  SPR.jungleTree = paintCanopyTree(41, { W: 58, H: 56, fruit: false, canopyY: 28 });
  SPR.jungleTree2 = paintCanopyTree(67, { W: 48, H: 50, fruit: false, canopyY: 24 });
  SPR.bush = paintBush(3, { W: 30, H: 20 });
  SPR.fruitBush = paintBush(13, { W: 28, H: 19, fruit: true });
  SPR.grass = paintGrass(5);
  SPR.grass2 = paintGrass(23);
  SPR.flower = paintFlower(9);
  SPR.flower2 = paintFlower(41);
  SPR.rock = paintRock(2, 20);
  SPR.rockSmall = paintRock(17, 13);
  SPR.rock3 = paintRock(31, 15);
  SPR.wreck = paintWreck();
  SPR.mast = paintMast();
  SPR.deadTree = paintDeadTree(4);
  SPR.deadTree2 = paintDeadTree(6);
  SPR.fern = paintFern(8);
  SPR.scrub = paintScrub(11);
  SPR.scrub2 = paintScrub(29);
  SPR.fallenFruit = paintFallenFruit(21);
  SPR.fallenFruit2 = paintFallenFruit(37);
  SPR.monolith = paintMonolith();
  SPR.sigil = paintSigil();
  SPR.mat = paintMat();
  SPR.milestone = paintMilestone();
  SPR.cave = paintCave();
  SPR.hut1 = paintHut(3, { W: 74, H: 62 });
  SPR.hut2 = paintHut(9, { W: 66, H: 56, lit: true });
  SPR.hut3 = paintHut(17, { W: 78, H: 60 });
  SPR.hutWelded = paintHut(23, { W: 70, H: 58 });
  SPR.tavern = paintTavernBuilding();
  SPR.well = paintWell();
  SPR.shrine = paintShrine();
  SPR.gate = paintGate();
  SPR.lanternMem = paintMemoryLantern();
  SPR.noticeBoard = paintNoticeBoard();
  SPR.jetty = paintJetty();
  SPR.fence = paintFence(2);
  SPR.fence2 = paintFence(8);
  SPR.counter = paintCounter();
  SPR.table = paintTable();
  SPR.stool = paintStool();
  SPR.hearth = paintHearth();
  SPR.stairs = paintStairs();
  // small sheet props
  SPR.plank = sheet([
    '..kkkkkkkkkkk..',
    '.kttTtttTttttk.',
    'ktTttttttTttttk',
    '.kTTTtttTTTttk.',
    '..kkkkkkkkkkk..'
  ]);
  SPR.barrel = sheet([
    '..kkkkkkkk..',
    '.ktTtttTttk.',
    'kttttttttttk',
    'kTTTTTTTTTTk',
    'kttttttttttk',
    'kTTTTTTTTTTk',
    'kttttttttttk',
    'kTTTTTTTTTTk',
    '.ktTtttTttk.',
    '..kkkkkkkk..'
  ]);
  SPR.crate = sheet([
    'kkkkkkkkkkkk',
    'kttTttttTttk',
    'ktTtttttTttk',
    'kttTtttTtttk',
    'ktttTTTTtttk',
    'ktttTTTTtttk',
    'kttTtttTtttk',
    'ktTtttttTttk',
    'kttTttttTttk',
    'kkkkkkkkkkkk'
  ]);
  SPR.shell = sheet([
    '..kkk..',
    '.kwWsk.',
    'kwWwWsk',
    'kwWwWsk',
    '.ksssk.',
    '..kkk..'
  ], Object.assign({}, PAL, { s: '#e7c3b0', W: '#f7e6de' }));
  SPR.starfish = sheet([
    '...k...',
    '..kok..',
    'kkookk.',
    'koooook',
    '.kookk.',
    '..k.k..'
  ], Object.assign({}, PAL, { o: '#e07a4e' }));
  SPR.footprint = sheet([
    '.kkk...kkk.',
    'kiiik.kiiik',
    'kiiik.kiiik',
    '.kik...kik.',
    '..k.....k..'
  ]);
  SPR.sign = sheet([
    '..kkkkkkkkkkkk..',
    '.kttttttttttttk.',
    'ktTtttttttttTtk.',
    'kttttwwwwwttttk.',
    'ktTttwwwwwtttTk.',
    'kttttwwwwwttttk.',
    '.kTTTTTTTTTTTTk.',
    '..kkkkktTkkkkk..',
    '.......tTt......',
    '.......tTt......',
    '......ttTtt.....',
    '......kkkkk.....'
  ]);
  SPR.lanternPost = sheet([
    '..kkkkkk..',
    '.kyyyyyyk.',
    'kyeeeeeeyk',
    'kyeeyyeeek',
    'kyeeyyeeek',
    'kyeeeeeeyk',
    '.kyyyyyyk.',
    '..kkkkkk..',
    '....tT....',
    '....tT....',
    '....tT....',
    '...ttTTt..',
    '...kkkkk..'
  ]);
  SPR.vine = sheet([
    'l..l...l..',
    'Ll.lL.lL..',
    '.LlLLlLl..',
    '.lLLlLLl..',
    '..lLlLl...',
    '..lLlL....',
    '...lll....'
  ]);
  SPR.sparkle = sheet(['..w..', '.wWw.', 'wWWWw', '.wWw.', '..w..'], Object.assign({}, PAL, { W: '#bfe8e0' }));
  SPR.ring = sheet(['..fff..', '.f...f.', 'f.....f', '.f...f.', '..fff..']);
  SPR.boat = sheet([
    '.......kk........',
    '......kwWk.......',
    '.....kwwwWk......',
    '....kwwwwWWk.....',
    '...kwwwwwwWWk....',
    '..kwwwwwwwwWWk...',
    '.kwwwwwwwwwwwWk..',
    'kkkkkkkkkkkkkkkk.',
    '.krrrrrrrrrrrrk..',
    '..kkkkkkkkkkkk...'
  ]);
}
