/**
 * Region landing-page prose, written by hand, one per region.
 *
 * These describe geography and public leasing arrangements — matters of public
 * record — and deliberately make no claim about any individual farm.
 * Programmatic pages still get original writing.
 *
 * Lives in its own module because Astro extracts `getStaticPaths` into a
 * separate build chunk, where it cannot close over a page's frontmatter consts.
 */
export const REGIONS = [
  'South Shore',
  'North Shore',
  'North Fork',
  'South Fork',
  'Peconic',
  'Western LI',
] as const;

export type Region = (typeof REGIONS)[number];

export const REGION_INTROS: Record<Region, string> = {
  'South Shore':
    'The South Shore faces the Atlantic from behind a barrier-island chain, and its oysters grow in the shallow, wind-driven lagoons behind it — the Great South Bay above all, along with Moriches and Shinnecock. Growers here generally work bay bottom leased from their town rather than from the county, which is why South Shore farms turn up in town records rather than in the county lease program.',
  'North Shore':
    'The North Shore drops into Long Island Sound through a series of deep, narrow harbours — cooler, saltier and more sheltered than the South Shore lagoons. Oyster grounds sit inside harbour mouths and coves, and a great deal of Long Island Sound shellfish history runs through this coast.',
  'North Fork':
    'The North Fork runs northeast between Long Island Sound and the Peconic system, and it holds the densest concentration of oyster farming on Long Island. Growers work Southold Bay, Cutchogue Harbor, Orient Harbor and Little and Great Peconic Bay, mostly on ten-acre sites leased through the Suffolk County Shellfish Aquaculture Lease Program.',
  'South Fork':
    'The South Fork reaches east to Montauk between the open Atlantic and the Peconic and Gardiners bay systems. Oyster grounds here include Napeague Bay, Northwest Harbor and the waters around Gardiners Island, and lease sites are administered through the county program.',
  Peconic:
    'The Peconic system is the sheltered estuary between Long Island’s two forks — Flanders Bay at its head, opening east through Great and Little Peconic Bay toward Gardiners Bay and the Atlantic. It is the heart of the county lease program and of modern Long Island oyster growing.',
  'Western LI':
    'Western Long Island covers the Nassau shoreline and the harbours closest to New York City, including the Oyster Bay and Cold Spring Harbor grounds that made Long Island oysters famous in the nineteenth century.',
};
