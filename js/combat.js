/* ============================================================================
   js/combat.js — battle system (original, Undertale-inspired in structure)
   Flow:  intro -> menu -> [fight timing | act list | item list | mercy]
          -> resolve -> enemy flavor+intent -> DODGE (bullet box) -> menu ...
   End states: win (hp<=0), spared, flee, lose. All exits call Battle.finish
   exactly once; Game.exitBattle() restores the overworld (inventory state is
   shared by reference so items used in battle persist after).
   ========================================================================== */
'use strict';

const ENEMY_DEFS = {
  crabApple: {
    id: 'crabApple', name: 'Crab Apple', spr: 'crabApple',
    hp: 20, atk: 3, def: 1,
    flavor: [
      'The Crab Apple skitters sideways, shell glinting.',
      'It polishes its shell with one pincer. Vain.',
      'Sand falls out of its joints. It pretends not to notice.',
      'The Crab Apple clicks a rhythm. It is not a friendly rhythm.'
    ],
    intents: {
      sweep: 'The Crab Apple winds up for a sideways rush.',
      pinch: 'Both pincers open wide. That is a lot of pincer.'
    },
    check: 'CRAB APPLE \u2014 ATK 3 DEF 1. Proud of its shell. Mortified about the sea lice.',
    acts: [
      { id: 'compliment', text: 'Compliment', apply(e) { e.spareable = true; return 'You compliment the shell. The Crab Apple freezes mid-skitter, then pirouettes to show its other side. It is too flustered to fight well.'; } },
      { id: 'boil', text: 'Boiling Joke', apply(e) { e.atk = Math.max(2, e.atk - 1); return 'You mention how good steamed shellfish smells. The Crab Apple clicks its pincers furiously. It is laughing. Probably.'; } }
    ],
    patterns: ['sweep', 'pinch'],
    drops: [['fruit', 0.4], ['bandage', 0.2]]
  },
  bramblett: {
    id: 'bramblett', name: 'Bramblett', spr: 'bramblett',
    hp: 26, atk: 4, def: 0,
    flavor: [
      'Bramblett rustles nervously. Its berries glow like little lanterns.',
      'Bramblett checks the ground for rakes.',
      'A single berry drops off, rolls, and hides behind a root.',
      'Bramblett braces itself. It has been braced its whole life.'
    ],
    intents: {
      thorns: 'Thorns shake loose above the box.',
      berries: 'Berries aim your way, quietly apologizing.'
    },
    check: 'BRAMBLETT \u2014 ATK 4 DEF 0. A bramble that learned to walk. Terrified of being pruned.',
    acts: [
      { id: 'untangle', text: 'Untangle', apply(e) { e.spareable = true; return 'You gently untangle a snagged vine. Bramblett stops shaking from root to crown.'; } },
      { id: 'whistle', text: 'Whistle', apply(e) { e.slow = true; return 'You whistle an old sea tune. The berries sway along in time.'; } }
    ],
    patterns: ['thorns', 'berries'],
    drops: [['fruit', 0.5], ['jerky', 0.25]]
  },
  gullgazer: {
    id: 'gullgazer', name: 'Gullgazer', spr: 'gullgazer',
    hp: 14, atk: 5, def: 0,
    flavor: [
      'The Gullgazer stares. It has been staring for some time.',
      'It tilts its head 90 degrees. So do you, involuntarily.',
      'Somewhere behind its eye, a memory of being fed plays on loop.',
      'The Gullgazer does not blink. The eye is patient.'
    ],
    intents: {
      darts: 'Wings tuck. A dive is coming.',
      feathers: 'It prepares to shed feathers \u2014 sharp ones.'
    },
    check: 'GULLGAZER \u2014 ATK 5 DEF 0. It remembers being fed. It does not remember by whom.',
    acts: [
      { id: 'stare', text: 'Stare Back', apply(e) { e.spareable = true; return 'You stare back, flat and unblinking. The Gullgazer blinks first. It looks deeply unsettled by losing.'; } },
      { id: 'avert', text: 'Avert Eyes', apply(e) { e.atk = Math.max(3, e.atk - 1); return 'You avert your eyes politely. The Gullgazer relaxes. So, unexpectedly, do you.'; } }
    ],
    patterns: ['darts', 'feathers'],
    drops: [['bandage', 0.4]]
  }
};

