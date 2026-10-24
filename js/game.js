/* ============================================================================
   js/game.js — game state, player, camera, encounters, saves, transitions,
   input dispatch, main loop and boot.

   Modes: title | intro | play | dialogue | inventory | pause | battle |
          epilogue (chapter card)
   Story flags live in Game.flags (persisted); per-conversation choices in
   Game.asked (persisted too, so reloaded saves don't re-offer questions).
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ input */
const Input = {
  keys: { up: false, down: false, left: false, right: false },
  lastAxis: 'x',
  map: {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
  }
};

function actionFromKey(e) {
  if (e.code === 'KeyE' || e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') return 'confirm';
  if (e.code === 'Escape') return 'pause';
  if (e.code === 'KeyI') return 'inv';
  if (e.code === 'Tab') return 'inv';
  if (e.code === 'KeyM') return 'mute';
  return null;
}

/* ------------------------------------------------------------------ save */
const SaveSys = {
  KEY: 'fructasia_ch1_save_v1',
  _ok: null,
  available() {
    if (this._ok !== null) return this._ok;
    try {
      localStorage.setItem('__fr_test', '1');
      localStorage.removeItem('__fr_test');
      this._ok = true;
    } catch (e) { this._ok = false; }
    return this._ok;
  },
  exists() { return this.available() && !!localStorage.getItem(this.KEY); },
  save() {
    if (!this.available()) return false;
    try {
      const data = {
        v: 1,
        area: World.areaId,
        x: Math.round(Player.x), y: Math.round(Player.y), dir: Player.dir,
        hp: Game.hp, maxhp: Game.maxhp,
        flags: Game.flags, asked: Game.asked,
        objective: { id: Game.objective.id, text: Game.objective.text },
        inv: Inventory.serialize(),
        playTime: Math.round(Game.playTime)
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },
  load() {
    if (!this.exists()) return null;
    try { return JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { return null; }
  },
  clear() { if (this.available()) { try { localStorage.removeItem(this.KEY); } catch (e) {} } }
};

/* ------------------------------------------------------------------ player */
const Player = {
  x: 240, y: 396, dir: 'down', speed: 70,
  animT: 0, idleT: 0, moveT: 0, stepT: 0, moving: false,

  reset() {
    this.x = 240; this.y = 396; this.dir = 'down';
    this.animT = 0; this.idleT = 0; this.moving = false; this.stepT = 0;
  },
  box() { return { x: this.x - 5, y: this.y - 6, w: 10, h: 6 }; },
  surface() {
    const area = World.area;
    if (!area) return 'grass';
    if (area.chars) {
      const row = area.chars[clamp(Math.floor(this.y / TILE), 0, area.chars.length - 1)];
      const ch = row ? row[clamp(Math.floor(this.x / TILE), 0, row.length - 1)] : '.';
      if (ch === 'F') return 'wood';
      if (ch === 'W') return 'sand';
      return 'grass';
    }
    const id = bTerrainId(this.x, this.y + 2);
    return (id === 3 || id === 2) ? 'sand' : 'grass';
  },
  update(dt, blocked) {
    let dx = 0, dy = 0;
    const k = Input.keys;
    if (k.left) dx -= 1;
    if (k.right) dx += 1;
    if (k.up) dy -= 1;
    if (k.down) dy += 1;
    const moving = (dx !== 0 || dy !== 0) && !Game.waking;
    this.moving = moving;
    if (moving) {
      if (Math.abs(dy) > 0 && Math.abs(dx) > 0) {
        this.dir = Input.lastAxis === 'y' ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left');
      } else if (dy !== 0) this.dir = dy > 0 ? 'down' : 'up';
      else this.dir = dx > 0 ? 'right' : 'left';

      const len = Math.hypot(dx, dy) || 1;
      const vx = dx / len * this.speed * dt;
      const vy = dy / len * this.speed * dt;
      if (vx !== 0 && !blocked(this.x + vx, this.y)) this.x += vx;
      if (vy !== 0 && !blocked(this.x, this.y + vy)) this.y += vy;
      this.animT += dt;
      this.idleT = 0;
      this.stepT += dt;
      if (this.stepT > 0.28) {
        this.stepT = 0;
        AudioSys.footstep(this.surface());
      }
    } else {
      this.animT = 0;
      this.idleT += dt;
    }
    const area = World.area;
    if (area) {
      this.x = clamp(this.x, 12, area.w - 12);
      this.y = clamp(this.y, 12, area.h - 12);
    }
  },
  frame() {
    return this.moving ? Math.floor(this.animT * 7) % 4 : -1;
  },
  sprite(t) {
    const facing = this.dir === 'left' ? 'right' : this.dir;
    if (this.moving) {
      return SPR['p_' + facing + Math.floor(this.animT * 7) % 4];
    }
    // idle: slow breath dip + rare blink
    const blink = (this.idleT % 5.2) > 4.95;
    if (facing === 'down') return blink ? SPR.p_down_blink : SPR.p_down_idle;
    if (facing === 'right') return blink ? SPR.p_right_blink : SPR.p_right_idle;
    return SPR.p_up_idle;
  },
  draw(ctx, camX, camY, t) {
    if (Game.waking) {
      // lying in the sand until he wakes
      const spr = SPR.p_lying;
      const dx = Math.round(this.x - spr.width / 2 - camX);
      const dy = Math.round(this.y - spr.height + 3 - camY);
      drawShadow(ctx, this.x - camX, this.y - camY - 1, 18);
      ctx.drawImage(spr, dx, dy);
      return;
    }
    const spr = this.sprite(t);
    const passBob = this.moving && (Math.floor(this.animT * 7) % 4) % 2 === 1 ? -1 : 0;
    const breathe = !this.moving && (this.idleT % 2.6) > 2.1 ? 1 : 0;
    const w = spr.width, h = spr.height;
    const dx = Math.round(this.x - w / 2 - camX);
    const dy = Math.round(this.y - h - camY + passBob + breathe);
    drawShadow(ctx, this.x - camX, this.y - camY - 1, 11);
    if (this.dir === 'left') {
      ctx.save();
      ctx.translate(dx + w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(spr, dx, dy);
    }
  }
};

/* ------------------------------------------------------------------ weather */
const Weather = {
  rain: [], intensity: 1,
  init() {
    this.rain = [];
    for (let i = 0; i < 90; i++) {
      this.rain.push({
        x: Math.random() * (VW + 60) - 30, y: Math.random() * VH,
        len: 2 + Math.floor(Math.random() * 3),
        spd: 150 + Math.random() * 90, drift: 26 + Math.random() * 18
      });
    }
  },
  setIntensity(v) { this.intensity = v; },
  update(dt) {
    if (this.intensity <= 0) return;
    for (const d of this.rain) {
      d.y += d.spd * dt;
      d.x += d.drift * dt;
      if (d.y > VH + 6) { d.y = -8; d.x = Math.random() * (VW + 60) - 30; }
      if (d.x > VW + 30) d.x -= VW + 60;
    }
  },
  draw(ctx) {
    if (this.intensity <= 0) return;
    ctx.fillStyle = `rgba(198,226,235,${(0.2 * this.intensity).toFixed(2)})`;
    const n = Math.floor(this.rain.length * this.intensity);
    for (let i = 0; i < n; i++) {
      const d = this.rain[i];
      for (let s = 0; s < d.len; s++) ctx.fillRect(Math.round(d.x) - (s > 1 ? 1 : 0), Math.round(d.y) - s * 2, 1, 2);
    }
  }
};

/* ------------------------------------------------------------------ camera */
const Camera = {
  x: 0, y: 0,
  snap() {
    const area = World.area;
    if (!area) return;
    this.x = this.tx();
    this.y = this.ty();
  },
  tx() {
    const area = World.area;
    return area.w <= VW ? (area.w - VW) / 2 : clamp(Player.x - VW / 2, 0, area.w - VW);
  },
  ty() {
    const area = World.area;
    return area.h <= VH ? (area.h - VH) / 2 : clamp(Player.y - 16 - VH / 2, 0, area.h - VH);
  },
  update(dt) {
    const k = 1 - Math.pow(0.0008, dt);
    this.x = lerp(this.x, this.tx(), k);
    this.y = lerp(this.y, this.ty(), k);
    const area = World.area;
    if (area) {
      if (area.w > VW) this.x = clamp(this.x, 0, area.w - VW); else this.x = (area.w - VW) / 2;
      if (area.h > VH) this.y = clamp(this.y, 0, area.h - VH); else this.y = (area.h - VH) / 2;
    }
  }
};

/* ------------------------------------------------------------------ game */
const Game = {
  mode: 'title',
  titleScreen: 'menu',
  time: 0, playTime: 0,
  camera: Camera,
  objective: { id: 'explore', text: 'Explore the shore' },
  toast: null, toastT: 0,
  flags: {}, asked: {},
  hp: 20, maxhp: 20,
  examCount: 0,
  fade: { a: 0, dir: 0, cb: null },
  cooldown: 0,
  menuIndex: 0, pauseIndex: 0,
  pauseScreen: 'menu',
  invTab: 'all', invIndex: 0, invScroll: 0,
  areaNameT: 0,
  saveFlashT: 0,
  omen: { next: 26, active: 0, x: 0, y: 0 },
  weather: { birdT: 4 },
  nearest: null,
  waking: 0,
  wakingTalk: false,
  encounterT: 0,
  battleImmune: 0,
  epilogueDone: false,
  embedded: false,

  atk() { return 4 + Inventory.atk(); },
  def() { return 1 + Inventory.def(); },

  reset(full) {
    Player.reset();
    this.playTime = 0;
    this.objective = { id: 'explore', text: 'Explore the shore' };
    this.toast = null; this.toastT = 0;
    this.flags = {}; this.asked = {};
    this.examCount = 0;
    this.hp = 20; this.maxhp = 20;
    Inventory.reset();
    Inventory.add('jerky', 2);
    Inventory.add('compass');
    this.cooldown = 0;
    this.nearest = null;
    this.waking = 0;
    this.wakingTalk = false;
    this.encounterT = 0;
    this.battleImmune = 0;
    this.epilogueDone = false;
    this.omen = { next: 26, active: 0, x: 0, y: 0 };
    Dialogue.reset();
    World.visited = {};
  },

  setObjective(id, text) {
    if (this.objective.id === id) return;
    this.objective = { id, text };
    this.objFlash = 2.8;
    AudioSys.stepObj();
  },
  showToast(text) { this.toast = text; this.toastT = 3.4; },

  /* ------------------------------------------------ lifecycle */
  newGame() {
    this.reset(true);
    this.mode = 'intro';
    Intro.begin();
  },
  introDone() {
    // fade from the intro into the beach; the sailor wakes among the wreck
    this.transition(() => {
      World.load('beach', 240, 396, 'down');
      Camera.snap();
      this.mode = 'play';
      this.waking = 2.6;            // seconds lying in the sand
      this.fade = { a: 1, dir: -1, cb: null };
    });
  },
  continueGame() {
    const data = SaveSys.load();
    if (!data) { this.newGame(); return; }
    this.reset(true);
    this.flags = data.flags || {};
    this.asked = data.asked || {};
    this.hp = data.hp || 20;
    this.maxhp = data.maxhp || 20;
    if (data.objective) this.objective = data.objective;
    Inventory.deserialize(data.inv);
    this.playTime = data.playTime || 0;
    World.visited = {};   // re-show area names, but not first-visit hooks
    World.visited[data.area] = true;
    this.transition(() => {
      World.load(data.area || 'beach', data.x, data.y, data.dir || 'down');
      Camera.snap();
      this.mode = 'play';
      this.fade = { a: 1, dir: -1, cb: null };
    });
  },
  restart() {
    this.reset(true);
    this.transition(() => {
      World.load('beach', 240, 396, 'down');
      Camera.snap();
      this.mode = 'play';
      this.waking = 1.2;
      this.fade = { a: 1, dir: -1, cb: null };
    });
  },
  toTitle() {
    this.reset(true);
    this.mode = 'title';
    this.titleScreen = 'menu';
    this.menuIndex = 0;
    AudioSys.stopSong();
    AudioSys.setMix({ ocean: 0.06, wind: 0.008, rain: 0, hum: 0.01 }, 0.5);
  },
  transition(cb) {
    if (this.fade.dir !== 0) { if (cb) cb(); return; }
    this.fade = { a: 0, dir: 1, cb };
  },

  /* ------------------------------------------------ area transitions */
  checkExits() {
    for (const ex of World.exits) {
      if (Player.x > ex.x && Player.x < ex.x + ex.w && Player.y > ex.y && Player.y < ex.y + ex.h) {
        this.transition(() => {
          World.load(ex.to, ex.tx, ex.ty, ex.dir || 'down');
          Camera.snap();
          this.areaNameT = 3.2;
          this.mode = 'play';
          this.battleImmune = 1.2;
          // objective progression on arriving in the village
          if (ex.to === 'village' && this.objective.id === 'village') {
            this.setObjective('findali', 'Find Ali Sama at the tavern');
          }
          this.fade = { a: 1, dir: -1, cb: null };
        });
        return;
      }
    }
  },

  /* ------------------------------------------------ encounters */
  updateEncounters(dt) {
    if (this.battleImmune > 0) { this.battleImmune -= dt; return; }
    if (!Player.moving) return;
    const enc = World.encounterAt(Player.x, Player.y);
    if (!enc) return;
    this.encounterT += dt;
    // scripted first encounter on the trail
    if (World.areaId === 'trail' && !this.flags.trailFirstEncounter && this.encounterT > 3.2) {
      this.flags.trailFirstEncounter = true;
      this.startBattle('crabApple', true);
      return;
    }
    if (this.encounterT > enc.rate) {
      this.encounterT = 0;
      if (Math.random() < enc.chance) {
        const pool = enc.pool || ['crabApple'];
        this.startBattle(pool[Math.floor(Math.random() * pool.length)], false);
      }
    }
  },
  startBattle(enemyId, scripted) {
    this.showToast(scripted ? 'The bushes rustle with intent...' : 'Something rustles!');
    AudioSys.encounterZap();
    this.transition(() => {
      if (!Battle.start(enemyId)) {
        this.mode = 'play';
        return;
      }
      this.mode = 'battle';
      this.fade = { a: 1, dir: -1, cb: null };
    });
  },
  exitBattle(result, drop) {
    Battle.active = false;
    this.mode = 'play';
    this.battleImmune = 7;
    this.encounterT = 0;
    const music = Areas[World.areaId] && Areas[World.areaId].music;
    if (music) AudioSys.playSong(music); else AudioSys.stopSong();
    AudioSys.setMix((Areas[World.areaId] && Areas[World.areaId].ambience) || {}, 0.5);
    if (result === 'lose') {
      this.defeat();
      return;
    }
    if (drop && ITEMS[drop]) {
      Inventory.add(drop, 1);
      this.showToast('Found: ' + ITEMS[drop].name);
      AudioSys.itemGet();
    } else if (result === 'win') {
      this.showToast('You feel steadier. The island feels you.');
    } else if (result === 'spared') {
      this.showToast('It settles back into the island. Peace, of a kind.');
    }
  },
  defeat() {
    // Defeat = the nearest Memory Lantern re-kindles you (storyline §4)
    this.transition(() => {
      const data = SaveSys.load();
      if (data) {
        this.hp = this.maxhp;
        World.load(data.area, data.x, data.y, data.dir || 'down');
      } else {
        this.hp = this.maxhp;
        World.load('beach', 240, 396, 'down');
      }
      Camera.snap();
      this.mode = 'play';
      this.battleImmune = 3;
      this.showToast('The lantern re-kindles you at the last moment you were entirely yourself.');
      this.fade = { a: 1, dir: -1, cb: null };
    });
  },

  /* ------------------------------------------------ objective/flow helpers */
  updateFlow() {
    // wake-up micro-scene
    if (this.waking > 0) {
      this.waking = Math.max(0, this.waking - dtGlobal);
      if (this.waking <= 0 && !this.wakingTalk) {
        this.wakingTalk = true;
        this.mode = 'dialogue';
        Dialogue.start([
          L('Sailor', 'Sand. Gulls. A headache the size of the horizon.'),
          L('Sailor', 'The Marigold is gone. The compass says north-west. The compass can wait.'),
          OBJ('explore', 'Explore the shore')
        ], () => {
          this.mode = 'play';
          this.cooldown = 0.3;
        });
      }
      return;
    }
    // Vax discovery: after a little wandering, point the player at him
    if (this.objective.id === 'explore' && this.playTime > 6) {
      const vax = World.npcs.find(n => n.id === 'vax');
      if (vax && mdist(Player.x, Player.y, vax.x, vax.y) < 260) {
        this.setObjective('talk', 'Speak with the stranger by the lantern');
        AudioSys.bird();
      } else if (this.examCount >= 3 || this.playTime > 45) {
        this.setObjective('talk', 'Someone keeps a lantern lit inland. Find them.');
      }
    }
    // village objective chain
    if (this.objective.id === 'findali' && this.flags.metAli) {
      this.setObjective('villagefolk', 'Meet Majhool at the shrine and Levi by the well');
    }
    if (this.objective.id === 'villagefolk' && this.flags.metMajhool && this.flags.metLevi) {
      this.setObjective('token', 'Return to Majhool at the shrine');
    }
    // chapter one end card
    if (this.flags.chapterOneEnd && !this.flags.chapterCardShown && this.mode === 'play') {
      this.flags.chapterCardShown = true;
      this.mode = 'epilogue';
      this.epiT = 0;
      AudioSys.stopSong();
    }
  }
};

/* ------------------------------------------------------------- draw helpers */
function drawShadow(ctx, cx, cy, w) {
  const x = Math.round(cx - w / 2), y = Math.round(cy);
  ctx.fillStyle = 'rgba(24,30,42,0.22)';
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.fillStyle = 'rgba(24,30,42,0.13)';
  ctx.fillRect(x, y, w, 1);
}

function drawProp(ctx, p, camX, camY, t) {
  const spr = SPR[p.spr];
  if (!spr) return;
  const w = spr.width, h = spr.height;
  let ox = 0;
  if (p.sway !== undefined && !p.dead) ox = Math.round(Math.sin(t * 1.1 + p.sway * 1.3) * 0.6 + Math.sin(t * 2.3 + p.sway) * 0.25);
  const dx = Math.round(p.x - w / 2 - camX + ox);
  const dy = Math.round(p.y - h - camY);
  if (!p.flat && !p.noShadow) drawShadow(ctx, p.x - camX, p.y - camY - 1, Math.max(6, Math.round(w * 0.55)));
  if (p.flip) {
    ctx.save();
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(spr, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(spr, dx, dy);
  }
  // lantern glow
  if (p.lantern === 'beach' || p.lantern === 'village') {
    const a = 0.16 + Math.sin(t * 2.2 + p.x) * 0.03;
    const gr = ctx.createRadialGradient(p.x - camX, p.y - 34 - camY, 2, p.x - camX, p.y - 34 - camY, 26);
    gr.addColorStop(0, `rgba(255,208,120,${(a * 1.6).toFixed(2)})`);
    gr.addColorStop(1, 'rgba(255,208,120,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(p.x - camX - 26, p.y - 34 - camY - 26, 52, 52);
  }
  if (p.hearth) {
    const a = 0.2 + Math.sin(t * 6) * 0.05 + Math.sin(t * 11) * 0.03;
    const gr = ctx.createRadialGradient(p.x - camX, p.y - 22 - camY, 2, p.x - camX, p.y - 22 - camY, 30);
    gr.addColorStop(0, `rgba(255,160,80,${a.toFixed(2)})`);
    gr.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(p.x - camX - 30, p.y - 22 - camY - 30, 60, 60);
  }
}

function drawNpc(ctx, n, camX, camY, t) {
  let spr, dy2 = 0;
  if (n.vax) {
    const facing = n.dir === 'left' ? 'right' : n.dir;
    let key;
    if (n.talking) {
      key = 'v_' + facing + '_talk';
      dy2 = Math.floor(n.idleT * 5) % 2; // talk bob
    } else {
      const ph = Math.floor(n.idleT / 1.8) % 4;
      if (ph === 1) key = 'v_' + facing + '1';
      else if (ph === 3 && Math.floor(n.idleT / 14) % 2 === 1) key = 'v_' + facing + '2';
      else key = 'v_' + facing + '0';
    }
    if (!SPR[key]) key = 'v_' + facing + '0';
    spr = SPR[key];
  } else {
    spr = n.spriteFrame(t);
    dy2 = Math.floor(n.idleT / 1.6) % 2; // idle weight-shift bob
  }
  if (!spr) return;
  const w = spr.width, h = spr.height;
  const dx = Math.round(n.x - w / 2 - camX);
  const dy = Math.round(n.y - h - camY + (dy2 ? 1 : 0));
  drawShadow(ctx, n.x - camX, n.y - camY - 1, Math.max(8, Math.round(w * 0.5)));
  if (n.dir === 'left') {
    ctx.save();
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(spr, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(spr, dx, dy);
  }
}

/* --------------------------------------------------------- water (beach) */
const WaterGrid = { cell: 8, w: 0, h: 0, ids: null };
function buildWaterGrid() {
  const area = World.area;
  if (!area || World.areaId !== 'beach') return;
  WaterGrid.w = Math.ceil(area.w / WaterGrid.cell);
  WaterGrid.h = Math.ceil(area.h / WaterGrid.cell);
  if (!WaterGrid.ids || WaterGrid.ids.length !== WaterGrid.w * WaterGrid.h) {
    WaterGrid.ids = new Uint8Array(WaterGrid.w * WaterGrid.h);
  }
  for (let cy = 0; cy < WaterGrid.h; cy++) {
    for (let cx = 0; cx < WaterGrid.w; cx++) {
      WaterGrid.ids[cy * WaterGrid.w + cx] = bTerrainId(cx * WaterGrid.cell + 4, cy * WaterGrid.cell + 4);
    }
  }
}
function drawWater(ctx, camX, camY, t) {
  if (!WaterGrid.ids) buildWaterGrid();
  const cell = WaterGrid.cell;
  const c0 = Math.floor(camX / cell), c1 = Math.ceil((camX + VW) / cell);
  const r0 = Math.floor(camY / cell), r1 = Math.ceil((camY + VH) / cell);
  for (let cy = r0; cy <= r1; cy++) {
    if (cy < 0 || cy >= WaterGrid.h) continue;
    for (let cx = c0; cx <= c1; cx++) {
      if (cx < 0 || cx >= WaterGrid.w) continue;
      const id = WaterGrid.ids[cy * WaterGrid.w + cx];
      if (id !== 0 && id !== 1) continue;
      const wx = cx * cell, wy = cy * cell;
      const sx = wx - camX, sy = wy - camY;
      const h = hash2(cx, cy);
      const phase = (t * (id === 1 ? 1.4 : 0.85) + h * 6.28);
      const dx = Math.round(Math.sin(phase) * 3);
      const dy = Math.round(Math.sin(phase * 0.7 + 1) * 1);
      if (h > 0.45) {
        ctx.fillStyle = id === 1 ? 'rgba(126,206,204,0.30)' : 'rgba(78,158,178,0.22)';
        ctx.fillRect(sx + 3 + dx, sy + 5 + dy, 4, 1);
      }
      if (h > 0.86) {
        ctx.fillStyle = id === 1 ? 'rgba(190,240,232,0.34)' : 'rgba(120,190,200,0.20)';
        ctx.fillRect(sx + 9 - dx, sy + 10 + dy, 3, 1);
      }
    }
  }
  const x0 = Math.max(0, Math.floor(camX) - 2);
  const x1 = Math.min(World.area.w, Math.ceil(camX + VW) + 2);
  for (let x = x0; x < x1; x += 2) {
    const sh = bShoreY(x);
    const wave = Math.sin(x * 0.06 + t * 1.7) * 2.2 + Math.sin(x * 0.17 - t * 2.3) * 0.9;
    const yy = Math.round(sh - 1 + wave);
    const sy = yy - camY;
    if (sy < -2 || sy > VH + 2) continue;
    const a = 0.35 + 0.25 * Math.sin(x * 0.1 + t * 2.2);
    ctx.fillStyle = `rgba(226,246,242,${a.toFixed(2)})`;
    ctx.fillRect(x - camX, sy, 2, 1);
    if ((x + Math.floor(t * 12)) % 16 < 3) {
      ctx.fillStyle = 'rgba(240,255,250,0.55)';
      ctx.fillRect(x - camX, sy + 1, 1, 1);
    }
  }
}

function drawCloudShadows(ctx, t) {
  ctx.save();
  ctx.globalAlpha = 0.075;
  ctx.fillStyle = '#0c1a22';
  const spots = [[0.12, 0.22, 220, 96], [0.55, 0.62, 260, 110], [0.86, 0.3, 180, 80]];
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const x = ((s[0] * (VW + 500) + t * (7 + i * 3)) % (VW + 500)) - 250;
    const y = s[1] * VH + Math.sin(t * 0.18 + i) * 12;
    ctx.beginPath();
    ctx.ellipse(x, y, s[2] / 2, s[3] / 2, 0, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

const Vignette = { canvas: null };
function buildVignette() {
  const mk = makeCanvas(VW, VH);
  const g = mk.x.createRadialGradient(VW / 2, VH / 2, VH * 0.30, VW / 2, VH / 2, VH * 0.95);
  g.addColorStop(0, 'rgba(8,12,20,0)');
  g.addColorStop(0.65, 'rgba(8,12,20,0.10)');
  g.addColorStop(1, 'rgba(8,12,20,0.42)');
  mk.x.fillStyle = g;
  mk.x.fillRect(0, 0, VW, VH);
  Vignette.canvas = mk.c;
}

/* ------------------------------------------------------- interactions */
function updateNearest() {
  const px0 = Player.x, py0 = Player.y - 4;
  let best = null, bestD = 26;
  for (const it of World.interactables) {
    const dx = Math.max(0, Math.abs(px0 - it.x) - it.hw);
    const dy = Math.max(0, Math.abs(py0 - it.y) - it.hh);
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = it; }
  }
  if (best) {
    best.sx = best.x - Math.round(Camera.x);
    best.sy = (best.top !== undefined ? best.top : best.y - 12) - Math.round(Camera.y);
  }
  Game.nearest = best;
}

function tryInteract() {
  if (Game.cooldown > 0) return;
  const it = Game.nearest;
  if (!it) return;

  if (it.kind === 'npc') {
    const n = it.ref;
    AudioSys.examine();
    n.talking = true;
    n.face(Player.x, Player.y);
    Game.mode = 'dialogue';
    const nodes = n.script();
    Dialogue.start(nodes, () => {
      n.talking = false;
      Game.mode = 'play';
      Game.cooldown = 0.35;
      if (n.id === 'vax' && !Game.flags.vaxStage) Game.flags.vaxStage = 1;
    });
    return;
  }

  if (it.kind === 'lantern') {
    AudioSys.examine();
    const p = it.ref;
    const lines = p.lantern === 'beach' ? [
      'The lantern remembers: a ship with white sails that stayed one night, and left at dawn, and never arrived anywhere.'
    ] : [
      'The lantern remembers: a festival with no name that everyone attended, and no one can describe.'
    ];
    Game.mode = 'dialogue';
    Dialogue.start([
      L('Sailor', 'A Guild lantern, older than the village. The flame leans toward me as I stop, like a dog that knows its name.'),
      L('Sailor', lines[0]),
      FN(() => {
        Game.hp = Game.maxhp;
        const ok = SaveSys.save();
        Game.saveFlashT = 1.6;
        AudioSys.save();
        Game.showToast(ok ? 'Rested. The lantern remembers you. (Saved)' : 'Rested. (Saving unavailable here)');
      })
    ], () => {
      Game.mode = 'play';
      Game.cooldown = 0.4;
    });
    return;
  }

  const p = it.ref;
  if (!p.interact) return;
  AudioSys.examine();
  Game.mode = 'dialogue';
  Game.examCount++;
  const taken = p.interact.once && Game.flags[p.interact.once];
  let nodes;
  if (taken) {
    nodes = [L('Sailor', p.interact.after || 'Nothing else here worth taking.')];
  } else {
    nodes = p.interact.lines.map(l => Dialogue.say(l.who, l.text, l));
  }
  Dialogue.start(nodes, () => {
    Game.mode = 'play';
    Game.cooldown = 0.3;
    if (p.interact.once && !Game.flags[p.interact.once] && p.interact.item) {
      Game.flags[p.interact.once] = true;
      const d = ITEMS[p.interact.item];
      if (d) {
        Inventory.add(p.interact.item, 1);
        Game.showToast('Got ' + d.name + '!');
        AudioSys.itemGet();
      }
    }
    if (Game.objective.id === 'explore' && Game.examCount >= 2) {
      Game.setObjective('talk', 'Someone keeps a lantern lit inland. Find them.');
    }
  });
}

/* ------------------------------------------------------- title helpers */
function titleItems() {
  const hasSave = SaveSys.exists();
  const items = [];
  if (hasSave) items.push({ act: 'continue' });
  items.push({ act: 'new' });
  items.push({ act: 'controls' });
  items.push({ act: 'sound' });
  return items;
}

/* ------------------------------------------------------- input dispatch */
function handleAction(action) {
  if (action === 'mute') {
    if (AudioSys.enabled && AudioSys.volume > 0) {
      const v = AudioSys.cycleVolume();
      Game.showToast('Sound: ' + (v === 1 ? 'On' : v === 0.5 ? 'Half' : 'Muted'));
    } else {
      AudioSys.setEnabled(true);
      Game.showToast('Sound: On');
    }
    return;
  }
  const m = Game.mode;

  if (m === 'title') {
    const items = titleItems();
    if (Game.titleScreen === 'controls') {
      if (action === 'confirm' || action === 'pause') { Game.titleScreen = 'menu'; AudioSys.back(); }
      return;
    }
    if (action === 'up') { Game.menuIndex = (Game.menuIndex + items.length - 1) % items.length; AudioSys.select(); }
    else if (action === 'down') { Game.menuIndex = (Game.menuIndex + 1) % items.length; AudioSys.select(); }
    else if (action === 'confirm') {
      const it = items[Game.menuIndex];
      AudioSys.select();
      if (it.act === 'continue') Game.continueGame();
      else if (it.act === 'new') Game.newGame();
      else if (it.act === 'controls') Game.titleScreen = 'controls';
      else if (it.act === 'sound') {
        if (AudioSys.enabled && AudioSys.volume > 0) AudioSys.cycleVolume();
        else AudioSys.setEnabled(true);
      }
    }
    return;
  }

  if (m === 'intro') {
    if (action === 'pause') Intro.skip();
    else if (action === 'confirm') Intro.advance();
    return;
  }

  if (m === 'play') {
    if (action === 'confirm') tryInteract();
    else if (action === 'pause') { Game.mode = 'pause'; Game.pauseIndex = 0; Game.pauseScreen = 'menu'; AudioSys.select(); }
    else if (action === 'inv') { Game.mode = 'inventory'; Game.invTab = 'all'; Game.invIndex = 0; Game.invScroll = 0; AudioSys.open(); }
    return;
  }

  if (m === 'dialogue') {
    if (action === 'confirm') {
      if (Dialogue.choiceOpen) Dialogue.pick();
      else Dialogue.advance();
    } else if (action === 'up') { if (Dialogue.choiceOpen) Dialogue.moveChoice(-1); }
    else if (action === 'down') { if (Dialogue.choiceOpen) Dialogue.moveChoice(1); }
    return;
  }

  if (m === 'inventory') {
    const list = Game.invTab === 'all' ? Inventory.slots : Inventory.byCat(Game.invTab);
    if (action === 'up') { Game.invIndex = Math.max(0, Game.invIndex - 1); AudioSys.select(); }
    else if (action === 'down') { Game.invIndex = Math.min(list.length - 1, Game.invIndex + 1); AudioSys.select(); }
    else if (action === 'pause') { Game.mode = 'play'; AudioSys.close(); }
    else if (action === 'inv') {
      let i = INV_TABS.findIndex(t => t.id === Game.invTab);
      i = (i + 1) % INV_TABS.length;
      Game.invTab = INV_TABS[i].id;
      Game.invIndex = 0; Game.invScroll = 0;
      AudioSys.select();
    }
    else if (action === 'confirm') {
      const sel = list[Game.invIndex];
      if (!sel) return;
      const d = ITEMS[sel.id];
      if (d.cat === 'consumable') {
        const res = Inventory.use(sel.id, Game.hp, Game.maxhp);
        if (res) {
          Game.hp = res.hpAfter;
          AudioSys.heal();
          Game.showToast(res.healed > 0 ? 'Restored ' + res.healed + ' HP.' : 'You are already whole.');
        }
        if (Game.invIndex >= list.length) Game.invIndex = list.length - 1;
      } else if (d.cat === 'equip') {
        if (Inventory.isEquipped(sel.id)) { Inventory.unequip(d.slot); AudioSys.back(); Game.showToast('Unequipped ' + d.name + '.'); }
        else { Inventory.equipItem(sel.id); AudioSys.select(); Game.showToast('Equipped ' + d.name + '.'); }
      } else {
        AudioSys.talk();
      }
    } else if (action === 'left' || action === 'right') {
      // cycle tabs
      let i = INV_TABS.findIndex(t => t.id === Game.invTab);
      i = (i + (action === 'right' ? 1 : INV_TABS.length - 1)) % INV_TABS.length;
      Game.invTab = INV_TABS[i].id;
      Game.invIndex = 0; Game.invScroll = 0;
      AudioSys.select();
    }
    return;
  }

  if (m === 'pause') {
    if (Game.pauseScreen === 'controls') {
      if (action === 'confirm' || action === 'pause') { Game.pauseScreen = 'menu'; AudioSys.back(); }
      return;
    }
    if (action === 'pause') { Game.mode = 'play'; AudioSys.back(); }
    else if (action === 'up') { Game.pauseIndex = (Game.pauseIndex + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; AudioSys.select(); }
    else if (action === 'down') { Game.pauseIndex = (Game.pauseIndex + 1) % PAUSE_ITEMS.length; AudioSys.select(); }
    else if (action === 'confirm') {
      AudioSys.select();
      const it = PAUSE_ITEMS[Game.pauseIndex];
      if (it === 'Resume') Game.mode = 'play';
      else if (it === 'Inventory') { Game.mode = 'inventory'; Game.invTab = 'all'; Game.invIndex = 0; AudioSys.open(); }
      else if (it === 'Controls') Game.pauseScreen = 'controls';
      else if (it === 'Save Game') {
        const ok = SaveSys.save();
        Game.saveFlashT = 1.6;
        Game.showToast(ok ? 'Saved.' : 'Saving unavailable in this browser.');
        if (ok) AudioSys.save();
      }
      else if (it === 'Restart') Game.restart();
      else if (it === 'Sound') {
        if (AudioSys.enabled && AudioSys.volume > 0) AudioSys.cycleVolume();
        else AudioSys.setEnabled(true);
      }
      else if (it === 'Title Screen') Game.toTitle();
    }
    return;
  }

  if (m === 'battle') {
    Battle.onAction(action);
    return;
  }

  if (m === 'epilogue') {
    if (action === 'confirm' && Game.epiT > 1.0) {
      Game.mode = 'play';
      Game.cooldown = 0.3;
      Game.showToast('Objective: ' + Game.objective.text);
      AudioSys.advance();
    }
    return;
  }
}

/* ------------------------------------------------------------- events */
function installInputListeners() {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = Input.map[e.code];
    if (dir) {
      Input.keys[dir] = true;
      if (dir === 'up' || dir === 'down') Input.lastAxis = 'y';
      else Input.lastAxis = 'x';
      if (e.repeat) return;
      handleAction(dir);
      return;
    }
    if (e.repeat) return;
    const act = actionFromKey(e);
    if (act) handleAction(act);
  });
  window.addEventListener('keyup', (e) => {
    const dir = Input.map[e.code];
    if (dir) Input.keys[dir] = false;
  });
  window.addEventListener('blur', () => {
    Input.keys.up = Input.keys.down = Input.keys.left = Input.keys.right = false;
    if (Game.mode === 'play') { Game.mode = 'pause'; Game.pauseIndex = 0; Game.pauseScreen = 'menu'; }
  });
  window.addEventListener('pointerdown', () => {
    AudioSys.resume();
    if (Game.mode === 'intro') Intro.advance();
    else if (Game.mode === 'dialogue') handleAction('confirm');
  });
}

/* ------------------------------------------------------------- update */
let dtGlobal = 0.016;
function update(dt) {
  dtGlobal = dt;
  Game.time += dt;
  Weather.update(dt);
  if (Game.toastT > 0) Game.toastT -= dt;
  if (Game.objFlash > 0) Game.objFlash -= dt;
  if (Game.cooldown > 0) Game.cooldown -= dt;
  if (Game.saveFlashT > 0) Game.saveFlashT -= dt;
  if (Game.areaNameT > 0) Game.areaNameT -= dt;
  AudioSys.tickMusic();

  if (Game.fade.dir !== 0) {
    Game.fade.a = clamp(Game.fade.a + Game.fade.dir * dt * 2.2, 0, 1);
    if (Game.fade.a >= 1 && Game.fade.dir > 0) {
      Game.fade.dir = 0;
      const cb = Game.fade.cb;
      Game.fade.cb = null;
      if (cb) cb();
    }
    if (Game.fade.a <= 0 && Game.fade.dir < 0) Game.fade.dir = 0;
  }

  const m = Game.mode;
  if (m === 'title') {
    return;
  }
  if (m === 'intro') {
    Intro.update(dt);
    return;
  }
  if (m === 'play') {
    Game.playTime += dt;
    Player.update(dt, blockedAt);
    for (const n of World.npcs) n.update(dt);
    updateNearest();
    Camera.update(dt);
    Game.checkExits();
    Game.updateEncounters(dt);
    Game.updateFlow();
    // ambience: birds + the omen in the treeline (beach only)
    if (World.areaId === 'beach' || World.areaId === 'village') {
      Game.weather.birdT -= dt;
      if (Game.weather.birdT <= 0) { AudioSys.bird(); Game.weather.birdT = 8 + Math.random() * 10; }
    }
    if (World.areaId === 'beach') {
      if (Game.omen.active > 0) Game.omen.active -= dt;
      else {
        Game.omen.next -= dt;
        if (Game.omen.next <= 0) {
          Game.omen.next = 30 + Math.random() * 25;
          Game.omen.active = 2.6;
          Game.omen.x = 180 + Math.random() * 420;
          Game.omen.y = 138 + Math.random() * 8;
          AudioSys.moan();
        }
      }
    }
    return;
  }
  if (m === 'dialogue') {
    Dialogue.update(dt);
    for (const n of World.npcs) n.update(dt);
    return;
  }
  if (m === 'inventory') {
    return;
  }
  if (m === 'pause') {
    return;
  }
  if (m === 'battle') {
    Battle.update(dt, Input.keys);
    return;
  }
  if (m === 'epilogue') {
    Game.epiT += dt;
    return;
  }
}

/* ------------------------------------------------------------- render */
function drawWorld(ctx, t) {
  const camX = Math.round(Camera.x), camY = Math.round(Camera.y);
  const area = World.area;
  // letterbox for small indoor areas
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, VW, VH);
  if (area.w <= VW || area.h <= VH) {
    // small indoor areas: centered, no scroll
    ctx.drawImage(area.terrainCanvas, Math.round((VW - area.w) / 2), Math.round((VH - area.h) / 2));
  } else {
    ctx.drawImage(area.terrainCanvas, camX, camY, VW, VH, 0, 0, VW, VH);
  }
  if (World.areaId === 'beach') drawWater(ctx, camX, camY, t);
  if (!Areas[World.areaId] || !Areas[World.areaId].indoor) drawCloudShadows(ctx, t);

  // omen: pale eyes in the treeline, gone before you're sure
  if (World.areaId === 'beach') {
    const om = Game.omen;
    if (om.active > 0) {
      const a = Math.min(1, Math.min(om.active, 2.6 - om.active + 0.2) * 1.4);
      const ex = Math.round(om.x - camX), ey = Math.round(om.y - camY);
      ctx.globalAlpha = clamp(a, 0, 1) * 0.85;
      ctx.fillStyle = '#e8e0b8';
      ctx.fillRect(ex, ey, 2, 1);
      ctx.fillRect(ex + 4, ey, 2, 1);
      ctx.globalAlpha = 1;
    }
  }

  // y-sorted draw list
  const items = [];
  for (const p of World.props) {
    if (p.flat) items.push({ y: -999, p });
    else items.push({ y: p.y, p });
  }
  for (const n of World.npcs) items.push({ y: n.y, n });
  items.push({ y: Player.y, player: true });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.player) Player.draw(ctx, camX, camY, t);
    else if (it.n) drawNpc(ctx, it.n, camX, camY, t);
    else drawProp(ctx, it.p, camX, camY, t);
  }

  // gold diamond over the nearest examinable
  const near = Game.nearest;
  if (near && Game.mode === 'play' && near.kind === 'obj') {
    const bob = Math.round(Math.sin(t * 3) * 1.5);
    const mx = Math.round(near.sx), my = Math.round(near.sy - 6 + bob);
    ctx.fillStyle = 'rgba(228,201,124,0.9)';
    ctx.fillRect(mx - 1, my, 3, 1);
    ctx.fillRect(mx, my - 1, 1, 3);
  }
  // talk bubble over Vax while he's the objective
  if (Game.objective.id === 'talk' && Game.mode === 'play') {
    const vax = World.npcs.find(n => n.id === 'vax');
    if (vax) {
      const bob = Math.round(Math.sin(t * 2.4) * 1.5);
      const mx = Math.round(vax.x - camX), my = Math.round(vax.y - 44 - camY + bob);
      ctx.drawImage(SPR.bubble, mx - 5, my - 10);
      drawText(ctx, '!', mx - 1, my - 7, '#2a2438');
    }
  }
  // cold shadow pooling at the beach treeline
  if (World.areaId === 'beach') {
    const fy = bForestY(Player.x) - camY;
    if (fy < VH + 40) {
      const g = ctx.createLinearGradient(0, fy - 60, 0, fy + 24);
      g.addColorStop(0, 'rgba(10,12,22,0.55)');
      g.addColorStop(0.55, 'rgba(10,12,22,0.25)');
      g.addColorStop(1, 'rgba(10,12,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.max(0, fy - 60), VW, Math.min(VH, fy + 24) - Math.max(0, fy - 60));
    }
  }
  ctx.drawImage(Vignette.canvas, 0, 0);
  Weather.draw(ctx);
}

let ctx = null, canvas = null;

function render(t) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VW, VH);
  const m = Game.mode;
  if (m === 'title') {
    drawTitle(ctx, t);
  } else if (m === 'intro') {
    Intro.draw(ctx, t);
  } else if (m === 'battle') {
    Battle.draw(ctx, t);
  } else {
    if (World.area) drawWorld(ctx, t);
    const hud = m === 'play';
    if (hud || m === 'dialogue') drawHUD(ctx, t);
    if (m === 'dialogue') drawDialogueBox(ctx, t);
    if (m === 'inventory') drawInventory(ctx, t);
    if (m === 'pause') {
      drawWorld(ctx, t);
      drawPause(ctx, t);
      if (Game.pauseScreen === 'controls') {
        const cw = Math.min(VW - 16, 300);
        const chH = 34 + CONTROLS_ROWS.length * 15;
        drawControls(ctx, Math.round((VW - cw) / 2), Math.round((VH - chH) / 2), cw);
      }
    }
    if (m === 'epilogue') drawChapterCard(ctx, t);
    drawSaveFlash(ctx);
  }
  if (Game.fade.a > 0) {
    ctx.fillStyle = `rgba(4,7,12,${Game.fade.a.toFixed(3)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
}

/* ------------------------------------------------------------- boot */
function resize() {
  const wrap = document.getElementById('wrap');
  const availW = wrap.clientWidth || window.innerWidth;
  const availH = wrap.clientHeight || window.innerHeight;
  let scale = Math.min(availW / VW, availH / VH);
  if (scale > 2) scale = Math.floor(scale);
  scale = Math.max(0.4, scale);
  canvas.style.width = Math.round(VW * scale) + 'px';
  canvas.style.height = Math.round(VH * scale) + 'px';
}

let lastT = 0;
function loop(now) {
  if (!lastT) lastT = now;
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05;
  try {
    update(dt);
    render(Game.time);
  } catch (err) {
    window.__errors.push(String(err && err.stack || err));
    console.error(err);
  }
  requestAnimationFrame(loop);
}

function boot() {
  window.__errors = window.__errors || [];
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  buildAllSprites();
  buildPropSprites();
  buildVignette();
  Weather.init();

  try { Game.embedded = window.top !== window.self; } catch (e) { Game.embedded = true; }
  Game.reset(true);
  Game.mode = 'title';
  Game.titleScreen = 'menu';
  AudioSys.setMix({ ocean: 0.06, wind: 0.008, rain: 0, hum: 0.012 }, 1);

  resize();
  window.addEventListener('resize', resize);
  installInputListeners();

  // ---- test hooks (used by tools/harness.mjs; harmless in a browser)
  window.__game = {
    Game, Player, Camera, Dialogue, Inventory, Battle, World, Areas, Input, AudioSys, SPR, ITEMS,
    Intro, SaveSys, blockedAt, tryInteract, updateNearest, handleAction, update, render,
    bTerrainId, PAL, buildWaterGrid, drawWorld, Weather, Camera,
    teleport(x, y) {
      Player.x = x; Player.y = y;
      Camera.snap();
    },
    step(dt, n) { for (let i = 0; i < (n || 1); i++) { update(dt); } render(Game.time); },
    act(a) { handleAction(a); },
    key(code, down) {
      const dir = Input.map[code];
      if (dir) Input.keys[dir] = down;
      if (down) {
        const a = actionFromKey({ code });
        if (a) handleAction(a);
        else if (dir) handleAction(dir);
      }
    },
    loadArea(id, x, y, dir) { World.load(id, x, y, dir); Camera.snap(); buildWaterGrid(); Game.mode = 'play'; },
    errors: window.__errors
  };

  requestAnimationFrame(loop);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
