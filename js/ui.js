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

function drawHpBar(ctx) {
  const x = 8, y = 29;
  const w = 96;
  drawPanel(ctx, x, y, w + textWidth('HP 20/20') + 12, 15, 0.92);
  // little lantern flame icon
  ctx.drawImage(SPR[Math.floor(Game.time * 6) % 2 === 0 ? 'soul0' : 'soul1'], x + 4, y + 4);
  ctx.fillStyle = '#4a1d20';
  ctx.fillRect(x + 15, y + 5, w, 6);
  const frac = clamp(Game.hp / Game.maxhp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? '#e8cf6a' : frac > 0.25 ? '#e0a23b' : '#d8452e';
  ctx.fillRect(x + 15, y + 5, Math.round(w * frac), 6);
  drawText(ctx, 'HP ' + Math.max(0, Game.hp) + '/' + Game.maxhp, x + 15 + w + 5, y + 5, '#eae3d2');
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
const INTRO_PANELS = [
  { lines: ['Every sailor knows the story of', 'THE FORGE.'], music: 'title' },
  { lines: ['The place where broken things', 'are made whole.', 'Where what was lost can be rebuilt.'] },
  { lines: ['The Sailor had chased that story', 'across nine seas.', 'The compass always pointed further.'] },
  { lines: ['Then, one night \u2014', 'the storm.'], storm: true },
  { lines: ['It did not behave like weather.', 'It behaved like a hand.'], storm: true, darker: true },
  { lines: ['The ship came apart.', 'The sea took the rest.'], storm: true, crash: true, darker: true },
  { lines: ['Cold.', 'Sand.', 'Gulls.', 'Morning.'] },
  { lines: ['An island not on any chart.', 'Fruit-heavy. Bright-eyed.'], beat: 0.7 },
  { lines: ['Wrong.'], darker: true, slow: true },
  { lines: ['FRUITS ISLAND'], title: true }
];

const Intro = {
  idx: 0,
  chars: 0,
  t: 0,
  holdT: 0,
  doneHold: false,
  flashT: 0,
  finished: false,

  begin() {
    this.idx = 0; this.chars = 0; this.t = 0; this.holdT = 0;
    this.doneHold = false; this.finished = false; this.flashT = 0;
    AudioSys.playSong('title');
    AudioSys.setMix({ ocean: 0.02, wind: 0.006, rain: 0, hum: 0.05 }, 0.4);
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
    } else {
      const p = this.panel();
      if (p.crash) { AudioSys.crash(); this.flashT = 0.5; }
      else if (p.storm && this.idx === 3) { AudioSys.thunder(); this.flashT = 0.4; }
      if (p.title) { AudioSys.stopSong(); AudioSys.setMix({ hum: 0.08 }, 0.3); }
    }
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
    const total = this.totalChars();
    if (this.chars < total) {
      const cps = p.slow ? 14 : p.title ? 10 : 30;
      const prev = Math.floor(this.chars);
      this.chars = Math.min(total, this.chars + cps * dt);
      if (Math.floor(this.chars) > prev && Math.floor(this.chars) % 3 === 0) AudioSys.type();
      if (this.chars >= total) this.doneHold = true;
    } else {
      this.holdT += dt;
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

    // storm panels: rain + distant lightning
    if (p.storm) {
      ctx.fillStyle = 'rgba(140,170,190,0.16)';
      for (let i = 0; i < 70; i++) {
        const h = hash2(i, 9);
        const ry = ((t * (170 + h * 140) + h * 400) % (VH + 30)) - 15;
        const rx = ((h * (VW + 80) + t * 30) % (VW + 80)) - 40;
        ctx.fillRect(Math.round(rx), Math.round(ry), 1, 4 + Math.floor(h * 3));
      }
      if (Math.sin(t * 0.9 + 2) > 0.985 || this.flashT > 0) {
        ctx.fillStyle = 'rgba(200,220,240,0.13)';
        ctx.fillRect(0, 0, VW, VH);
      }
      // sea swell at the bottom
      ctx.fillStyle = 'rgba(20,40,60,0.6)';
      for (let i = 0; i < 30; i++) {
        const y = VH - 26 + i;
        const w = 60 + Math.sin(t * 2 + i) * 30;
        ctx.fillRect(Math.round(VW / 2 - w / 2), y, Math.round(w), 1);
      }
    }

    // text
    const total = this.totalChars();
    const cps = p.slow ? 14 : p.title ? 10 : 30;
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
        const sub = 'Chapter One';
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
    if (this.chars >= total && Math.floor(t * 1.8) % 2 === 0) {
      const hint = '\u00b7 press Z or E \u00b7';
      drawText(ctx, hint, Math.round((VW - textWidth(hint)) / 2), VH - 22, 'rgba(160,178,178,0.6)');
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