/* ------------------------------------------------------------- the battle */
const BOX = { x: 92, y: 104, w: 200, h: 64 };
const MENU_BTN = [
  { id: 'fight', label: 'FIGHT' },
  { id: 'act',   label: 'ACT' },
  { id: 'item',  label: 'ITEM' },
  { id: 'mercy', label: 'MERCY' }
];

const Battle = {
  active: false,
  state: 'intro',        // intro|menu|target|act|item|mercy|resolve|enemyline|dodge|win|spared|flee|lose
  enemy: null,
  t: 0,
  menuIndex: 0,
  subIndex: 0,
  boxMsg: '',
  flavorIdx: 0,
  // fight timing bar
  cursorX: 0, cursorDir: 1, hitAccuracy: 0,
  // dodge phase
  pattern: null, patT: 0, patDur: 3.4, spawnT: 0,
  soul: { x: 0, y: 0 },
  invuln: 0,
  projectiles: [],
  dmgPops: [],           // floating damage numbers {x,y,txt,t,col}
  shake: 0,
  flash: 0,
  finished: false,
  result: null,
  dropItem: null,
  playerHurtFlash: 0,

  start(enemyId, opts) {
    opts = opts || {};
    const def = ENEMY_DEFS[enemyId];
    if (!def) return false;
    this.active = true;
    this.finished = false;
    this.result = null;
    this.dropItem = null;
    this.enemy = {
      def, id: def.id, name: def.name, spr: def.spr,
      hp: def.hp, maxhp: def.hp, atk: def.atk, defv: def.def,
      spareable: false, slow: false, patternIdx: opts.firstPattern || 0,
      hurtT: 0, swayT: Math.random() * 6
    };
    this.t = 0;
    this.state = 'intro';
    this.menuIndex = 0;
    this.subIndex = 0;
    this.flavorIdx = 0;
    this.boxMsg = def.flavor[0];
    this.projectiles = [];
    this.dmgPops = [];
    this.invuln = 0;
    this.shake = 0;
    this.flash = 0;
    this.soul.x = BOX.x + BOX.w / 2;
    this.soul.y = BOX.y + BOX.h / 2;
    AudioSys.playSong('battle');
    AudioSys.battleStart();
    return true;
  },

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.result = result;
    this.state = result;
    this.t = 0;
    if (result === 'win') { AudioSys.victory(); Game.flags.hurt = (Game.flags.hurt || 0) + 1; }
    else if (result === 'spared') { AudioSys.spare(); Game.flags.spared = (Game.flags.spared || 0) + 1; }
    else if (result === 'flee') AudioSys.flee();
    else if (result === 'lose') AudioSys.defeat();
    // roll a drop for wins/spares
    if (result === 'win' || result === 'spared') {
      for (const [id, chance] of this.enemy.def.drops) {
        if (Math.random() < chance) { this.dropItem = id; break; }
      }
    }
  },

  /* ------------------------------------------------------------- actions */
  playerAtk() { return Game.atk(); },
  playerDef() { return Game.def(); },

  doFightHit() {
    // called when the player confirms on the timing bar
    const e = this.enemy;
    const center = BOX.x + BOX.w / 2;
    const acc = clamp(1 - Math.abs(this.cursorX - center) / (BOX.w / 2), 0, 1);
    this.hitAccuracy = acc;
    let dmg = Math.max(1, Math.round((this.playerAtk() + 1 + Math.random() * 2 - e.defv) * (0.55 + acc)));
    e.hp -= dmg;
    e.hurtT = 0.5;
    this.dmgPops.push({ x: 192 + (Math.random() * 14 - 7), y: 52, txt: String(dmg), t: 0, col: acc > 0.9 ? '#ffe9a8' : '#f4efe4' });
    AudioSys.hit();
    this.shake = 0.25;
    this.state = 'resolve';
    this.boxMsg = acc > 0.9 ? 'Dead center! The ' + e.name + ' reels!' : 'You swing your lantern-hard fist.';
    if (e.hp <= 0) {
      setTimeout(() => {}, 0);
    }
  },

  applyAct(act) {
    const e = this.enemy;
    let msg;
    try { msg = act.apply(e); } catch (err) { msg = 'Nothing happens.'; }
    this.state = 'resolve';
    this.boxMsg = msg;
    AudioSys.examine();
  },

  useItemBattle(id) {
    const d = ITEMS[id];
    if (!d || d.cat !== 'consumable') return;
    const res = Inventory.use(id, Game.hp, Game.maxhp);
    if (res) {
      Game.hp = res.hpAfter;
      this.dmgPops.push({ x: 192, y: 150, txt: '+' + res.healed, t: 0, col: '#9fd8a8' });
      AudioSys.heal();
    }
    this.state = 'resolve';
    this.boxMsg = 'You use the ' + d.name + '.' + (res && res.healed === 0 ? ' You are already whole.' : '');
  },

  trySpare() {
    const e = this.enemy;
    if (e.spareable || e.hp <= e.maxhp * 0.18) {
      this.finish('spared');
      this.boxMsg = 'The ' + e.name + ' settles back into the island, grateful.';
    } else {
      this.state = 'resolve';
      this.boxMsg = 'You offer peace. The ' + e.name + ' is not ready to settle down yet.';
    }
  },

  tryFlee() {
    if (Math.random() < 0.75) {
      this.finish('flee');
      this.boxMsg = 'You walk away with dignity. Mostly.';
    } else {
      this.state = 'resolve';
      this.boxMsg = 'You try to leave. The ' + this.enemy.name + ' sidesteps into your path!';
    }
  },

  /* --------------------------------------------------------- enemy phase */
  beginEnemyPhase() {
    const e = this.enemy;
    if (e.hp <= 0) { this.finish('win'); return; }
    const pid = e.def.patterns[e.patternIdx % e.def.patterns.length];
    e.patternIdx++;
    this.pattern = pid;
    this.patT = 0;
    this.spawnT = 0;
    this.projectiles = [];
    this.soul.x = BOX.x + BOX.w / 2;
    this.soul.y = BOX.y + BOX.h / 2;
    this.state = 'enemyline';
    this.boxMsg = (e.def.intents && e.def.intents[pid]) || e.def.flavor[0];
    AudioSys.talk();
  },

  spawnPattern(pid, dt) {
    const e = this.enemy;
    const spd = e.slow ? 0.65 : 1;
    const S = this;
    const addDot = (x, y, vx, vy, r, col) => S.projectiles.push({ x, y, vx: vx * spd, vy: vy * spd, r: r || 3, col: col || '#e23a2e', life: 6 });
    this.spawnT -= dt;
    const rate = e.slow ? 0.42 : 0.3;
    if (pid === 'sweep') {
      if (this.spawnT <= 0) {
        this.spawnT = rate + 0.1;
        const fromLeft = Math.floor(this.patT * 2.2) % 2 === 0;
        const y = BOX.y + 8 + Math.random() * (BOX.h - 16);
        addDot(fromLeft ? BOX.x - 6 : BOX.x + BOX.w + 6, y, (fromLeft ? 1 : -1) * (52 + Math.random() * 26), 0, 3);
      }
      if (Math.random() < dt * 1.4) {
        addDot(BOX.x + 6 + Math.random() * (BOX.w - 12), BOX.y - 6, 0, 34, 2, '#e08a4c');
      }
    } else if (pid === 'pinch') {
      if (this.spawnT <= 0) {
        this.spawnT = 0.55;
        // two horizontal pinch lines with a gap that shifts
        const gapY = BOX.y + 10 + Math.random() * (BOX.h - 24);
        for (let y = BOX.y + 4; y < BOX.y + BOX.h - 2; y += 5) {
          if (Math.abs(y - gapY) < 9) continue;
          addDot(BOX.x - 6, y, 44, 0, 2, '#e23a2e');
          addDot(BOX.x + BOX.w + 6, y, -44, 0, 2, '#e23a2e');
        }
      }
    } else if (pid === 'thorns') {
      if (this.spawnT <= 0) {
        this.spawnT = 0.34;
        const tx = BOX.x + 6 + Math.random() * (BOX.w - 12);
        this.projectiles.push({ x: tx, y: BOX.y - 8, vx: 0, vy: (46 + Math.random() * 20) * spd, r: 2, col: '#c9a6e0', life: 6, thorn: true });
      }
    } else if (pid === 'berries') {
      if (this.spawnT <= 0) {
        this.spawnT = 0.7;
        const dx = this.soul.x - (BOX.x - 8), dy = this.soul.y - (BOX.y - 8);
        const len = Math.hypot(dx, dy) || 1;
        for (let i = 0; i < 3; i++) {
          const sp = 58 + i * 16;
          addDot(BOX.x - 8, BOX.y - 8, dx / len * sp, dy / len * sp, 2.4, '#a81f2c');
        }
      }
    } else if (pid === 'darts') {
      if (this.spawnT <= 0) {
        this.spawnT = 0.42;
        const y = BOX.y + 6 + Math.random() * (BOX.h - 12);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.projectiles.push({ x: dir > 0 ? BOX.x - 8 : BOX.x + BOX.w + 8, y, vx: dir * 120 * spd, vy: 0, r: 2, col: '#e8ecef', dart: true, life: 6 });
      }
    } else if (pid === 'feathers') {
      if (this.spawnT <= 0) {
        this.spawnT = 0.16;
        const fx = BOX.x + 4 + Math.random() * (BOX.w - 8);
        this.projectiles.push({ x: fx, y: BOX.y - 6, vx: (Math.random() - 0.5) * 16, vy: (60 + Math.random() * 26) * spd, r: 1.8, col: '#c3ccd2', feather: true, life: 6 });
      }
    }
  },

  /* ------------------------------------------------------------- update */
  update(dt, input) {
    this.t += dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.playerHurtFlash > 0) this.playerHurtFlash -= dt;
    for (const p of this.dmgPops) p.t += dt;
    this.dmgPops = this.dmgPops.filter(p => p.t < 1.1);
    if (this.enemy) {
      if (this.enemy.hurtT > 0) this.enemy.hurtT -= dt;
      this.enemy.swayT += dt;
    }

    switch (this.state) {
      case 'intro':
        if (this.t > 0.9) { this.state = 'menu'; this.t = 0; }
        break;
      case 'menu':
        break;
      case 'target': {
        this.cursorX += this.cursorDir * 235 * dt;
        if (this.cursorX > BOX.x + BOX.w - 6) { this.cursorX = BOX.x + BOX.w - 6; this.cursorDir = -1; }
        if (this.cursorX < BOX.x + 6) { this.cursorX = BOX.x + 6; this.cursorDir = 1; }
        break;
      }
      case 'resolve':
        if (this.t > 1.15) {
          this.t = 0;
          if (this.enemy.hp <= 0) this.finish('win');
          else this.beginEnemyPhase();
        }
        break;
      case 'enemyline':
        if (this.t > 1.25) { this.t = 0; this.state = 'dodge'; }
        break;
      case 'dodge': {
        this.patT += dt;
        // move the soul
        const spd = 92;
        if (input.left) this.soul.x -= spd * dt;
        if (input.right) this.soul.x += spd * dt;
        if (input.up) this.soul.y -= spd * dt;
        if (input.down) this.soul.y += spd * dt;
        this.soul.x = clamp(this.soul.x, BOX.x + 5, BOX.x + BOX.w - 5);
        this.soul.y = clamp(this.soul.y, BOX.y + 5, BOX.y + BOX.h - 5);
        this.spawnPattern(this.pattern, dt);
        if (this.invuln > 0) this.invuln -= dt;
        // projectile update + collision
        for (const p of this.projectiles) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.life -= dt;
          if (p.thorn) p.vx = Math.sin(p.y * 0.12) * 14;
          if (p.feather) p.vx += Math.sin(p.y * 0.2) * 8 * dt;
          if (this.invuln <= 0 && Math.hypot(p.x - this.soul.x, p.y - this.soul.y) < p.r + 3.2) {
            this.invuln = 0.9;
            const dmg = Math.max(1, this.enemy.atk + 2 - this.playerDef());
            Game.hp -= dmg;
            this.playerHurtFlash = 0.4;
            AudioSys.hurt();
            this.dmgPops.push({ x: this.soul.x, y: this.soul.y - 10, txt: '-' + dmg, t: 0, col: '#e23a2e' });
            if (Game.hp <= 0) {
              Game.hp = 0;
              this.finish('lose');
              return;
            }
          }
        }
        this.projectiles = this.projectiles.filter(p => p.life > 0 &&
          p.x > BOX.x - 20 && p.x < BOX.x + BOX.w + 20 &&
          p.y > BOX.y - 20 && p.y < BOX.y + BOX.h + 24);
        if (this.patT > this.patDur) {
          this.projectiles = [];
          this.state = 'menu';
          this.t = 0;
          this.flavorIdx = (this.flavorIdx + 1) % this.enemy.def.flavor.length;
          this.boxMsg = this.enemy.def.flavor[this.flavorIdx];
        }
        break;
      }
      case 'win': case 'spared': case 'flee':
        if (this.t > 1.6) Game.exitBattle(this.result, this.dropItem);
        break;
      case 'lose':
        if (this.t > 2.2) Game.exitBattle(this.result, null);
        break;
    }
  },

  /* -------------------------------------------------------------- input */
  onAction(action) {
    if (this.state === 'intro') return;
    if (action === 'mute') return; // handled globally
    const st = this.state;
    if (st === 'menu') {
      if (action === 'left') { this.menuIndex = (this.menuIndex + 3) % 4; AudioSys.select(); }
      else if (action === 'right') { this.menuIndex = (this.menuIndex + 1) % 4; AudioSys.select(); }
      else if (action === 'confirm') {
        AudioSys.select();
        const id = MENU_BTN[this.menuIndex].id;
        if (id === 'fight') {
          this.state = 'target';
          this.cursorX = BOX.x + 8; this.cursorDir = 1;
          this.t = 0;
        } else if (id === 'act') {
          this.state = 'act'; this.subIndex = 0;
        } else if (id === 'item') {
          if (Inventory.byCat('consumable').length === 0) { this.boxMsg = 'Your pockets hold nothing useful.'; return; }
          this.state = 'item'; this.subIndex = 0;
        } else if (id === 'mercy') {
          this.state = 'mercy'; this.subIndex = 0;
        }
      }
      return;
    }
    if (st === 'target') {
      if (action === 'confirm') { AudioSys.swing(); this.doFightHit(); }
      else if (action === 'pause') { this.state = 'menu'; AudioSys.back(); }
      return;
    }
    if (st === 'act') {
      const acts = [{ id: 'check', text: 'Check' }].concat(this.enemy.def.acts);
      if (action === 'up') { this.subIndex = (this.subIndex + acts.length - 1) % acts.length; AudioSys.select(); }
      else if (action === 'down') { this.subIndex = (this.subIndex + 1) % acts.length; AudioSys.select(); }
      else if (action === 'confirm') {
        const a = acts[this.subIndex];
        if (a.id === 'check') { this.state = 'resolve'; this.boxMsg = this.enemy.def.check; AudioSys.examine(); }
        else this.applyAct(a);
        this.t = 0;
      } else if (action === 'pause') { this.state = 'menu'; AudioSys.back(); }
      return;
    }
    if (st === 'item') {
      const list = Inventory.byCat('consumable');
      if (action === 'up') { this.subIndex = (this.subIndex + list.length - 1) % list.length; AudioSys.select(); }
      else if (action === 'down') { this.subIndex = (this.subIndex + 1) % list.length; AudioSys.select(); }
      else if (action === 'confirm') {
        const it = list[this.subIndex];
        if (it) this.useItemBattle(it.id);
        this.t = 0;
      } else if (action === 'pause') { this.state = 'menu'; AudioSys.back(); }
      return;
    }
    if (st === 'mercy') {
      const opts = ['Spare', 'Flee'];
      if (action === 'up') { this.subIndex = (this.subIndex + 1) % 2; AudioSys.select(); }
      else if (action === 'down') { this.subIndex = (this.subIndex + 1) % 2; AudioSys.select(); }
      else if (action === 'confirm') {
        if (this.subIndex === 0) this.trySpare();
        else this.tryFlee();
        this.t = 0;
      } else if (action === 'pause') { this.state = 'menu'; AudioSys.back(); }
      return;
    }
    if (st === 'enemyline' || st === 'resolve') {
      if (action === 'confirm') { /* let timing run so the intent is readable */ }
    }
  },

  /* --------------------------------------------------------------- draw */
  draw(ctx, gt) {
    const e = this.enemy;
    if (!e) return;
    // background: dark arena with silhouetted leaves
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#101722');
    g.addColorStop(0.7, '#0a0e16');
    g.addColorStop(1, '#070a10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    // drifting dark leaves at the edges
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 10; i++) {
      const lx = i < 5 ? 4 + i * 9 : VW - 44 + (i - 5) * 9;
      const sway = Math.sin(gt * 0.8 + i * 1.7) * 3;
      ctx.fillStyle = '#16241c';
      ctx.beginPath();
      ctx.ellipse(lx + sway, 30 + (i % 5) * 34, 16, 7, (i % 2 ? 0.5 : -0.5), 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // vignette
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, 60, VW / 2, VH / 2, 200);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VW, VH);

    let ox = 0, oy = 0;
    if (this.shake > 0) { ox = Math.round(Math.sin(gt * 60) * 2 * this.shake); oy = Math.round(Math.cos(gt * 55) * 1.4 * this.shake); }

    // enemy sprite
    const spr = SPR[e.spr];
    if (spr) {
      const bob = Math.sin(gt * 2.1 + e.swayT) * 1.6;
      const ex = Math.round(VW / 2 - spr.width / 2 + ox);
      const ey = Math.round(58 - spr.height + bob + oy);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(VW / 2 - 18, 62, 36, 3);
      if (e.hurtT > 0 && Math.floor(gt * 30) % 2 === 0) {
        ctx.globalAlpha = 0.35;   // hit flicker
        ctx.drawImage(spr, ex, ey);
        ctx.globalAlpha = 1;
      } else {
        ctx.drawImage(spr, ex, ey);
      }
    }
    // enemy hp bar (above box) + name; yellow when spareable
    const nx = Math.round(VW / 2 - 60);
    ctx.fillStyle = '#0b141c'; ctx.fillRect(nx - 2, 74, 124, 10);
    ctx.fillStyle = '#17252f'; ctx.fillRect(nx - 1, 75, 122, 8);
    const nameCol = e.spareable ? '#e8cf6a' : '#eae3d2';
    drawText(ctx, e.name, nx + 2, 77, nameCol);
    const hpw = 44;
    ctx.fillStyle = '#3a2226';
    ctx.fillRect(nx + 74, 78, hpw, 4);
    ctx.fillStyle = e.spareable ? '#e8cf6a' : '#c4543f';
    ctx.fillRect(nx + 74, 78, Math.max(0, Math.round(hpw * e.hp / e.maxhp)), 4);

    // battle box
    const bx = BOX.x + ox, by = BOX.y + oy;
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 2, by - 2, BOX.w + 4, BOX.h + 4);
    ctx.fillStyle = '#e8ecef';
    ctx.fillRect(bx - 2, by - 2, BOX.w + 4, 2);
    ctx.fillRect(bx - 2, by + BOX.h, BOX.w + 4, 2);
    ctx.fillRect(bx - 2, by, 2, BOX.h);
    ctx.fillRect(bx + BOX.w, by, 2, BOX.h);

    // box content by state
    if (this.state === 'menu' || this.state === 'resolve' || this.state === 'enemyline' || this.state === 'intro' ||
        this.state === 'win' || this.state === 'spared' || this.state === 'flee' || this.state === 'lose') {
      const lines = wrapText(this.boxMsg, 30);
      lines.forEach((l, i) => drawText(ctx, l, bx + 10, by + 10 + i * 11, '#e8ecef'));
      if (this.state === 'intro' && this.t < 0.9) {
        ctx.fillStyle = `rgba(255,255,255,${(0.9 - this.t).toFixed(2)})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      if ((this.state === 'win' || this.state === 'spared' || this.state === 'flee' || this.state === 'lose') && Math.floor(gt * 2.5) % 2 === 0) {
        drawText(ctx, '[E]', bx + BOX.w - 22, by + BOX.h - 11, '#e4c97c');
      }
    } else if (this.state === 'target') {
      // timing bar
      ctx.fillStyle = '#233042';
      ctx.fillRect(bx + 8, by + 14, BOX.w - 16, BOX.h - 30);
      ctx.fillStyle = '#e4c97c';
      ctx.fillRect(bx + 8 + Math.round((BOX.w - 16) * 0.44), by + 12, 3, BOX.h - 26);
      ctx.fillRect(bx + 8 + Math.round((BOX.w - 16) * 0.56) - 3, by + 12, 3, BOX.h - 26);
      ctx.fillStyle = '#f4efe4';
      ctx.fillRect(Math.round(this.cursorX) - 1, by + 10, 3, BOX.h - 22);
      drawText(ctx, 'Press E at the center', bx + 8, by + BOX.h - 12, '#8fa3a0');
    } else if (this.state === 'act') {
      const acts = [{ id: 'check', text: 'Check' }].concat(e.def.acts);
      acts.forEach((a, i) => {
        const sel = i === this.subIndex;
        const yy = by + 8 + i * 12;
        if (sel) {
          ctx.drawImage(SPR[Math.floor(gt * 8) % 2 === 0 ? 'soul0' : 'soul1'], bx + 8, yy);
          drawText(ctx, '* ' + a.text, bx + 20, yy + 1, '#ffe9b0');
        } else drawText(ctx, '* ' + a.text, bx + 20, yy + 1, '#c9d4d0');
      });
      drawText(ctx, '[E] choose   [ESC] back', bx + 8, by + BOX.h - 11, '#6f8585');
    } else if (this.state === 'item') {
      const list = Inventory.byCat('consumable');
      list.forEach((it, i) => {
        const sel = i === this.subIndex;
        const d = ITEMS[it.id];
        const yy = by + 8 + i * 12;
        if (i === this.subIndex) {
          ctx.drawImage(SPR[Math.floor(gt * 8) % 2 === 0 ? 'soul0' : 'soul1'], bx + 8, yy);
          drawText(ctx, d.name + ' x' + it.n, bx + 20, yy + 1, '#ffe9b0');
        } else drawText(ctx, d.name + ' x' + it.n, bx + 20, yy + 1, '#c9d4d0');
      });
      drawText(ctx, '[E] use      [ESC] back', bx + 8, by + BOX.h - 11, '#6f8585');
    } else if (this.state === 'mercy') {
      ['Spare', 'Flee'].forEach((m, i) => {
        const sel = i === this.subIndex;
        const yy = by + 10 + i * 13;
        if (sel) {
          ctx.drawImage(SPR[Math.floor(gt * 8) % 2 === 0 ? 'soul0' : 'soul1'], bx + 8, yy);
          drawText(ctx, '* ' + m, bx + 20, yy + 1, '#ffe9b0');
        } else drawText(ctx, '* ' + m, bx + 20, yy + 1, '#c9d4d0');
      });
      drawText(ctx, '[E] choose   [ESC] back', bx + 8, by + BOX.h - 11, '#6f8585');
    } else if (this.state === 'dodge') {
      for (const p of this.projectiles) {
        ctx.fillStyle = p.col;
        if (p.dart) ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 1, 7, 2);
        else if (p.thorn) { ctx.fillRect(Math.round(p.x), Math.round(p.y) - 3, 2, 7); ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y), 6, 1); }
        else if (p.feather) { ctx.fillRect(Math.round(p.x), Math.round(p.y) - 2, 2, 5); ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 4, 1); }
        else { ctx.fillRect(Math.round(p.x) - p.r, Math.round(p.y) - p.r, p.r * 2, p.r * 2); ctx.fillStyle = '#f4a6a0'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2); }
      }
      // the soul (lantern flame) — blinks while invulnerable
      if (!(this.invuln > 0 && Math.floor(gt * 16) % 2 === 0)) {
        ctx.drawImage(SPR[Math.floor(gt * 10) % 2 === 0 ? 'soul0' : 'soul1'], Math.round(this.soul.x) - 4, Math.round(this.soul.y) - 4);
      }
    }

    // player status row under the box
    const py = 178;
    drawText(ctx, 'SAILOR', bx + 4, py + 2, '#eae3d2');
    drawText(ctx, 'HP', bx + 52, py + 2, '#8fa3a0');
    const hpMax = 50, hpX = bx + 66;
    ctx.fillStyle = '#4a1d20'; ctx.fillRect(hpX, py + 2, hpMax, 8);
    ctx.fillStyle = '#e8cf6a'; ctx.fillRect(hpX, py + 2, Math.round(hpMax * clamp(Game.hp / Game.maxhp, 0, 1)), 8);
    drawText(ctx, String(Math.max(0, Game.hp)) + ' / ' + Game.maxhp, hpX + hpMax + 8, py + 2, '#eae3d2');

    // menu buttons row
    if (this.state !== 'dodge') {
      MENU_BTN.forEach((b, i) => {
        const sel = i === this.menuIndex;
        const bw = 76, gap = 6;
        const bxx = Math.round((VW - (bw * 4 + gap * 3)) / 2) + i * (bw + gap);
        const byy = 196;
        drawPanel(ctx, bxx, byy, bw, 16, sel ? 1 : 0.72);
        const col = sel ? (b.id === 'mercy' && this.enemy.spareable ? '#e8cf6a' : '#ffe9b0') : '#93a9a8';
        drawText(ctx, b.label, bxx + Math.round((bw - textWidth(b.label)) / 2), byy + 5, col);
        if (sel) {
          ctx.drawImage(SPR[Math.floor(gt * 8) % 2 === 0 ? 'soul0' : 'soul1'], bxx + 4, byy + 4);
        }
      });
    } else {
      drawText(ctx, 'MOVE WITH ARROWS / WASD', 30 + Math.round((VW - 60 - textWidth('MOVE WITH ARROWS / WASD')) / 2), 200, '#6f8585');
    }

    // damage pops
    for (const p of this.dmgPops) {
      const a = clamp(1.1 - p.t, 0, 1);
      ctx.globalAlpha = a;
      drawText(ctx, p.txt, Math.round(p.x - textWidth(p.txt) / 2), Math.round(p.y - p.t * 14), p.col, 1, '#0b141c');
      ctx.globalAlpha = 1;
    }

    if (this.playerHurtFlash > 0) {
      ctx.fillStyle = `rgba(200,40,40,${(this.playerHurtFlash * 0.35).toFixed(2)})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }
};
