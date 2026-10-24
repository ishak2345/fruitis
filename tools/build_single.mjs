#!/usr/bin/env node
/* Builds fruits-island.html: the whole game (css + all js) inlined into ONE
   self-contained file. Open it directly from disk — no server, no fetches. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let out = html;
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)];
for (const m of scripts) {
  const code = fs.readFileSync(path.join(ROOT, m[1]), 'utf8');
  out = out.replace(m[0], '<script>\n' + code + '\n</script>');
}
const banner = `<!-- Fruits Island - Chapter One: The First Slice
     SINGLE-FILE BUILD - everything inlined, works offline from file://
     Built from the modular sources in js/ (see docs/TECH_NOTES.md).
     Controls: Arrows/WASD move - Z/E/Enter/Space confirm - I/Tab inventory
               Esc pause - M mute/volume -->\n`;
out = out.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + banner);
fs.writeFileSync(path.join(ROOT, 'fruits-island.html'), out);
console.log('fruits-island.html written:', (out.length / 1024).toFixed(0) + ' KB,', scripts.length, 'scripts inlined');
