# Deploy

Hosting is Cloudflare Pages, connected to this GitHub repo through **Cloudflare's own Git
integration**. Cloudflare watches the repo, builds it, and serves it:

| Branch      | Cloudflare deployment | URL                           |
| ----------- | --------------------- | ----------------------------- |
| `main`      | Production            | `longislandoysterfarm.com`    |
| `develop`   | Preview (= staging)   | `develop.<project>.pages.dev` |
| `feature/*` | Preview               | per-deployment `*.pages.dev`  |

GitHub Actions does **not** deploy and holds no Cloudflare credential. It runs the checks and
the Lighthouse gate (`ci-cd.yml`), plus a daily audit of the live site
(`lighthouse-production.yml`). See [CI-CD-ARCHITECTURE.md](CI-CD-ARCHITECTURE.md).

**The trade to know about:** Cloudflare builds on _push_, not on _green_. It does not read
GitHub check status, so a push to `develop` that fails CI is still built and served at the
preview URL. The gates are enforced at the merge boundary by branch protection instead — which
is why `main` and `develop` are protected, require a PR, and are never pushed to directly.

## One-time setup

### 0. If a Worker is connected to this repo, remove it first

The initial setup connected the repo to a **Worker** (`longislandoysterfarm`) rather than a
Pages project. That is a different product: Workers Builds has no `functions/` file-based
routing, so `functions/api/submit.ts` would never be served, and its builds failed. Delete
that Worker (Cloudflare dashboard → Workers & Pages → the Worker → Settings → Delete), or at
minimum disconnect it from the repo so it stops posting a failing check on every PR.

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

### 3b. Remove the GoDaddy Website Builder site first

**This is the step that actually blocks the cutover, and it is on the GoDaddy side, not
Cloudflare's.**

Symptom: the apex and `www` both resolve to a Cloudflare proxy IP, yet serve a GoDaddy
Website Builder site. The giveaways in the response are `x-siteid: us-east-1`, a
`dps_site_id` cookie, preload links to `img1.wsimg.com`, and a `Content-Security-Policy`
listing `godaddy.com` and `secureserver.net` in `frame-ancestors`. `server: cloudflare` is
_not_ evidence the origin is ours — Cloudflare will happily proxy someone else's origin.

Two separate things have to be undone, and doing only one leaves the site still wrong:

1. **In GoDaddy:** remove the Websites + Marketing / Website Builder product from the domain.
   This removes the _site_.
2. **In Cloudflare DNS:** delete the `A`/`AAAA` records at the apex **and** at `www`. This
   removes the _routing_. Deleting the GoDaddy product does **not** remove these — they live in
   this zone, and while they exist Cloudflare keeps proxying to GoDaddy's origin and the Pages
   custom domain cannot take the hostname.

Then attach the custom domain (step 4) and let Cloudflare create its own records.

How to tell the records are still there: `dig +short CNAME longislandoysterfarm.com` returns
nothing while `dig +short A longislandoysterfarm.com` returns Cloudflare proxy addresses. A
Pages-managed custom domain is a Cloudflare-created record, not a hand-made `A` record.

Only if the records **reappear after deletion** is it worth investigating Domain Connect or a
connected app writing them back. Note that the `_domainconnect` TXT record is present on
Cloudflare zones by default and is not by itself evidence of an active integration.

### 4. Attach the apex domain

The dashboard's navigation has been reorganised more than once, and Cloudflare's own docs lag
it, so two routes are given here. **Prefer the API** — it is stable, it is scriptable, and it
does not depend on a menu label.

#### Via the API (recommended)

```bash
# Run this in your own terminal, not through the agent, so the token is not
# captured anywhere. Create a token scoped to Account -> Cloudflare Pages ->
# Edit, use it, then revoke it. It is NOT a repo secret and must never become
# one: this project deliberately holds no Cloudflare credential.
export CF_TOKEN='...'
ACCOUNT=d1de92cf166d53190720d66ce207a1e1
PROJECT=longislandoysterfarm

for DOMAIN in longislandoysterfarm.com www.longislandoysterfarm.com; do
  curl -sS -X POST \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/pages/projects/$PROJECT/domains" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $CF_TOKEN" \
    --data "$(printf '{"name":"%s"}' "$DOMAIN")"
  echo
done
```

Needs the **Pages Write** permission. To list what is attached, `GET` the same path; to retry a
domain stuck validating, `PATCH .../domains/<domain>`; to remove one, `DELETE` it.

#### Via the dashboard

A deep link avoids the sidebar entirely:
`https://dash.cloudflare.com/d1de92cf166d53190720d66ce207a1e1/pages/view/longislandoysterfarm`
→ **Custom domains**. In the current UI this tab may sit under the project's **Settings**
rather than at the top level. The button has been labelled "Set up a domain" and "Setup a
custom domain" in different places; the branch-alias flow adds an **Activate domain**
confirmation step that the main flow does not.

#### Either way

The apex must be a zone on the **same Cloudflare account** as the Pages project. It is.

Because the zone is on Cloudflare DNS, Cloudflare creates the record itself — a `CNAME` for the
apex, flattened at the edge. **Delete any pre-existing `A`, `AAAA` or `CNAME` for the apex
first.** Cloudflare's docs do not say how a conflicting record is handled, and the observed
behaviour on this zone was that the custom domain simply never provisioned: the GoDaddy `A`
record kept answering, and deleting it afterwards left the apex with no records at all.

Do not hand-create a `CNAME` to `<project>.pages.dev` _before_ attaching the domain in Pages.
Cloudflare warns this makes the domain fail to resolve and serve a **522**.

Then verify from outside the dashboard, which is the only check that cannot lie:

```bash
dig +short CNAME longislandoysterfarm.com      # should return a Cloudflare target
curl -sI https://longislandoysterfarm.com/ | grep -i content-security-policy
```

The CSP should be ours (`default-src 'none'; script-src 'self' …`). If it names `godaddy.com`
in `frame-ancestors`, the apex is still pointed at GoDaddy. Certificate provisioning is usually
a couple of minutes, occasionally up to ~15.

#### CAA records

If the zone has `CAA` records, they must permit Cloudflare's issuers or the certificate cannot
be issued: **Let's Encrypt**, **Google Trust Services (`pki.goog`)** and **`ssl.com`**. This
zone has no `CAA` records today, so there is nothing to do — but it is the first thing to check
if a domain sits in pending with DNS that looks correct.

### 5. Attach `www` and redirect it to the apex

Two parts. Both are needed — the second one is the part people forget.

> **Note:** before the cutover, `www` already returned a 301 to the apex, but that redirect was
> **GoDaddy's**, not ours — the 301 response carried `x-siteid: us-east-1`. It disappears with
> the Website Builder site, so the Redirect Rule below is genuinely required rather than
> already satisfied.

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
