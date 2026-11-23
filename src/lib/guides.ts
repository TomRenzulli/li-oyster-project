import { getCollection, type CollectionEntry } from 'astro:content';

export type Guide = CollectionEntry<'guides'>;

/**
 * Guides fit to publish, in editorial order.
 *
 * Drafts are excluded here rather than filtered at each call site, so a draft
 * cannot leak onto an index, the sitemap or a "related" list by someone
 * forgetting the filter.
 */
export async function getPublishedGuides(): Promise<Guide[]> {
  const guides = await getCollection('guides', ({ data }) => !data.draft);
  return guides.sort((a, b) => a.data.order - b.data.order);
}

/** Every guide, drafts included. For build-time checks only. */
export async function getAllGuides(): Promise<Guide[]> {
  return getCollection('guides');
}

/**
 * How many days since a guide's facts were last checked against its sources.
 * Shared with the directory's staleness rule so the site has one definition.
 */
export { STALE_AFTER_DAYS, daysSinceVerified, isStale } from './farms';

/**
 * Resolve `related_guides` slugs to entries, dropping any that are missing or
 * draft. A broken relation is a content bug, so it is reported rather than
 * silently skipped — see `assertGuideRelations`.
 */
export async function resolveRelated(guide: Guide): Promise<Guide[]> {
  const published = await getPublishedGuides();
  const byId = new Map(published.map((g) => [g.id, g]));
  return guide.data.related_guides
    .map((slug) => byId.get(slug))
    .filter((g): g is Guide => g !== undefined);
}

/**
 * Fails the build if a guide points at a related guide that does not exist.
 *
 * `related_guides` holds plain strings rather than `reference('guides')`
 * because a self-referential collection reference cannot be declared in the
 * same schema object. That trade means the slugs are unchecked by Zod, so they
 * are checked here instead, at build time, rather than becoming a dead link
 * that only the link checker catches after a full render.
 */
export async function assertGuideRelations(): Promise<void> {
  const all = await getAllGuides();
  const ids = new Set(all.map((g) => g.id));
  const problems: string[] = [];

  for (const guide of all) {
    for (const slug of guide.data.related_guides) {
      if (!ids.has(slug)) {
        problems.push(`${guide.id}: related_guides -> "${slug}" does not exist`);
      }
      if (slug === guide.id) {
        problems.push(`${guide.id}: related_guides lists itself`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Broken guide relations:\n  ${problems.join('\n  ')}`);
  }
}
