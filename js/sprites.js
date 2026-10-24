/* ============================================================================
   js/sprites.js — palette, sheet factory and ALL character art

   Sprite canon (do not drift):
   - Every character uses a 1px dark outline (PAL.k) and top-left light.
   - SAILOR: 16x20. White sailor cap w/ blue band + gold emblem, dark brown
     hair, red neckerchief, blue peacoat w/ gold buttons, dark green trousers,
     brown boots. 4 directions x 4 walk frames (true stride/pass alternation:
     frames 0/2 are MIRRORED strides, 1/3 are pass poses drawn 1px higher at
     runtime), plus idle breath + blink + a "washed up" lying pose.
   - VAX (locked design): 16x22. Messy dark brown hair (spiky silhouette),
     pale complexion, GREY left eye + bright RED right eye (the red one never
     blinks), thick red scarf with one long end hanging over the chest, black
     long-sleeved jacket over a dark charcoal shirt, baggy light grey
     trousers, red-and-white sneakers (red dominant). Idle = slow weight shift
     + scarf sway + rare hair flick; talk frames bob with an open mouth.
   - Villagers: 16x18-ish, same outline/palette rules, 2-frame idle bob,
     talk variant via mouth pixel.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ PALETTE */
const PAL = {
  k: '#161a2b', // outline (every character, every prop)
  K: '#232a40', // soft outline / deep shade
  w: '#f4efe4', W: '#d9d2c6',           // off-whites
  s: '#f0c290', S: '#c9936a',           // sailor skin
  x: '#ead9c8', X: '#c9ad92',           // vax pale skin
  h: '#4a3226', H: '#33231b',           // dark brown hair (sailor)
  d: '#3a2a1e', D: '#26190f',           // dark brown hair (vax, deeper)
  b: '#2e6f9e', B: '#1f4f78',           // sailor jacket blues
  c: '#cf4b57', C: '#9c3543',           // scarf reds (shared)
  y: '#e8c45a', Y: '#b08f35',           // gold / buttons
  n: '#2f3b4f',                         // charcoal shirt / dark cloth
  g: '#3c5c46', G: '#2a4534',           // sailor trousers green
  j: '#1d2028', J: '#12141a',           // vax jacket black
  v: '#b6bac2', V: '#8b909a',           // vax baggy grey trousers
  R: '#e23a2e',                         // vax red eye / sneaker red
  Q: '#97a8b8',                         // vax grey eye
  z: '#d8362e', Z: '#9c2721',           // sneaker red / dark
  t: '#a8552e', T: '#7a3a20',           // timber browns
  l: '#4f9d5d', L: '#37774a', m: '#79c06e', // leaf greens
  e: '#e9a23b',                         // fruit orange
  r: '#c85a3c',                         // rust
  p: '#7d5ba6', P: '#533a75', q: '#a884c9', // plum (memory / shrine)
  i: '#2b4550', f: '#6fc3b8', u: '#8fd8c3',
  o: '#e08a4c',                         // orange
  A: '#d98f4e',                         // ali sama skin (warm tan)
  a: '#8a2f3d',                         // ali dress wine
  u2: '#3f8f6f'                         // (reserved)
};

/* --------------------------------------------------------- SHEET FACTORY */
// Turns char-row art into a canvas. Rows shorter than the first are padded,
// longer rows are clipped — art can never draw outside its own bounds.
function sheet(rows, pal) {
  pal = pal || PAL;
  const h = rows.length, w = rows[0].length;
  const mk = makeCanvas(w, h);
  mk.c.__rows = rows;   // kept for the dev-time art audit (tools/harness.mjs)
  mk.c.__pal = pal;      // (ditto)
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let q = 0; q < w && q < row.length; q++) {
      const ch = row[q];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      mk.x.fillStyle = col;
      mk.x.fillRect(q, r, 1, 1);
    }
  }
  return mk.c;
}
// replace whole rows of a base sheet (returns new row array)
function mutate(base, changes) {
  const rows = base.slice();
  for (const k in changes) rows[+k] = changes[+k];
  return rows;
}
// shift a horizontal band of rows by dx columns (used for weight-shift idles)
function shiftRows(rows, dx, from, to) {
  const out = rows.slice();
  for (let r = from; r <= to && r < rows.length; r++) {
    const line = rows[r];
    if (dx > 0) out[r] = '.'.repeat(dx) + line.slice(0, line.length - dx);
    else if (dx < 0) out[r] = line.slice(-dx) + '.'.repeat(-dx);
  }
  return out;
}

const SPR = {};

