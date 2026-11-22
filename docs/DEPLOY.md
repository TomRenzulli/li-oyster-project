# Deploy

Hosting is Cloudflare Pages, connected to this GitHub repo through **Cloudflare's own Git
integration**. Cloudflare watches the repo, builds it, and serves it:

| Branch      | Cloudflare deployment | URL                           |
| ----------- | --------------------- | ----------------------------- |
| `main`      | Production            | `longislandoysterfarm.com`    |
| `develop`   | Preview (= staging)   | `develop.<project>.pages.dev` |
| `feature/*` | Preview               | per-deployment `*.pages.dev`  |

GitHub Actions does **not** deploy and holds no Cloudflare credential. It runs the checks
(`ci-cd.yml`) and, after Cloudflare reports a deployment, the Lighthouse audit
(`lighthouse.yml`). See [CI-CD-ARCHITECTURE.md](CI-CD-ARCHITECTURE.md).

**The trade to know about:** Cloudflare builds on _push_, not on _green_. It does not read
GitHub check status, so a push to `develop` that fails CI is still built and served at the
preview URL. The gates are enforced at the merge boundary by branch protection instead — which
is why `main` and `develop` are protected, require a PR, and are never pushed to directly.

## One-time setup

### 1. Connect the Pages project to the repo

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → authorise the
Cloudflare GitHub App on `TomRenzulli/li-oyster-project` **only** (not "all repositories") →
select the repo.

Build settings:

| Setting          | Value                     |
| ---------------- | ------------------------- |
| Framework preset | Astro                     |
| Build command    | `npm ci && npm run build` |
| Build output     | `dist`                    |
| Root directory   | _(blank — repo root)_     |
| `NODE_VERSION`   | `24`                      |

`npm ci` rather than `npm install`: it installs exactly the committed lockfile and fails if
`package.json` and `package-lock.json` disagree, which is the whole reason the lockfile is
committed.

Set `NODE_VERSION` as a build environment variable for **both** Production and Preview.
Cloudflare's default Node is older than what this project's Astro version needs.

### 2. GitHub secrets

None needed — that is the point of Git integration. If `CLOUDFLARE_API_TOKEN` or
`CLOUDFLARE_ACCOUNT_ID` are still set from the earlier Actions-deploy design, delete both and
revoke the token in Cloudflare. See [GITHUB_SECRETS.md](GITHUB_SECRETS.md).

### 3. Set the production branch

Pages project → **Settings → Builds & deployments → Production branch** → `main`. Every other
branch, including `develop`, then deploys as a preview. That is what makes `develop` staging.

### 4. Attach the apex domain

Pages project → **Custom domains → Set up a custom domain** → `longislandoysterfarm.com`.

Because the zone is already on Cloudflare DNS, Cloudflare creates the record itself: a `CNAME`
for the apex, flattened automatically at the edge. Accept it. Remove any pre-existing `A`,
`AAAA` or `CNAME` record for the apex that points somewhere else, or the domain will stay in
"pending" or serve the wrong origin.

Wait for the certificate. It is usually a couple of minutes and occasionally up to ~15. The
custom domain shows **Active** when it is done.

### 5. Attach `www` and redirect it to the apex

Two parts. Both are needed — the second one is the part people forget.

**a. Add the hostname** so the certificate covers it: Pages project → Custom domains → add
`www.longislandoysterfarm.com`. Cloudflare adds the DNS record.

**b. Create the redirect.** `public/_redirects` cannot do this: Pages `_redirects` matches on
path, not on hostname, so a rule there would loop. Use a zone-level Redirect Rule instead:

Cloudflare dashboard → the `longislandoysterfarm.com` zone → **Rules → Redirect Rules →
Create rule**.

- Name: `www to apex`
- If: **Custom filter expression** → `http.host eq "www.longislandoysterfarm.com"`
- Then: **Dynamic** redirect
  - Expression: `concat("https://longislandoysterfarm.com", http.request.uri.path)`
  - Status: **301**
  - **Preserve query string: on**

Dynamic rather than static, so `https://www.../farms/oyster-bay/?x=1` lands on the matching
apex URL instead of dumping every visitor on the home page. That matters for the directory,
where deep links are the whole point.

### 6. Confirm SSL mode

Zone → **SSL/TLS → Overview → Full (strict)**. Pages serves valid certificates, so strict
works and anything looser is a downgrade. Then **SSL/TLS → Edge Certificates**: Always Use
HTTPS **on**, Minimum TLS Version **1.2** (1.3 if you are willing to drop ancient clients),
Automatic HTTPS Rewrites **on**.

HSTS is sent by `public/_headers` with `preload`. Do **not** submit the domain to the HSTS
preload list until you are certain every subdomain you will ever want can serve HTTPS —
preload removal takes months.

### 7. Environment variables

Pages project → **Settings → Environment variables**. Add the Phase 2+ runtime variables,
separately for **Production** and **Preview**, with test keys in Preview. Table in
[GITHUB_SECRETS.md](GITHUB_SECRETS.md).

## Routine deploys

- Merge a `feature/*` PR into `develop` → staging preview deploys, Lighthouse runs against it
  and fails the run below 95.
- Open `develop` → `main`, review the diff, squash-merge → production deploys.

Preview URLs look like `https://<hash>.li-oyster-project.pages.dev`, with
`https://develop.li-oyster-project.pages.dev` as the stable staging alias.

## Verify a deploy

```bash
curl -sI https://longislandoysterfarm.com/ | grep -iE 'content-security|strict-transport|x-content-type|referrer|permissions'
curl -sI https://www.longislandoysterfarm.com/ | head -3   # expect 301 to apex
curl -s https://longislandoysterfarm.com/sitemap-index.xml | head -5
curl -sI https://longislandoysterfarm.com/no-such-page/ | head -1   # expect 404
```

Then open the site and check the browser console for CSP violations. A blocked resource is
silent to `curl` and loud in the console.

## Rollback

Pages project → **Deployments** → pick the last good one → **Rollback**. Instant, no build.
Then fix forward in git — a rollback is not a commit, so the next deploy will reintroduce the
problem if you leave the branch alone.

Break-glass: **Retry deployment** on the failed deployment in the Cloudflare dashboard, or
push an empty commit to `main`. A manual `wrangler pages deploy` is deliberately _not_
documented as the escape hatch — it would need a Pages:Edit token, and creating one for an
incident reintroduces exactly the credential this architecture removed. Rollback plus fix
forward covers the realistic failures.
