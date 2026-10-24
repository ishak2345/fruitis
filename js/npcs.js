/* ============================================================================
   js/npcs.js — NPC definitions + dialogue scripts (all story-flag aware).
   Every script re-derives from Game.flags so a restored save shows the same
   conversations. The Vax encounter is the spine of Chapter One.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------- helpers */
function mkNpc(o) {
  return Object.assign({
    id: 'npc', name: '???', spr: 'nad_down', x: 0, y: 0, dir: 'down',
    solid: true, idleT: Math.random() * 3, talking: false,
    face(tx, ty) {
      const dx = tx - this.x, dy = ty - this.y;
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
      else this.dir = dy > 0 ? 'down' : 'up';
    },
    update(dt) {
      this.idleT += dt;
      const d = mdist(Player.x, Player.y, this.x, this.y);
      if (!this.talking && d < 90 && d > 10) this.face(Player.x, Player.y);
    },
    spriteFrame(gt) {
      const base = this.spr;
      const facing = this.dir === 'left' ? 'right' : this.dir;
      let key = base + '_' + facing;
      if (this.talking && SPR[base + '_' + facing + '_talk']) key = base + '_' + facing + '_talk';
      if (!SPR[key]) key = base + '_down';
      if (!SPR[key]) key = base;
      return SPR[key];
    }
  }, o);
}

const NpcDefs = {
  /* ================================================================ VAX */
  vax() {
    return mkNpc({
      id: 'vax', name: 'Vax', spr: 'v', x: 272, y: 290, dir: 'down',
      vax: true, // uses the dedicated idle cycle
      update(dt) {
        this.idleT += dt;
        const d = mdist(Player.x, Player.y, this.x, this.y);
        if (!this.talking && d < 110 && d > 8) this.face(Player.x, Player.y);
        else if (!this.talking && this.idleT > 8) this.dir = 'down';
      },
      script() {
        if (!Game.flags.metVax) return vaxFirstTalk();
        return vaxAgainTalk();
      }
    });
  },

  /* ========================================================== ALI SAMA */
  ali() {
    return mkNpc({
      id: 'ali', name: 'Ali Sama', spr: 'ali', x: 108, y: 78, dir: 'down',
      script() {
        const f = Game.flags;
        if (!f.metAli) return aliFirstTalk();
        return aliAgainTalk();
      }
    });
  },

  /* =========================================================== MAJHOOL */
  majhool() {
    return mkNpc({
      id: 'majhool', name: 'Majhool', spr: 'maj', x: 586, y: 200, dir: 'down',
      script() {
        const f = Game.flags;
        if (!f.metMajhool) return majhoolFirstTalk();
        if (!f.gotToken && f.metAli && f.metLevi) return majhoolGiveToken();
        return majhoolAgainTalk();
      }
    });
  },

  /* ============================================================== LEVI */
  levi() {
    return mkNpc({
      id: 'levi', name: 'Levi', spr: 'levi', x: 332, y: 318, dir: 'down',
      solid: true,
      script() {
        const f = Game.flags;
        if (!f.metLevi) return leviFirstTalk();
        return leviAgainTalk();
      }
    });
  },

  /* ============================================================= NADIA */
  nadia() {
    return mkNpc({
      id: 'nadia', name: 'Nadia', spr: 'nad', x: 300, y: 404, dir: 'down',
      script() {
        const lines = [
          [L('Nadia', 'Lovely harvest this year. Same as last year. And the year before that. And before that.'),
           L('Nadia', 'The garden died in perfect rows, see. Very tidy. The tidy part is what matters.')],
          [L('Nadia', 'You\u2019re the sailor everyone isn\u2019t talking about. Word travels quietly here. It has learned to.'),
           L('Sailor', 'What does it say?'),
           L('Nadia', 'That the sea spat you out because it didn\u2019t like the taste. Don\u2019t take it personally. It said the same about Vax.')]
        ];
        return lines[Math.floor(Game.time / 17) % lines.length];
      }
    });
  },

  /* ============================================================== RUTA */
  ruta() {
    return mkNpc({
      id: 'ruta', name: 'Ruta', spr: 'ruta', x: 240, y: 126, dir: 'down',
      script() {
        const pool = [
          [L('Ruta', 'The reef\u2019s wrong. Fish come back with numbers on them. Little numbers, like a ledger.'),
           L('Sailor', 'Numbers?'),
           L('Ruta', 'Serial numbers. Someone out there is counting. I don\u2019t want to meet the clerk.')],
          [L('Ruta', 'Forty years I fished the south shallows. Then one morning the shallows were the north shallows.'),
           L('Ruta', 'Same water. Different direction. The island does that sometimes, and we all pretend it doesn\u2019t.')]
        ];
        return pool[Math.floor(Game.time / 23) % pool.length];
      }
    });
  }
};