/* =========================================================== THE SAILOR === */
/* 16x20. Frames: 0 & 2 = opposed strides, 1 & 3 = pass pose (drawn 1px up). */
function buildSailorSprites() {
  // ---------------- shared bodies ----------------
  const BODY_DOWN = [
    '.....kkkkkk.....', //  0 cap top
    '....kwwwwwwk....', //  1
    '....kwwwwwwk....', //  2
    '....kbbbybbk....', //  3 cap band + emblem
    '...kkkkkkkkkk...', //  4 brim
    '...khsssssshk...', //  5 forehead (hair frames the face)
    '...khsksskshk...', //  6 eyes
    '...khsssssshk...', //  7
    '....kssssssk....', //  8 chin
    '....kcccccck....', //  9 neckerchief
    '....kcccccck....', // 10
    '..kbbbbbbbbbbk..', // 11 shoulders
    '..kbbbbyybbbbk..', // 12 chest + buttons
    '..ksbbbbbbbbsk..', // 13 hands at sides
    '..kkbbbbbbbbkk..', // 14 hem
  ];
  const LEGS_IDLE = [
    '...knnnyynnnk...', // 15 belt
    '...kGGGGGGGGk...', // 16
    '...kGGGkkGGGk...', // 17
    '....kGGkkGGk....', // 18
    '....kTTkkTTk....', // 19 boots
  ];
  // stride A: left leg planted, right foot lifted
  const LEGS_A = [
    '...knnnyynnnk...',
    '...kGGGGGGGGk...',
    '...kGGGkkGGGk...',
    '...kGGk..kTTk...',
    '...kTTk.........',
  ];
  // stride B: right leg planted, left foot lifted (true mirror of A)
  const LEGS_B = [
    '...knnnyynnnk...',
    '...kGGGGGGGGk...',
    '...kGGGkkGGGk...',
    '...kTTk..kGGk...',
    '.........kTTk...',
  ];
  // pass pose: legs together
  const LEGS_PASS = [
    '...knnnyynnnk...',
    '...kGGGGGGGGk...',
    '...kGGGkkGGGk...',
    '....kGGkkGGk....',
    '....kTTkkTTk....',
  ];
  // arm swing: opposite arm forward (visible), other tucked
  const ARMS_A = mutate(BODY_DOWN, { 13: '..kbbbbbbbbssk..' }); // right hand fwd
  const ARMS_B = mutate(BODY_DOWN, { 13: '..kssbbbbbbbbk..' }); // left hand fwd

  const BODY_UP = [
    '.....kkkkkk.....',
    '....kwwwwwwk....',
    '....kwwwwwwk....',
    '....kbbbbbbk....', // plain band from behind
    '...kkkkkkkkkk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '....khhhhhhk....',
    '....kbbbbbbk....', // collar
    '....kcccccck....', // scarf peeking over collar
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..ksbbbbbbbbsk..',
    '..kkbbbbbbbbkk..',
  ];
  const BODY_SIDE = [ // facing right
    '.....kkkkkk.....',
    '....kwwwwwwk....',
    '....kwwwwwwk....',
    '....kbbbbbbk....',
    '...kkkkkkkkkk...',
    '...khhsssssk....', // hair at the back, face forward
    '...khhsssksk....', // one eye
    '...khhsssssk....',
    '....khssssk.....',
    '.....kcccck.....', // scarf band
    '.....kcccckc....', // scarf tail begins at the chest
    '....kbbbbbbk....',
    '....kbbbbbbk....',
    '....kbbbbssk....', // hand forward
    '....kkbbbbkk....',
  ];
  const SIDE_ARMS_A = mutate(BODY_SIDE, { 13: '....kbbbbssk....' }); // hand fwd
  const SIDE_ARMS_B = mutate(BODY_SIDE, { 13: '....ksbbbbbk....' }); // hand back
  const SLEGS_IDLE = [
    '.....knnnnk.....',
    '....kGGGGGk.....',
    '....kGGGGGk.....',
    '....kGGkGGk.....',
    '....kTTkTTk.....',
  ];
  // side stride A: forward (right) leg extended right, back leg trailing
  const SLEGS_A = [
    '.....knnnnk.....',
    '....kGGGGGk.....',
    '....kGGGkGGk....',
    '...kGGk...kGGk..',
    '...kTTk...kTTk..',
  ];
  // side stride B: opposite stride
  const SLEGS_B = [
    '.....knnnnk.....',
    '....kGGGGGk.....',
    '....kGGkGGGk....',
    '..kGGk...kGGk...',
    '..kTTk...kTTk...',
  ];
  const SLEGS_PASS = [
    '.....knnnnk.....',
    '....kGGGGGk.....',
    '....kGGGGk......',
    '....kGGkGGk.....',
    '....kTTkTTk.....',
  ];

  const join = (body, legs) => body.concat(legs);

  // DOWN: 0 strideA, 1 pass, 2 strideB, 3 pass
  SPR.p_down0 = sheet(join(ARMS_A, LEGS_A));
  SPR.p_down1 = sheet(join(BODY_DOWN, LEGS_PASS));
  SPR.p_down2 = sheet(join(ARMS_B, LEGS_B));
  SPR.p_down3 = sheet(join(BODY_DOWN, LEGS_PASS));
  // UP
  SPR.p_up0 = sheet(join(BODY_UP, LEGS_A));
  SPR.p_up1 = sheet(join(BODY_UP, LEGS_PASS));
  SPR.p_up2 = sheet(join(BODY_UP, LEGS_B));
  SPR.p_up3 = sheet(join(BODY_UP, LEGS_PASS));
  // SIDE (right; left = runtime mirror)
  SPR.p_right0 = sheet(join(SIDE_ARMS_A, SLEGS_A));
  SPR.p_right1 = sheet(join(BODY_SIDE, SLEGS_PASS));
  SPR.p_right2 = sheet(join(SIDE_ARMS_B, SLEGS_B));
  SPR.p_right3 = sheet(join(BODY_SIDE, SLEGS_PASS));
  // IDLE + BLINK (breath bob is a runtime 1px dip)
  SPR.p_down_idle = sheet(join(BODY_DOWN, LEGS_IDLE));
  SPR.p_down_blink = sheet(join(mutate(BODY_DOWN, { 6: '...khsSssSshk...' }), LEGS_IDLE));
  SPR.p_up_idle = sheet(join(BODY_UP, LEGS_IDLE));
  SPR.p_right_idle = sheet(join(BODY_SIDE, SLEGS_IDLE));
  SPR.p_right_blink = sheet(join(mutate(BODY_SIDE, { 6: '...khhsssSsk....' }), SLEGS_IDLE));

  // washed-up pose (intro): lying on his back in the sand, 22x9
  SPR.p_lying = sheet([
    '........................',
    '........................',
    '......kkkk..k...........',
    '...kkkwwwwkkck..........',
    '..khhbsssskcck..........',
    '..kbbbbssGGGGkk.........',
    '..kbbbbbbbbGGGkkk.......',
    '...kbbbbbkGGk..kTTk.....',
    '....kkkkk.kkk...kkk.....'
  ]);
}

