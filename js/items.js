/* ============================================================================
   js/items.js — item database + Inventory runtime
   Categories: consumable / key / equip. Item descriptions follow storyline
   rule #8: one concrete sensory detail + one subtle wrongness.
   The inventory is plain data ({id, n} entries) so it saves/restores and
   crosses area + battle boundaries by value, never by reference.
   ========================================================================== */
'use strict';

const ITEMS = {
  /* ------------------------------------------------------- consumables */
  jerky: {
    id: 'jerky', name: 'Salty Jerky', cat: 'consumable', icon: 'it_jerky', heal: 8,
    desc: 'Dried meat from the ship\u2019s stores, chewy as an old bootlace. The salt stings your cracked lips \u2014 it tastes faintly of the storm.'
  },
  fruit: {
    id: 'fruit', name: 'Island Fruit', cat: 'consumable', icon: 'it_fruit', heal: 12,
    desc: 'Heavy, warm, impossibly ripe; the smell reaches you before your hand does. It tastes like a memory of sweetness \u2014 secondhand, borrowed, someone else\u2019s.'
  },
  coconut: {
    id: 'coconut', name: 'Coconut Milk', cat: 'consumable', icon: 'it_coconut', heal: 16,
    desc: 'Cool and clean, with a rattle way down inside the shell that you decide not to think about.'
  },
  tea: {
    id: 'tea', name: 'Torchlight Tea', cat: 'consumable', icon: 'it_tea', heal: 99,
    desc: 'Ali Sama\u2019s own brew \u2014 smoke, honey, and something that glows very softly at the bottom of the cup. One sip and your head is entirely your own again.'
  },
  bandage: {
    id: 'bandage', name: 'Old Bandage', cat: 'consumable', icon: 'it_bandage', heal: 5,
    desc: 'From the ship\u2019s first-aid kit. The box said STERILE. The box is being optimistic.'
  },
  /* ------------------------------------------------------------- key items */
  compass: {
    id: 'compass', name: 'Cracked Compass', cat: 'key', icon: 'it_compass',
    desc: 'Your father\u2019s compass, cracked in the wreck. The needle still turns \u2014 it just prefers north-west now, insistently, like it knows something about the island you don\u2019t.'
  },
  bell: {
    id: 'bell', name: 'Ship\u2019s Bell', cat: 'equip', icon: 'it_bell', slot: 'charm', def: 1,
    desc: 'The old bell off the Marigold\u2019s bow, half-buried and still warm. It rings once when you hold it to your ear \u2014 pointing somewhere behind you, out to sea. Home, maybe. (DEF +1)'
  },
  map: {
    id: 'map', name: 'Map Shard', cat: 'key', icon: 'it_map',
    desc: 'A torn quarter of a hand-drawn map. It shows the beach, the jungle trail, and Bouga Bouga Village \u2014 but the paper continues past the tear, and so does the ink, as if the map knows more than its half.'
  },
  token: {
    id: 'token', name: 'Shrine Token', cat: 'key', icon: 'it_token',
    desc: 'A dull plum-colored token from the shrine\u2019s fourth niche. It is colder than the stone it sat in. Majhool said: "Take it to the mountain, when the mountain asks." The mountain has not asked yet.'
  },
  /* ------------------------------------------------------------ equipment */
  gloves: {
    id: 'gloves', name: 'Worn Gloves', cat: 'equip', icon: 'it_gloves', slot: 'weapon', atk: 1,
    desc: 'Sailor\u2019s gloves, patched at the palms by someone patient. They smell of tar and rope. Your grip feels older and steadier with them on. (ATK +1)'
  }
};

/* ------------------------------------------------------------- Inventory */
const Inventory = {
  slots: [],                 // [{id, n}] ordered
  equip: { weapon: null, charm: null },

  reset() {
    this.slots = [];
    this.equip = { weapon: null, charm: null };
  },
  def(id) { return ITEMS[id]; },
  count(id) {
    const s = this.slots.find(e => e.id === id);
    return s ? s.n : 0;
  },
  has(id) { return this.count(id) > 0; },
  add(id, n) {
    n = n || 1;
    const d = ITEMS[id];
    if (!d) return false;
    if (d.cat !== 'consumable') n = 1; // non-stackable
    const s = this.slots.find(e => e.id === id);
    if (s) s.n += n;
    else this.slots.push({ id, n });
    return true;
  },
  remove(id, n) {
    n = n === undefined ? 1 : n;
    const i = this.slots.findIndex(e => e.id === id);
    if (i < 0) return false;
    this.slots[i].n -= n;
    if (this.slots[i].n <= 0) this.slots.splice(i, 1);
    return true;
  },
  // use a consumable out of battle. `hp/maxhp` come from Player.
  use(id, hp, maxhp) {
    const d = ITEMS[id];
    if (!d || d.cat !== 'consumable') return null;
    let healed = 0;
    if (d.heal) healed = Math.min(d.heal, maxhp - hp);
    this.remove(id, 1);
    return { healed, hpAfter: hp + healed };
  },
  equipItem(id) {
    const d = ITEMS[id];
    if (!d || d.cat !== 'equip' || !d.slot) return false;
    // swap: currently equipped goes back to the bag (kept: 1 copy each)
    const prev = this.equip[d.slot];
    this.equip[d.slot] = id;
    if (prev && prev !== id) {
      if (!this.has(prev)) this.add(prev, 1);
    }
    return true;
  },
  unequip(slot) {
    const id = this.equip[slot];
    if (!id) return false;
    this.equip[slot] = null;
    if (!this.has(id)) this.add(id, 1);
    return true;
  },
  isEquipped(id) { return this.equip.weapon === id || this.equip.charm === id; },
  bonus(kind) {
    let v = 0;
    for (const slot of ['weapon', 'charm']) {
      const id = this.equip[slot];
      if (id && ITEMS[id] && ITEMS[id][kind]) v += ITEMS[id][kind];
    }
    return v;
  },
  atk() { return this.bonus('atk'); },
  def() { return this.bonus('def'); },
  // category-filtered views for the inventory UI
  byCat(cat) { return this.slots.filter(e => ITEMS[e.id] && ITEMS[e.id].cat === cat); },
  serialize() {
    return { slots: this.slots.map(e => ({ id: e.id, n: e.n })), equip: { weapon: this.equip.weapon, charm: this.equip.charm } };
  },
  deserialize(data) {
    this.reset();
    if (!data) return;
    if (data.slots) for (const e of data.slots) if (ITEMS[e.id]) this.add(e.id, e.n || 1);
    if (data.equip) {
      if (ITEMS[data.equip.weapon]) this.equip.weapon = data.equip.weapon;
      if (ITEMS[data.equip.charm]) this.equip.charm = data.equip.charm;
    }
  }
};
