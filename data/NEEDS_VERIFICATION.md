# Needs verification

Open questions and research leads. **Nothing on this page is published.** A lead becomes a
listing only when a public source supports it; see [RESEARCH_METHOD.md](RESEARCH_METHOD.md).

Last reviewed: 2026-11-21

---

## 1. Business-entity leaseholders not yet researched

The Suffolk County ALP snapshot (`data/raw/suffolk-alp-leases.json`, retrieved 2026-11-21)
holds 41 held lease sites across 33 distinct lessees. 25 look like registered business
entities. Two have been verified and published; **23 remain**, queued in
[`farm-leads.csv`](farm-leads.csv).

For each, the open question is the same: does a public, self-publishing business exist behind
this lease, and what does it say about itself?

Cherry Harbor Oysters LP · Cornelius & Little Ram Oyster Co. LLC · Davy Jones Landing LLC ·
East Hampton Oyster Company LLC · Founders Oyster Farm LLC · Empire State Shellfish Company
LLC · Hampton Oyster Co. LLC · JBH of Peconic Inc. · Long Island Shellfish Company Inc. ·
Manna Fish Farms Inc. · Meetinghouse Creek Fisheries Inc. · MK Family Aqua Farms LLC ·
Montauk Shellfish Company Inc. · Multi Aquaculture Systems Inc. · North Fork Big Oyster Corp.
(two entity spellings in the data — "Corp." and "Corporation" — possibly one business, do not
merge without evidence) · Olas Oyster Company Inc. · Oyster Bay Shellfish Co. LLC ·
Oysterponds Shellfish LLC · Polifarms LLC · Promised Land Mariculture Co., LLC · Sebonac Inlet
Oyster Farm LLC · Shellworks LLC · Southold Bay Oysters LLC · Spinelli's Sea Farm LLC ·
Tardif Aquaculture LLC · Weird Fishes Shellfish Co. LLC

Known partial findings, **not sufficient to publish**:

- _Montauk Shellfish Company_ — no official site found. One article refers to the owner's
  business as "Montauk Oyster Company", so the trading name may differ from the lease entity.
  Needs the business's own publication before any listing.
- _Oysterponds Shellfish_ — no official site found. Appears in a marketplace listing and local
  press associated with Orient; brand name unconfirmed from the business itself.
- _Founders Oyster Farm, Hampton Oyster Co., West Robins Oyster Co._ — appear in a third-party
  list of Long Island oyster companies with no web addresses given. **Note:** West Robins
  appears in the 2026-08 lease PDF but not in the current feature-service snapshot as a held
  lease; reconcile the two before concluding anything about its status.

## 2. Personal-name leaseholders — closed by policy, not open work

Eight lessees in the snapshot are personal names. Per
[RESEARCH_METHOD.md](RESEARCH_METHOD.md), these are **not** research targets and the names are
not republished. They are recorded here only as a count, so the queue is honest about what it
excludes. If one of these later turns out to be the lessee _behind_ a public business, the
listing is created from the business's own publications — never from the lease record.

## 3. Entire South Shore is missing

The ALP covers **Peconic and Gardiners Bay lease sites only**. The Great South Bay, Moriches
Bay and Shinnecock Bay growers work under **town** bottom-leasing programs — notably the Town
of Islip's — or on private oyster grants, and **none of them appear in the county dataset.**
Absence from the lease data is not evidence a farm does not exist.

This is the single biggest coverage gap. Needed:

- Town of Islip bottom-lease program: is there a public leaseholder list?
- Towns of Brookhaven, Babylon, Southampton (south side): equivalent programs and records
- Private oyster grant holders: Suffolk County publishes grant _parcels_ as a GIS layer
  (`PrivateOysterGrantPolygon`); does any public record tie a parcel to a current operator?

Specific unresolved lead: **Blue Island Oyster Company** — press and a non-profit page place a
hatchery in West Sayville and a farm off Captree, leasing bottom from the Town of Islip, with
tours offered. No official website confirmed, sources disagree on the founding year (2000 vs
~1995 vs a 2005 purchase), and the owner's name appears in press but has not been confirmed as
self-published by the business. **Do not publish any of this** until the business's own
material is read.

## 4. Hatcheries, nurseries and programs

None are in the lease data — they hold no bay lease. Open work:

- **Cornell Cooperative Extension of Suffolk County / SPAT** at the Suffolk County Marine
  Environmental Learning Center, Cedar Beach Road, Southold. Two problems to resolve before
  listing: sources give **two different street numbers** (3690 and 3960 Cedar Beach Road), and
  the acronym is expanded two ways by CCE's own pages ("Southold Project in Aquaculture
  Training" and "Suffolk Project in Aquaculture Training"). Verify both against CCE's own
  current pages and record which spelling CCE uses where.
- Town-run shellfish hatcheries and spawner-sanctuary programs: which towns run one, and does
  each publish a public-facing page?
- Commercial hatcheries supplying LI growers: who, and do they sell seed publicly?

## 5. Per-listing open questions

**Little Ram Oyster Co.** — `town`/`hamlet` deliberately empty: the site states only "Long
Island's North Fork". A lease to "Cornelius & Little Ram Oyster Co. LLC" sits in Shelter
Island township; relating that entity to this business is an inference and has not been made.
Phone, address, wholesale, shipping, farming method and restoration involvement not stated on
the homepage. Sub-pages not yet read.