/* ================================================================ VAX ===== */
/* 16x22 — LOCKED DESIGN. See file header. Red eye (right) never blinks.     */
function buildVaxSprites() {
  const DOWN0 = [
    '...k..kk..k.....', //  0 hair spike tips
    '...kdkddkkddk...', //  1 messy edge
    '..kddddddddddk..', //  2
    '..kddddddddddk..', //  3
    '..kdDdddddDddk..', //  4 strand shadows
    '..kddxxxxxxddk..', //  5 fringe over the forehead
    '..kdxxxxxxxxdk..', //  6
    '..kdxxQxxRxxdk..', //  7 eyes: grey left, RED right
    '..kdxxxxxxxxdk..', //  8
    '...kxxXxxXxk....', //  9 mouth hint
    '....kxxxxxk.....', // 10 jaw
    '..kcccccccccck..', // 11 scarf wrap (wide: silhouette!)
    '.kcccccccccccck.', // 12 chunky second row
    '..kjjnccjjjjjk..', // 13 jacket + charcoal shirt + scarf tail (cols 6-7)
    '..kjjncnjjjjjk..', // 14 tail narrows
    '..kjjncnjjjjjk..', // 15
    '..kjjjnnjjjjjk..', // 16 tail ends on the shirt
    '..kxjjjjjjjjxk..', // 17 pale hands at the hem
    '.kvvvvvvvvvvvk..', // 18 baggy grey trousers
    '..kvvvvkkvvvvk..', // 19
    '..kvvk....kvvk..', // 20
    '..kzzwk..kzzwk..', // 21 red-and-white sneakers
  ];
  const RIGHT0 = [
    '...k..kk..k.....',
    '...kdkddkkdk....',
    '..kdddddddk.....',
    '..kddddddddk....',
    '..kdDddddddk....',
    '..kdddxxxxxk....', // fringe, face forward (right)
    '..kddxxxxxxk....',
    '..kddxxxRxxk....', // the red eye faces the world
    '..kddxxxxxxk....',
    '...kdxxXxxk.....',
    '....kxxxxk......',
    '...kccccccck....', // scarf wrap
    '...kccccccck....',
    '....kjjjjncck...', // tail hangs at the chest-front
    '....kjjjjncck...',
    '....kjjjjnck....',
    '....kjjjjjjk....',
    '....kxjjjjxk....',
    '....kvvvvvk.....',
    '....kvvvvvk.....',
    '....kvvkvvk.....',
    '....kzzwzzk.....',
  ];
  const UP0 = [
    '...k..kk..k.....',
    '...kdkddkkddk...',
    '..kddddddddddk..',
    '..kddddddddddk..',
    '..kdDdddddDddk..',
    '..kddddddddddk..',
    '..kddddddddddk..',
    '..kddddddddddk..',
    '..kddddddddddk..',
    '...kddddddddk...',
    '....kdddddk.....',
    '..kcccccccccck..',
    '.kcccccccccccck.',
    '..kjjjjjjjjjjk..',
    '..kjjjjjjjjjjk..',
    '..kjjjjjjjjjjk..',
    '..kjjjjjjjjjjk..',
    '..kxjjjjjjjjxk..',
    '.kvvvvvvvvvvvk..',
    '..kvvvvkkvvvvk..',
    '..kvvk....kvvk..',
    '..kzzwk..kzzwk..',
  ];

  // idle frame 1: weight shifts onto the right leg — body slides 1px right,
  // the scarf tail swings the other way, spikes settle differently.
  const DOWN1 = shiftRows(DOWN0, 1, 0, 17);
  DOWN1[0] = '....k..kk..k....';
  DOWN1[13] = '..kjjjncjjjjjk..'; // tail sways left while body goes right
  DOWN1[14] = '..kjjjncjjjjjk..';
  DOWN1[15] = '..kjjjnnjjjjjk..';
  const RIGHT1 = shiftRows(RIGHT0, 0, 0, 21); // side idle: scarf sway only
  RIGHT1[13] = '....kjjjjnck....';
  RIGHT1[14] = '....kjjjjncck...';
  RIGHT1[15] = '....kjjjjnck....';
  const UP1 = shiftRows(UP0, 1, 0, 17);
  UP1[0] = '....k..kk..k....';

  // idle frame 2 (rare hair flick): spikes jump
  const DOWN2 = mutate(DOWN0, {
    0: '....k.kk.kk.k...',
    1: '....kdkddkkdk...',
  });

  // talk variants: mouth open + a 1px bob comes from the draw call
  const tDOWN = mutate(DOWN0, { 9: '...kxxXnnXxk....' });
  const tRIGHT = mutate(RIGHT0, { 9: '....kdxXnnxk....' });
  const tUP = mutate(UP0, {});

  SPR.v_down0 = sheet(DOWN0);
  SPR.v_down1 = sheet(DOWN1);
  SPR.v_down2 = sheet(DOWN2);
  SPR.v_down_talk = sheet(tDOWN);
  SPR.v_right0 = sheet(RIGHT0);
  SPR.v_right1 = sheet(RIGHT1);
  SPR.v_right_talk = sheet(tRIGHT);
  SPR.v_up0 = sheet(UP0);
  SPR.v_up1 = sheet(UP1);
  SPR.v_up_talk = sheet(tUP);
}

/* ============================================================ VILLAGERS === */
/* 16x18 each: down + right (left mirrored at runtime). Idle = runtime bob;
   talk variant swaps the mouth row. All share PAL. */
