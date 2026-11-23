import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOgImage, type OgOptions } from '../../lib/og';
import { getAllFarms, getBrands, slugify } from '../../lib/farms';
import { getPublishedGuides } from '../../lib/guides';

/**
 * One PNG per page that needs a social card, generated at build time.
 * Static output means these are plain files on the CDN — no runtime renderer.
 */
export const getStaticPaths = (async () => {
  const farms = await getAllFarms();
  const brands = await getBrands();
  const guides = await getPublishedGuides();

  const paths: { params: { route: string }; props: OgOptions }[] = [
    {
      params: { route: 'site' },
      props: {
        title: 'Every Long Island oyster farm, in one honest index',
        subtitle: 'Hatcheries, farms and growers — each listing cited and dated',
      },
    },
    {
      params: { route: 'farms' },
      props: {
        eyebrow: 'Directory',
        title: 'Long Island oyster farms',
        subtitle: `${farms.length} verified listing${farms.length === 1 ? '' : 's'}`,
      },
    },
    {
      params: { route: 'oysters' },
      props: {
        eyebrow: 'Index',
        title: 'Named Long Island oysters',
        subtitle: 'The name on the menu, mapped to the grower',
      },
    },
    {
      params: { route: 'map' },
      props: {
        eyebrow: 'Map',
        title: 'Where the oysters grow',
        subtitle: 'Verified locations only',
      },
    },
    {
      params: { route: 'guides' },
      props: {
        eyebrow: 'Guides',
        title: 'Buying, keeping and opening oysters',
        subtitle: 'Every factual claim cited to its source',
      },
    },
  ];

  for (const guide of guides) {
    paths.push({
      params: { route: `guides/${guide.id}` },
      props: {
        eyebrow: guide.data.health_claims ? 'Guide · food safety' : 'Guide',
        title: guide.data.title,
        subtitle: `Checked ${guide.data.last_verified}`,
      },
    });
  }

  for (const farm of farms) {
    paths.push({
      params: { route: `farms/${farm.id}` },
      props: {
        eyebrow: farm.data.type.includes('hatchery') ? 'Hatchery' : 'Oyster farm',
        title: farm.data.name,
        subtitle: [farm.data.hamlet || farm.data.town, farm.data.waterbody]
          .filter(Boolean)
          .join(' · '),
      },
    });
  }

  const seen = new Set<string>();
  for (const brand of brands) {
    const slug = slugify(brand.name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    paths.push({
      params: { route: `oysters/${slug}` },
      props: {
        eyebrow: 'Oyster',
        title: brand.name,
        subtitle: [brand.farm.data.name, brand.waterbody].filter(Boolean).join(' · '),
      },
    });
  }

  return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage(props as OgOptions);
  return new Response(png as unknown as BodyInit, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' },
  });
};
