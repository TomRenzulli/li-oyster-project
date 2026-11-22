# GitHub Secrets

Set these at **Settings → Secrets and variables → Actions → Repository secrets**. The
pipeline needs exactly two. If a third ever appears, it needs a line in this file explaining
why it exists and what it can do.

| Secret                  | Used by                               | What it is                                                                                                                |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `deploy-staging`, `deploy-production` | A custom Cloudflare API token, scoped as narrowly below                                                                   |
| `CLOUDFLARE_ACCOUNT_ID` | both deploy jobs                      | Your Cloudflare account ID. Not secret in the cryptographic sense, but kept out of the repo so a fork does not inherit it |

## Creating the API token with minimum scope

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Create Custom Token**.

- **Permissions:** `Account` → `Cloudflare Pages` → **Edit**. Nothing else. No Zone
  permissions, no DNS, no Workers Scripts, no Account Settings. Pages:Edit is sufficient for
  `wrangler pages deploy`.
- **Account Resources:** Include → _your account only_.
- **Zone Resources:** none.
- **Client IP Address Filtering:** leave open. GitHub-hosted runner IPs rotate, so an
  allowlist here will break deploys rather than secure them.
- **TTL:** set an expiry — 12 months is reasonable — and put the rotation date in your
  calendar. An unexpiring deploy token is a permanent credential.

Scoping note: this token can create and modify Pages deployments on this account. It cannot
touch DNS, read your zone, or edit Workers. If it leaks, an attacker can deploy arbitrary
content to your Pages project — bad, but recoverable by revoking the token and redeploying. It
cannot take your domain.

## Finding the account ID

Cloudflare dashboard → **Workers & Pages** → right-hand sidebar, **Account ID**. Or
`npx wrangler whoami`.

## Rotation

1. Create the replacement token first, with the same scope.
2. Update the GitHub secret.
3. Re-run the latest `develop` workflow to confirm the new token deploys.
4. Only then delete the old token in Cloudflare.

## Not GitHub secrets

These belong in **Cloudflare Pages → Settings → Environment variables**, not in Actions,
because they are read at request time by Pages Functions rather than at build time:

| Variable                                     | Phase | Notes                                                                |
| -------------------------------------------- | ----- | -------------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY`                       | 2     | Server-side Turnstile verification                                   |
| `PUBLIC_TURNSTILE_SITE_KEY`                  | 2     | Public by design; safe in client bundles                             |
| `GITHUB_ISSUE_TOKEN`                         | 2     | Fine-grained PAT, **issues:write on this repo only**, no other scope |
| `STRIPE_SECRET_KEY` / webhook signing secret | 4     | Live keys only in the production environment, never in preview       |
| `PUBLIC_CF_ANALYTICS_TOKEN`                  | 5     | Public beacon token                                                  |

Set each one separately for **Production** and **Preview**. Preview gets test keys. A live
Stripe key in the preview environment is how a staging deploy charges a real card.

## Rules

- No secret is ever committed, not even in a comment, not even expired. TruffleHog scans the
  full history and will fail the build.
- `.env` is gitignored. `.env.example` holds names only, never values.
- Nothing in a `PUBLIC_*` variable is secret — Astro inlines those into client JavaScript.