function buildNpcSprites() {
  // ---- ALI SAMA: sturdy tavern keeper, wine dress + pale apron, hair bun
  const aliD = [
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '...kkhbbbbhkk...',
    '....kAssssAk....',
    '....kAskksAk....',
    '....kAssssAk....',
    '.....kssssk.....',
    '....kwwwwwwk....',   // apron collar
    '...kaawwwwaak...',
    '...kaawwwwaak...',
    '..ksaawwwwaask..',   // hands
    '..ksaawwwwaask..',
    '...kaawwwwaak...',
    '...kaawwwwaak...',
    '...kkwwwwwwkk...',
    '....kaa..aak....',
    '....kTT..TTk....',
  ];
  const aliR = [
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '....khhbbbbk....',
    '....khhAsssk....',
    '....khhAsksk....',
    '....khhAsssk....',
    '.....khsssk.....',
    '.....kwwwwk.....',
    '....kaawwwk.....',
    '....kaawwwk.....',
    '....kaawwwsk....',
    '....kaawwwsk....',
    '....kaawwwk.....',
    '....kaawwwk.....',
    '....kaawwwk.....',
    '....kkwwwwkk....',
    '.....kawwak.....',
    '.....kTTTTk.....',
  ];
  SPR.ali_down = sheet(aliD);
  SPR.ali_down_talk = sheet(mutate(aliD, { 6: '....kAsnnnAk....' }));
  SPR.ali_right = sheet(aliR);
  SPR.ali_right_talk = sheet(mutate(aliR, { 6: '...khhAsnssk....' }));

  // ---- MAJHOOL: hunched old archivist, hooded patched robe, long grey beard
  const majD = [
    '.....kkkkk......',
    '....kPPPPPk.....',
    '...kPPPPPjPk....',   // patched hood (plum robe with patches)
    '...kPPwPwPPk....',
    '...kPwwwwwPk....',   // hood shadow over the face
    '...kPwWkWwPk....',   // eyes in shadow
    '...kPwwwwwPk....',
    '....kWWWWWk.....',   // beard begins
    '....kWWWWWk.....',
    '....kWWWWk......',
    '...kPPPPPPPk....',
    '..kPPjPPjPPPk...',   // patched robe
    '..kPPPPPPPPPk...',
    '..kPsPPPPPsPk...',   // old hands
    '..kPPPPPPPPPk...',
    '..kPPPPPPPPPk...',
    '...kPPk.kPPk....',
    '...kTTk.kTTk....',
  ];
  const majR = [
    '.....kkkkk......',
    '....kPPPPPk.....',
    '...kPPPPPjPk....',
    '...kPPPPPPPk....',
    '...kPPwwwwPk....',
    '...kPPwWkwPk....',
    '...kPPwwwwPk....',
    '....kPWWWWk.....',
    '....kPWWWWk.....',
    '....kPWWWk......',
    '....kPPPPPk.....',
    '....kPPjPPk.....',
    '....kPPPPPk.....',
    '....kPPPPsPk....',
    '....kPPPPPk.....',
    '....kPPPPPk.....',
    '.....kPPPk......',
    '.....kTTTk......',
  ];
  SPR.maj_down = sheet(majD);
  SPR.maj_down_talk = sheet(mutate(majD, { 6: '...kPwnnWwPk....' }));
  SPR.maj_right = sheet(majR);
  SPR.maj_right_talk = sheet(mutate(majR, { 6: '...kPPwnnwPk....' }));

  // ---- LEVI: small kid in a big yellow raincoat, 16x15
  const levD = [
    '.....kkkkk......',
    '....keeeeek.....',
    '...keeeeeeeek...',
    '...keesssseek...',
    '...keeskseek....',
    '...keesssseek...',
    '....kessssk.....',
    '...kkeeeeeekk...',
    '..keeeeeeeeek...',
    '..kseseeesesk...',
    '..keeeeeeeeek...',
    '..keeeeeeeeek...',
    '...keeekkeeek...',
    '....kTTk.kTTk...',  // wait: boots row width differs, fixed in-place
  ];
  const leviD = [
    '.....kkkkk......',
    '....keeeeek.....',
    '...keeeeeeeek...',
    '...keesssseek...',
    '...keeskseek....',
    '...keesssseek...',
    '....kessssk.....',
    '...kkeeeeeekk...',
    '..keeeeeeeeek...',
    '..kseseeesesk...',
    '..keeeeeeeeek...',
    '..keeeeeeeeek...',
    '...keeekeeek....',
    '....kTTkkTTk....',
  ];
  const leviR = [
    '.....kkkkk......',
    '....keeeeek.....',
    '...keeeeeeeek...',
    '....keessssek...',
    '....keesksek....',
    '....keessssek...',
    '.....kesssk.....',
    '....kkeeeekk....',
    '....keeeeeek....',
    '....keeeesk.....',
    '....keeeeek.....',
    '....keeeeek.....',
    '.....keeeek.....',
    '.....kTTTTk.....',
  ];
  SPR.levi_down = sheet(leviD);
  SPR.levi_down_talk = sheet(mutate(leviD, { 5: '...keesnneek....' }));
  SPR.levi_right = sheet(leviR);
  SPR.levi_right_talk = sheet(mutate(leviR, { 5: '....keesnsek....' }));

  // ---- RUTA: fisherman patron, navy beanie, grey sweater, pipe
  const rutaD = [
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....knnnnnnk....',
    '....khssssHk....',
    '....kskssksk....',
    '....kssssssk....',
    '....ksstsssk....',   // pipe stem
    '.....kssssk.....',
    '....kWWWWWWk....',
    '...kWWWWWWWWk...',
    '..ksWWWWWWWWsk..',
    '..kWWWWWWWWWWk..',
    '..kWWWWnWWWWWk..',
    '...kWWWWWWWWk...',
    '...knnnnnnnnk...',
    '...knnk..knnk...',
    '...kTTk..kTTk...',
  ];
  const rutaR = [
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '....knnnnnnk....',
    '....khsssssk....',
    '....khssksk.....',
    '....khsssssk....',
    '....khssstsk....',
    '.....khsssk.....',
    '....kWWWWWWk....',
    '....kWWWWWWk....',
    '....kWWWWWsk....',
    '....kWWWWWWk....',
    '....kWWWWnWk....',
    '....kWWWWWWk....',
    '....knnnnnnk....',
    '.....knnnnk.....',
    '.....kTTTTk.....',
  ];
  SPR.ruta_down = sheet(rutaD);
  SPR.ruta_down_talk = sheet(mutate(rutaD, { 6: '....ksnnnssk....' }));
  SPR.ruta_right = sheet(rutaR);

  // ---- NADIA: villager with headscarf and fruit basket
  const nadD = [
    '.....kkkkk......',
    '....kcccccck....',
    '...kcccccccck...',
    '....kssssssk....',
    '....ksksskss....',
    '....kssssssk....',
    '.....kssssk.....',
    '....kPPPPPPk....',
    '...kPPPPPPPPk...',
    '..kseePPPPeeak..',
    '..ksePPPPPSeek..',
    '...kPPPPPPPPk...',
    '...kPPPPPPPPk...',
    '...kPPPPPPPPk...',
    '...kPPk..kPPk...',
    '...kTTk..kTTk...',
  ];
  const nadR = [
    '.....kkkkk......',
    '....kcccccck....',
    '...kccccccck....',
    '....khsssssk....',
    '....khsskssk....',
    '....khsssssk....',
    '.....khsssk.....',
    '....kPPPPPPk....',
    '....kPPPPPPk....',
    '....kPPPPPsik...',
    '....kPPPPPsik...',
    '....kPPPPPPk....',
    '....kPPPPPPk....',
    '....kPPPPPPk....',
    '.....kPPPPk.....',
    '.....kTTTTk.....',
  ];
  SPR.nad_down = sheet(nadD);
  SPR.nad_right = sheet(nadR);
}