/* ====================================================== VAX'S SCRIPTS === */
function vaxOptions() {
  const all = [
    {
      key: 'authority',
      text: 'Why don\u2019t you have any authority?',
      nodes: [
        L('Vax', 'Because authority isn\u2019t a hat. You can\u2019t just put one on and expect people to duck.'),
        L('Vax', 'There was a leader before me. She made the rules. I make the announcements.'),
        L('Sailor', 'So who actually runs things?'),
        L('Vax', 'Wonderful question. I would love to have an answer before it becomes urgent.')
      ]
    },
    {
      key: 'danger',
      text: 'What danger are you talking about?',
      nodes: [
        L('Vax', 'Something\u2019s been taking fruit off the north trees. Not eating it. Taking it, in neat little rows.'),
        L('Vax', 'Two of my fishermen won\u2019t take their boats past the reef anymore. They won\u2019t say why. They just won\u2019t.'),
        L('Sailor', 'And the circles I saw drawn in the sand?'),
        L('Vax', '...You saw those.'),
        L('Vax', 'Then you understand why I\u2019d rather we talked about shipwrecks.')
      ]
    },
    {
      key: 'forge',
      text: 'I need to find The Forge.',
      nodes: [
        L('Vax', 'The Forge.'),
        L('Vax', 'It shows up in stories about as often as it shows up in the water.'),
        L('Sailor', 'I\u2019ve been looking for it for a long time.'),
        L('Vax', 'Then I hope for your sake that it\u2019s real.'),
        L('Vax', 'And a little part of me hopes it isn\u2019t.')
      ]
    },
    {
      key: 'scarf',
      text: 'Your eye. And the scarf.',
      nodes: [
        L('Vax', 'The eye\u2019s a birthmark. The scarf\u2019s a choice. One of the few I remember making.'),
        L('Vax', 'The island gave me the eye, if you want the honest version. I looked at something I shouldn\u2019t have, and it looked back.'),
        L('Sailor', 'Looked at what?'),
        L('Vax', 'Now that \u2014 that is the one subject on this island that is genuinely, professionally closed.')
      ]
    },
    {
      key: null, ends: true,
      text: 'I\u2019ll head to the village.',
      nodes: [
        L('Vax', 'Good. Follow the east path through the trees, keep to the trail, and don\u2019t dawdle where the canopy leans in.'),
        L('Vax', 'Tell Ali Sama I sent you. She\u2019ll feed you, and then she\u2019ll pretend not to answer exactly one question. Let her.'),
        L('Sailor', 'Thank you, Vax.'),
        L('Vax', 'Don\u2019t thank me. I\u2019m just the leader.')
      ]
    }
  ];
  return all.filter(o => !o.key || !Game.asked[o.key]);
}

