#!/usr/bin/env node
/**
 * Pull the Suffolk County Aquaculture Lease Program lease inventory from the
 * county's own ArcGIS feature service and write a dated snapshot.
 *
 * Why the feature service and not the PDF: the county publishes the same
 * inventory as a PDF (`Inventory of Leases.pdf`), but the PDF's text layer is
 * positional and lossy to parse, while this service is the structured source
 * behind the county's public ALP lease mapper. Same authority, machine
 * readable, and re-runnable so a later snapshot can be diffed against this one.
 *
 * This writes RESEARCH INPUT, not listings. Nothing here is published until a
 * human verifies the business is a public, self-publishing business and writes
 * a listing with its own sources.
 *
 *   node scripts/research/fetch-suffolk-leases.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const SERVICE =
  'https://gis.suffolkcountyny.gov/server/rest/services/PlanningSQLData/Live10AcreLeaseSitePolygon/FeatureServer/0';
const SOURCE_PAGE =
  'https://suffolkcountyny.gov/Departments/Economic-Development-and-Planning/Planning-and-Environment/Environmental-Planning-and-Aquaculture/Aquaculture-Lease-Program/Inventory-of-Current-Leases';
const OUT_DIR = 'data/raw';

/** Lease statuses that mean someone actually holds the site. */
const HELD = new Set(['Leased', 'Pending']);

const query = new URLSearchParams({
  where: '1=1',
  outFields: 'LEASEID,LEASESTATUS,LESSEE,LEASETERM,centrlat,centrlong,LASTUPDATE',
  returnGeometry: 'false',
  resultRecordCount: '5000',
  f: 'json',
});

const res = await fetch(`${SERVICE}/query?${query}`, {
  headers: { accept: 'application/json' },
});
if (!res.ok) {
  console.error(`Feature service returned ${res.status} ${res.statusText}`);
  process.exit(1);
}

const body = await res.json();
if (body.error) {
  console.error('Feature service error:', body.error);
  process.exit(1);
}

const features = body.features ?? [];
if (features.length === 0) {
  console.error('No features returned. Refusing to overwrite the snapshot with nothing.');
  process.exit(1);
}

const held = features
  .map((f) => f.attributes)
  .filter((a) => HELD.has(a.LEASESTATUS) && a.LESSEE && a.LESSEE !== 'Not Leased')
  .map((a) => ({
    lease_id: a.LEASEID ?? null,
    lessee: a.LESSEE.trim(),
    status: a.LEASESTATUS,
    term: a.LEASETERM ?? null,
    lat: a.centrlat ?? null,
    lng: a.centrlong ?? null,
    last_update: a.LASTUPDATE ? new Date(a.LASTUPDATE).toISOString().slice(0, 10) : null,
  }))
  .sort(
    (a, b) =>
      a.lessee.localeCompare(b.lessee) || String(a.lease_id).localeCompare(String(b.lease_id)),
  );

const snapshot = {
  retrieved: new Date().toISOString().slice(0, 10),
  source: {
    name: 'Suffolk County Shellfish Aquaculture Lease Program — live 10-acre lease sites',
    service: SERVICE,
    page: SOURCE_PAGE,
  },
  caveats: [
    'The ALP covers Peconic and Gardiners Bay system lease sites only. South Shore growers (Great South Bay, Moriches, Shinnecock) and growers on private oyster grants or town permits are NOT in this dataset, so absence here is not evidence a farm does not exist.',
    'A lease is not a business. Lessees include private individuals; those are not listings and their names are not published unless the business itself publishes them.',
    'Lessee names are the legal entity on the lease and are often not the brand the farm sells under.',
    'Lease centroid coordinates describe a water lease site, not a business address or a place the public can visit.',
  ],
  total_sites_in_service: features.length,
  held_sites: held.length,
  distinct_lessees: new Set(held.map((h) => h.lessee)).size,
  leases: held,
};

mkdirSync(OUT_DIR, { recursive: true });
const out = `${OUT_DIR}/suffolk-alp-leases.json`;
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(
  `Wrote ${out}: ${snapshot.held_sites} held lease sites, ` +
    `${snapshot.distinct_lessees} distinct lessees, of ${snapshot.total_sites_in_service} sites total.`,
);
