# GitHub Secrets

**The pipeline needs none.** Set nothing at Settings → Secrets and variables → Actions.

That is the point of the file, not an omission. GitHub Actions in this repo only runs
_checks_ — secret scanning, vulnerability scanning, lint, types, audit, build, link check —
and a Lighthouse audit triggered by a deployment event. None of that needs a credential.
Deployment is done by **Cloudflare Pages' Git integration**, which authenticates to GitHub
from Cloudflare's side via the Cloudflare GitHub App, so the deploy credential lives in
Cloudflare and never enters this repo or its Actions environment.

If a secret ever does need to exist here, it gets a row in the table below explaining what it
is, which job reads it, and what an attacker could do with it. An undocumented secret is a
bug.

| Secret | Used by | What it is |
| ------ | ------- | ---------- |
| _none_ | —       | —          |

## Why there is no `CLOUDFLARE_API_TOKEN`

The earlier design deployed with `cloudflare/wrangler-action` and needed a
`CLOUDFLARE_API_TOKEN` (Pages:Edit) plus `CLOUDFLARE_ACCOUNT_ID` as repository secrets. Those
jobs are gone. With Git integration there is no deploy token to scope, rotate, expire, or have
read out of a runner by a compromised npm dependency during `npm ci`.

**If you still have those two secrets set from the earlier setup, delete them** — an unused
credential is pure liability. And revoke the token itself in the Cloudflare dashboard (My
Profile → API Tokens), because deleting the GitHub secret does not invalidate the token.

## What this means for the runner

- Every job declares `permissions: contents: read`. Nothing can write to the repo.
- Every checkout uses `persist-credentials: false`, so the job's git credential is not left in
  `.git/config` for a later step to find.
- Because no job reads a secret, a pull request from a fork is not a credential-exposure risk
  at all — there is nothing in the environment to exfiltrate.
- `lighthouse.yml` runs on `deployment_status`, an event whose payload is partly
  attacker-controlled (`environment_url`). It therefore allowlists the URL it will audit to
  `*.pages.dev` and the production apex, and still reads no secret.

## Where the real secrets live: Cloudflare

These are set at **Cloudflare dashboard → Workers & Pages → the project → Settings →
Variables and Secrets**, not in GitHub, because they are read at request time by Pages
Functions (or at build time by Cloudflare's builder) rather than by Actions.

| Variable                                     | Phase | Notes                                                                |
| -------------------------------------------- | ----- | -------------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY`                       | 2     | Server-side Turnstile verification                                   |
| `PUBLIC_TURNSTILE_SITE_KEY`                  | 2     | Public by design; safe in client bundles                             |
| `GITHUB_ISSUE_TOKEN`                         | 2     | Fine-grained PAT, **issues:write on this repo only**, no other scope |
| `STRIPE_SECRET_KEY` / webhook signing secret | 4     | Live keys only in the production environment, never in preview       |
| `PUBLIC_CF_ANALYTICS_TOKEN`                  | 5     | Public beacon token                                                  |

Set each one separately for **Production** and **Preview**. Preview gets test keys. A live
Stripe key in the preview environment is how a staging deploy charges a real card.

Mark anything genuinely secret as a **Secret**, not a plaintext variable, so it is write-only
once saved. `PUBLIC_*` values are the exception: they are inlined into client JavaScript by
design and are not secret in any sense.

### Rotation (Cloudflare-side)

1. Create the replacement value at the provider (Turnstile, GitHub, Stripe).
2. Update the Preview variable first and confirm a `develop` deployment still works.
3. Update Production.
4. Only then revoke the old value at the provider.

`GITHUB_ISSUE_TOKEN` is a fine-grained PAT and therefore expires. Put its expiry date in a
calendar reminder — the failure mode is `/submit/` silently returning errors months from now.

## Rules

- No secret is ever committed, not even in a comment, not even expired. TruffleHog scans the
  full history and will fail the build.
- `.env` is gitignored. `.env.example` holds names only, never values.
- Nothing in a `PUBLIC_*` variable is secret — Astro inlines those into client JavaScript.