function vaxFirstTalk() {
  const opts = vaxOptions();
  return [
    L('Vax', 'Well. You\u2019re either very unlucky, or this island has started collecting shipwrecks again.'),
    L('Sailor', 'Where... where am I?'),
    L('Vax', 'Fruits Island. I\u2019m Vax. I\u2019m the leader here.'),
    L('Sailor', 'You don\u2019t sound particularly proud of that.'),
    L('Vax', 'It\u2019s a title. The island doesn\u2019t always listen.'),
    L('Vax', 'You came in on the south beach. Your ship did a fair impression of a firework, by the look of it.'),
    L('Vax', 'And you were looking for The Forge, weren\u2019t you? Sailors with that particular face are always looking for The Forge.'),
    L('Sailor', 'How did you know that?'),
    L('Vax', 'Because nobody sails out this far for the fruit.'),
    L('Vax', 'The Forge is a long way from here. Whatever carried you off course carried you a very long way.'),
    L('Sailor', 'Carried me?'),
    L('Vax', 'Storms don\u2019t usually steer.', { cue: 'warn' }),
    L('Vax', '...Anyway. You should know something before you settle in.'),
    L('Vax', 'There\u2019s something on this island that we ought to be worrying about a lot more than shipwrecks.'),
    L('Sailor', 'What is it?'),
    L('Vax', 'That\u2019s the problem. I don\u2019t know enough to tell you.'),
    L('Vax', 'And the people who do know aren\u2019t talking. They smile at me, they pour me tea, and they change the subject.'),
    L('Vax', 'I\u2019m the leader. Everyone agrees on that. Nobody listens.'),
    L('Vax', 'So: stay off the north path after the light goes. Don\u2019t go past the dead trees. And if the island ever starts... humming...'),
    L('Vax', '...come and find me. I\u2019ll be standing somewhere important, looking like I know what to do.'),
    L('Sailor', 'That\u2019s not very reassuring.'),
    L('Vax', 'No. It isn\u2019t. But it\u2019s honest, and I don\u2019t get to be both very often.'),
    L('Vax', 'There\u2019s a village east of here. Bouga Bouga. Folk are decent, in the way folk are decent when they\u2019re all hiding the same thing.'),
    L('Vax', 'Take this \u2014 a piece of a map I started drawing when I still believed in maps.'),
    GIVE('map'),
    FLAG('metVax'),
    OBJ('village', 'Follow the east trail to Bouga Bouga Village'),
    L('Vax', 'Ask me something first, if you like. I\u2019ll be honest. It\u2019s my one trick.')
  ].concat(opts.length > 1 ? [{ type: 'choice', options: opts, repeat: true }] : []);
}

function vaxAgainTalk() {
  const stage = Game.flags.vaxStage || 1;
  const pool = [
    [
      L('Vax', 'Still here. Still not drowned. I\u2019ll take the good news where I find it.'),
      L('Vax', 'The east path\u2019s the safe one. Well. The safe-ish one. Nothing on this island is more than safe-ish.')
    ],
    [
      L('Vax', 'The village treating you well? Ali Sama\u2019s tea is the only thing on this island I\u2019d trust with my eyes closed.'),
      L('Vax', 'Which is convenient, because one of mine doesn\u2019t close.')
    ],
    [
      L('Vax', 'If you found anything strange up north: don\u2019t touch it, don\u2019t pick it up, and don\u2019t bring it to me.'),
      L('Sailor', 'That\u2019s very specific.'),
      L('Vax', 'It\u2019s a policy. Policies are what leaders have instead of courage.')
    ]
  ];
  const pick = pool[Math.min(pool.length - 1, stage - 1)] || pool[0];
  const opts = vaxOptions();
  return pick.concat(opts.length > 1 ? [{ type: 'choice', options: opts, repeat: true }] : []);
}

