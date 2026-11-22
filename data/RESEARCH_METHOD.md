# Research method

How a listing on longislandoysterfarm.com comes to exist. The short version: a fact gets
published only when a public source says it, and the listing records which source and when.

## The standard

Every published fact traces to one of:

1. **The business's own published material** — its website, its own social accounts, its own
   price list. This is the best source for what a farm sells, how it sells it, and what it
   calls its oysters.
2. **A government record** — the Suffolk County Shellfish Aquaculture Lease Program inventory
   and its GIS feature services; NYS DEC shellfish and aquaculture material; town shellfish or
   mariculture program pages.
3. **An institutional program** — Cornell Cooperative Extension of Suffolk County (marine
   program, SPAT), New York Sea Grant.
4. **Named press or non-profit coverage**, used only for colour and never as the sole source
   for a contact detail, an address, or an operational claim.

If none of those says it, it does not go on the site. Not as a hedge, not as "likely", not as
a plausible inference. The field stays empty and the question goes in
[NEEDS_VERIFICATION.md](NEEDS_VERIFICATION.md).

## What we refuse to do

- **No inferring a business from a lease.** A lease is a property record. Many lessees are
  private individuals with no public business; some businesses hold no lease at all.
- **No personal names.** A grower's name appears only where the business itself publishes it
  (an "about" page, a quoted owner on its own site). Lease records name individuals; those
  names are not republished.
- **No private addresses.** Only an address the business itself publishes as a place of
  business. Never a residence, even when a public record ties it to the operation.
- **No exact-looking pins we cannot stand behind.** `geo` always carries `geo_precision`. A
  lease centroid is a point in the water, not a place to visit, and is never used as a
  business location.
- **No copied descriptions.** Every `description` is written here. A farm's own words belong
  to the farm.
- **No filling a gap with a plausible guess.** Common sense is not a source.

## The pipeline

```
1. Pull the lease inventory      scripts/research/fetch-suffolk-leases.mjs
                                 -> data/raw/suffolk-alp-leases.json  (dated snapshot)

2. Turn leases into leads        scripts/research/leases-to-leads.mjs
                                 -> data/farm-leads.csv               (research queue)

3. Verify each lead by hand      the business's own site and public records
                                 -> data/farms.csv                    (reviewable in a sheet)

4. Convert approved rows         scripts/research/csv-to-yaml.mjs
                                 -> src/content/farms/<slug>.yaml     (published listings)

   Round-trip back out           scripts/research/yaml-to-csv.mjs

5. Gates                         npm run verify:data   (sources, dates, geo precision)
                                 npx astro check       (Zod schema)
```

Steps 1, 2, 4 and 5 are scripted and repeatable. **Step 3 is deliberately manual.** Deciding
whether a lessee is a public business, whether an address is commercial, and whether a farm
still operates is judgement, and automating judgement here is how a directory ends up
confidently wrong.

## What the lease data does and does not cover

The Suffolk County ALP covers **lease sites in the Peconic and Gardiners Bay system only**.
It does not include:

- South Shore growers (Great South Bay, Moriches Bay, Shinnecock Bay), who work under **town**
  bottom-leasing programs such as the Town of Islip's, not the county ALP
- growers on **private oyster grants**, a separate and much older form of underwater title
- hatcheries, nurseries and upwellers, which hold no bay lease
- community and restoration programs

So **absence from the lease data is not evidence that a farm does not exist.** South Shore
coverage has to be built from town programs and the farms' own publications, and that is
tracked as open work.

## Re-verification

A listing's `last_verified` is the date a human last checked it against its sources.
`npm run verify:stale` lists anything older than roughly six months. Contact-level fields
(`address`, `phone`, `email`, `geo`) additionally require a source accessed within 12 months,
enforced by `scripts/verify-data.mjs` — stale contact data is the fastest way to send someone
to a farm that closed.

## Corrections

Any farm can correct or remove its listing through `/claim/` or `/submit/`. A removal request
is honoured without argument and without requiring proof of ownership: the cost of removing a
real farm that wants out is far lower than the cost of publishing something a farm says is
wrong. Nothing auto-publishes; every submission is reviewed by a person.