/* ============================================================ PORTRAITS === */
/* 28x28 busts for the dialogue box. */
function buildPortraits() {
  SPR.por_sailor = sheet([
    '............................',
    '.........kkkkkkk............',
    '........kwwwwwwwk...........',
    '.......kwwwwwwwwwk..........',
    '.......kwwwwwwwwwk..........',
    '.......kbbbbybbbbk..........',
    '......kkkkkkkkkkkkk.........',
    '......khssssssssshk.........',
    '.....khssssssssssshk........',
    '.....khskkssssskkshk........',
    '.....khskwssssskwshk........',
    '.....khskkssssskkshk........',
    '.....khssssssssssshk........',
    '.....khssssnnssssshk........',
    '......khssssssssshk.........',
    '......kssskkkkksssk.........',
    '.......kssssssssk...........',
    '......kccccccccck...........',
    '.....kccccccccccck..........',
    '....kbbbbbbbbbbbbbbk........',
    '...kbbbbbbbbbybbbbbbbk......',
    '...kbbbbbbbbyyybbbbbbk......',
    '...kbbbbbbbbyybbbbbbbk......',
    '...kbbbbbbbbbbbbbbbbbk......',
    '...kbbbbbbbbbbbbbbbbbk......',
    '...kBbbbbbbbbbbbbbbbBk......',
    '....kkkkkkkkkkkkkkkkkk......',
    '.....kggggk....kggggk.......',
    '.....kkkkkk....kkkkkk.......'
  ]);
  SPR.por_vax = sheet([
    '.....k..kkk..k..............',
    '....kdkddddkkddk............',
    '...kdddddddddddddk..........',
    '..kdddddddddddddddk.........',
    '..kdDdddddddDdddddk.........',
    '..kdddddddddddddddk.........',
    '..kdddddddddddddddk.........',
    '..kddxxxxxxxxxxdddk.........',
    '..kddxxxxxxxxxxdddk.........',
    '..kddxxQxxxxRxxxdddk........',
    '..kddxxQxxxxRxxxdddk........',
    '..kddxxxxxxxxxxdddk.........',
    '..kddxxxxxxxxxxdddk.........',
    '...kdxxxxxxXxxddk...........',
    '...kxxxxxxXxxxxxk...........',
    '....kxxxxxxxxxxk............',
    '...kcccccccccccck...........',
    '..kcccccccccccccck..........',
    '..kCcckcccccckccCk..........',
    '..kjjjncccccccnjjjk.........',
    '..kjjjncckkccnjjjk..........',
    '..kjjjjncccccnjjjjk.........',
    '..kjjjjjjnnnjjjjjjjk........',
    '..kjjjjjjjjjjjjjjjjk........',
    '..kjjjjjjjjjjjjjjjjk........',
    '..kJjjjjjjjjjjjjjjJk........',
    '...kkkkkkkkkkkkkkkkk........',
    '.....kvvvvk...kvvvvk........'
  ]);
  SPR.por_ali = sheet([
    '............................',
    '.........kkkkkk.............',
    '........khhhhhhk............',
    '.......khhhhhhhhk...........',
    '.......khhbbbbhhk...........',
    '.......khhhhhhhhk...........',
    '......kkAsssssskk...........',
    '.....kAsssssssssk...........',
    '.....kAskkssskksk...........',
    '.....kAskwwsskwsk...........',
    '.....kAskkssskksk...........',
    '.....kAsssssssssk...........',
    '.....kAsssnnssssk...........',
    '......kAssssssk.............',
    '.......ksssssk..............',
    '......kwwwwwwwk.............',
    '.....kwwwwwwwwwk............',
    '....kaawwwwwwwaak...........',
    '...kaawwwwwwwwwaak..........',
    '...kaawwwccccwwaak..........',
    '..ksaawwwwwwwwwaask.........',
    '..ksaawwwwwwwwwaask.........',
    '..kaawwwwwwwwwwwaak.........',
    '..kaawwwwwwwwwwwaak.........',
    '..kaawwwwwwwwwwwaak.........',
    '..kaawwwwwwwwwwwaaak........'.slice(0, 28),
    '...kkwwwwwwwwwwwwkk.........',
    '.....kaaak....kaaak.........'
  ]);
  SPR.por_majhool = sheet([
    '........kkkkkk..............',
    '.......kPPPPPPk.............',
    '......kPPPPPPPPk............',
    '.....kPPPPjjPPPPk...........',
    '.....kPPPPPPPPPPk...........',
    '.....kPPwwwwwwPPk...........',
    '.....kPwwwwwwwwPk...........',
    '.....kPwwkwwkwwPk...........',
    '.....kPwwkwwkwwPk...........',
    '.....kPwwwwwwwwPk...........',
    '.....kPwWWWWWWwPk...........',
    '.....kkWWWWWWWWkk...........',
    '......kWWWWWWWWk............',
    '......kWWWWWWk..............',
    '......kWWWWWWWWk............',
    '......kWWWWWk...............',
    '.....kPPPPPPPPPk............',
    '....kPPPPjPPPPPPk...........',
    '...kPPPPPPPPjPPPPk..........',
    '...kPPjPPPPPPPPPPPk.........'.slice(0, 28),
    '...kPPPPPPPPPPPPPPk.........',
    '..kPPPPPPPPPPPPPPPPk........',
    '..kPPsPPPPPPPPPPsPPk........',
    '..kPPPPPPPPPPPPPPPPk........',
    '..kPPPPPPPPPPPPPPPPk........',
    '..kPPPPPPPPPPPPPPPPk........',
    '...kkPPPPPPPPPPPPkk.........',
    '.....kPPk......kPPk.........'
  ]);
  SPR.por_levi = sheet([
    '............................',
    '........kkkkkkk.............',
    '.......keeeeeeeek...........',
    '......keeeeeeeeek...........',
    '.....keeeeeeeeeeeek.........'.slice(0, 28),
    '.....keessssssseek..........',
    '.....keessssssseek..........',
    '.....keeskssskseek..........',
    '.....keeskssskseek..........',
    '.....keessssssseek..........',
    '.....keessnnssseek..........',
    '.....keessssssseek..........',
    '.....kkessssssekk...........',
    '......ksssssssk.............',
    '.......ksssssk..............',
    '......kkeeeeeekk............',
    '.....keeeeeeeeek............',
    '....keeeeeeeeeeeek..........',
    '....kseseeeeeeesk...........',
    '....keeeeeeeeeeeek..........',
    '....keeeeeeeeeeeek..........',
    '....keeeeekkeeeeeek.........'.slice(0, 28),
    '....keeeeeeeeeeeeek.........',
    '....keeeeeeeeeeeeek.........',
    '....keeeeeeeeeeeeek.........',
    '.....keeeeeeeeeeek..........',
    '......kkkkkkkkkkkk..........',
    '.......kTTk..kTTk...........'
  ]);
}

