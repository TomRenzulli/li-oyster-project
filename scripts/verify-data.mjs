#!/usr/bin/env node
/**
 * Data integrity gate for the farm directory.
 *
 * The one rule this project cannot bend: no fabricated data. Every listing
 * must carry at least one source URL and a last_verified date, and any
 * contact-level field (address, phone, email, geo) must be backed by a
 * source accessed within the last 12 months.
 *
 * This runs in CI and in the pre-commit hook. It intentionally has zero
 * dependencies and parses only the narrow YAML subset the listings use, so
 * the gate cannot be broken by a supply-chain problem in a parser.
 *
 *   node scripts/verify-data.mjs          # fail on any integrity violation
 *   node scripts/verify-data.mjs --stale  # also report listings due for re-verification
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FARMS_DIR = 'src/content/farms';
const CONTACT_FIELDS = ['address', 'phone', 'email', 'geo'];
const SOURCE_MAX_AGE_DAYS = 365;
const REVERIFY_AFTER_DAYS = 183; // ~6 months, per the launch checklist

const reportStale = process.argv.includes('--stale');
const errors = [];
const warnings = [];

/** Minimal reader: we only need to know whether keys and list items exist. */
function readListing(text) {
  const topLevelKeys = new Set();
  const sourceDates = [];
  let sourceCount = 0;
  let inSources = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const topLevel = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (topLevel && topLevel[1]) {
      const [, key, rest] = topLevel;
      topLevelKeys.add(key);
      inSources = key === 'sources';
      if (inSources && rest && rest.trim() && rest.trim() !== '[]') {
        // Inline array form: sources: [ ... ]
        sourceCount += (rest.match(/https?:\/\//g) ?? []).length;
      }
      continue;
    }

    if (inSources && /^\s+-\s/.test(line)) sourceCount += 1;
    if (inSources) {
      const accessed = /accessed:\s*["']?(\d{4}-\d{2}-\d{2})/.exec(line);
      if (accessed && accessed[1]) sourceDates.push(accessed[1]);
    }
  }

  const lastVerified = /^last_verified:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(text)?.[1] ?? null;
  return { topLevelKeys, sourceCount, sourceDates, lastVerified };
}

const daysSince = (iso) => (Date.now() - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000;

if (!existsSync(FARMS_DIR)) {
  console.log(`verify-data: ${FARMS_DIR} does not exist yet — no listings to check.`);
  process.exit(0);
}

const files = readdirSync(FARMS_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

if (files.length === 0) {
  console.log('verify-data: no listings published yet. Nothing to verify. OK.');
  process.exit(0);
}

for (const file of files) {
  const path = join(FARMS_DIR, file);
  const { topLevelKeys, sourceCount, sourceDates, lastVerified } = readListing(
    readFileSync(path, 'utf8'),
  );
  const fail = (msg) => errors.push(`${path}: ${msg}`);

  if (sourceCount === 0) fail('no sources. Every listing needs at least one source URL.');
  if (!lastVerified) fail('missing or malformed last_verified (expected YYYY-MM-DD).');
  else if (daysSince(lastVerified) < 0) fail(`last_verified ${lastVerified} is in the future.`);

  const contactFields = CONTACT_FIELDS.filter((f) => topLevelKeys.has(f));
  if (contactFields.length > 0) {
    const freshest = sourceDates.length
      ? Math.min(...sourceDates.map((d) => daysSince(d)))
      : Infinity;
    if (freshest > SOURCE_MAX_AGE_DAYS) {
      fail(
        `has contact fields (${contactFields.join(', ')}) but no source accessed in the last ` +
          `${SOURCE_MAX_AGE_DAYS} days. Re-verify or remove the contact data.`,
      );
    }
  }

  if (topLevelKeys.has('geo') && !topLevelKeys.has('geo_precision')) {
    fail('has geo but no geo_precision. A pin that looks exact and is not is fabrication.');
  }

  if (reportStale && lastVerified && daysSince(lastVerified) > REVERIFY_AFTER_DAYS) {
    warnings.push(`${path}: last verified ${Math.floor(daysSince(lastVerified))} days ago — due.`);
  }
}

for (const w of warnings) console.warn(`DUE  ${w}`);
for (const e of errors) console.error(`FAIL ${e}`);

console.log(
  `\nverify-data: ${files.length} listing(s) checked, ${errors.length} error(s)` +
    (reportStale ? `, ${warnings.length} due for re-verification` : '') +
    '.',
);

process.exit(errors.length > 0 ? 1 : 0);
