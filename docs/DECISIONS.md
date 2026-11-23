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
  **Superseded 2026-11-22**, see below.
- **Actions pinned to commit SHAs**, resolved from the GitHub API rather than written from
  memory, with the tag in a trailing comment and Dependabot bumping both. — engineering
- **`verify-data.mjs` is dependency-free and independent of the Zod schema.** The schema can
  be weakened in the same PR as the data it guards; a second check cannot be. — engineering
- **Trivy `ignore-unfixed: true`.** Unpatchable HIGHs are not actionable in a PR and a gate
  people bypass is worse than no gate. They surface in logs for the monthly pass. — engineering

## 2026-11-21 (Phase 2)

- **Lease data comes from the county's ArcGIS feature service, not the PDF.** Same authority
  and the same inventory, but structured and re-runnable, so a later snapshot can be diffed.
  The PDF's text layer is positional and lossy. — engineering
- **A lease is not a business, and lease individuals are never republished.** 8 of 33 lessees
  are personal names; they are counted in the research queue and excluded from it by policy.
  — engineering, per RESEARCH_METHOD.md
- **Directory filtering is client-side over server-rendered cards, not Pagefind.** The full
  list works with JavaScript off, filtering is instant with no network round-trip, and there
  is no index to drift out of sync with the content. At tens-to-hundreds of farms this is both
  faster and simpler. Pagefind still runs in the build and indexes the site, ready to power
  full-text search over the Phase 3 guides. — engineering
- **`geo` is published only with `geo_precision`,** enforced by both the Zod schema and
  `verify-data.mjs`. A lease centroid is a point of open water and is never used as a business
  location. Consequence: `/map/` currently has no pins and says so plainly. — engineering
- **`style-src-attr 'unsafe-inline'` added for Leaflet**, which positions tiles by writing
  `style="transform:…"` onto elements. This keeps the far more dangerous `style-src` on
  `'self'`, so injected `<style>` blocks stay blocked. Drops out if the map ever does.
  — engineering
- **`vite.build.assetsInlineLimit: 0`.** Astro inlines small island scripts as
  `<script type="module">…</script>`, which `script-src 'self'` blocks. This was caught by
  inspecting the real build output, not assumed. Forcing external files keeps one strict CSP
  in `_headers` instead of per-build hashes. A CI step now asserts no inline script or style
  ever reappears. — engineering
- **`data:` dropped from img-src** — nothing we serve uses a data URI now that nothing is
  inlined. Must be revisited if the Pagefind UI bundle is ever adopted, as its CSS uses them.
  — engineering
- **Nav links only to pages that exist.** `/guides/` and `/shop/` links arrive with Phases 3
  and 4. A new CI step (`check:links`) fails the build on any internal link to a missing page.
  — engineering
- **`zod` added as a direct dependency.** Astro 7 deprecates the `z` re-export from
  `astro:content`; importing from `zod` directly clears the warnings and npm dedupes it to the
  single copy Astro already ships (4.6.7). — engineering
- **OG images via Satori + resvg, font from `@fontsource/eb-garamond`.** The font is an
  auditable npm dependency under the SIL OFL rather than a binary committed to the repo or a
  build-time download. Generated at build time, so they are plain files on the CDN.
  — engineering
- **Known moderate advisory accepted:** `satori` depends on `fflate` 0.7.x
  (GHSA-px8p-9vwx-vf98, infinite loop on malformed ZIP64). Below the `--audit-level=high`
  gate, and the code path never runs: Satori is build-time only and parses our own font and
  content, never user input. Revisit when Satori ships a patched fflate. — engineering

## 2026-11-22 (repo hardening)

- **TruffleHog scanner image pinned to `3.100.0`.** The action SHA pinned only the wrapper;
  the wrapper's default pulls `trufflehog:latest` on every run, which is the same
  supply-chain hole SHA pinning exists to close. Note the ghcr tag has no `v` prefix. Found
  because the job was failing: the action also passes `--fail` itself, so repeating it in
  `extra_args` is a hard error. — engineering
- **Branch protection applied to `main` and `develop` with admin bypass.** PR required, four
  CI checks required, linear history, no force-push or deletion. Admin bypass is the
  deliberate trade for a solo operator — gates catch ordinary mistakes without locking the
  owner out during an incident. — owner
- **Issue labels created** for the submission pipeline: `submission`, `new-listing`,
  `correction`, `removal-request`, `priority`, `needs-verification`. The Pages Function files
  against these. — engineering

## 2026-11-22 (deploy architecture)

- **Cloudflare Pages deploys via Git integration; Actions no longer deploys.** Supersedes the
  Phase 1 direct-upload decision. Removed the `deploy-staging` and `deploy-production` jobs
  and `wrangler-action` from `ci-cd.yml`, and with them the `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` repository secrets. GitHub Actions now holds **no** credentials at
  all, so there is no deploy token to scope, rotate, or have read out of a runner by a
  compromised transitive dependency during `npm ci`. — owner's decision, 2026-11-22
- **Accepted cost: Cloudflare builds on push, not on green.** It does not read GitHub check
  status, so the CI gate is no longer a hard precondition of a deploy. Mitigation: `main` and
  `develop` are protected and require a PR with all four checks passing, so the gate moves
  from the deploy boundary to the merge boundary, and the only way to deploy unchecked code is
  a deliberate admin-bypass direct push. Documented plainly in `docs/DEPLOY.md` rather than
  left as a surprise. — engineering