/* ============================================================== ICONS ===== */
function buildIcons() {
  // battle soul: the sailor's lantern-flame (2 frames)
  SPR.soul0 = sheet([
    '...yy...',
    '..yYYy..',
    '..YeeY..',
    '.yEeeEy.',
    '.yEwwEy.',
    '.yEwwEy.',
    '..yEEy..',
    '...yy...'
  ], Object.assign({}, PAL, { E: '#ffb84d' }));
  SPR.soul1 = sheet([
    '....y...',
    '...yYy..',
    '..yYeY..',
    '.yEeeEy.',
    '.yEwwEy.',
    '.yEwwEy.',
    '..yEEy..',
    '...yy...'
  ], Object.assign({}, PAL, { E: '#ffb84d' }));
  // exclamation bubble for talk prompts
  SPR.bubble = sheet([
    '..kkkkkkk..',
    '.kwwwwwwwk.',
    'kwwwwwwwwwk',
    'kwwwwwwwwwk',
    'kwwwwwwwwwk',
    'kwwwwwwwwwk',
    '.kwwwwwwwk.',
    '..kkkwwkkk.',
    '....kwk....',
    '.....k.....'
  ]);
  // gold diamond used to mark examinables
  SPR.diamond = sheet([
    '.yy.',
    'yYYy',
    'yYYy',
    '.yy.'
  ]);
}

