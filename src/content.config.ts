import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro 7 deprecates the `z` re-export from astro:content; import Zod directly.
// Pinned to the same major Astro itself depends on, so npm dedupes to one copy.
import { z } from 'zod';

/**
 * The directory schema.
 *
 * Two rules are structural, not stylistic:
 *   1. `sources` has a minimum length of 1. A listing without a citation
 *      cannot be built.
 *   2. `last_verified` is required. A fact with no date is a rumour.
 *
 * Anything that cannot be verified is OMITTED, never guessed. An absent field
 * renders as "Not listed" and the open question goes in
 * data/NEEDS_VERIFICATION.md. `scripts/verify-data.mjs` enforces the same
 * invariants independently of this file.
 */

/**
 * A YYYY-MM-DD date.
 *
 * YAML parses a bare `2026-11-21` into a Date, and a quoted one into a string.
 * Rather than depend on every author remembering the quotes, normalise both to
 * the string form — the canonical form on disk stays readable in a diff.
 */
const isoDate = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: 'Use YYYY-MM-DD so YAML diffs stay readable.',
  }),
);

/** One citation. A bare URL rots; a label and an access date do not. */
const source = z.object({
  url: z.url(),
  /** Human-readable citation, e.g. "Peconic Gold Oysters — official site". */
  label: z.string().min(3),
  /** When we actually looked at it. */
  accessed: isoDate,
});

const farmType = z.enum([
  'hatchery',
  'farm',
  'grower',
  'nursery/upweller',
  'community program',
  'retail/raw bar',
]);

const region = z.enum([
  'South Shore',
  'North Shore',
  'North Fork',
  'South Fork',
  'Peconic',
  'Western LI',
]);

/**
 * Honest precision beats a pin that looks exact and is not.
 * - exact:          a public street address or a location the business publishes
 * - approximate:    the right hamlet or dock, not a surveyed point
 * - waterbody_only: we know the bay and nothing finer; do not place a pin
 */
const geoPrecision = z.enum(['exact', 'approximate', 'waterbody_only']);

const farms = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/farms' }),
  schema: z
    .object({
      name: z.string().min(2),
      type: z.array(farmType).min(1),

      /**
       * Named oysters as marketed. Each brand carries its own citations
       * because /oysters/ is built from these and a brand claim is a claim.
       */
      oyster_brands: z
        .array(
          z.object({
            name: z.string().min(2),
            waterbody: z.string().optional(),
            sources: z.array(source).min(1),
          }),
        )
        .default([]),

      species: z.array(z.string()).default(['Crassostrea virginica']),
      other_species: z.array(z.string()).default([]),

      waterbody: z.string().optional(),
      /** Town of Islip, Brookhaven, Southold... Omitted when unverified. */
      town: z.string().optional(),
      hamlet: z.string().optional(),
      region: region.optional(),

      geo: z
        .object({ lat: z.number().min(40).max(41.3), lng: z.number().min(-74).max(-71.8) })
        .optional(),
      geo_precision: geoPrecision.optional(),

      /** Only when the business publishes it. Never a private residence. */
      address: z.string().optional(),
      website: z.url().optional(),
      phone: z.string().optional(),
      email: z.email().optional(),
      instagram: z.string().optional(),
      facebook: z.string().optional(),

      sells_direct: z.boolean().optional(),
      sells_wholesale: z.boolean().optional(),
      offers_tours: z.boolean().optional(),
      ships: z.boolean().optional(),
      csa_or_subscription: z.boolean().optional(),

      seasonality: z.string().optional(),
      farming_method: z.array(z.string()).default([]),
      restoration_partner: z.boolean().optional(),

      /** Our own writing. Never copied from the farm's site. */
      description: z.string().min(40),

      /** Lease records from the Suffolk County ALP, where they apply. */
      leases: z
        .array(
          z.object({
            lease_id: z.string(),
            lessee: z.string(),
            status: z.string(),
            term: z.string().optional(),
            source: source,
          }),
        )
        .default([]),

      status: z.enum(['active', 'unconfirmed', 'closed', 'merged']).default('active'),
      /** Set when status is 'merged'. */
      merged_into: reference('farms').optional(),

      sources: z.array(source).min(1, { error: 'Every listing needs at least one source.' }),
      last_verified: isoDate,

      /** Working notes for the next verification pass. Not rendered. */
      verification_notes: z.string().optional(),

      claimed: z.boolean().default(false),
      featured: z.boolean().default(false),
    })
    .strict()
    .superRefine((farm, ctx) => {
      if (farm.geo && !farm.geo_precision) {
        ctx.addIssue({
          code: 'custom',
          path: ['geo_precision'],
          message:
            'geo requires geo_precision. An exact-looking pin that is a guess is fabrication.',
        });
      }
      if (String(farm.last_verified) > new Date().toISOString().slice(0, 10)) {
        ctx.addIssue({
          code: 'custom',
          path: ['last_verified'],
          message: 'last_verified is in the future.',
        });
      }
    }),
});

