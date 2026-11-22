import { getCollection, type CollectionEntry } from 'astro:content';

export type Farm = CollectionEntry<'farms'>;

/** Published listings only: 'closed' and 'merged' entries keep their URL but leave the index. */
export async function getListedFarms(): Promise<Farm[]> {
  const farms = await getCollection(
    'farms',
    ({ data }) => data.status === 'active' || data.status === 'unconfirmed',
  );
  return farms.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export async function getAllFarms(): Promise<Farm[]> {
  const farms = await getCollection('farms');
  return farms.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[.,'’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Distinct, sorted values of a single-valued field, with counts. */
export function facetCounts(farms: Farm[], pick: (f: Farm) => string | undefined) {
  const counts = new Map<string, number>();
  for (const farm of farms) {
    const v = pick(farm);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, slug: slugify(value) }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/** Same, for array-valued fields. */
export function facetCountsMulti(farms: Farm[], pick: (f: Farm) => readonly string[]) {
  const counts = new Map<string, number>();
  for (const farm of farms) {
    for (const v of pick(farm)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, slug: slugify(value) }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

export interface Brand {
  name: string;
  waterbody?: string;
  farm: Farm;
}

/** Every named oyster brand, flattened to brand -> grower. */
export async function getBrands(): Promise<Brand[]> {
  const farms = await getListedFarms();
  return farms
    .flatMap((farm) =>
      farm.data.oyster_brands.map((b) => ({
        name: b.name,
        ...(b.waterbody ? { waterbody: b.waterbody } : {}),
        farm,
      })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

const DAY = 86_400_000;

/** Days since a listing was last verified. */
export const daysSinceVerified = (iso: string): number =>
  Math.floor((Date.now() - Date.parse(`${iso}T00:00:00Z`)) / DAY);

/** Listings older than this are shown with a "due for re-check" note. */
export const STALE_AFTER_DAYS = 183;

export const isStale = (iso: string): boolean => daysSinceVerified(iso) > STALE_AFTER_DAYS;

/** The shape the client-side filter island consumes. */
export interface FarmIndexRow {
  slug: string;
  name: string;
  url: string;
  type: string[];
  region: string;
  waterbody: string;
  town: string;
  hamlet: string;
  brands: string[];
  sells_direct: boolean;
  offers_tours: boolean;
  ships: boolean;
  sells_wholesale: boolean;
  csa: boolean;
  last_verified: string;
  /** Lowercased haystack for the text query. */
  text: string;
}

export function toIndexRow(farm: Farm): FarmIndexRow {
  const d = farm.data;
  const brands = d.oyster_brands.map((b) => b.name);
  return {
    slug: farm.id,
    name: d.name,
    url: `/farms/${farm.id}/`,
    type: [...d.type],
    region: d.region ?? '',
    waterbody: d.waterbody ?? '',
    town: d.town ?? '',
    hamlet: d.hamlet ?? '',
    brands,
    sells_direct: d.sells_direct === true,
    offers_tours: d.offers_tours === true,
    ships: d.ships === true,
    sells_wholesale: d.sells_wholesale === true,
    csa: d.csa_or_subscription === true,
    last_verified: String(d.last_verified),
    text: [d.name, ...brands, d.waterbody, d.town, d.hamlet, d.region, ...d.type, d.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}