/* ===================================================== ENEMY BATTLE ART === */
/* Painted (not char-mapped) so bosses stay organic. ~48px tall, centered.  */
function paintCrabApple() {
  // A crab wearing an apple as a shell. It is very proud of the apple.
  const { c, x } = makeCanvas(52, 44);
  const bx = 26, by = 24;
  // legs (angular, 3 per side)
  const leg = (sx, dir, lift) => {
    for (let i = 0; i < 7; i++) {
      px(x, sx + dir * i * 2.4, by + 9 - Math.sin(i / 6 * Math.PI) * (4 + lift), '#8f2b38');
      px(x, sx + dir * i * 2.4, by + 9 - Math.sin(i / 6 * Math.PI) * (4 + lift) + 1, '#5f1d26');
    }
  };
  leg(14, -1, 2); leg(10, -1, 5); leg(6, -1, 3);
  leg(38, 1, 2); leg(42, 1, 5); leg(46, 1, 3);
  // pincers
  const pincer = (px0, py0, dir) => {
    fillCircle(x, px0, py0, 4.4, '#7d1f2c');
    fillCircle(x, px0, py0, 3.4, '#a63340');
    fillCircle(x, px0 + dir, py0 - 1, 1.8, '#d15460');
    px(x, px0 + dir * 5, py0 - 2, '#7d1f2c'); px(x, px0 + dir * 5, py0 - 3, '#7d1f2c');
    px(x, px0 + dir * 5, py0 + 1, '#7d1f2c');
  };
  pincer(8, 16, -1); pincer(44, 16, 1);
  // apple shell
  fillCircle(x, bx, by, 11, '#6e1620');
  fillCircle(x, bx, by, 10, '#a81f2c');
  fillCircle(x, bx - 2, by - 2, 8, '#c93340');
  fillCircle(x, bx - 4, by - 4, 4.4, '#e05a63');
  px(x, bx - 5, by - 5, '#f7a6a6');
  // dimple + stem + leaf
  px(x, bx, by - 9, '#5f4a2a'); px(x, bx, by - 10, '#7a5f38');
  x.fillStyle = '#37774a'; x.fillRect(bx + 1, by - 12, 4, 2);
  px(x, bx + 4, by - 13, '#4f9d5d');
  // eyes under the shell rim
  x.fillStyle = '#f4efe4';
  x.fillRect(bx - 6, by + 5, 4, 4); x.fillRect(bx + 2, by + 5, 4, 4);
  x.fillStyle = '#161a2b';
  x.fillRect(bx - 5, by + 6, 2, 2); x.fillRect(bx + 3, by + 6, 2, 2);
  // little mouth
  x.fillStyle = '#4a0d14';
  x.fillRect(bx - 2, by + 9, 4, 1);
  return c;
}

function paintBramblett() {
  // A bramble bush that learned to walk. Nervous. Berry-cluster eyes.
  const { c, x } = makeCanvas(50, 46);
  const bx = 25, baseY = 45;
  // root-legs
  const root = (x0, lean) => {
    for (let i = 0; i < 9; i++) {
      px(x, x0 + lean * i * 0.8, baseY - i - Math.sin(i * 0.9) * 1.2, i < 4 ? '#26190f' : '#37774a');
      px(x, x0 + lean * i * 0.8 + 1, baseY - i - Math.sin(i * 0.9) * 1.2, '#1d3d2a');
    }
  };
  root(16, -0.7); root(24, 0.15); root(32, 0.8);
  // thorny body mass
  fillCircle(x, bx, baseY - 22, 12, '#1d3d2a');
  fillCircle(x, bx - 5, baseY - 26, 8, '#2a5a38');
  fillCircle(x, bx + 6, baseY - 25, 8.4, '#2a5a38');
  fillCircle(x, bx, baseY - 30, 8, '#37774a');
  fillCircle(x, bx - 3, baseY - 32, 5, '#4f9d5d');
  // bramble texture: thorns
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39, r = 7 + (i % 4) * 2.4;
    px(x, bx + Math.cos(a) * r, baseY - 26 + Math.sin(a) * r * 0.8, i % 3 ? '#26190f' : '#5fae63');
    px(x, bx + Math.cos(a) * r, baseY - 25 + Math.sin(a) * r * 0.8, '#161a2b');
  }
  // berry clusters
  const berry = (bxx, byy) => {
    fillCircle(x, bxx, byy, 2.2, '#6e1620'); fillCircle(x, bxx, byy, 1.6, '#a81f2c'); px(x, bxx - 1, byy - 1, '#d15460');
  };
  berry(bx - 8, baseY - 30); berry(bx + 8, baseY - 27); berry(bx + 3, baseY - 34); berry(bx - 4, baseY - 22);
  // eyes: two pale berries with pupils
  fillCircle(x, bx - 5, baseY - 27, 3, '#f4efe4'); fillCircle(x, bx + 5, baseY - 27, 3, '#f4efe4');
  x.fillStyle = '#161a2b';
  x.fillRect(bx - 5, baseY - 27, 2, 2); x.fillRect(bx + 4, baseY - 27, 2, 2);
  return c;
}

function paintGullgazer() {
  // A seagull that has been staring at the island for too long.
  const { c, x } = makeCanvas(56, 44);
  const bx = 28, by = 20;
  // wings (spread, angular)
  const wing = (dir) => {
    for (let i = 0; i < 16; i++) {
      const wy = by + 2 - Math.sin(i / 15 * Math.PI) * 9;
      for (let w = 0; w < 3; w++) {
        px(x, bx + dir * (4 + i * 1.6), wy + w, w === 0 ? '#e8ecef' : w === 1 ? '#c3ccd2' : '#8d99a1');
      }
    }
  };
  wing(-1); wing(1);
  // body
  fillCircle(x, bx, by + 4, 8, '#c3ccd2');
  fillCircle(x, bx, by + 2, 7, '#e8ecef');
  fillCircle(x, bx - 1, by, 4.6, '#f6f8f9');
  // tail
  x.fillStyle = '#c3ccd2'; x.fillRect(bx - 3, by + 11, 6, 2);
  // head
  fillCircle(x, bx, by - 6, 5.4, '#e8ecef');
  fillCircle(x, bx - 1, by - 7, 3.4, '#f6f8f9');
  // the eye: far too large
  fillCircle(x, bx + 1, by - 6, 2.8, '#f4efe4');
  x.fillStyle = '#161a2b'; x.fillRect(bx, by - 7, 2, 2);
  px(x, bx, by - 7, '#5d6b78');
  // beak
  x.fillStyle = '#e8a23b'; x.fillRect(bx + 5, by - 5, 5, 2);
  px(x, bx + 9, by - 5, '#b07224'); px(x, bx + 9, by - 4, '#b07224');
  // legs
  x.fillStyle = '#e8a23b';
  x.fillRect(bx - 3, by + 11, 1, 4); x.fillRect(bx + 2, by + 11, 1, 4);
  x.fillRect(bx - 4, by + 15, 3, 1); x.fillRect(bx + 1, by + 15, 3, 1);
  return c;
}

