# longislandoysterfarm.com — Phase 0 Plan

**Status:** awaiting owner approval
**Date:** 2026-11-21
**Repo:** https://github.com/TomRenzulli/li-oyster-project

The product is a directory first and a shop second. The directory is the moat: nobody has
a verified, source-cited index of Long Island oyster growers and the named oyster brands
they sell. The shop is monetization bolted to the side, and it must never compromise the
directory's credibility or the site's static-by-default architecture.

---

## 1. Site map and URL structure

```
/                           Home: what this is, search box, featured farms, region entry points
/farms/                     Full directory. Pagefind search + faceted filters + sort
/farms/[slug]/              One farm. Details, map, brands, sources, last-verified badge
/map/                       Leaflet + OSM, clustered, filterable
/oysters/                   Index of named LI oyster brands
/oysters/[brand]/           One brand -> grower, waterbody, flavor notes (only if sourced)
/regions/[region]/          South Shore, North Shore, North Fork, South Fork, Peconic, Western LI
/waterbodies/[waterbody]/   Great South Bay, Peconic Bay, LI Sound, Moriches, Shinnecock, ...
/towns/[town]/              Islip, Brookhaven, Southold, Southampton, ...
/guides/                    Content hub index
/guides/[slug]/             MDX guide
/shop/                      Shop landing
/shop/[category]/           pans, trays-platters, stickers, patches
/shop/[product]/            One product
/submit/                    Add or update a listing
/claim/                     Claim your listing (farm owners)
/about/                     Who runs this, methodology summary, corrections policy
/methodology/               Public version of RESEARCH_METHOD.md - this is a trust asset
/shipping/  /returns/  /privacy/  /terms/  /affiliate-disclosure/
/404
/sitemap-index.xml  /robots.txt  /feed.xml
```

URL rules: lowercase kebab-case slugs, trailing slash, no dates in paths, one canonical URL
per entity. Slugs are permanent once published; renames get a 301 in `public/_redirects`.
`www` 301s to apex.

Deliberately **not** doing: user accounts, reviews/ratings, or a farm-facing CMS. All three
add attack surface, moderation load, and legal exposure for a one-person operation. Farm
corrections flow through `/claim/` into human review.

---

## 2. Directory data schema

One YAML file per farm at `src/content/farms/<slug>.yaml`, validated by Zod in
`src/content/config.ts`. The schema in your brief is sound; I'm proposing these changes:

**Changes from the brief**

| Change | Why |
|---|---|
| `sources: {url, label, accessed}[]` instead of `string[]` | A bare URL rots. Per-source access dates let the re-verification job show *which* source is stale, and labels render as a readable citation list on the farm page. |
| Add `status: 'active' \| 'unconfirmed' \| 'closed' \| 'merged'` | Farms go under. Deleting an entry loses the URL and the research; a status field keeps provenance and lets closed entries 410 or redirect. |
| Add `geo_precision: 'exact' \| 'approximate' \| 'waterbody_only'` | Some growers list only a lease area or a dock. Honest precision beats a pin that looks exact and isn't. |
| Add `verification_notes?: string` (private-ish, not rendered) | Keeps the "why we believe this" next to the data. |
| `last_verified` as `YYYY-MM-DD` string coerced to Date | Keeps YAML diffs readable in review. |
| `oyster_brands` as `{name, waterbody?, sources}[]` | Brands are the `/oysters/` index's primary key and need their own citations. |
| `species` default `['Crassostrea virginica']` | As specified. Bay scallops/clams noted in `other_species`. |

**Hard validation rules (build fails, not warns)**

1. `sources.length >= 1` for every entry.
2. `last_verified` required and not in the future.
3. If `address`, `phone`, `email`, or `geo` is present, at least one source must be dated
   within 12 months — contact data is the fastest-rotting and highest-harm-if-wrong field.
4. `description` must be non-empty and is checked by a build-time script against fetched
   source text for long verbatim runs (anti-copy-paste guard).
5. `geo` requires `geo_precision`.
6. No entry may be published with a residential-looking address flag set; those go to
   `NEEDS_VERIFICATION.md` instead.

**Empty is a valid answer.** Any unverifiable field stays absent, the entry lands in
`data/NEEDS_VERIFICATION.md` with the specific open question, and the farm page renders
"Not listed" rather than hiding the gap.

---

## 3. Commerce architecture recommendation

**Recommendation: start with option 3 (affiliate) + Stripe for merch, and only move to
Shopify if monthly merch revenue clears roughly $300.**

Concretely, for launch:
- **Pans, trays, platters:** affiliate links with a visible disclosure. Zero inventory, zero
  fulfillment, zero liability, and it tells us which SKUs people actually click before we
  commit to a supplier.
