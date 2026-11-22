# Content collections

- `farms/` — one YAML file per listing. Schema lands in Phase 2; `src/content.config.ts`
  will enforce it with Zod, and `scripts/verify-data.mjs` enforces the source and
  `last_verified` rules independently (belt and braces: the Zod schema can be edited in the
  same PR as the data, the standalone gate is harder to weaken by accident).
- `guides/` — MDX content hub (Phase 3).
- `products/` — product copy and SEO only. Price and inventory live at the commerce
  provider, never in the repo (Phase 4).

Nothing is published here until it has a cited source and a verification date.
