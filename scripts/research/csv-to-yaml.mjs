#!/usr/bin/env node
/**
 * Convert approved rows in data/farms.csv into listing YAML files.
 *
 * Refuses to write a row that lacks a source or last_verified, and refuses to
 * write a `lat`/`lng` without a `geo_precision` — the same invariants the Zod
 * schema and verify-data.mjs enforce, checked here so a bad row never reaches
 * the content directory in the first place.
 *
 *   node scripts/research/csv-to-yaml.mjs            # dry run, reports only
 *   node scripts/research/csv-to-yaml.mjs --write    # write the files
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { parseCsv, parseSources, splitList, csvToBool } from './lib/csv.mjs';

const IN = 'data/farms.csv';
const FARMS = 'src/content/farms';
const write = process.argv.includes('--write');

if (!existsSync(IN)) {
  console.error(`No ${IN}. Run yaml-to-csv.mjs first, or create it from data/farm-leads.csv.`);
  process.exit(1);
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[.,'’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const rows = parseCsv(readFileSync(IN, 'utf8'));
const errors = [];
const written = [];

/** Preserve YAML-only fields (leases, merged_into) that the CSV cannot carry. */
const existingYaml = (slug) => {
  const p = join(FARMS, `${slug}.yaml`);
  return existsSync(p) ? YAML.parse(readFileSync(p, 'utf8')) : null;
};

for (const [i, row] of rows.entries()) {
  const where = `${IN} row ${i + 2} (${row.name || row.slug || 'unnamed'})`;
  const slug = row.slug || slugify(row.name);
  try {
    if (!row.name) throw new Error('name is required.');
    if (!slug) throw new Error('could not derive a slug.');

    const sources = parseSources(row.sources);
    if (sources.length === 0) {
      throw new Error('no sources. A listing without a citation cannot be published.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.last_verified)) {
      throw new Error('last_verified must be YYYY-MM-DD.');
    }

    const hasLat = row.lat !== '';
    const hasLng = row.lng !== '';
    if (hasLat !== hasLng) throw new Error('lat and lng must both be set, or both empty.');
    if (hasLat && !row.geo_precision) {
      throw new Error('lat/lng given without geo_precision.');
    }

    const brands = splitList(row.oyster_brands).map((chunk) => {
      const [name, waterbody] = chunk.split('|').map((s) => (s ?? '').trim());
      if (!name) throw new Error(`malformed oyster_brands entry "${chunk}".`);
      // Brand citations default to the listing's sources; refine in the YAML.
      return { name, ...(waterbody ? { waterbody } : {}), sources };
    });

    const prev = existingYaml(slug);
    const set = (v) => (v === '' || v === undefined ? undefined : v);
    const doc = {
      name: row.name,
      type: splitList(row.type).length ? splitList(row.type) : ['farm'],
      ...(brands.length ? { oyster_brands: brands } : {}),
      species: splitList(row.species).length ? splitList(row.species) : ['Crassostrea virginica'],
      ...(splitList(row.other_species).length
        ? { other_species: splitList(row.other_species) }
        : {}),
      waterbody: set(row.waterbody),
      town: set(row.town),
      hamlet: set(row.hamlet),
      region: set(row.region),
      ...(hasLat ? { geo: { lat: Number(row.lat), lng: Number(row.lng) } } : {}),
      geo_precision: set(row.geo_precision),
      address: set(row.address),
      website: set(row.website),
      phone: set(row.phone),
      email: set(row.email),
      instagram: set(row.instagram),
      facebook: set(row.facebook),
      sells_direct: csvToBool(row.sells_direct),
      sells_wholesale: csvToBool(row.sells_wholesale),
      offers_tours: csvToBool(row.offers_tours),
      ships: csvToBool(row.ships),
      csa_or_subscription: csvToBool(row.csa_or_subscription),
      seasonality: set(row.seasonality),
      ...(splitList(row.farming_method).length
        ? { farming_method: splitList(row.farming_method) }
        : {}),
      restoration_partner: csvToBool(row.restoration_partner),
      description: row.description,
      ...(prev?.leases ? { leases: prev.leases } : {}),
      status: row.status || 'active',
      ...(prev?.merged_into ? { merged_into: prev.merged_into } : {}),
      sources,
      last_verified: row.last_verified,
      verification_notes: set(row.verification_notes),
      claimed: csvToBool(row.claimed) ?? false,
      featured: csvToBool(row.featured) ?? false,
    };

    for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];

    if ((doc.description ?? '').length < 40) {
      throw new Error('description must be at least 40 characters of our own writing.');
    }

    if (write) {
      mkdirSync(FARMS, { recursive: true });
      writeFileSync(
        join(FARMS, `${slug}.yaml`),
        YAML.stringify(doc, { lineWidth: 88, defaultStringType: 'PLAIN', singleQuote: false }),
      );
    }
    written.push(slug);
  } catch (e) {
    errors.push(`${where}: ${e.message}`);
  }
}

for (const e of errors) console.error(`FAIL ${e}`);

const existing = existsSync(FARMS)
  ? readdirSync(FARMS)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => f.replace(/\.yaml$/, ''))
  : [];
const orphans = existing.filter((s) => !written.includes(s));
if (orphans.length) {
  console.warn(
    `\nNote: ${orphans.length} listing(s) exist in ${FARMS} but not in the CSV ` +
      `(${orphans.join(', ')}). They were left untouched — this script never deletes.`,
  );
}

console.log(
  `\n${write ? 'Wrote' : 'Would write'} ${written.length} listing(s); ${errors.length} error(s).` +
    (write ? '' : ' Re-run with --write to apply.'),
);
process.exit(errors.length ? 1 : 0);