- **Stickers and patches:** our own SKUs via Stripe Checkout. Stickers print-on-demand;
  patches as a held-inventory small batch shipped by you.

Pricing I verified this week (all third-party aggregators unless noted — these need a final
check on the vendors' own pages before you sign anything, and the vendors' own pages are the
only thing I'd put in a contract):

| Option | Monthly | Per transaction | Who fulfills what | Your manual work |
|---|---|---|---|---|
| **1. Shopify headless** (Storefront API in Astro islands, Shopify-hosted checkout) | Starter ~$5, Basic ~$39 ($29 annual) | Starter reportedly carries a 5% fee even on Shopify Payments; Basic ~2.9% + 30c, ~2% on third-party gateways | App ecosystem auto-routes pans/trays to a drop-ship supplier and stickers/patches to Printful/Printify. Patches you hold ship manually. | Least ongoing work, most setup. Also the heaviest CSP surface. |
| **2. Stripe Checkout / Payment Links** | $0 | ~2.9% + 30c US cards (+1.5% intl, +1% FX). Stripe Tax ~0.5%/txn on no-code, $0.50/txn on API — and Stripe Tax does **not** file or remit | Nothing automatic. Each order is emailed to you or posted to a supplier by hand/API. | Highest per-order labor. Fine at low volume, painful past ~2 orders/day. |
| **3. Affiliate + Stripe for merch** | $0 | Only on our merch SKUs | Pans/trays fulfilled entirely by the merchant we link to. Stickers via POD, patches by you. | Lowest risk, lowest revenue. Pure data-gathering phase. |

Why not Shopify on day one: $39/mo plus an app stack is real money against a site with no
traffic yet, Starter's reported 5% fee is worse than Stripe at any volume, and a Storefront
API island forces `connect-src`/`script-src` allowances into an otherwise tight CSP. Option 3
costs nothing, proves demand, and the migration to Shopify later is a swap of the shop
island — the products content collection and all product SEO copy stay put. That is the
architectural point: **product copy lives in the repo, price/inventory/checkout live at the
provider**, so the provider is replaceable.

POD caveat found in research: neither Printful nor Printify clearly publishes consumer
sticker/patch *product* pricing, and Printful's "free branded stickers" offer is a packaging
insert, not a sellable product. Apliiq appears repeatedly as the embroidery/patch specialist.
Treat patch sourcing as an open question (see §5) — bulk-order patches from a dedicated
embroidery shop is likely both cheaper and better quality than POD.

Non-negotiable regardless of option: card data never touches our code. Checkout is a redirect
or a provider-hosted iframe. Any webhook lands on a Pages Function that verifies the
signature before reading the body.

---

## 4. Third-party services needed

| Service | Role | Cost | Requires |
|---|---|---|---|
| Cloudflare Pages | Hosting, CI deploy target | Free tier | API token scoped **Pages:Edit on this project only**, account ID |
| Cloudflare DNS | Already live for the apex | Free | Apex + `www` records, `www` 301 to apex |
| Cloudflare Turnstile | Bot gate on `/submit/` and `/claim/` | Free | Site key (public) + secret key (Pages env var). Adds `challenges.cloudflare.com` to CSP |
| Cloudflare Web Analytics | Traffic, cookieless | Free | Beacon token. No cookie banner needed |
| GitHub | Repo, Actions, Dependabot, issue intake for submissions | Free | A fine-grained PAT for the submit Function to open issues, scoped to issues:write on this one repo |
| OpenStreetMap tiles | Map basemap | Free, with a usage policy | A real User-Agent/Referer and sane caching. If traffic grows, move to a tile provider with an SLA |
| Pagefind | Static search index, built at build time | Free, no service | Nothing — it's a build step, no runtime dependency |
| Stripe | Merch checkout | $0/mo, ~2.9%+30c | Business details, bank account. Live keys only in Pages env, never in repo |
| Sticker POD (Printful/Printify/other) | Sticker fulfillment | Per-unit | Account; final per-unit pricing still to confirm |
| Patch supplier (Apliiq or a bulk embroidery shop) | Patches | Per-unit + setup/digitizing | Quote needed; artwork |
| Email list | Newsletter, double opt-in | Kit free tier ~10k subs (1 automation, Kit branding); Buttondown free ~100 subs then ~$9/mo; MailerLite free tier recently cut to ~250-500 subs | Domain auth records (SPF/DKIM/DMARC). None of the sources I found confirmed double opt-in support — must verify in docs before committing |
| Lighthouse CI | Release gate | Free | Nothing, or a free LHCI server if we want history |

Sources for the above pricing — all secondary, all to be re-checked on vendor pages:
[Shopify pricing roundup](https://www.websitebuilderexpert.com/shopify-pricing),
[Shopify official](https://www.shopify.com/pricing),
[Stripe pricing](https://stripe.com/pricing),
[Stripe Tax pricing](https://support.stripe.com/questions/understanding-stripe-tax-pricing),
[Printful vs Printify](https://www.printful.com/printful-vs-printify),
[POD embroidery comparison](https://bootstrappingecommerce.com/best-print-on-demand-companies-custom-embroidery/),
[MailerLite pricing](https://www.mailmodo.com/guides/mailerlite-pricing/),
[Kit pricing](https://www.emailvendorselection.com/kit-pricing/).

**Running cost at launch: $0/month plus per-unit merch costs and Stripe fees.** That is the
whole argument for this stack.

---

## 5. Research sourcing — what I confirmed exists

I verified one primary source is live and current rather than assuming it:

- **Suffolk County Shellfish Aquaculture Lease Program — Inventory of Current Leases.** The
  page links a PDF, `2026-08-13_Inventory of Leases.pdf`, described as identifying "all leases
  currently in the Aquaculture Lease Program," plus an
  [ALP lease GIS viewer](https://gis.suffolkcountyny.gov/portal/apps/View/index.html?appid=6ae708a346f340ada850544fe25ce0fb)
  and [county open data](https://opendata.suffolkcountyny.gov/). Updated "periodically," no
  fixed cadence; current file is ~3 months old.
  [Page](https://suffolkcountyny.gov/Departments/Economic-Development-and-Planning/Planning-and-Environment/Environmental-Planning-and-Aquaculture/Aquaculture-Lease-Program/Inventory-of-Current-Leases)
- I have **not** yet read that PDF, so I do not know whether it carries leaseholder names,
  acreage, and waterbody. That is the first task of Phase 2, not an assumption in this plan.
- Suffolk County states its authority covers only conveyance of underwater land, not
  regulation — so **NYS DEC** is the right place for permit/shipper records, and I did not
  find a public DEC leaseholder list in this pass. A FOIL request may be the route.
- Still to work: Cornell Cooperative Extension Suffolk (marine program, SPAT), NY Sea Grant,
  town shellfish/mariculture programs, and each farm's own site and socials.

Important distinction that will shape the data: **a lease is not a business.** A lease list
gives leaseholders, which may be individuals, not public-facing farms. Only businesses that
publish themselves as businesses get listed, and a grower's personal name appears only if the
business publishes it. Leases without a public business presence are research leads in
`NEEDS_VERIFICATION.md`, not entries.

---

## 6. Open questions for you

Nothing below is mine to decide.

1. **Commerce:** approve the affiliate-first recommendation, or do you want Shopify from day one?
2. **Affiliate program:** Amazon Associates, or vet a specialty restaurant-supply/housewares
   program? Amazon is easiest and pays worst, and its disclosure requirements are specific.
3. **Patches:** do you want to hold inventory at launch, or POD-only until a SKU proves itself?
   And do you have artwork, or is that a design task?
4. **Email provider:** Kit's free tier is the only one that scales free, with Kit branding on
   emails. Acceptable, or pay for Buttondown's cleaner, developer-friendly setup?
5. **Brand name and voice:** site title/wordmark — "Long Island Oyster Farm," something else?
   Do you want a logo pass, or wordmark-only to start?
6. **Attribution:** does the site carry your name and a contactable email, or an alias plus a
   contact form? This affects trust with the farms you'll be asking to claim listings.
7. **Listing policy:** do unclaimed listings publish by default (opt-out), or only after the
   farm confirms (opt-in)? Opt-out builds a useful directory far faster; opt-in is friendlier
   to the farms. My read: publish opt-out, with a prominent correction path and same-day
   removal on request.
8. **Scope:** Long Island only, or include the NYC-side and Westchester Sound growers people
   conflate with LI? I'd stay strictly LI and say so.
9. **Legal pages:** approve that I draft shipping/returns/privacy/terms as clearly labeled
   templates for your review. They are not legal advice, and if real money flows you should
   have a lawyer read the terms and the raw-shellfish language.
10. **Map tiles:** OSM's public tiles per the brief. If you'd rather not depend on a
    community service, say so now — swapping later means a CSP change and possibly a bill.
11. **Repo name:** currently `li-oyster-project`. Rename to `longislandoysterfarm.com` to match
    the domain?

---

## 7. What happens on approval

Phase 1 delivers the Astro + TS strict + Tailwind scaffold, the single `ci-cd.yml` with
TruffleHog / Trivy / ESLint / Prettier / `astro check` / `npm audit` / build / Pages deploy /
Lighthouse CI at a 95 floor, Husky + lint-staged, Dependabot with SHA-pinned actions,
`public/_headers` with a strict CSP, and the five docs. Then it stops for review.
