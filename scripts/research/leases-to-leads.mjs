#!/usr/bin/env node
/**
 * Turn the Suffolk County ALP lease snapshot into a research queue.
 *
 * A lease is a property record, not a business. This script does NOT create
 * listings. It produces data/farm-leads.csv: one row per distinct lessee, each
 * needing a human to decide whether a public, self-publishing business exists
 * behind the name.
 *
 * Lessees that look like a private individual are flagged `likely_individual`
 * and are NOT research targets — their names are never republished. They are
 * counted so the queue is honest about what it skipped.
 *
 *   node scripts/research/leases-to-leads.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SNAPSHOT = 'data/raw/suffolk-alp-leases.json';
const OUT = 'data/farm-leads.csv';

if (!existsSync(SNAPSHOT)) {
  console.error(`Missing ${SNAPSHOT}. Run scripts/research/fetch-suffolk-leases.mjs first.`);
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));

/** Entity suffixes that mark a registered business rather than a person. */
const ENTITY =
  /\b(LLC|L\.L\.C|Inc|Incorporated|Corp|Corporation|Co|Company|LP|LLP|Ltd|Farms?|Fisheries|Shellfish|Oysters?|Aquaculture|Mariculture|Seafood)\b/i;

const byLessee = new Map();
for (const lease of snapshot.leases) {
  const entry = byLessee.get(lease.lessee) ?? { lessee: lease.lessee, leases: [] };
  entry.leases.push(lease);
  byLessee.set(lease.lessee, entry);
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[.,'’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const rows = [...byLessee.values()]
  .map((e) => {
    const likelyIndividual = !ENTITY.test(e.lessee);
    return {
      lessee: e.lessee,
      likely_individual: likelyIndividual ? 'yes' : 'no',
      research: likelyIndividual ? 'skip — personal name, not republished' : 'pending',
      suggested_slug: likelyIndividual ? '' : slugify(e.lessee),
      lease_count: e.leases.length,
      lease_ids: e.leases.map((l) => l.lease_id).join('; '),
      statuses: [...new Set(e.leases.map((l) => l.status))].join('; '),
      terms: [...new Set(e.leases.map((l) => l.term).filter(Boolean))].join('; '),
      source_page: snapshot.source.page,
      snapshot_date: snapshot.retrieved,
    };
  })
  .sort(
    (a, b) =>
      a.likely_individual.localeCompare(b.likely_individual) || a.lessee.localeCompare(b.lessee),
  );

const headers = Object.keys(rows[0]);
const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
writeFileSync(
  OUT,
  [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n') +
    '\n',
);

const individuals = rows.filter((r) => r.likely_individual === 'yes').length;
console.log(
  `Wrote ${OUT}: ${rows.length} distinct lessees — ` +
    `${rows.length - individuals} business entities to research, ` +
    `${individuals} personal names skipped by policy.`,
);
console.log(
  'Reminder: the ALP covers Peconic/Gardiners lease sites only. South Shore growers, ' +
    'private oyster grants, hatcheries and nurseries are not in this queue.',
);