- **Lighthouse gate audits a local `astro preview`; a separate daily workflow audits
  production.** The first attempt triggered Lighthouse on `deployment_status`, assuming
  Cloudflare reports deployments to GitHub. **It does not** — Pages' and Workers' native Git
  integrations create _check runs and PR comments only_, no GitHub Deployment object, so the
  event never fires. Verified 2026-11-22: the repo's `/deployments` API is empty despite
  completed Cloudflare builds. Scraping the preview URL out of a check run's prose summary was
  the alternative and is too fragile to gate a release on. So the gate audits `dist/` served
  locally and therefore blocks every PR, and `lighthouse-production.yml` measures the real CDN
  daily. A gate that runs and measures slightly less beats a faithful one that never
  fires. — engineering
- **The preview server is started in its own CI step, not via Lighthouse CI's
  `startServerCommand`.** `astro preview` in Astro 7 daemonizes — the foreground process exits
  as soon as it prints the pid — so Lighthouse CI would see its child die and fail while the
  server was actually up. Confirmed locally. — engineering
- **Cloudflare project must be Pages, not a Worker.** The repo was initially connected to a
  Worker (`longislandoysterfarm`), whose builds failed. Workers Builds has no `functions/`
  file-based routing, so the Phase 2 `functions/api/submit.ts` would never have been served.
  Staying on Workers would have meant a `wrangler.jsonc` with `assets.directory`, an
  `.assetsignore`, and rewriting the Function as a Worker entrypoint with hand-rolled routing.
  Pages keeps `_headers`, `_redirects` and the Function working unchanged. — owner's decision,
  2026-11-22
- **No break-glass `wrangler pages deploy` in the runbook.** Documenting it would require
  minting a Pages:Edit token during an incident, which is when scope discipline is weakest.
  Dashboard rollback plus fix-forward covers the realistic failures. — engineering

## 2026-11-22 (Phase 3)

- **Guides carry the same sourcing burden as listings.** A guide is original writing, but the
  moment it names a temperature, a month, a regulation or a health risk it is making a factual
  claim, and "it sounds right" is how a food-safety error gets published. The `guides` schema
  therefore requires `last_verified` and at least one citation, exactly like a listing. —
  engineering
- **`health_claims: true` forces a public-health authority.** Guides declare whether they give
  food-safety guidance. If they do, a `superRefine` requires at least one `authorities` entry
  naming a body (CDC, FDA, NYS DOH, NYS DEC). `scripts/verify-data.mjs` enforces the same rule
  independently. Telling someone what is safe to eat on our own say-so is not acceptable, and
  that is now a build failure rather than a good intention. Both rules were proven to fail
  before being committed. — engineering
- **`unsourced_questions` is rendered on the page, not hidden in a TODO.** Each guide publishes
  the questions it could not answer. A gap that is written down in public does not quietly
  become a guess in a later edit, which is the actual failure mode for prose. — engineering
- **Only two of the six planned guides were published.** `raw-oysters-and-vibrio` and
  `shucking-safely` had quotable CDC/FDA text for every factual claim. The other four
  (storage, seasons/merroir, hosting, restoration) did not, and are logged with their specific
  missing facts in `data/NEEDS_VERIFICATION.md` §7 rather than written from plausible
  knowledge. The seasons/merroir guide is the highest fabrication risk on the site: per-bay
  flavour claims are repeated everywhere and attributable nowhere. — engineering
- **No email signup was built.** The brief asks for double opt-in, the provider choice is the
  owner's, and no candidate's double opt-in behaviour has been confirmed in vendor
  documentation. Wiring a provider and assuming its confirmation flow would have been the
  wrong kind of progress. — deferred to owner
- **Prose styling is hand-rolled, not `@tailwindcss/typography`.** The plugin is good, but its
  entire job here is a few dozen element rules we can read, on the only long-form page type on
  the site. One fewer dependency. — engineering
- **Guide pages use schema.org `Article`, not `HowTo`.** `HowTo` wants a machine-readable step
  list; writing one that did not match the prose would be a structured-data lie for a rich
  result we do not need. The `citation` array carries every authority, so "this page is
  sourced" is machine-checkable rather than a badge we drew. — engineering
- **`related_guides` holds plain slugs, checked at build time.** A self-referential
  `reference('guides')` cannot be declared inside the same schema object, so the slugs are
  unchecked by Zod. `assertGuideRelations()` runs on the index page and throws, which fails
  the build before the link checker would have to catch it after a full render. — engineering

## 2026-11-22 (Node version pinning)

- **`.node-version` is the single source of truth for the Node version.** Cloudflare Pages
  reads `.node-version`, and `ci-cd.yml` now reads the same file through
  `actions/setup-node`'s `node-version-file` instead of a hardcoded workflow env var. The
  previous setup had the version written in two places that nothing forced to agree — a
  workflow env of `24` and a dashboard setting a human had to remember.
  **Pages does not read `package.json` → `engines`**, so that field cannot serve this purpose
  and is advisory only. Pinned to `24.22.3` (current Node 24 LTS, "Krypton"); Astro itself
  requires `>=22.23.4`, so this is comfortably inside support. — engineering