**Peconic Gold Oysters** — wholesale, tours, shipping and farming method not stated on the
homepage; sub-pages not yet read. No `geo` set: the farmstand address is published but has not
been geocoded from a source we control, and the lease centroid is a point in the water, not
the stand. The site's own footer misspells the hamlet ("Cutghogue"); listing uses Cutchogue.

## 6. Structural gaps

- **No geocoding source yet.** Both published listings have a waterbody and one has a street
  address, but neither has coordinates, so `/map/` currently has nothing to plot. Decide on a
  geocoding approach that is licence-compatible and auditable before adding any pin.
- **No brand index depth.** `/oysters/` is built from `oyster_brands`, which has two entries.
  Named LI oyster brands (Blue Points, Naked Cowboy, Peeko, Montauk Pearl, Widow's Hole and
  others seen in press) each need the grower link verified from the grower's own material.
- **LIOGA has no public member list.** The association's site advertises a "local oyster farm
  map and online member profiles" as a member benefit, but no member list is published —
  it appears to sit behind a member login. It is therefore not usable as a source, and its
  absence is a large part of why this directory is worth building.
- **Lease PDF vs feature service.** The 2026-08-13 inventory PDF and the live GIS feature
  service do not contain an identical set of lessees. Reconcile them and document which is
  authoritative for which field.

## 7. Guides drafted but not published (Phase 3)

Six guides were planned. **Two are published** (`raw-oysters-and-vibrio`,
`shucking-safely`), because CDC and FDA pages supplied quotable, attributable text for every
factual claim in them. The other four are **not published**, because publishing them would
have meant asserting things we could not source. Each one below lists the specific facts that
are missing — the point of writing them down is that a gap recorded here does not quietly
become a guess in a later edit.

Two sources we wanted and could not read, which affect several of these:

- **NYS Department of Health vibriosis pages** (`health.ny.gov/diseases/communicable/
vibriosis/`) returned HTTP 403 to every automated fetch. This is the New York-specific
  advisory and the one that would state NY months and NY risk-group language. Needs a manual
  read by a human in a browser.
- **NYS DEC shellfishing pages** have moved; the current paths are
  `dec.ny.gov/things-to-do/shellfishing/closures` and
  `dec.ny.gov/things-to-do/shellfishing/regulatory-changes-for-harvest-areas`. Not yet read in
  full.

### 7.1 Storing and preserving live oysters

**Missing:** every specific storage instruction. The FDA's general seafood guidance gives
"40 °F or below" for use within two days and the tap test, and that is all we have from an
official source. **Unsourced:** cup-side-down storage, damp cloth vs sealed container, never
submerging in fresh water, how many days live oysters actually keep, and any sign of a dead
oyster beyond the tap test. All of this is widespread received wisdom and is probably correct,
which is exactly why it is dangerous to assert — needs a university extension or state
shellfish-program publication.

### 7.2 Long Island seasons and merroir by waterbody

**Missing:** essentially all of it, and this is the guide with the highest fabrication risk on
the whole site. Per-waterbody flavour claims ("Peconic is sweeter", "Blue Point is brinier")
are repeated endlessly in press and by growers, but we have no source that is both
authoritative and specific enough to attribute. **Unsourced:** spawning timing in LI waters,
how spawning affects texture, salinity ranges by bay, and any claim that one bay tastes
different from another. Candidate sources: NY Sea Grant, Cornell Cooperative Extension Suffolk,
peer-reviewed work on Peconic/Great South Bay salinity. **Do not write this guide from
tasting notes.**

### 7.3 Hosting an oyster party

**Missing:** quantities per person, ice/handling logistics, and timing. Low stakes compared to
the rest — nothing here is a health claim — but "a dozen per person" is still a factual claim
and the safety-adjacent parts (how long a shucked tray can sit out, holding temperature) are
not. Needs the FDA time/temperature guidance for shucked shellfish held for service, which we
have not yet located.

### 7.4 Restoration and the bays

**Missing:** the programs themselves. Every URL we guessed for the operators 404'd, so we have
**not confirmed the official name, operator, waterbodies or public-participation route** for
any Long Island restoration program. Specifically unresolved:

- **CCE Suffolk "SPAT"** — two conflicting expansions of the acronym appear on CCE's own
  pages, and two different street numbers for the same facility (3690 vs 3960 Cedar Beach
  Road). Neither is settled. This duplicates item 4 above; it blocks both a listing and this
  guide.
- **Shinnecock Bay restoration (Stony Brook)** — the program is real and widely covered, but
  `stonybrook.edu/shinnecock-bay/` 404s and we have not found the current official page, so
  the program's exact name and scope are unconfirmed.
- **Town-level programs** (Islip, Brookhaven, Oyster Bay, Huntington) — unresearched.

Writing a restoration guide that misnames a program or credits the wrong organisation would be
worse than not having one, because the organisations involved are the people most likely to
read it.

## 8. Not a data gap, but blocking a Phase 3 feature

- **Email signup provider.** The brief asks for a double opt-in email signup. No candidate's
  double opt-in behaviour has been confirmed in vendor documentation, and the provider choice
  is the owner's. **Nothing was built**, rather than wiring a provider and assuming its
  confirmation flow. See `docs/PLAN.md` §6.
