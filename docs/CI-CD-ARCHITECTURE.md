# CI/CD architecture

One workflow file: `.github/workflows/ci-cd.yml`. It runs on PRs into `main` and `develop`,
on pushes to those branches, and on manual dispatch.

## Branch flow

```
feature/*  --PR-->  develop  --PR-->  main
                      |                 |
                  staging deploy    production deploy
                  + Lighthouse      longislandoysterfarm.com
```

Squash-merge everywhere, so `develop` and `main` stay one-commit-per-change and a revert is
one commit.

## Jobs

| Job                 | Runs on               | Fails when                                                                              |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `secrets`           | every event           | TruffleHog finds a **verified** secret anywhere in the repo, including history          |
| `vulnerabilities`   | every event           | Trivy finds a HIGH/CRITICAL, fixable vulnerability, secret or misconfiguration          |
| `quality`           | every event           | ESLint, Prettier, `astro check`, `npm audit --audit-level=high`, or `verify:data` fails |
| `build`             | after the three gates | The build fails, or `dist/_headers` is missing its CSP                                  |
| `deploy-staging`    | push to `develop`     | Wrangler deploy fails                                                                   |
| `lighthouse`        | after staging deploy  | Any of performance / a11y / best-practices / SEO scores below 95                        |
| `deploy-production` | push to `main`        | Wrangler deploy fails                                                                   |

Gates run in parallel; `build` needs all three. Nothing deploys unless everything passed.

## Design decisions

**Why whole-history secret scanning.** TruffleHog runs with `base: ''`, `head: HEAD`, so it
scans history rather than just the diff. A key committed and "removed" three months ago is
still a leaked key. `--only-verified` means the gate fires on credentials TruffleHog actually
confirmed live, which keeps it actionable instead of a wall of false positives people learn
to ignore.

**Why `ignore-unfixed: true` on Trivy.** A HIGH with no available patch is not something a PR
author can act on; failing on it just teaches everyone to bypass the gate. Unfixable findings
still show in the job log and are reviewed in the monthly maintenance pass.

**Why actions are pinned to commit SHAs.** A tag is mutable. `@v4` means "whatever that
account points the tag at today", which is the whole mechanism behind the Actions supply-chain
compromises of recent years. Every `uses:` is a 40-character SHA with the readable tag in a
trailing comment; Dependabot (configured for `github-actions`) bumps both together so the
comment never drifts from the SHA.

**Why `permissions: contents: read` at the top.** The default token is broad. Nothing here
needs write access to the repo, so nothing gets it. The Phase 2 submit Function uses a
separate fine-grained PAT, not the Actions token.

**Why `persist-credentials: false` on every checkout.** Stops the job's git credential from
sitting in `.git/config` where any later step — or a compromised dependency running during
`npm ci` — could read and reuse it.

**Why Lighthouse runs against the deployed staging URL, not a local server.** The release gate
should measure what Cloudflare actually serves: real headers, real compression, real CDN. A
local preview can pass while the deployed site fails on a CSP violation or a caching header.

**Why `build` greps `dist/_headers`.** The security headers are a file that Astro copies from
`public/`. A refactor that moves or renames it would silently ship a site with no CSP, and the
build would still be green. One `grep` closes that gap.

**Why data integrity is a CI gate and a pre-commit hook.** The no-fabricated-data rule is the
product's entire credibility. `scripts/verify-data.mjs` has zero dependencies and does not use
the Zod schema, deliberately: the schema can be weakened in the same PR as the data it
validates, so a second, independent check guards the invariant.

## Secrets

Only two, both repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Scopes
and rotation are in [GITHUB_SECRETS.md](GITHUB_SECRETS.md). No secret is ever read in a job
that runs untrusted PR code — the deploy jobs are gated on `push` to a protected branch, so a
fork PR cannot reach them.

## Suggested branch protection

Not settable from the repo, so set these in GitHub UI → Settings → Branches:

- `main` and `develop`: require a PR, require the `secrets`, `vulnerabilities`, `quality` and
  `build` checks to pass, require branches up to date, no force-push, no deletion.
- `main` additionally: require the `develop` → `main` PR to be reviewed (even by you — it is a
  moment to read the diff).
