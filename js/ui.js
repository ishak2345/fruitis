/* ============================================================================
   js/ui.js — every screen and overlay except battle (combat.js draws itself)
     drawHUD          objective + HP + area name + toast + prompt
     drawDialogueBox  portraits, typewriter, choices
     drawInventory    full inventory screen (tabs / details / use / equip)
     drawPause        pause menu (resume/inv/controls/save/restart/sound/title)
     drawControls     shared controls panel — REBUILT so nothing clips
     drawTitle        title screen (menu + controls sub-screen)
     Intro            the Undertale-style opening panel sequence
     drawChapterCard  END OF CHAPTER ONE overlay
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------- HUD */
function drawObjectivePanel(ctx, t) {
  const text = Game.objective.text;
  const w = Math.min(VW - 16, textWidth(text, 1) + 22);
  const x = 8, y = 8;
  const flash = Math.max(0, Math.min(1, Game.objFlash || 0));
  ctx.globalAlpha = 0.92;
  drawPanel(ctx, x, y, w, 17);
  ctx.globalAlpha = 1;
  if (flash > 0) {
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t * 3.2));
    ctx.strokeStyle = `rgba(228,201,124,${(flash * pulse).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 16);
  }
  ctx.fillStyle = flash > 0 ? '#ffe9a8' : '#e4c97c';
  ctx.fillRect(x + 7, y + 8, 3, 1);
  ctx.fillRect(x + 8, y + 7, 1, 3);
  drawText(ctx, text, x + 14, y + 6, flash > 0 ? '#fff4d2' : '#eae3d2');
}

// layout is a pure function so the harness can verify the text never leaves
// the panel (it used to overhang the right edge by several pixels)
function hpBarLayout() {
  const x = 8, y = 29, w = 96;                 // w = red bar width
  const label = 'HP ' + Math.max(0, Game.hp) + '/' + Game.maxhp;
  const icon = 15;                              // flame icon + gap
  const gap = 5;                                // bar -> text gap
  const pad = 7;                                // right padding inside panel
  const tw = textWidth(label);
  return {
    x, y, barW: w, label,
    textX: x + icon + w + gap,
    panelW: icon + w + gap + tw + pad
  };
}
function drawHpBar(ctx) {
  const L = hpBarLayout();
  drawPanel(ctx, L.x, L.y, L.panelW, 15, 0.92);
  // little lantern flame icon
  ctx.drawImage(SPR[Math.floor(Game.time * 6) % 2 === 0 ? 'soul0' : 'soul1'], L.x + 4, L.y + 4);
  ctx.fillStyle = '#4a1d20';
  ctx.fillRect(L.x + 15, L.y + 5, L.barW, 6);
  const frac = clamp(Game.hp / Game.maxhp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? '#e8cf6a' : frac > 0.25 ? '#e0a23b' : '#d8452e';
  ctx.fillRect(L.x + 15, L.y + 5, Math.round(L.barW * frac), 6);
  drawText(ctx, L.label, L.textX, L.y + 4, '#eae3d2');
}

function drawAreaName(ctx) {
  if (!Game.areaNameT || Game.areaNameT <= 0 || !World.area) return;
  const a = Math.min(1, Math.min(Game.areaNameT, 3.2 - Game.areaNameT) * 2);
  const name = Areas[World.areaId] ? Areas[World.areaId].name : '';
  if (!name) return;
  ctx.globalAlpha = clamp(a, 0, 1) * 0.9;
  const w = textWidth(name) + 18;
  drawPanel(ctx, Math.round((VW - w) / 2), 10, w, 15);
  drawText(ctx, name, Math.round((VW - textWidth(name)) / 2), 14, '#dfe8e2');
  ctx.globalAlpha = 1;
}

function drawToast(ctx) {
  if (!Game.toast || Game.toastT <= 0) return;
  const a = clamp(Math.min(Game.toastT, 3.4 - Game.toastT) * 3, 0, 1);
  const w = textWidth(Game.toast) + 20;
  const x = Math.round((VW - w) / 2), y = 52;
  ctx.globalAlpha = a;
  drawPanel(ctx, x, y, w, 17);
  drawText(ctx, Game.toast, x + 10, y + 6, '#d8f0e6');
  ctx.globalAlpha = 1;
}

function drawPrompt(ctx, t) {
  const target = Game.nearest;
  if (!target || Game.mode !== 'play') return;
  let label;
  if (target.kind === 'npc') label = 'Talk to ' + target.ref.name;
  else if (target.kind === 'lantern') label = 'Rest at the lantern';
  else label = target.ref.interact.label === 'take' ? 'Take' : (target.ref.interact.label === 'read' ? 'Read' : 'Examine');
  label = 'E: ' + label;
  const w = textWidth(label) + 14;
  const bx = clamp(Math.round(target.sx - w / 2), 4, VW - w - 4);
  const by = clamp(Math.round(target.sy - 24), 16, VH - 24);
  ctx.globalAlpha = 0.82 + Math.sin(t * 3) * 0.08;
  drawPanel(ctx, bx, by, w, 14);
  ctx.globalAlpha = 1;
  drawText(ctx, label, bx + 7, by + 4, '#ffe9b0');
}

function drawHUD(ctx, t) {
  drawObjectivePanel(ctx, t);
  drawHpBar(ctx);
  drawAreaName(ctx);
  drawToast(ctx);
  drawPrompt(ctx, t);
}

/* -------------------------------------------------------- dialogue box */
const DBOX = { x: 8, y: VH - 8 - 78, w: VW - 16, h: 78 };

function drawDialogueBox(ctx, t) {
  if (!Dialogue.active) return;
  const a = Dialogue.boxAlpha;
  const b = DBOX;
  drawPanel(ctx, b.x, b.y, b.w, b.h, a);
  const node = Dialogue.node;
  if (node) {
    const sp = SPEAKERS[node.who] || SPEAKERS['???'];
    if (sp.portrait && SPR[sp.portrait]) {
      const spr = SPR[sp.portrait];
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0d1820';
      ctx.fillRect(b.x + 8, b.y + 10, 32, 32);
      ctx.fillStyle = '#1a2833';
      ctx.fillRect(b.x + 9, b.y + 11, 30, 30);
      ctx.drawImage(spr, b.x + 10, b.y + 12, 28, 28);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(228,201,124,0.35)';
      ctx.fillRect(b.x + 8, b.y + 9, 32, 1);
      ctx.fillRect(b.x + 8, b.y + 42, 32, 1);
    }
    const nameW = textWidth(node.who) + 12;
    ctx.fillStyle = '#0b141c';
    ctx.fillRect(b.x + 6, b.y - 7, nameW, 12);
    ctx.fillStyle = '#1d3040';
    ctx.fillRect(b.x + 7, b.y - 6, nameW - 2, 10);
    drawText(ctx, node.who, b.x + 12, b.y - 4, sp.color);

    const lines = Dialogue.visibleLines();
    const tx = b.x + (sp.portrait ? 46 : 12), ty = b.y + 12;
    for (let i = 0; i < lines.length && i < 4; i++) {
      drawText(ctx, lines[i], tx, ty + i * 12, node.think ? '#9fb3ae' : '#f2ecdf');
    }
    if (!Dialogue.typing && !Dialogue.choiceOpen) {
      if (Math.floor(t * 2.5) % 2 === 0) {
        const ax = b.x + b.w - 14, ay = b.y + b.h - 12;
        ctx.fillStyle = '#e4c97c';
        ctx.fillRect(ax, ay, 5, 1);
        ctx.fillRect(ax + 1, ay + 1, 3, 1);
        ctx.fillRect(ax + 2, ay + 2, 1, 1);
      }
    }
  }
  if (Dialogue.choiceOpen && Dialogue.choiceNode) {
    const opts = Dialogue.choiceNode.options;
    const chH = 14, boxH = opts.length * chH + 8;
    let maxW = 0;
    opts.forEach(o => maxW = Math.max(maxW, textWidth(o.text)));
    const boxW = Math.min(VW - 24, maxW + 26);
    const bx = VW - 12 - boxW, by = b.y - boxH - 6;
    drawPanel(ctx, bx, by, boxW, boxH, 1);
    for (let i = 0; i < opts.length; i++) {
      const oy = by + 5 + i * chH;
      const sel = i === Dialogue.choiceIndex;
      if (sel) {
        ctx.fillStyle = '#2c4356';
        ctx.fillRect(bx + 3, oy - 2, boxW - 6, 11);
        ctx.drawImage(SPR[Math.floor(t * 8) % 2 === 0 ? 'soul0' : 'soul1'], bx + 5, oy + 1);
      }
      drawText(ctx, opts[i].text, bx + 15, oy, sel ? '#fff6dc' : '#b9c9c6');
    }
  }
}

/* ---------------------------------------------------- inventory screen */
const INV_TABS = [
  { id: 'all', label: 'ALL' },
  { id: 'consumable', label: 'FOOD' },
  { id: 'key', label: 'KEY' },
  { id: 'equip', label: 'GEAR' }
];

function drawInventory(ctx, t) {
  ctx.fillStyle = 'rgba(8,14,20,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  const px0 = 10, py0 = 8, pw = VW - 20, ph = VH - 16;
  drawPanel(ctx, px0, py0, pw, ph);
  drawText(ctx, 'POCKETS', px0 + 10, py0 + 7, '#e4c97c');
  drawText(ctx, Game.hp + '/' + Game.maxhp + ' HP', px0 + pw - 10 - textWidth(Game.hp + '/' + Game.maxhp + ' HP'), py0 + 7, '#9fb3ae');
  drawDivider(ctx, px0 + 8, py0 + 17, pw - 16);

  // tabs
  const tabY = py0 + 22;
  let tx0 = px0 + 10;
  for (const tab of INV_TABS) {
    const sel = Game.invTab === tab.id;
    const tw = textWidth(tab.label) + 12;
    if (sel) {
      drawPanel(ctx, tx0, tabY, tw, 13);
      drawText(ctx, tab.label, tx0 + 6, tabY + 3, '#ffe9b0');
    } else {
      ctx.fillStyle = '#20323e';
      ctx.fillRect(tx0, tabY, tw, 13);
      drawText(ctx, tab.label, tx0 + 6, tabY + 3, '#93a9a8');
    }
    tx0 += tw + 4;
  }

  // item list (left)
  const list = Game.invTab === 'all' ? Inventory.slots : Inventory.byCat(Game.invTab);
  const listX = px0 + 10, listY = tabY + 20;
  const rowH = 13, maxRows = 9;
  Game.invScroll = clamp(Game.invScroll, 0, Math.max(0, list.length - maxRows));
  if (Game.invIndex >= list.length) Game.invIndex = list.length - 1;
  if (Game.invIndex < 0) Game.invIndex = 0;
  if (Game.invIndex < Game.invScroll) Game.invScroll = Game.invIndex;
  if (Game.invIndex >= Game.invScroll + maxRows) Game.invScroll = Game.invIndex - maxRows + 1;
  for (let i = 0; i < Math.min(maxRows, list.length); i++) {
    const idx = Game.invScroll + i;
    const entry = list[idx];
    const d = ITEMS[entry.id];
    const sel = idx === Game.invIndex;
    const ry = listY + i * rowH;
    if (sel) {
      ctx.fillStyle = '#2c4356';
      ctx.fillRect(listX, ry - 2, 178, 12);
    }
    if (d && SPR[d.icon]) ctx.drawImage(SPR[d.icon], listX + 2, ry - 1);
    let label = d ? d.name : entry.id;
    if (d && d.cat === 'consumable' && entry.n > 1) label += ' x' + entry.n;
    drawText(ctx, label, listX + 17, ry, sel ? '#fff6dc' : '#c9d4d0');
    if (d && Inventory.isEquipped(d.id)) drawText(ctx, 'E', listX + 166, ry, '#e8cf6a');
  }
  if (list.length === 0) {
    drawText(ctx, '(empty)', listX + 2, listY, '#5f7370');
  }
  if (list.length > maxRows) {
    drawText(ctx, Game.invScroll > 0 ? '^' : ' ', listX + 184, listY - 1, '#6f8585');
    drawText(ctx, Game.invScroll + maxRows < list.length ? 'v' : ' ', listX + 184, listY + (maxRows - 1) * rowH, '#6f8585');
  }

  // detail panel (right)
  const dX = px0 + 208, dW = pw - 218;
  const sel = list[Game.invIndex];
  const d = sel ? ITEMS[sel.id] : null;
  ctx.fillStyle = '#101c24';
  ctx.fillRect(dX, listY - 3, dW, ph - (listY - py0) - 22);
  if (d) {
    if (SPR[d.icon]) {
      ctx.drawImage(SPR[d.icon], dX + 6, listY + 4, 36, 36);
      const catLabel = d.cat === 'consumable' ? 'FOOD' : d.cat === 'key' ? 'KEY ITEM' : 'GEAR';
      drawText(ctx, catLabel, dX + 48, listY + 6, '#93a9a8');
      drawText(ctx, d.name, dX + 6, listY + 46, '#ffe9b0');
      let stats = '';
      if (d.cat === 'consumable') stats = 'Heals ' + d.heal + ' HP';
      if (d.slot === 'weapon') stats = 'ATK +' + d.atk + (Inventory.isEquipped(d.id) ? '  [equipped]' : '');
      if (d.slot === 'charm') stats = 'DEF +' + d.def + (Inventory.isEquipped(d.id) ? '  [equipped]' : '');
      if (stats) drawText(ctx, stats, dX + 6, listY + 58, '#9fd8a8');
      const lines = wrapText(d.desc, (dW - 12) / 6 | 0);
      for (let i = 0; i < lines.length && i < 6; i++) {
        drawText(ctx, lines[i], dX + 6, listY + 72 + i * 11, '#c9d4d0');
      }
    }
  }

  // hints
  const hint = d
    ? (d.cat === 'consumable' ? 'E: use   TAB: tabs   ESC: close'
      : d.cat === 'equip' ? 'E: equip   TAB: tabs   ESC: close'
      : 'TAB: tabs   ESC: close')
    : 'TAB: tabs   ESC: close';
  drawText(ctx, hint, px0 + 10, py0 + ph - 14, '#6f8585');
}

/* --------------------------------------------------------- pause menu */
const PAUSE_ITEMS = ['Resume', 'Inventory', 'Controls', 'Save Game', 'Restart', 'Sound', 'Title Screen'];

function drawPause(ctx, t) {
  ctx.fillStyle = 'rgba(8,14,20,0.66)';
  ctx.fillRect(0, 0, VW, VH);
  const bw = 168, bh = PAUSE_ITEMS.length * 14 + 30;
  const bx = Math.round((VW - bw) / 2), by = Math.round((VH - bh) / 2);
  drawPanel(ctx, bx, by, bw, bh);
  drawText(ctx, 'PAUSED', bx + 12, by + 8, '#e4c97c');
  drawDivider(ctx, bx + 8, by + 18, bw - 16);
  PAUSE_ITEMS.forEach((it, i) => {
    const sel = i === Game.pauseIndex;
    const y = by + 25 + i * 14;
    let label = it;
    if (it === 'Sound') label = 'Sound: ' + (AudioSys.enabled ? (AudioSys.volume === 1 ? 'On' : AudioSys.volume === 0.5 ? 'Half' : 'Muted') : 'Off');
    if (it === 'Save Game' && !SaveSys.available()) label = 'Save (unavailable)';
    if (sel) {
      ctx.fillStyle = '#2a4152';
      ctx.fillRect(bx + 4, y - 2, bw - 8, 12);
      ctx.drawImage(SPR[Math.floor(t * 8) % 2 === 0 ? 'soul0' : 'soul1'], bx + 7, y + 1);
    }
    drawText(ctx, label, bx + 18, y, sel ? '#fff6dc' : '#a9bcbb');
  });
}

/* ------------------------------------------------------ controls panel */
/* REBUILT: measured so no line can ever exceed the panel. */
const CONTROLS_ROWS = [
  ['MOVE', 'WASD / ARROWS'],
  ['TALK / EXAMINE / CONFIRM', 'E / Z / ENTER'],
  ['ADVANCE DIALOGUE', 'E / Z / ENTER / SPACE'],
  ['INVENTORY', 'I / TAB'],
  ['PAUSE', 'ESC'],
  ['SOUND / MUTE', 'M']
];
function drawControls(ctx, x, y, w) {
  const rowH = 15;
  const h = 34 + CONTROLS_ROWS.length * rowH;
  drawPanel(ctx, x, y, w, h);
  drawText(ctx, 'CONTROLS', x + 10, y + 8, '#e4c97c');
  drawDivider(ctx, x + 8, y + 18, w - 16);
  CONTROLS_ROWS.forEach((r, i) => {
    const ry = y + 26 + i * rowH;
    drawText(ctx, r[0], x + 10, ry, '#dff0e8');
    const rw = textWidth(r[1]);
    drawText(ctx, r[1], x + w - 10 - rw, ry, '#93a9a8');
  });
  drawText(ctx, 'E or ESC: back', x + 10, y + h - 12, '#6f8585');
  return h;
}

/* ----------------------------------------------------------- title */
const STARS = (() => {
  const r = mulberry32(77), s = [];
  for (let i = 0; i < 70; i++) s.push({ x: Math.floor(r() * VW), y: Math.floor(r() * 105), p: r() * 6.28, b: 0.35 + r() * 0.65 });
  return s;
})();

function drawTitle(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 145);
  g.addColorStop(0, '#0d1526');
  g.addColorStop(0.45, '#1d2a44');
  g.addColorStop(0.78, '#4a4258');
  g.addColorStop(1, '#a2685a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 150);
  for (const s of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(t * 1.4 + s.p);
    ctx.globalAlpha = clamp(s.b * tw, 0, 1);
    ctx.fillStyle = '#dfe8ff';
    ctx.fillRect(s.x, s.y, 1, 1);
    if (s.b > 0.85 && tw > 0.9) ctx.fillRect(s.x - 1, s.y, 3, 1);
  }
  ctx.globalAlpha = 1;
  // moon
  ctx.fillStyle = '#f3e6c4';
  ctx.beginPath(); ctx.arc(320, 42, 13, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#e2d3ae';
  ctx.beginPath(); ctx.arc(315, 38, 3, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.arc(324, 47, 2, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(243,230,196,0.10)';
  ctx.beginPath(); ctx.arc(320, 42, 22, 0, 6.2832); ctx.fill();
  // sea
  const sea = ctx.createLinearGradient(0, 140, 0, VH);
  sea.addColorStop(0, '#20455f'); sea.addColorStop(1, '#0c1c2c');
  ctx.fillStyle = sea; ctx.fillRect(0, 140, VW, VH - 140);
  for (let i = 0; i < 26; i++) {
    const y = 146 + i * 2.6;
    const w = 18 + Math.sin(t * 1.2 + i * 0.7) * 7;
    const a = 0.22 * (1 - i / 30) * (0.6 + 0.4 * Math.sin(t * 2 + i));
    ctx.fillStyle = `rgba(243,230,196,${clamp(a, 0, 1).toFixed(3)})`;
    ctx.fillRect(Math.round(320 - w / 2 + Math.sin(t + i) * 2), Math.round(y), Math.round(w), 1);
  }
  for (let i = 0; i < 90; i++) {
    const h = hash2(i, 3);
    const y = 148 + Math.floor(h * 66);
    const drift = ((t * (6 + h * 10) + h * 400) % (VW + 40)) - 20;
    ctx.fillStyle = `rgba(150,205,215,${(0.10 + h * 0.14).toFixed(2)})`;
    ctx.fillRect(Math.round(drift), y, 3 + Math.floor(h * 6), 1);
  }
  // island silhouette
  const islandY = 154, cx = 182;
  for (let x = 0; x < VW; x++) {
    const d = Math.abs(x - cx);
    let hgt = 0;
    if (d < 172) hgt = Math.round(30 * Math.cos((d / 172) * 1.45) + Math.sin(x * 0.06) * 2.5);
    if (hgt <= 0) continue;
    ctx.fillStyle = '#101a24';
    ctx.fillRect(x, islandY - hgt, 1, hgt + 3);
    ctx.fillStyle = '#16242e';
    ctx.fillRect(x, islandY - hgt, 1, 2);
  }
  const palmAt = (px0, py0, s) => {
    const sway = Math.sin(t * 0.9 + px0) * 1.5;
    ctx.fillStyle = '#0c141c';
    for (let i = 0; i < 10 * s; i++) {
      const yy = Math.round(py0 - i);
      const xx = Math.round(px0 + Math.sin(i * 0.14) * 2.2 * s + sway * (i / (10 * s)));
      ctx.fillRect(xx, yy, 1 + (s > 1.2 ? 1 : 0), 1);
    }
    const topX = px0 + Math.sin(10 * s * 0.14) * 2.2 * s + sway;
    for (let a = 0; a < 7; a++) {
      const ang = -Math.PI * 0.9 + a * 0.32;
      for (let l = 1; l < 8 * s; l++) {
        const lx = Math.round(topX + Math.cos(ang) * l * 0.9);
        const ly = Math.round(py0 - 10 * s + Math.sin(ang) * l * 0.55 + l * l * 0.035);
        ctx.fillRect(lx, ly, 1, 1);
      }
    }
  };
  palmAt(140, 132, 1.35); palmAt(196, 136, 1.05); palmAt(104, 139, 0.9); palmAt(230, 140, 0.75);
  ctx.fillStyle = '#0c141c';
  ctx.fillRect(216, 151, 17, 2); ctx.fillRect(220, 148, 9, 3); ctx.fillRect(226, 144, 1, 4);

  // title text
  const title = 'FRUITS ISLAND';
  const ts = 4;
  const tw = textWidth(title, ts);
  const tx = Math.round((VW - tw) / 2), ty = 30;
  for (const o of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [2, -2], [-2, 2]]) {
    drawText(ctx, title, tx + o[0], ty + o[1], '#1a1208', ts);
  }
  drawText(ctx, title, tx, ty, '#f2cf7d', ts);
  drawText(ctx, title, tx, ty + 1, '#e0b25f', ts);
  const sub = 'Chapter One \u00b7 The First Slice';
  drawText(ctx, sub, Math.round((VW - textWidth(sub)) / 2), ty + 40, '#c9b7a4', 1, '#0b1218');
  ctx.fillStyle = '#e4c97c';
  ctx.fillRect(Math.round(VW / 2) - 26, ty + 54, 52, 1);
  ctx.fillRect(Math.round(VW / 2) - 2, ty + 53, 2, 3);

  if (Game.titleScreen === 'menu') {
    const hasSave = SaveSys.exists();
    const items = [
      { label: hasSave ? 'Continue' : 'New Game', act: hasSave ? 'continue' : 'new' },
      { label: hasSave ? 'New Game' : null, act: 'new' },
      { label: 'Controls', act: 'controls' },
      { label: 'Sound', act: 'sound' }
    ].filter(i => i.label);
    const bw = 132, bh = items.length * 15 + 12;
    const bx = Math.round((VW - bw) / 2), by = 150;
    drawPanel(ctx, bx, by, bw, bh);
    items.forEach((it, i) => {
      const sel = i === Game.menuIndex;
      const y = by + 8 + i * 15;
      let label = it.label;
      if (it.act === 'sound') label = 'Sound: ' + (AudioSys.enabled ? (AudioSys.volume === 1 ? 'On' : AudioSys.volume === 0.5 ? 'Half' : 'Muted') : 'Off');
      if (sel) {
        ctx.fillStyle = '#2a4152'; ctx.fillRect(bx + 3, y - 2, bw - 6, 12);
        ctx.drawImage(SPR[Math.floor(t * 8) % 2 === 0 ? 'soul0' : 'soul1'], bx + 6, y + 1);
      }
      drawText(ctx, label, bx + 17, y, sel ? '#fff6dc' : '#a9bcbb');
    });
  } else if (Game.titleScreen === 'controls') {
    const cw = Math.min(VW - 16, 300);
    const ch = 34 + CONTROLS_ROWS.length * 15;
    drawControls(ctx, Math.round((VW - cw) / 2), Math.round((VH - ch) / 2) + 6, cw);
  }
  if (Game.embedded) {
    const hint = 'Click the screen once, then use the keyboard';
    drawText(ctx, hint, Math.round((VW - textWidth(hint)) / 2), VH - 12, 'rgba(190,214,214,0.55)');
  }
  ctx.fillStyle = 'rgba(150,180,190,0.25)';
  ctx.fillRect(0, VH - 1, VW, 1);
}

/* ================================================ INTRO PANEL SEQUENCE */
/* Undertale-style: near-black, slow typewriter, one thought per panel.
   Advance with Z / Enter / E / Space / click. ESC skips the whole intro. */
/* ==========================================================================
   THE INTRO — "The Sailor and the Storm"
   Ten quiet panels + a title card. Every scene is painted with fillRect only
   (identical rendering in browser and in the test harness rasterizer):
   stars, moon, layered sea, a rocking ship silhouette, jagged lightning
   with glow, rain, drifting debris, a beach dawn, and a wrong little island.
   Panels advance on Z/E/Enter/Space/click, or on their own after `hold`
   seconds once the text finishes (the title card always waits for input).
   ========================================================================== */
const INTRO_PANELS = [
  { scene: 'calm',    lines: ['The Marigold had one job:', 'sail past the edge of the map.'], hold: 3.6 },
  { scene: 'compass', lines: ['Find The Forge, they said.', 'It would be easy, they said.'], hold: 3.4 },
  { scene: 'clouds',  lines: ['Around midnight,', 'the sky changed its mind.'], hold: 3.2 },
  { scene: 'storm',   lines: ['The storm did not arrive.', 'It was waiting.'], storm: true, hold: 3.6 },
  { scene: 'storm',   lines: ['The Marigold fought', 'until it couldn\u2019t.'], storm: true, broken: true, crash: true, hold: 4.0 },
  { scene: 'wrecksea', lines: ['By dawn, the sea had taken the ship,'], grey: true, hold: 3.4 },
  { scene: 'wrecksea', lines: ['and everything on it.', 'Everything but him.'], grey: true, darker: true, slow: true, hold: 4.2 },
  { scene: 'beach',   lines: ['He woke to sand, and gulls,', 'and a headache the size of the horizon.'], hold: 4.0 },
  { scene: 'island',  lines: ['An island not on any chart.', 'Fruit-heavy. Bright-eyed.'], hold: 3.6 },
  { scene: 'island',  lines: ['Wrong.'], darker: true, slow: true, hold: 2.4 },
  { scene: 'title',   lines: ['FRUITS ISLAND'], title: true }
];

/* ------------------------------------------------------ scene painters */
function introStars(ctx, t, dim) {
  for (let i = 0; i < 26; i++) {
    const sx = Math.floor(hash2(i, 11) * (VW - 8)) + 4;
    const sy = Math.floor(hash2(i, 23) * 120) + 4;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.4 + hash2(i, 5) * 0.8) + i));
    ctx.fillStyle = 'rgba(214,228,240,' + (tw * dim).toFixed(3) + ')';
    ctx.fillRect(sx, sy, 1, 1);
    if (hash2(i, 31) > 0.8 && tw > 0.8) { ctx.fillRect(sx - 1, sy, 1, 1); ctx.fillRect(sx + 1, sy, 1, 1); ctx.fillRect(sx, sy - 1, 1, 1); ctx.fillRect(sx, sy + 1, 1, 1); }
  }
}
function introMoon(ctx, mx, my, dim, cover) {
  // halo
  ctx.fillStyle = 'rgba(208,222,232,' + (0.05 * dim * (1 - cover)).toFixed(3) + ')';
  ctx.fillRect(mx - 9, my - 9, 20, 20);
  ctx.fillStyle = 'rgba(208,222,232,' + (0.09 * dim * (1 - cover)).toFixed(3) + ')';
  ctx.fillRect(mx - 6, my - 6, 14, 14);
  // pixel moon (a 7-row disc)
  const rows = [3, 5, 7, 7, 7, 5, 3];
  ctx.fillStyle = 'rgba(226,234,238,' + (dim * (1 - cover)).toFixed(3) + ')';
  for (let r = 0; r < rows.length; r++) ctx.fillRect(mx - Math.floor(rows[r] / 2), my - 3 + r, rows[r], 1);
  ctx.fillStyle = 'rgba(150,168,178,' + (0.5 * dim * (1 - cover)).toFixed(3) + ')';
  ctx.fillRect(mx, my - 1, 2, 1); ctx.fillRect(mx - 2, my + 1, 2, 1);   // craters
}
function introSea(ctx, t, rough, grey) {
  const H0 = 150;
  for (let y = H0; y < VH; y++) {
    const d = (y - H0) / (VH - H0);
    let r, g, b;
    if (grey) {
      r = 26 + d * 26; g = 34 + d * 30; b = 42 + d * 32;
    } else {
      r = 10 + d * 16; g = 22 + d * 30; b = 40 + d * 40;
    }
    const amp = rough ? 5 : 2;
    const off = Math.round(Math.sin(t * (rough ? 2.6 : 1.1) + y * 0.35) * amp * (0.4 + d));
    ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    ctx.fillRect(-14 + off, y, VW + 28, 1);
    // moon glitter lane + foam crests
    if (y < H0 + 14 && hash2(y, Math.floor(t * 3)) > (rough ? 0.55 : 0.8)) {
      const fx = 150 + Math.round(Math.sin(t * 1.7 + y) * 30) + Math.floor(hash2(y, 7) * 60);
      ctx.fillStyle = rough ? 'rgba(196,212,224,0.35)' : 'rgba(168,196,214,0.28)';
      ctx.fillRect(fx, y, 2 + Math.floor(hash2(y, 9) * 3), 1);
    }
  }
  if (rough) {
    // whitecaps: broken dashes riding the swell
    for (let i = 0; i < 12; i++) {
      const wy = H0 + 6 + Math.floor(hash2(i, 41) * 54);
      const wx = Math.floor((hash2(i, 43) * VW + t * 26 * (0.5 + hash2(i, 45))) % (VW + 30)) - 15;
      ctx.fillStyle = 'rgba(210,224,232,' + (0.25 + hash2(i, 47) * 0.3).toFixed(2) + ')';
      ctx.fillRect(wx, wy, 3 + Math.floor(hash2(i, 49) * 4), 1);
    }
  }
}
function introShip(ctx, cx, cy, t, rough, broken) {
  // a small silhouetted brig, sheared row-by-row so it rolls with the swell
  const roll = Math.sin(t * (rough ? 2.2 : 0.9)) * (rough ? 4 : 1.6);
  const bob = Math.round(Math.sin(t * (rough ? 1.8 : 0.7)) * (rough ? 2 : 1));
  const y0 = cy + bob;
  const row = (ry, w, color) => {
    const shift = Math.round(roll * ((ry - 3) / 4));
    ctx.fillStyle = color;
    ctx.fillRect(cx - Math.floor(w / 2) + shift, y0 + ry, w, 1);
  };
  // hull
  const hull = '#0a0f16';
  row(0, 24, hull); row(1, 26, hull); row(2, 26, hull); row(3, 24, hull); row(4, 20, hull); row(5, 14, hull);
  // deck line
  ctx.fillStyle = '#1b2634';
  ctx.fillRect(cx - 11 + Math.round(roll * -0.75), y0 + 1, 22, 1);
  // mast (+ sail, or the stump of one)
  const mastH = broken ? 7 : 16;
  ctx.fillStyle = hull;
  ctx.fillRect(cx - 1 + Math.round(roll * -0.4), y0 - mastH, 2, mastH);
  if (!broken) {
    // sail: a pale triangle, bellying with the wind
    for (let r = 0; r < 9; r++) {
      const w = 2 + Math.round(r * 1.3);
      ctx.fillStyle = 'rgba(158,172,184,0.85)';
      ctx.fillRect(cx + 1 + Math.round(roll * (-0.4 + r * 0.06)), y0 - 15 + r, w, 1);
    }
    // tiny stern lantern
    ctx.fillStyle = 'rgba(232,196,106,0.9)';
    ctx.fillRect(cx + 12 + Math.round(roll * 1), y0 - 1, 1, 1);
  } else {
    // torn sail scrap flapping
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = 'rgba(120,132,142,0.7)';
      ctx.fillRect(cx + 1 + Math.round(Math.sin(t * 6 + r) * 2), y0 - 6 + r, 3 - (r > 1 ? 1 : 0), 1);
    }
    ctx.fillStyle = 'rgba(232,196,106,0.5)';
    ctx.fillRect(cx + 12 + Math.round(roll), y0 - 1, 1, 1);
  }
}
function introClouds(ctx, t, cover) {
  // long low banks sliding across; `cover` 0..1 hides the moon and stars
  const banks = [
    [0.1, 30, 90, 12, 0.55], [0.5, 52, 120, 14, 0.4], [0.8, 20, 80, 10, 0.5], [0.3, 70, 140, 16, 0.3]
  ];
  for (let i = 0; i < banks.length; i++) {
    const b = banks[i];
    const x = ((b[0] * (VW + 260) + t * (6 + i * 4)) % (VW + 260)) - 130;
    ctx.fillStyle = 'rgba(16,22,32,' + (b[4] * cover).toFixed(3) + ')';
    ctx.fillRect(Math.round(x), b[1], b[2], b[3]);
    ctx.fillStyle = 'rgba(24,32,44,' + (b[4] * cover * 0.8).toFixed(3) + ')';
    ctx.fillRect(Math.round(x + 14), b[1] - 5, b[2] - 30, 6);
    ctx.fillRect(Math.round(x + 30), b[1] + b[3], b[2] - 60, 4);
  }
}
function introRain(ctx, t, n) {
  ctx.fillStyle = 'rgba(150,178,196,0.30)';
  for (let i = 0; i < n; i++) {
    const h = hash2(i, 77);
    const spd = 200 + h * 160;
    const ry = ((t * spd + h * 500) % (VH + 40)) - 20;
    const rx = ((h * (VW + 120) + t * 46) % (VW + 120)) - 60;
    ctx.fillRect(Math.round(rx), Math.round(ry), 1, 4 + Math.floor(h * 4));
  }
}
function introLightning(ctx, I, t) {
  if (I.flashT <= 0) return;
  // sky flash (decays with flashT)
  const a = clamp(I.flashT * 0.55, 0, 0.7);
  ctx.fillStyle = 'rgba(205,222,238,' + a.toFixed(3) + ')';
  ctx.fillRect(0, 0, VW, 152);
  // the bolt itself is only visible in the first instant
  if (I.flashT < 0.30) return;
  const seed = I.boltSeed;
  let bx = 60 + Math.floor(hash2(seed, 1) * (VW - 120));
  let by = 0;
  const pts = [[bx, by]];
  for (let i = 0; i < 7; i++) {
    bx += Math.round((hash2(seed, i + 2) - 0.5) * 44);
    by += Math.round(18 + hash2(seed, i + 20) * 10);
    pts.push([bx, by]);
  }
  const draw = (w, color, alpha) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const steps = Math.max(1, Math.abs(y1 - y0));
      for (let k = 0; k <= steps; k++) {
        const px = x0 + (x1 - x0) * k / steps;
        const py = y0 + (y1 - y0) * k / steps;
        ctx.fillRect(Math.round(px) - (w >> 1), Math.round(py), w, 1);
      }
    }
    ctx.globalAlpha = 1;
  };
  draw(3, '#7fa2c4', 0.4);       // glow
  draw(1, '#eef4fb', 0.95);      // core
  // a short fork
  ctx.fillStyle = '#dce8f4';
  const f = pts[3];
  ctx.fillRect(f[0], f[1], 1, 8); ctx.fillRect(f[0] + 1, f[1] + 8, 1, 5);
}
function introDebris(ctx, t) {
  for (let i = 0; i < 5; i++) {
    const hx = hash2(i, 61), hw = 8 + Math.floor(hash2(i, 63) * 14);
    const x = Math.floor(hx * (VW - 60)) + 20;
    const y = 158 + Math.floor(hash2(i, 65) * 40) + Math.round(Math.sin(t * 1.2 + i * 2) * 2);
    ctx.fillStyle = 'rgba(18,24,32,0.9)';
    ctx.fillRect(x, y, hw, 2);
    ctx.fillStyle = 'rgba(40,52,64,0.8)';
    ctx.fillRect(x + 2, y - 1, hw - 5, 1);
  }
}
function introBeachDawn(ctx, t) {
  // dawn sky bands
  for (let y = 0; y < 150; y++) {
    const d = y / 150;
    const r = 42 + d * 60, g = 38 + d * 34, b = 52 + d * 22;
    ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    ctx.fillRect(0, y, VW, 1);
  }
  // sun haze on the horizon
  ctx.fillStyle = 'rgba(224,162,107,0.30)';
  ctx.fillRect(0, 138, VW, 12);
  ctx.fillStyle = 'rgba(236,182,124,0.5)';
  ctx.fillRect(VW / 2 - 30, 142, 60, 3);
  // sea
  for (let y = 150; y < 176; y++) {
    const d = (y - 150) / 26;
    ctx.fillStyle = 'rgb(' + ((30 + d * 24) | 0) + ',' + ((34 + d * 22) | 0) + ',' + ((48 + d * 26) | 0) + ')';
    ctx.fillRect(0, y, VW, 1);
  }
  // sand
  for (let y = 176; y < VH; y++) {
    const d = (y - 176) / (VH - 176);
    ctx.fillStyle = 'rgb(' + ((96 + d * 40) | 0) + ',' + ((80 + d * 32) | 0) + ',' + ((62 + d * 24) | 0) + ')';
    ctx.fillRect(0, y, VW, 1);
  }
  // wet shine + foam edge
  ctx.fillStyle = 'rgba(180,196,204,0.22)';
  for (let x = 0; x < VW; x += 3) ctx.fillRect(x + Math.round(Math.sin(t + x) * 2), 178, 2, 1);
  // palm silhouettes
  const palm = (px, py, s) => {
    ctx.fillStyle = '#100c12';
    ctx.fillRect(px, py - 26 * s, 2 * s, 26 * s);
    for (let f = 0; f < 5; f++) {
      const fa = -0.5 + f * 0.5;
      ctx.fillRect(px + (fa < 0 ? -1 : 1) * s, py - 28 * s + Math.round(f * 1.5), Math.round((6 + f * 2) * s) * (fa < 0 ? -1 : 1) + (fa < 0 ? 2 * s : 0), 2 * s);
    }
  };
  palm(36, 190, 1); palm(352, 186, 1.4); palm(316, 188, 0.8);
  // the sailor, face down where the tide left him
  ctx.fillStyle = '#141821';
  ctx.fillRect(196, 190, 14, 3);
  ctx.fillRect(192, 190, 5, 2);          // head
  ctx.fillRect(206, 189, 6, 1);          // an arm thrown out
  ctx.fillStyle = 'rgba(20,24,33,0.5)';
  ctx.fillRect(194, 193, 16, 2);
  // gulls
  for (let i = 0; i < 3; i++) {
    const gx = ((t * (14 + i * 5) + i * 120) % (VW + 40)) - 20;
    const gy = 58 + i * 14 + Math.round(Math.sin(t * 2 + i * 2) * 4);
    const flap = Math.sin(t * 6 + i * 1.7) > 0 ? 1 : 2;
    ctx.fillStyle = 'rgba(226,232,236,0.75)';
    ctx.fillRect(gx, gy, 2, 1);
    ctx.fillRect(gx - 2, gy - flap, 2, 1);
    ctx.fillRect(gx + 2, gy - flap, 2, 1);
  }
}
function introIsland(ctx, t, lightsOn) {
  // sea + sky, then the island: a low dark mass with palms and tiny lights
  introSea(ctx, t * 0.5, false, false);
  const base = 150;
  ctx.fillStyle = '#0a0e14';
  for (let x = 0; x < VW; x++) {
    const h = Math.round(14 * Math.sin(x * 0.02 + 1.2) + 8 * Math.sin(x * 0.05 + 0.4) + 12);
    ctx.fillRect(x, base - h, 1, h + 2);
  }
  // palm bumps along the ridge
  for (let i = 0; i < 9; i++) {
    const px = 24 + i * 40 + Math.floor(hash2(i, 71) * 14);
    const py = base - Math.round(14 * Math.sin(px * 0.02 + 1.2) + 8 * Math.sin(px * 0.05 + 0.4) + 12);
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(px, py - 6, 1, 6);
    ctx.fillRect(px - 2, py - 7, 2, 1); ctx.fillRect(px + 1, py - 7, 2, 1);
  }
  // village lights: warm dots that breathe... in unison (that's the wrong part)
  if (lightsOn) {
    for (let i = 0; i < 6; i++) {
      const lx = 60 + i * 52 + Math.floor(hash2(i, 81) * 16);
      const ly = base - 4 - Math.floor(hash2(i, 83) * 5);
      const breath = 0.55 + 0.45 * Math.sin(t * 0.8 + i * 0.13);
      const sync = Math.sin(t * 0.8) > -0.2 ? breath : 0.12;  // they all dim together
      ctx.fillStyle = 'rgba(236,196,120,' + sync.toFixed(2) + ')';
      ctx.fillRect(lx, ly, 1, 1);
      ctx.fillStyle = 'rgba(236,196,120,' + (sync * 0.25).toFixed(2) + ')';
      ctx.fillRect(lx - 1, ly - 1, 3, 3);
    }
  }
}
function introCompass(ctx, t) {
  // a big brass compass rose; the needle refuses to settle
  const cx = VW / 2, cy = 86;
  ctx.fillStyle = '#0d1119';
  for (let r = 0; r < 30; r++) {
    const w = Math.round(2 * Math.sqrt(30 * 30 - r * r));
    ctx.fillRect(cx - w, cy - 30 + r, w * 2, 1);
    ctx.fillRect(cx - w, cy + 30 - r, w * 2, 1);
  }
  ctx.fillStyle = '#232c3a';
  for (let r = 4; r < 27; r += 3) {
    const w = Math.round(2 * Math.sqrt(30 * 30 - r * r));
    ctx.fillRect(cx - w, cy - 30 + r, w * 2, 1);
    ctx.fillRect(cx - w, cy + 30 - r, w * 2, 1);
  }
  // rose points
  ctx.fillStyle = '#3c4a5c';
  for (let i = 0; i < 4; i++) {
    const dx = i === 0 ? 1 : i === 2 ? -1 : 0, dy = i === 1 ? 1 : i === 3 ? -1 : 0;
    for (let k = 4; k < 22; k++) {
      const w = Math.max(1, Math.round((22 - k) * 0.5));
      ctx.fillRect(cx + dx * k - (dy ? w / 2 : 0), cy + dy * k - (dx ? w / 2 : 0), dy ? w : 1, dx ? w : 1);
    }
  }
  // the needle: swings, never commits (it should point north; it points at him)
  const ang = -0.9 + Math.sin(t * 0.7) * 0.8 + Math.sin(t * 1.9) * 0.12;
  const nx = Math.cos(ang), ny = Math.sin(ang);
  for (let k = 0; k < 18; k++) {
    ctx.fillStyle = k < 9 ? '#c85a50' : '#93a3b3';
    ctx.fillRect(Math.round(cx + nx * (k - 9)) - 1, Math.round(cy + ny * (k - 9)) - 1, 2, 2);
  }
  ctx.fillStyle = '#e8cf6a';
  ctx.fillRect(cx - 1, cy - 1, 3, 3);
  // glass glint
  ctx.fillStyle = 'rgba(210,228,238,0.10)';
  ctx.fillRect(cx - 18, cy - 24, 10, 26);
}

const Intro = {
  idx: 0,
  chars: 0,
  t: 0,
  holdT: 0,
  doneHold: false,
  flashT: 0,
  boltSeed: 1,
  nextStrike: 0,
  finished: false,

  begin() {
    this.idx = 0; this.chars = 0; this.t = 0; this.holdT = 0;
    this.doneHold = false; this.finished = false;
    this.flashT = 0; this.boltSeed = 1; this.nextStrike = 2.2;
    AudioSys.restartSong('title');
    AudioSys.setMix({ ocean: 0.045, wind: 0.014, rain: 0, hum: 0.03 }, 0.4);
  },
  panel() { return INTRO_PANELS[this.idx]; },
  fullText() { return this.panel().lines.join('\n'); },
  totalChars() { return this.panel().lines.join('').length; },

  advance() {
    if (this.finished) return;
    if (this.chars < this.totalChars()) {
      this.chars = this.totalChars();
      return;
    }
    AudioSys.advance();
    this.idx++;
    this.chars = 0;
    this.t = 0;
    this.holdT = 0;
    this.doneHold = false;
    if (this.idx >= INTRO_PANELS.length) {
      this.finished = true;
      Game.introDone();
      return;
    }
    this.enterPanel(this.panel());
  },
  enterPanel(p) {
    if (p.crash) { AudioSys.crash(); this.flashT = 0.6; this.boltSeed = (Math.random() * 999) | 0; }
    else if (p.storm) { this.strike(); }
    if (p.scene === 'clouds') AudioSys.setMix({ ocean: 0.05, wind: 0.024, rain: 0.012, hum: 0.02 }, 0.8);
    if (p.scene === 'storm') AudioSys.setMix({ ocean: 0.06, wind: 0.03, rain: 0.05, hum: 0.012 }, 0.8);
    if (p.grey) { AudioSys.stopSong(); AudioSys.setMix({ ocean: 0.035, wind: 0.012, rain: 0.014, hum: 0.016 }, 1.2); }
    if (p.scene === 'beach') { AudioSys.setMix({ ocean: 0.055, wind: 0.01, rain: 0, hum: 0.014 }, 1.0); AudioSys.bird(); }
    if (p.scene === 'island' && !p.darker) AudioSys.setMix({ ocean: 0.02, wind: 0.006, rain: 0, hum: 0.05 }, 1.0);
    if (p.scene === 'island' && p.darker) { AudioSys.moan(); AudioSys.setMix({ hum: 0.065 }, 1.4); }
    if (p.title) { AudioSys.stopSong(); AudioSys.setMix({ hum: 0.08 }, 0.3); }
  },
  strike() {
    this.flashT = 0.5;
    this.boltSeed = (Math.random() * 999) | 0;
    AudioSys.thunder();
  },
  skip() {
    this.idx = INTRO_PANELS.length;
    this.finished = true;
    Game.introDone();
  },

  update(dt) {
    this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    const p = this.panel();
    if (!p) return;
    // rolling lightning inside storm panels
    if (p.storm) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.strike();
        this.nextStrike = 1.6 + Math.random() * 1.9;
      }
    }
    // a gull cries now and then on the beach panel
    if (p.scene === 'beach' && Math.random() < dt * 0.25) AudioSys.bird();
    const total = this.totalChars();
    if (this.chars < total) {
      const cps = p.slow ? 14 : p.title ? 10 : 30;
      const prev = Math.floor(this.chars);
      this.chars = Math.min(total, this.chars + cps * dt);
      if (Math.floor(this.chars) > prev && Math.floor(this.chars) % 3 === 0) AudioSys.type();
      if (this.chars >= total) this.doneHold = true;
    } else {
      this.holdT += dt;
      // panels breathe forward on their own (the title card waits for you)
      if (!p.title && this.holdT > (p.hold || 3.4)) this.advance();
    }
  },

  draw(ctx, t) {
    const p = this.panel();
    // near-black with a breath of deep blue
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    if (p && p.darker) { g.addColorStop(0, '#04050a'); g.addColorStop(1, '#020307'); }
    else { g.addColorStop(0, '#070a12'); g.addColorStop(1, '#04060c'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    if (!p) return;
    const scene = p.scene || 'calm';

    if (scene === 'calm' || scene === 'clouds' || scene === 'storm') {
      const cover = scene === 'calm' ? 0 : scene === 'clouds' ? 0.55 : 1;
      introStars(ctx, t, scene === 'storm' ? 0.25 : 1 - cover * 0.6);
      introMoon(ctx, 300, 34, scene === 'storm' ? 0.4 : 1, cover);
      introClouds(ctx, t, scene === 'clouds' ? 0.8 : scene === 'storm' ? 1.35 : 0.25);
      introSea(ctx, t, scene === 'storm', p.grey || false);
      const shipX = scene === 'storm' ? 150 : 210;
      const shipY = scene === 'storm' ? 148 : 146;
      introShip(ctx, shipX, shipY, t, scene === 'storm', !!p.broken);
      if (scene === 'storm') {
        introRain(ctx, t, 90);
        introLightning(ctx, this, t);
      }
      if (this.flashT > 0 && scene !== 'storm') {
        ctx.fillStyle = 'rgba(205,222,238,' + (clamp(this.flashT * 0.5, 0, 0.6)).toFixed(3) + ')';
        ctx.fillRect(0, 0, VW, VH);
      }
    } else if (scene === 'wrecksea') {
      introStars(ctx, t, 0.5);
      introSea(ctx, t, false, true);
      introDebris(ctx, t);
    } else if (scene === 'beach') {
      introBeachDawn(ctx, t);
    } else if (scene === 'island') {
      introIsland(ctx, t, !p.darker);
    } else if (scene === 'compass') {
      introStars(ctx, t, 0.7);
      introCompass(ctx, t);
    } else if (scene === 'title') {
      // the island gone black; just the name
      introSea(ctx, t * 0.4, false, true);
    }

    // text
    const total = this.totalChars();
    let shown = Math.floor(this.chars);
    if (p.title) {
      // title card: single big line, gold, centered
      const full = p.lines[0];
      const shownTxt = full.slice(0, shown);
      const s = 3;
      const w = textWidth(full, s);
      const x = Math.round((VW - w) / 2), y = 92;
      for (const o of [[-2, 0], [2, 0], [0, -2], [0, 2]]) drawText(ctx, shownTxt, x + o[0], y + o[1], '#120c04', s);
      drawText(ctx, shownTxt, x, y, '#e8cf92', s);
      if (shown >= full.length) {
        const sub = 'Chapter One \u2014 The First Slice';
        drawText(ctx, sub, Math.round((VW - textWidth(sub)) / 2), y + 34, '#6f7d86');
      }
    } else {
      let y = p.lines.length === 1 ? 96 : 78;
      for (const line of p.lines) {
        if (shown <= 0) break;
        const part = line.slice(0, shown);
        shown -= line.length;
        const lw = textWidth(line);
        drawText(ctx, part, Math.round((VW - lw) / 2), y, '#dfe6df', 1, '#04060c');
        y += 14;
      }
    }

    // advance hint (after the line finishes)
    if (this.chars >= total && Math.floor(t * 1.8) % 2 === 0 && !p.title) {
      const hint = '\u00b7 press Z or E \u00b7';
      drawText(ctx, hint, Math.round((VW - textWidth(hint)) / 2), VH - 22, 'rgba(160,178,178,0.6)');
    }
    if (p.title && this.chars >= total && Math.floor(t * 1.8) % 2 === 0) {
      const hint = '\u00b7 press Z or E to go ashore \u00b7';
      drawText(ctx, hint, Math.round((VW - textWidth(hint)) / 2), VH - 22, 'rgba(190,178,140,0.75)');
    }
    if (this.idx > 0 || this.chars > 0) {
      // a tiny progress marker of dots
      for (let i = 0; i < INTRO_PANELS.length; i++) {
        ctx.fillStyle = i <= this.idx ? 'rgba(228,201,124,0.55)' : 'rgba(228,201,124,0.16)';
        ctx.fillRect(8 + i * 5, VH - 10, 3, 3);
      }
    }
  }
};

/* -------------------------------------------------------- chapter card */
function drawChapterCard(ctx, t) {
  const a = clamp(Game.epiT * 1.2, 0, 0.88);
  ctx.fillStyle = `rgba(6,10,16,${a.toFixed(3)})`;
  ctx.fillRect(0, 0, VW, VH);
  const fade = clamp((Game.epiT - 0.3) * 1.1, 0, 1);
  ctx.globalAlpha = fade;
  const g = ctx.createLinearGradient(0, 40, 0, 190);
  g.addColorStop(0, 'rgba(8,14,20,0)');
  g.addColorStop(0.25, 'rgba(8,14,20,0.82)');
  g.addColorStop(0.75, 'rgba(8,14,20,0.82)');
  g.addColorStop(1, 'rgba(8,14,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 40, VW, 150);

  const title = 'END OF CHAPTER ONE';
  drawText(ctx, title, Math.round((VW - textWidth(title, 2)) / 2), 66, '#e8cf92', 2, '#140f08');
  const sub = 'THE FIRST SLICE';
  drawText(ctx, sub, Math.round((VW - textWidth(sub)) / 2), 88, '#8fa3a0');
  ctx.fillStyle = '#e4c97c';
  ctx.fillRect(Math.round(VW / 2) - 20, 100, 40, 1);
  const lines = [
    'The mountain is indisposed.',
    'It will not stay that way.'
  ];
  lines.forEach((l, i) => drawText(ctx, l, Math.round((VW - textWidth(l)) / 2), 114 + i * 12, '#cfdcd6'));
  if (fade > 0.9 && Math.floor(t * 1.6) % 2 === 0) {
    const p = 'Press E to keep exploring';
    drawText(ctx, p, Math.round((VW - textWidth(p)) / 2), 160, '#e4c97c', 1, '#140f08');
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------- save indicator */
function drawSaveFlash(ctx) {
  if (!Game.saveFlashT || Game.saveFlashT <= 0) return;
  const a = clamp(Math.min(Game.saveFlashT, 1.6 - Game.saveFlashT) * 2, 0, 1);
  ctx.globalAlpha = a;
  const txt = 'The lantern remembers you.';
  const w = textWidth(txt) + 20;
  drawPanel(ctx, Math.round((VW - w) / 2), 70, w, 17);
  drawText(ctx, txt, Math.round((VW - w) / 2) + 10, 76, '#ffe9a8');
  ctx.globalAlpha = 1;
}
