# Development

## Requirements

- Node 24+ (`engines` enforces it; CI uses 24)
- npm (lockfile is committed; always `npm ci`, never `npm install`, in CI)

## Setup

```bash
npm ci          # also installs the Husky pre-commit hook via `prepare`
cp .env.example .env
npm run dev
```

`.env` is gitignored and must never be committed. Production values live in Cloudflare Pages
environment variables and GitHub Actions secrets.

## Everything CI will check, locally

```bash
npm run check
```

That is `lint` + `format:check` + `typecheck` + `verify:data`. Run it before you push and the
pipeline holds no surprises.

## Pre-commit hook

Husky + lint-staged run on every commit: ESLint `--fix` and Prettier on staged files, then
`npm run verify:data`, then `npm audit --audit-level=high`. A failure blocks the commit. If
you genuinely need to bypass it, `git commit --no-verify` — and expect CI to catch you.

## Conventions

- **TypeScript strict**, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
  Indexed access returns `T | undefined` on purpose; handle it rather than asserting.
- **Zero client JS by default.** An Astro island needs a reason: search, filters, map, cart.
  Nothing else ships JavaScript.
- **No third-party font or script hosts.** Every added origin is a CSP entry and a privacy
  question. Fonts are system stacks; see the comment at the top of `src/styles/global.css`.
- **Brand tokens, not hex codes.** Use `navy-*`, `salt-*`, `brass-*`, `rope-*`, `shell-*` from
  the `@theme` block. A raw hex in a component is a review comment.
- **Accessibility is a gate, not a goal.** WCAG 2.2 AA, Lighthouse 95+ on all four categories.
  Semantic landmarks, one `h1` per page, visible focus rings, 4.5:1 text contrast, a working
  skip link, and `prefers-reduced-motion` respected.
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `ci:`.

## Adding a dependency

Justify it in one line in the PR description. Every package is attack surface and a Dependabot
PR forever. The bar: does this do something we cannot do in twenty lines of our own code?

## Adding a listing (from Phase 2)

1. Research from public sources only. Record every URL.
2. Write `src/content/farms/<slug>.yaml` with `sources[]` and `last_verified`.
3. `npm run verify:data`.
4. Anything unverifiable goes in `data/NEEDS_VERIFICATION.md` — not into the listing as a guess.

Contact fields (`address`, `phone`, `email`, `geo`) require a source accessed within 12 months.
`geo` requires `geo_precision`. These are enforced, not suggested.

## Writing a guide (from Phase 3)

Guides are MDX in `src/content/guides/`, one file per guide, filename = URL slug.

1. Copy the frontmatter shape from an existing guide. `title`, `summary`, `order`, `published`,
   `last_verified` are required.
2. **Decide `health_claims` honestly.** Set it to `true` if the guide tells anyone what is or
   is not safe to eat, handle or do. If it is `true`, you must list at least one `authorities`
   entry with a `body` (CDC, FDA, NYS DOH, NYS DEC). The schema and `verify:data` both refuse
   the build otherwise, on purpose.
3. **Quote, don't paraphrase, the risky parts.** For anything a reader might act on — a
   temperature, a time, a risk group, a regulation — use the agency's own words and link the
   page you read. Paraphrasing a safety instruction is how it drifts.
4. **Write what you could not source into `unsourced_questions`.** It renders on the page.
   This is not an admission of weakness; it is the mechanism that stops the gap becoming a
   guess when someone edits the page in six months.
5. If the guide is not fully sourced, set `draft: true` and add an entry to
   `data/NEEDS_VERIFICATION.md` saying exactly which facts are missing. A half-sourced guide
   does not ship.
6. `npm run verify:data && npm run build && npm run check:links`.

The rule to keep in mind: a guide is our writing, but its _facts_ are not ours. If you cannot
point at who said it, don't say it.

## Changing the CSP

`public/_headers`. Add an origin only in the PR of the feature that needs it, with a one-line
reason in the file. No `unsafe-inline`, no `unsafe-eval`, ever. `astro.config.mjs` sets
`inlineStylesheets: 'never'` so that `style-src` can stay on `'self'`; don't undo that.

After any CSP change, build and confirm no inline `<style>` or inline `<script>` appeared:

```bash
npm run build && grep -nE '<style>|<script>(?!.*src=)' -r dist || echo "clean"
```

## Research and data workflow (Phase 2)

```bash
npm run research      # pull the county lease snapshot + rebuild the research queue
npm run data:export   # listings  -> data/farms.csv   (review in a spreadsheet)
npm run data:import   # data/farms.csv -> listings    (dry run; add -- --write)
npm run verify:data   # source + date + geo-precision gate
npm run verify:stale  # listings due for re-verification
npm run check:links   # internal link check against dist/ (run after a build)
```

The CSV round-trip is a verified fixed point: export → import → export produces an identical
file. `leases` and `merged_into` are YAML-only, since they are structured records rather than
things to edit in a cell; the importer preserves them.

**Step 3 of the pipeline — deciding whether a lessee is a public business — is deliberately
manual.** See [`data/RESEARCH_METHOD.md`](../data/RESEARCH_METHOD.md). Automating that
judgement is how a directory ends up confidently wrong.

## Adding a listing, in practice

1. Read the business's own site. Record every URL and the date you read it.
2. Write only what the source states. Everything else is omitted — an absent field renders as
   "Not listed", which is not the same as "no".
3. Put the open questions in `data/NEEDS_VERIFICATION.md`, next to the listing's name.
4. `npm run verify:data && npx astro check` — the invariants are enforced twice, by
   `verify-data.mjs` and by the Zod schema, on purpose.
