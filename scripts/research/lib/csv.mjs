/** Minimal, correct RFC4180-ish CSV read/write. Shared by the research scripts. */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers = [], ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  return body.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h.trim(), (r[i] ?? '').trim()])),
  );
}

export function toCsv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n') +
    '\n'
  );
}

/** Lists are `a; b; c`. Sources are `url|label|accessed ;; url|label|accessed`. */
export const SEP = ';';
export const SRC_SEP = ';;';

export const splitList = (v) =>
  (v ?? '')
    .split(SEP)
    .map((s) => s.trim())
    .filter(Boolean);

export const joinList = (a) => (a ?? []).join('; ');

export function parseSources(v, { field = 'sources' } = {}) {
  return (v ?? '')
    .split(SRC_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [url, label, accessed] = chunk.split('|').map((s) => (s ?? '').trim());
      if (!url || !label || !accessed) {
        throw new Error(
          `${field}: each source must be "url|label|YYYY-MM-DD", got "${chunk}". ` +
            'A citation without a label and an access date is not a citation.',
        );
      }
      return { url, label, accessed };
    });
}

export const formatSources = (sources) =>
  (sources ?? []).map((s) => `${s.url}|${s.label}|${s.accessed}`).join(' ;; ');

export const boolToCsv = (v) => (v === true ? 'yes' : v === false ? 'no' : '');

export function csvToBool(v) {
  const s = (v ?? '').trim().toLowerCase();
  if (['yes', 'true', 'y', '1'].includes(s)) return true;
  if (['no', 'false', 'n', '0'].includes(s)) return false;
  return undefined; // empty means "unverified", which is not the same as false
}

/** Field order shared by both converters, so the round-trip is stable. */
export const CSV_HEADERS = [
  'slug',
  'name',
  'type',
  'oyster_brands',
  'species',
  'other_species',
  'waterbody',
  'town',
  'hamlet',
  'region',
  'lat',
  'lng',
  'geo_precision',
  'address',
  'website',
  'phone',
  'email',
  'instagram',
  'facebook',
  'sells_direct',
  'sells_wholesale',
  'offers_tours',
  'ships',
  'csa_or_subscription',
  'seasonality',
  'farming_method',
  'restoration_partner',
  'description',
  'sources',
  'last_verified',
  'status',
  'claimed',
  'featured',
  'verification_notes',
];
