/* ============================================================================
   js/dialogue.js — dialogue engine
   Node types:
     { type:'line',  who, text, cue?, think? }   cue 'warn' plays the omen
     { type:'choice', options:[{ text, key?, ends?, nodes:[...] }] }
     { type:'func',  fn }                        run code, continue
     { type:'give',  id, silent? }               grant item (toast + jingle)
     { type:'flag',  key, value? }               set story flag
     { type:'obj',   id, text }                  set objective
   Lines wrap to the box width; typewriter at ~46 chars/sec; first press
   completes a line, second advances — a line can never be skipped past.
   ========================================================================== */
'use strict';

const SPEAKERS = {
  'Sailor':    { color: '#f0cf8a', portrait: 'por_sailor' },
  'Vax':       { color: '#e88a80', portrait: 'por_vax' },
  'Ali Sama':  { color: '#9fd8a8', portrait: 'por_ali' },
  'Majhool':   { color: '#b9a6e0', portrait: 'por_majhool' },
  'Levi':      { color: '#f2dd8a', portrait: 'por_levi' },
  'Ruta':      { color: '#a9bfc9' },
  'Nadia':     { color: '#d8b9c9' },
  '???':       { color: '#8f8f9f' },
  'Island':    { color: '#a884c9' }
};

const Dialogue = {
  active: false,
  queue: [],
  node: null,
  lines: [],
  chars: 0,
  total: 0,
  t: 0,
  typing: false,
  done: false,
  choiceOpen: false,
  choiceIndex: 0,
  choiceNode: null,
  onEnd: null,
  boxAlpha: 0,

  reset() {
    this.active = false; this.queue = []; this.node = null; this.lines = [];
    this.chars = 0; this.total = 0; this.t = 0; this.typing = false; this.done = false;
    this.choiceOpen = false; this.choiceIndex = 0; this.choiceNode = null;
    this.onEnd = null; this.boxAlpha = 0;
  },

  start(nodes, onEnd) {
    this.reset();
    this.active = true;
    this.queue = nodes.slice();
    this.onEnd = onEnd || null;
    this.next();
  },

  say(who, text, opts) {
    opts = opts || {};
    return { type: 'line', who, text, cue: opts.cue, think: opts.think };
  },

  next() {
    while (true) {
      if (this.queue.length === 0) { this.end(); return; }
      const node = this.queue.shift();
      if (node.type === 'line') {
        this.node = node;
        this.lines = wrapText(node.text, 44);
        this.total = this.lines.join('').length;
        this.chars = 0; this.t = 0;
        this.typing = true; this.done = false; this.choiceOpen = false;
        if (node.cue === 'warn') AudioSys.warn();
        else if (node.cue === 'moan') AudioSys.moan();
        else AudioSys.talk();
        return;
      } else if (node.type === 'choice') {
        const opts = node.options.filter(o => !o._taken && !(o.key && Game.asked[o.key]));
        if (opts.length === 0) continue;
        node.options = opts;
        this.choiceNode = node;
        this.choiceIndex = 0;
        this.choiceOpen = true;
        this.typing = false;
        AudioSys.select();
        return;
      } else if (node.type === 'func') {
        try { node.fn(); } catch (e) { /* scripts must never break the flow */ }
        continue;
      } else if (node.type === 'give') {
        const d = ITEMS[node.id];
        if (d) {
          Inventory.add(node.id, node.n || 1);
          if (!node.silent) {
            Game.showToast('Got ' + d.name + '!');
            AudioSys.itemGet();
          }
        }
        continue;
      } else if (node.type === 'flag') {
        Game.flags[node.key] = (node.value === undefined ? true : node.value);
        continue;
      } else if (node.type === 'obj') {
        Game.setObjective(node.id, node.text);
        continue;
      }
    }
  },

  advance() {
    if (!this.active) return;
    if (this.choiceOpen) { this.pick(); return; }
    if (this.typing) {
      this.chars = this.total;
      this.typing = false;
      this.done = true;
      AudioSys.advance();
      return;
    }
    AudioSys.advance();
    this.next();
  },

  moveChoice(delta) {
    if (!this.choiceOpen || !this.choiceNode) return;
    const n = this.choiceNode.options.length;
    this.choiceIndex = (this.choiceIndex + delta + n) % n;
    AudioSys.select();
  },

  pick() {
    const node = this.choiceNode;
    if (!node) return;
    const opt = node.options[this.choiceIndex];
    if (!opt) return;
    AudioSys.advance();
    this.choiceOpen = false;
    if (opt.key) Game.asked[opt.key] = true;
    if (opt.once) opt._taken = true;
    const rest = node.options.filter(o => !o._taken && !(o.key && Game.asked[o.key]));
    const follow = [];
    if (opt.nodes) follow.push(...opt.nodes);
    // keep offering remaining questions unless this option ends the talk
    if (node.repeat && !opt.ends && rest.length > 1) {
      follow.push({ type: 'choice', options: rest, repeat: true });
    } else if (node.repeat && !opt.ends && rest.length === 1 && rest[0].ends) {
      follow.push({ type: 'choice', options: rest, repeat: true });
    }
    this.queue = follow.concat(this.queue);
    this.next();
  },

  end() {
    this.active = false;
    this.node = null;
    this.choiceOpen = false;
    const cb = this.onEnd;
    this.onEnd = null;
    if (cb) cb();
  },

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.boxAlpha = Math.min(1, this.boxAlpha + dt * 6);
    if (this.typing) {
      const cps = 46;
      const prev = Math.floor(this.chars);
      this.chars = Math.min(this.total, this.chars + cps * dt);
      if (Math.floor(this.chars) > prev && Math.floor(this.chars) % 2 === 0) AudioSys.type();
      if (this.chars >= this.total) { this.typing = false; this.done = true; }
    }
  },

  visibleLines() {
    const all = this.lines;
    let remaining = Math.floor(this.chars);
    const out = [];
    for (const ln of all) {
      if (remaining <= 0) break;
      out.push(ln.slice(0, remaining));
      remaining -= ln.length;
    }
    return out;
  }
};

/* helpers used by npc scripts */
function L(who, text, opts) { return Dialogue.say(who, text, opts); }
function FN(fn) { return { type: 'func', fn }; }
function GIVE(id, opts) { return Object.assign({ type: 'give', id }, opts || {}); }
function FLAG(key, value) { return { type: 'flag', key, value }; }
function OBJ(id, text) { return { type: 'obj', id, text }; }