/* ==================================================== ALI SAMA'S SCRIPTS */
function aliOptions() {
  const all = [
    {
      key: 'song',
      text: 'What\u2019s that hum under the floor?',
      nodes: [
        L('Ali Sama', 'Old houses talk. This one hums. You get used to it... you don\u2019t, actually. But you learn to serve tea over it.'),
        L('Sailor', 'It sounds almost like singing.'),
        L('Ali Sama', 'Does it? Hm. Singing needs two voices, surely. One to sing and one to remember.'),
        L('Ali Sama', '...More tea?')
      ]
    },
    {
      key: 'vax',
      text: 'Tell me about Vax.',
      nodes: [
        L('Ali Sama', 'That boy announced himself leader the day the old one walked into the trees and didn\u2019t walk back out.'),
        L('Ali Sama', 'Nobody argued. Arguing felt like cruelty, and somebody had to be to blame for the announcements.'),
        L('Ali Sama', 'He\u2019s better at it than he thinks. Worse at it than he hopes. That\u2019s a leader, more or less.')
      ]
    },
    {
      key: 'fruits',
      text: 'What are the Fruits, really?',
      nodes: [
        L('Ali Sama', 'Fruit\u2019s fruit, sweetheart. Sweet when the year is kind, sour when it isn\u2019t.'),
        L('Ali Sama', '(She says it lightly. Her hands stop wiping the counter for exactly one second.)'),
        L('Ali Sama', 'The shrine folk know the old stories. I just pour the tea.')
      ]
    },
    {
      key: null, ends: true,
      text: 'Just the tea, thanks.',
      nodes: [
        L('Ali Sama', 'Refills are free. Questions are too \u2014 answers, those cost, and I\u2019m all out of stock.')
      ]
    }
  ];
  return all.filter(o => !o.key || !Game.asked[o.key]);
}

function aliFirstTalk() {
  const opts = aliOptions();
  return [
    FLAG('metAli'),
    L('Ali Sama', 'Well now. Wet boots, salt in the eyebrows, and that specific far-away squint. Shipwrecked, are we?'),
    L('Sailor', 'Is it that obvious?'),
    L('Ali Sama', 'Sweetheart, you\u2019re dripping on my floor in a very dignified way. It\u2019s practically a signature.'),
    L('Ali Sama', 'Sit. That table wobbles, but it wobbles honestly, which is more than I can say for most things here.'),
    L('Ali Sama', 'Torchlight Tea. On the house \u2014 first cup\u2019s for the shipwrecked, house rules.'),
    GIVE('tea'),
    L('Ali Sama', 'Vax sent word ahead of you, in the way he sends word, which is shouting at a bird until it agrees.'),
    L('Ali Sama', 'So. Ask your questions, sailor. I\u2019ll answer the easy ones beautifully.')
  ].concat(opts.length > 1 ? [{ type: 'choice', options: opts, repeat: true }] : []);
}

function aliAgainTalk() {
  const opts = aliOptions();
  const pool = [
    [L('Ali Sama', 'Back again? Good. The stove missed having something to do.')],
    [L('Ali Sama', 'Careful on the trail after dark. The dark there has... texture.')],
    [L('Ali Sama', 'You\u2019ve got the look of someone collecting answers. Slow work, isn\u2019t it? The island buries them deep.')]
  ];
  return pool[Math.floor(Game.time / 31) % pool.length].concat(
    opts.length > 1 ? [{ type: 'choice', options: opts, repeat: true }] : []);
}

/* ================================================== MAJHOOL'S SCRIPTS === */
function majhoolFirstTalk() {
  return [
    FLAG('metMajhool'),
    L('Majhool', 'You step loudly for a man the island has not decided about.'),
    L('Sailor', 'Sorry?'),
    L('Majhool', 'No, no. Loud is good. Loud has edges. It is the quiet ones who fade.'),
    L('Majhool', 'This is the Old Fruit Shrine. Seven niches. Seven fruits. Seven keepers, once, when Fructasia had a name it answered to.'),
    L('Sailor', 'Fructasia?'),
    L('Majhool', 'The island\u2019s true name. It does not use it anymore. Names are for things that end, and the island has not ended. Yet.'),
    L('Sailor', 'What happened to the six?'),
    L('Majhool', 'The Great Deletion took them. That is not its name either \u2014 but a thing with no name is a thing you cannot point at, so we point at the hole.'),
    L('Majhool', 'Whole orchards, whole families, whole winters \u2014 removed. The island healed over the gap the way skin heals over a splinter.'),
    L('Majhool', 'And the splinter, sailor, is still in there.'),
    L('Sailor', 'How do you know all this?'),
    L('Majhool', 'I kept the accounts. Before the Deletion, I wrote everything down. After it, I wrote everything down again, in case it happened twice.'),
    L('Majhool', 'Go on. Meet the village. The well-child, the tea-woman. Let them see you. Then come back, and we will see what the shrine thinks of you.')
  ];
}

