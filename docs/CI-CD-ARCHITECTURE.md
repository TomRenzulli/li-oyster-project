# CI/CD architecture

Two workflow files, and neither one deploys anything.

- **`.github/workflows/ci-cd.yml`** — the gates. Runs on PRs into `main` and `develop`, on
  pushes to those branches, and on manual dispatch.
- **`.github/workflows/lighthouse-production.yml`** — a daily audit of the live site. Not a
  gate; an alarm.

Deployment itself is **Cloudflare Pages' Git integration**: Cloudflare watches this repo,
builds it, and serves it. `main` is production, `develop` is the staging preview. Actions
never deploys and never holds a Cloudflare credential.

## Branch flow

```
feature/*  --PR-->  develop  --PR-->  main
   |                  |                 |
 checks + Lighthouse (GitHub Actions, blocking on every PR)
                      |                 |
            Cloudflare builds    Cloudflare builds   (Pages Git integration)
            *.pages.dev preview  longislandoysterfarm.com
                                         |
                              daily Lighthouse audit  (GitHub Actions, alarm)
```

Squash-merge everywhere, so `develop` and `main` stay one-commit-per-change and a revert is
one commit.

## Jobs

| Job               | Runs on               | Fails when                                                                                                           |
| ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `secrets`         | every event           | TruffleHog finds a **verified** secret anywhere in the repo, including history                                       |
| `vulnerabilities` | every event           | Trivy finds a HIGH/CRITICAL, fixable vulnerability, secret or misconfiguration                                       |
| `quality`         | every event           | ESLint, Prettier, `astro check`, `npm audit --audit-level=high`, or `verify:data` fails                              |
| `build`           | after the three gates | The build fails, `dist/_headers` is missing its CSP, an inline script or style survived, or an internal link is dead |
| `lighthouse`      | after `build`         | Any of performance / a11y / best-practices / SEO scores below 95 on a local `astro preview` of the build             |

Separately, `lighthouse-production.yml` audits the live domain daily and on manual dispatch.
It is an alarm, not a gate.

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

**Why the Lighthouse gate audits a local `astro preview`, not the deployed site.** Auditing
the real deployment is better in principle — real CDN, real compression, real headers — and
that was the original design. It does not work with Cloudflare's native Git integration.
Cloudflare reports builds to GitHub as **check runs and PR comments only**; it creates no
GitHub Deployment object, so the `deployment_status` event never fires and there is nothing to
trigger on. Verified 2026-11-22: `GET /repos/TomRenzulli/li-oyster-project/deployments` is
empty despite completed Cloudflare builds. The alternative — scraping the preview URL out of a
check run's human-readable summary — is too fragile to hang a release gate on.

So the gate moved to where it can actually run on every PR, and the fidelity it loses is
covered elsewhere:

| What a local audit cannot see   | Covered by                                          |
| ------------------------------- | --------------------------------------------------- |
| `public/_headers` being applied | `build` asserts the file ships with a CSP in it     |
| Inline script/style vs the CSP  | `build` asserts the build emits none                |
| Real CDN, Brotli, TLS           | `lighthouse-production.yml`, daily against the apex |

A gate that runs on every PR and measures slightly less is worth more than a faithful gate
that never fires.

**Why the preview server is started as its own step, not by `startServerCommand`.** Lighthouse
CI can start a server itself and wait for a ready pattern, which is the obvious way to do
this. It does not work here: **`astro preview` in Astro 7 daemonizes.** It prints
`Preview server running at … (pid N)` and the foreground process exits immediately. Lighthouse
CI watches the child it spawned, so it would conclude the server had died while the server was
serving fine. The workflow starts it in its own step, polls for a 200 for up to 30 seconds,
and stops it with `astro preview stop` in an `if: always()` step.

**Why the production audit validates its own target.** `workflow_dispatch` takes a URL input,
and the job accepts only the apex or its `www` alias. It also `curl`s for a 200 first, so a
parked page or a 522 fails loudly instead of as four mysterious sub-95 scores.

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

| Rule                      | Setting                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pull request required     | Yes, 0 approvals (solo operator; a PR is still a forced pause to read the diff)                                                    |
| Required checks           | `Secret scan (TruffleHog)`, `Dependency + filesystem scan (Trivy)`, `Lint, format, types, audit`, `Build`, `Lighthouse (95 floor)` |
| Branch must be up to date | Yes — a green check on a stale base is not a green check                                                                           |
| Linear history            | Required, which matches the squash-merge workflow                                                                                  |
| Force push / deletion     | Blocked                                                                                                                            |
| Conversation resolution   | Required before merge                                                                                                              |
| Applies to admins         | **No** — the owner can push directly in an emergency                                                                               |

**`Lighthouse (95 floor)` became a required check on 2026-11-22**, once it moved to a local
audit that runs on every PR. That is the brief's release gate, so it belongs in the required
set now that it can actually report on a pull request. The separate
`lighthouse-production.yml` is **not** required and never will be: it runs on a schedule after
the merge, so requiring it would deadlock every merge.

Admin bypass is a deliberate trade for a one-person project: the gates catch the ordinary
mistakes, and the owner is not locked out of their own production branch during an incident.
If a second maintainer ever joins, turn `enforce_admins` on.
