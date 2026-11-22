#!/usr/bin/env node
/**
 * Export published listings to data/farms.csv for review in a spreadsheet.
 * Pairs with csv-to-yaml.mjs; the round-trip is lossless for every field the
 * CSV carries. `leases` and `merged_into` are intentionally YAML-only — they
 * are structured records, not things to edit in a cell.
 *
 *   node scripts/research/yaml-to-csv.mjs
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { CSV_HEADERS, toCsv, joinList, formatSources, boolToCsv } from './lib/csv.mjs';

const FARMS = 'src/content/farms';
const OUT = 'data/farms.csv';

if (!existsSync(FARMS)) {
  console.error(`No ${FARMS} directory.`);
  process.exit(1);
}

const files = readdirSync(FARMS).filter((f) => f.endsWith('.yaml'));
const rows = files
  .map((file) => {
    const f = YAML.parse(readFileSync(join(FARMS, file), 'utf8'));
    const date = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? ''));
    return {
      slug: file.replace(/\.yaml$/, ''),
      name: f.name ?? '',
      type: joinList(f.type),
      // name|waterbody per brand; brand citations live in the YAML.
      oyster_brands: (f.oyster_brands ?? [])
        .map((b) => [b.name, b.waterbody].filter(Boolean).join('|'))
        .join('; '),
      species: joinList(f.species),
      other_species: joinList(f.other_species),
      waterbody: f.waterbody ?? '',
      town: f.town ?? '',
      hamlet: f.hamlet ?? '',
      region: f.region ?? '',
      lat: f.geo?.lat ?? '',
      lng: f.geo?.lng ?? '',
      geo_precision: f.geo_precision ?? '',
      address: f.address ?? '',
      website: f.website ?? '',
      phone: f.phone ?? '',
      email: f.email ?? '',
      instagram: f.instagram ?? '',
      facebook: f.facebook ?? '',
      sells_direct: boolToCsv(f.sells_direct),
      sells_wholesale: boolToCsv(f.sells_wholesale),
      offers_tours: boolToCsv(f.offers_tours),
      ships: boolToCsv(f.ships),
      csa_or_subscription: boolToCsv(f.csa_or_subscription),
      seasonality: f.seasonality ?? '',
      farming_method: joinList(f.farming_method),
      restoration_partner: boolToCsv(f.restoration_partner),
      description: (f.description ?? '').replace(/\s+/g, ' ').trim(),
      sources: formatSources(f.sources),
      last_verified: date(f.last_verified),
      status: f.status ?? 'active',
      claimed: boolToCsv(f.claimed ?? false),
      featured: boolToCsv(f.featured ?? false),
      verification_notes: (f.verification_notes ?? '').replace(/\s+/g, ' ').trim(),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

mkdirSync('data', { recursive: true });
writeFileSync(OUT, toCsv(CSV_HEADERS, rows));
console.log(`Wrote ${OUT}: ${rows.length} listing(s).`);