/* ============================================================ ITEM ICONS == */
/* 12x12 each. */
function buildItemIcons() {
  SPR.it_jerky = sheet([
    '............',
    '..kkk..kkk..',
    '.krrrkkrrrk.',
    'krRrrrrrRrrk',
    'krrrrrrrrrrk',
    '.krrRrrrRrk.',
    '..krrrrrrk..',
    '...krrrrk...',
    '....kkkk....',
    '............',
    '............',
    '............'
  ]);
  SPR.it_fruit = sheet([
    '.....k......',
    '....ktk.....',
    '..kk.lk.....',
    '.keeklk.....',
    'keeeek.klk..',
    'keeeeeklklk.',
    'keeeeeeeek..',
    'keeEeeeek...',
    '.keEeeek....',
    '..kkekk.....',
    '............',
    '............'
  ], Object.assign({}, PAL, { E: '#f6c96b' }));
  SPR.it_coconut = sheet([
    '............',
    '....kkkk....',
    '..kknnnnkk..',
    '.knnnNNnnnk.',
    'knnnnnnnnnnk',
    'knnknnnnknnk',
    'knnnnnnnnnnk',
    'knnnNNnnnnk.',
    '.knnnnnnnnk.',
    '..kknnnnkk..',
    '....kkkk....',
    '............'
  ], Object.assign({}, PAL, { n: '#6b4a2e', N: '#4a3018' }));
  SPR.it_tea = sheet([
    '............',
    '...kkkkkk...',
    '..kwwwwwwk..',
    '.kwOOOOOOwk.',
    '.kwOOOOOOwk.',
    '.kwOOOOOOwk.',
    '..kwwwwwwkk.',
    '...kkkkkk.k.',
    '..........k.',
    '...k.kk.k...',
    '....k..k....',
    '...kkkkkk...'
  ], Object.assign({}, PAL, { O: '#c47a2e' }));
  SPR.it_bandage = sheet([
    '............',
    '............',
    '..kkkkkkkk..',
    '.kwwwwwwwwk.',
    'kwwwwkkwwwwk',
    'kwwwkwwkwwwk',
    'kwwwkwwkwwwk',
    'kwwwwkkwwwwk',
    '.kwwwwwwwwk.',
    '..kkkkkkkk..',
    '............',
    '............'
  ]);
  SPR.it_compass = sheet([
    '............',
    '....kkkk....',
    '..kkyyyykk..',
    '.kyywwwwyyk.',
    '.kywwRwwwyk.',
    'kyywwwRwwyyk',
    'kyywwwRwwyyk',
    '.kywwRwwwyk.',
    '.kyywwwwyyk.',
    '..kkyyyykk..',
    '....kkkk....',
    '............'
  ]);
  SPR.it_map = sheet([
    '............',
    '.kkkkkkkkk..',
    'kWWwwwwWwWk.',
    'kWwwkwwwWwk.',
    'kwwwkwkwwwk.',
    'kWwkkkkwwwk.',
    'kwwwkwkwwWk.',
    'kWwwkwkwwwk.',
    'kWwwkkkwwWk.',
    'kWWwwwwWWwk.',
    '.kkkkkkkkk..',
    '............'
  ], Object.assign({}, PAL, { W: '#d8c9a3' }));
  SPR.it_bell = sheet([
    '............',
    '.....kk.....',
    '....kyYk....',
    '...kkyykk...',
    '..kyyyyyyk..',
    '..kyyYyyyk..',
    '.kyyyyyyyyk.',
    '.kyyyYyyyyk.',
    '.kyyyyyyyyk.',
    '..kkkkkkkk..',
    '....kyyk....',
    '.....kk.....'
  ], Object.assign({}, PAL, { y: '#b8905a', Y: '#8a6a3c' }));
  SPR.it_token = sheet([
    '............',
    '....kkkk....',
    '..kkppppkk..',
    '.kppqqqqppk.',
    '.kpqwqqwqpk.',
    'kpqqwqqwqqpk',
    'kpqqwqqwqqpk',
    '.kpqwqqwqpk.',
    '.kppqqqqppk.',
    '..kkppppkk..',
    '....kkkk....',
    '............'
  ], Object.assign({}, PAL, { p: '#7d5ba6', q: '#a884c9', w: '#e6d9f2' }));
  SPR.it_gloves = sheet([
    '............',
    '............',
    '..kk....kk..',
    '.kwwk..kwwk.',
    '.kwwk..kwwk.',
    '.kwwkk.kwwk.',
    '.kwwwwkwwwk.',
    '..kwwwwwwk..',
    '...kwwwwk...',
    '....kkkk....',
    '............',
    '............'
  ], Object.assign({}, PAL, { w: '#8d99a1' }));
  SPR.it_cap = sheet([
    '............',
    '....kkkk....',
    '..kkwwwwkk..',
    '.kwwwwwwwwk.',
    '.kbbbbbybbk.',
    '.kbbbbbbbbk.',
    'kkkkkkkkkkkk',
    '............',
    '............',
    '............',
    '............',
    '............'
  ]);
}

/* ------------------------------------------------------------ MASTER BUILD */
function buildAllSprites() {
  buildSailorSprites();
  buildVaxSprites();
  buildNpcSprites();
  buildPortraits();
  buildIcons();
  buildItemIcons();
  SPR.crabApple = paintCrabApple();
  SPR.bramblett = paintBramblett();
  SPR.gullgazer = paintGullgazer();
}
