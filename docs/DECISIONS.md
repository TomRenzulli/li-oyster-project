# Decisions log

Format: date — decision — why — who decided.

## 2026-11-21

- **Astro + TS strict, static output, Cloudflare Pages.** Owner-specified constraint. — owner
- **Repo created public as `li-oyster-project`.** Site is public-facing; rename to match the
  domain is open question #11. — owner
- **Phase 0 plan proposes affiliate-first commerce over day-one Shopify.** $0 fixed cost,
  tighter CSP, and provider is swappable because product copy lives in the repo. Pending
  approval. — proposed, not decided
- **Schema additions proposed:** structured `sources[]`, `status`, `geo_precision`,
  `verification_notes`, structured `oyster_brands[]`. Pending approval. — proposed
- **No user accounts, reviews, or farm-facing CMS.** Attack surface and moderation load
  unjustifiable for a solo operator. — proposed

## 2026-11-21 (Phase 1)

- **Commerce: affiliate-first approved.** Pans/trays via disclosed affiliate links; stickers
  and patches as our own SKUs via Stripe Checkout. Shopify revisited if merch clears ~$300/mo.
  — owner
- **Listings publish opt-out.** Verified listings go live without waiting for the farm to
  confirm, with a prominent correction path and same-day removal on request. Opt-in would take
  a year to produce a useful directory. — owner
- **Astro 7 + Tailwind v4 + TS strict.** Tailwind v4 via `@tailwindcss/vite`, brand tokens in
  an `@theme` block in `src/styles/global.css`. — engineering
- **No third-party font or script hosts.** Fonts are system serif/sans stacks. Keeps the CSP
  to `'self'`, removes a render-blocking request and a privacy leak. Revisit only if a
  commissioned display face is worth a self-hosted woff2. — engineering
- **`inlineStylesheets: 'never'`.** Astro inlines small stylesheets by default, which would
  force `style-src 'unsafe-inline'`. One cached CSS file is the better trade. — engineering
- **CSP starts at `default-src 'none'`** and gains origins only in the PR of the feature that
  needs them. Future additions (OSM tiles, Turnstile, Stripe, CF analytics) are listed as
  comments in `public/_headers` but not granted. — engineering
- **Pages project uses direct upload, not Cloudflare's Git integration.** A Git-connected
  Pages project builds and deploys on push, bypassing every CI gate. — engineering
- **Actions pinned to commit SHAs**, resolved from the GitHub API rather than written from
  memory, with the tag in a trailing comment and Dependabot bumping both. — engineering
- **`verify-data.mjs` is dependency-free and independent of the Zod schema.** The schema can
  be weakened in the same PR as the data it guards; a second check cannot be. — engineering
- **Trivy `ignore-unfixed: true`.** Unpatchable HIGHs are not actionable in a PR and a gate
  people bypass is worse than no gate. They surface in logs for the monthly pass. — engineering