/**
 * The guides collection.
 *
 * The no-fabrication rule is usually discussed in terms of listings, but prose
 * is where it is easiest to break. A guide is original writing, yet the moment
 * it states a temperature, a month, a regulation or a health risk it is making
 * a factual claim, and "it sounds right" is how a food-safety error gets
 * published. So guides carry the same `sources` and `last_verified` burden a
 * listing does.
 *
 * Two fields exist specifically to keep us honest about what we have not
 * sourced:
 *   - `health_claims`: set it when the guide gives food-safety or medical
 *     guidance. A superRefine then requires `authorities`, so such a guide
 *     cannot be published citing only a blog.
 *   - `unsourced_questions`: the things this guide deliberately does NOT
 *     answer, rendered on the page. Saying "we don't know yet" in public is
 *     cheaper than being wrong, and it stops a gap quietly becoming a guess
 *     in a later edit.
 */
const guides = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/guides' }),
  schema: z
    .object({
      title: z.string().min(8),
      /** One sentence. Used for <meta description> and the index card. */
      summary: z.string().min(40).max(300),

      /**
       * Ordering on /guides/. Explicit so the index is editorial rather than
       * alphabetical-by-accident.
       */
      order: z.number().int().min(0),

      published: isoDate,
      last_verified: isoDate,

      /**
       * Does this guide give food-safety or health guidance? If so the
       * superRefine below requires at least one `authorities` entry.
       */
      health_claims: z.boolean().default(false),

      /**
       * Citations to a government or public-health body specifically. Kept
       * separate from `sources` so the distinction is enforceable: a guide
       * that tells someone what is safe to eat must point at an authority,
       * not at us.
       */
      authorities: z
        .array(
          source.extend({
            /** e.g. "CDC", "FDA", "NYS DOH", "NYS DEC". */
            body: z.string().min(2),
          }),
        )
        .default([]),

      sources: z.array(source).default([]),

      /** Rendered on the page. See the note above. */
      unsourced_questions: z.array(z.string().min(10)).default([]),

      /** Related directory entries, if any. Validated against the collection. */
      related_farms: z.array(reference('farms')).default([]),

      /** Other guides worth reading next. Slugs, checked by check:links. */
      related_guides: z.array(z.string()).default([]),

      /** Suppresses the page from /guides/ and from the sitemap. */
      draft: z.boolean().default(false),
    })
    .strict()
    .superRefine((guide, ctx) => {
      const today = new Date().toISOString().slice(0, 10);
      if (String(guide.last_verified) > today) {
        ctx.addIssue({
          code: 'custom',
          path: ['last_verified'],
          message: 'last_verified is in the future.',
        });
      }
      if (String(guide.published) > today) {
        ctx.addIssue({
          code: 'custom',
          path: ['published'],
          message: 'published is in the future.',
        });
      }
      if (guide.health_claims && guide.authorities.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['authorities'],
          message:
            'A guide with health_claims must cite at least one public-health authority. ' +
            'Telling someone what is safe to eat on our own say-so is not acceptable.',
        });
      }
      if (!guide.health_claims && guide.sources.length === 0 && guide.authorities.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources'],
          message: 'A guide needs at least one source or authority.',
        });
      }
    }),
});

export const collections = { farms, guides };
