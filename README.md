# longislandoysterfarm.com

The independent, source-cited index of Long Island oyster hatcheries, farms and growers —
plus a small shop for oyster gear and branded merch.

Astro (static) · TypeScript strict · Tailwind CSS v4 · Cloudflare Pages

## The rule that outranks every other rule

**No fabricated data.** Never invent a farm, hatchery, address, phone number, set of hours or
oyster brand. Every listing carries a `sources` array and a `last_verified` date. If a fact
cannot be verified from a public source, the field stays empty and the open question goes in
[`data/NEEDS_VERIFICATION.md`](data/NEEDS_VERIFICATION.md). Guessing is a bug, and
`npm run verify:data` fails the build over it.

## Quick start

```bash
npm ci
npm run dev        # http://localhost:4321
npm run check      # lint + format + types + data integrity, i.e. what CI runs
npm run build
```

Node 24+. See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) and
[`docs/CHEATSHEET.md`](docs/CHEATSHEET.md).

## Layout

```
src/content/     Content collections: farms (YAML), guides (MDX), products
src/components/  Components; islands only where interactivity is real
src/layouts/     Page shells
src/pages/       Routes
src/styles/      global.css — brand tokens live here
data/            Research, CSV import/export, NEEDS_VERIFICATION.md
functions/       Cloudflare Pages Functions (form intake, webhooks)
scripts/         verify-data.mjs and the research/import tooling
public/          Static assets, _headers (CSP), _redirects, robots.txt
docs/            Plan, decisions, CI/CD, deploy, launch
```

## Branches

`feature/*` → PR → `develop` (staging) → `main` (production). Squash-merge. Conventional
commits. Every gate in [`docs/CI-CD-ARCHITECTURE.md`](docs/CI-CD-ARCHITECTURE.md) must pass.

## Status

Phase 1 (scaffold + CI/CD) complete. Phase 2 (the directory) is next. No listings are
published yet.

## Docs

| Doc                                                 | What it covers                                           |
| --------------------------------------------------- | -------------------------------------------------------- |
| [PLAN.md](docs/PLAN.md)                             | Site map, data schema, commerce analysis, open questions |
| [DECISIONS.md](docs/DECISIONS.md)                   | Running decision log                                     |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md)               | Local setup, conventions, adding content                 |
| [CHEATSHEET.md](docs/CHEATSHEET.md)                 | Commands and one-liners                                  |
| [CI-CD-ARCHITECTURE.md](docs/CI-CD-ARCHITECTURE.md) | Pipeline design and every gate                           |
| [DEPLOY.md](docs/DEPLOY.md)                         | Cloudflare Pages + domain setup, step by step            |
| [GITHUB_SECRETS.md](docs/GITHUB_SECRETS.md)         | Required secrets and exact token scopes                  |
