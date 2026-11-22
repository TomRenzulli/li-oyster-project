#!/usr/bin/env node
/**
 * Internal link checker for the built site.
 *
 * A directory earns trust by not sending people to dead ends, and a link to a
 * page that does not exist yet is the easiest way to lose it. This walks every
 * built HTML file and asserts that each internal href resolves to real output.
 *
 * Runs in CI after the build.
 *
 *   node scripts/check-links.mjs
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const DIST = 'dist';
const html = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) html.push(p);
  }
})(DIST);
const broken = [];
for (const file of html) {
  const body = readFileSync(file, 'utf8');
  for (const m of body.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    const candidates = [
      join(DIST, href),
      join(DIST, href, 'index.html'),
      join(DIST, href.replace(/\/$/, '') + '.html'),
    ];
    if (!candidates.some((c) => existsSync(c))) broken.push(`${file} -> ${href}`);
  }
}
if (broken.length > 0) {
  for (const b of broken) console.error(`BROKEN ${b}`);
  console.error(`\n${broken.length} broken internal link(s) across ${html.length} pages.`);
} else {
  console.log(`All internal links resolve (${html.length} pages checked).`);
}
process.exit(broken.length ? 1 : 0);