function majhoolGiveToken() {
  return [
    L('Majhool', 'Back. And louder than before. The island has started deciding about you, I think.'),
    L('Majhool', 'The shrine has been warm all morning. It only does that when it is paying attention.'),
    L('Majhool', 'Take what sits in the fourth niche. It has been sitting there since before I had this many wrinkles, and it has never once been warm.'),
    FN(() => { Game.flags.shrineWarm = true; }),
    L('Sailor', 'What is it?'),
    L('Majhool', 'A token of the fourth fruit \u2014 the Songfruit, the keepers called it, though its song has been... paused.'),
    GIVE('token'),
    FLAG('gotToken'),
    L('Majhool', 'Take it to the mountain, when the mountain asks. Not before. Mountains are formal.'),
    L('Sailor', 'And if it never asks?'),
    L('Majhool', 'Then you will have the only warm thing on this island in your pocket, and that will be its own kind of answer.'),
    FN(() => {
      Game.setObjective('chapter1end', 'Rest at the village lantern');
      Game.flags.chapterOneEnd = true;
    })
  ];
}

function majhoolAgainTalk() {
  const pool = [
    [L('Majhool', 'The well-child remembers things that never happened. Or things that happened somewhere else. On this island, that distinction is... decorative.')],
    [L('Majhool', 'Do not fear the Deletion, sailor. Fear the editing. Someone, somewhere, is still tidying.')],
    [L('Majhool', 'I have written nine hundred and six pages about this island. Eight hundred are about the weather. The weather is the only thing that behaves.')]
  ];
  return pool[Math.floor(Game.time / 19) % pool.length];
}

/* ====================================================== LEVI'S SCRIPTS == */
function leviFirstTalk() {
  return [
    FLAG('metLevi'),
    L('Levi', 'You\u2019re the sailor! The wet one. You drowned.'),
    L('Sailor', 'I\u2019m fairly sure I didn\u2019t.'),
    L('Levi', 'Not here. Not yet. In my dream you had a red scarf, like the other one. No \u2014 the other one had the red scarf. You had the water.'),
    L('Sailor', 'The other one?'),
    L('Levi', 'He wasn\u2019t scared of the water. He was scared of the sand. That\u2019s why he wears the scarf, in my dream. Sand can\u2019t get in.'),
    L('Sailor', '...Where do you get these dreams, kid?'),
    L('Levi', 'They come up the well. Everything here comes up the well, if you\u2019re patient.'),
    L('Levi', 'I\u2019m very patient. I\u2019m the most patient person in the whole village. Nobody remembers me being born, you know.'),
    L('Sailor', 'Nobody?'),
    L('Levi', 'Nobody remembers anybody being born. That\u2019s the game.')
  ];
}

function leviAgainTalk() {
  const pool = [
    [L('Levi', 'The well knocked back yesterday. Twice. I think it\u2019s learning to be polite.')],
    [L('Levi', 'When you go up the mountain, wave at the snow for me. The snow remembers waving.')],
    [L('Levi', 'Vax\u2019s eye is red like the inside of the well at night. He doesn\u2019t know I know. He doesn\u2019t know lots of things he knows.')]
  ];
  return pool[Math.floor(Game.time / 21) % pool.length];
}
