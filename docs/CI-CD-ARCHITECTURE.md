# CI/CD architecture

Two workflow files, and neither one deploys anything.

- **`.github/workflows/ci-cd.yml`** — the gates. Runs on PRs into `main` and `develop`, on
  pushes to those branches, and on manual dispatch.
- **`.github/workflows/lighthouse.yml`** — the performance/a11y release floor. Triggered by
  `deployment_status`, which is Cloudflare telling GitHub a deployment went live.

Deployment itself is **Cloudflare Pages' Git integration**: Cloudflare watches this repo,
builds it, and serves it. `main` is production, `develop` is the staging preview. Actions
never deploys and never holds a Cloudflare credential.

## Branch flow

```
feature/*  --PR-->  develop  --PR-->  main
   |                  |                 |
 checks             checks            checks         (GitHub Actions)
                      |                 |
            Cloudflare builds    Cloudflare builds   (Pages Git integration)
            *.pages.dev preview  longislandoysterfarm.com
                      |                 |
                      +-------+---------+
                              |
                   deployment_status -> Lighthouse   (GitHub Actions)
```

Squash-merge everywhere, so `develop` and `main` stay one-commit-per-change and a revert is
one commit.

## Jobs

| Job                      | Runs on                            | Fails when                                                                                                           |
| ------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `secrets`                | every event                        | TruffleHog finds a **verified** secret anywhere in the repo, including history                                       |
| `vulnerabilities`        | every event                        | Trivy finds a HIGH/CRITICAL, fixable vulnerability, secret or misconfiguration                                       |
| `quality`                | every event                        | ESLint, Prettier, `astro check`, `npm audit --audit-level=high`, or `verify:data` fails                              |
| `build`                  | after the three gates              | The build fails, `dist/_headers` is missing its CSP, an inline script or style survived, or an internal link is dead |
| `audit` (lighthouse.yml) | a successful Cloudflare deployment | Any of performance / a11y / best-practices / SEO scores below 95                                                     |

Gates run in parallel; `build` needs all three.

One consequence of handing deploys to Cloudflare is worth stating plainly: **Cloudflare builds
on push, not on green.** It does not read GitHub check status, so a push to `develop` that
fails `quality` still gets built and served at the preview URL. The checks are enforced at the
_merge_ boundary by branch protection, not at the deploy boundary — which is why a PR is
required into both branches and why nothing is pushed to them directly. The Lighthouse audit
then runs against whatever Cloudflare actually served, so a bad deploy is still caught, just
after the fact rather than before.

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

**Why Lighthouse runs against the deployed URL, not a local server.** The release gate should
measure what Cloudflare actually serves: real headers, real compression, real CDN. A local
preview can pass while the deployed site fails on a CSP violation or a caching header.

**Why Lighthouse is triggered by `deployment_status` rather than by a push.** With Git
integration, Actions has no way to know when Cloudflare finished building or what URL the
result landed on — preview hostnames are per-deployment. Cloudflare reports each deployment
back to GitHub as a deployment status carrying `environment_url`, so that event is both the
"it is live now" signal and the address to audit. No polling, no guessed hostname, no API
token.

**Why the Lighthouse job allowlists the URL it audits.** `environment_url` is attacker-
supplied in the general case: anyone who can create a deployment on this repo can set it. The
job therefore runs only for `state == 'success'` and only when the URL is a `*.pages.dev` host
or the production apex, so the audit cannot be pointed at an arbitrary third-party site with
this repo's workflow run attached to it.

**Why deploying from Cloudflare instead of from Actions.** The alternative was
`wrangler-action` with a `CLOUDFLARE_API_TOKEN` repository secret. Git integration removes
that credential from GitHub entirely — there is no deploy token to leak, scope, rotate, or
have stolen from a compromised Action. The cost is the push-not-green behaviour above and
losing the ability to deploy a build artifact Actions already produced (Cloudflare rebuilds
it). For a static site with a 1-minute build, that is a good trade.

**Why `build` greps `dist/_headers`.** The security headers are a file that Astro copies from
`public/`. A refactor that moves or renames it would silently ship a site with no CSP, and the
build would still be green. One `grep` closes that gap.

**Why data integrity is a CI gate and a pre-commit hook.** The no-fabricated-data rule is the
product's entire credibility. `scripts/verify-data.mjs` has zero dependencies and does not use
the Zod schema, deliberately: the schema can be weakened in the same PR as the data it
validates, so a second, independent check guards the invariant.

## Secrets

**None.** No GitHub Actions secret is required by either workflow — see
[GITHUB_SECRETS.md](GITHUB_SECRETS.md), which is now a record of why the list is empty and
what belongs in Cloudflare instead. Every job runs with `permissions: contents: read` and a
checkout with `persist-credentials: false`, so there is nothing for a malicious dependency
pulled in during `npm ci` to steal.

## Branch protection

**Applied to both `main` and `develop` (2026-11-21):**

| Rule                      | Setting                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Pull request required     | Yes, 0 approvals (solo operator; a PR is still a forced pause to read the diff)                           |
| Required checks           | `Secret scan (TruffleHog)`, `Dependency + filesystem scan (Trivy)`, `Lint, format, types, audit`, `Build` |
| Branch must be up to date | Yes — a green check on a stale base is not a green check                                                  |
| Linear history            | Required, which matches the squash-merge workflow                                                         |
| Force push / deletion     | Blocked                                                                                                   |
| Conversation resolution   | Required before merge                                                                                     |
| Applies to admins         | **No** — the owner can push directly in an emergency                                                      |

Lighthouse is deliberately **not** a required check: it runs on a deployment event after the
merge, never on the PR, so requiring it would deadlock every merge. It is a post-merge alarm
on `develop`, which is what the staging preview is for — a `develop` audit below 95 is fixed
before the promotion PR into `main` is opened.

Admin bypass is a deliberate trade for a one-person project: the gates catch the ordinary
mistakes, and the owner is not locked out of their own production branch during an incident.
If a second maintainer ever joins, turn `enforce_admins` on.
