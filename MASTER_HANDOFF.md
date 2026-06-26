# MASTER_HANDOFF.md — Propedia Ground Truth
_Generated from actual file reads + git log. Last updated: 2026-06-26_

---

## 1. PROJECT SNAPSHOT

| Key | Value |
|-----|-------|
| **Live URL** | https://propedia.ca |
| **Repo** | https://github.com/adwbackup26-dev/propedia-website |
| **Stack** | React 18 + Vite, Vercel serverless (Node 20), TRREB OData API |
| **Deployment** | Push to `main` → Vercel auto-deploys (no manual step) |
| **Phase** | Phase 1 — Polish (feature-complete, pre-launch QA) |
| **Launch target** | Imminent — pending mobile QA + smoke test |
| **Compliance** | RECO #6011384, IDX #1860304, MLS®/REALTOR® trademarks of CREA |

**Two-chat workflow:**
- **Claude Chat** = strategist (UX decisions, feature scoping, debugging theory)
- **Claude Code** = executor (reads files, writes code, commits, deploys)
- Never implement without reading the actual files first. Reconstructed code breaks things.

---

## 2. ARCHITECTURE

```
propedia-website/
├── api/                    # Vercel serverless functions (ES module, export default)
│   ├── listing.js          # GET /api/listing?listingKey=X  — single listing detail (VOW token)
│   ├── listings.js         # GET /api/listings?...          — paginated search (IDX token)
│   ├── photos.js           # GET /api/photos?listingKey=X   — media from TRREB Media endpoint
│   └── maptoken.js         # GET /api/maptoken              — Mapbox token proxy
├── src/
│   ├── pages/
│   │   ├── ListingsPage.jsx       # Main search page: URL state, autocomplete, filter modal
│   │   ├── ListingDetailPage.jsx  # Detail page: Signal, PriceSqFt, MarketVelocity, Calculator
│   │   └── MapSearchPage.jsx      # Map view page
│   ├── components/
│   │   ├── FilterModal.jsx        # Bottom-sheet filter: search + applied chips + filters
│   │   ├── Signal.jsx             # Market signals (timing, price positioning, area supply)
│   │   ├── PriceSqFt.jsx          # $/sqft vs area comparables (tabs: This | Comps)
│   │   ├── ListingCard.jsx        # Card component for search results grid
│   │   ├── PriceHistorySection.jsx # Price history chart component
│   │   └── VOWSignupWall.jsx       # VOW email gate (triggers Airtable lead capture)
│   ├── hooks/
│   │   └── useListings.js         # All listings state: filters, pagination, fetch, VOW session
│   └── styles/
│       └── listings.css           # Dark theme CSS, mobile breakpoints, detail page grid
├── public/
│   ├── ITERATION-LOGO.png         # Transparent PNG logo (processed with pngjs)
│   └── images/qr-codes/           # QR code assets
└── index.html                     # Tabicon: ITERATION-LOGO.png + favicon.svg
```

**Data flow: user search → listings render**
```
User types city in nav search bar
  → SearchAutocomplete (AC_ALL list in ListingsPage.jsx)
  → commitSuggestion() sets URL params (?city=Mississauga)
  → applyWith({ city: 'Mississauga' }) called on useListings
  → applied state updates → useEffect fires → fetchListings()
  → URLSearchParams built → GET /api/listings?city=Mississauga
  → api/listings.js → startswith(City,'Mississauga') OData filter
  → TRREB OData API at https://query.ampre.ca/odata/Property
  → JSON response → setListings() → ListingCard grid re-renders
```

**State management:** URL params are the source of truth. On page load, `urlToModal()` and `urlToApiFilters()` parse `window.location.search` to hydrate filter state. No localStorage for filters (only VOW session + compare state use sessionStorage/localStorage).

**Airtable integration:** VOW signups POST to `/api/airtable-vow` (or similar) → `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID=appzFQTk6s4GA3B0x` in Vercel env vars only — never in code. Captures: email, name, phone, ListingAddress, ListingKey, Timestamp to 'Leads' table.

---

## 3. TRREB API — CRITICAL RULES (NEVER BREAK)

### Base URL
```
https://query.ampre.ca/odata/Property   (listings)
https://query.ampre.ca/odata/Media      (photos)
```

### Query string building — MANUAL encodeURIComponent only
```js
// ✅ CORRECT — manual build with encodeURIComponent
const queryParts = [
  `$filter=${encodeURIComponent(filterString)}`,
  `$top=${top}`,
  `$skip=${skip}`,
  `$orderby=${encodeURIComponent(sortBy + ' ' + sortDir)}`,
  `$select=${encodeURIComponent(select)}`,
  `$count=true`,
];
const url = `${RESO_BASE}?${queryParts.join('&')}`;

// ❌ NEVER — URLSearchParams double-encodes OData operators and breaks queries
const url = `${RESO_BASE}?${new URLSearchParams({ $filter: filterString })}`;
```

### $expand=Media — NEVER use on listings endpoint
The Media expand causes timeout/error on the Property endpoint. Photos are fetched separately via `api/photos.js` which hits the dedicated Media endpoint.

### $select — MUST be explicit, validated field names only
TRREB returns a **400 error** if any field in `$select` doesn't exist in their schema. This causes "Listing not found" on the detail page. Lessons from failed fields:
- ❌ `AboveGradeFinishedArea` — not in TRREB RESO schema
- ❌ `BelowGradeFinishedArea` — not in TRREB RESO schema
- ❌ `ApproximateSquareFootage` — not in TRREB RESO schema
- ❌ `ListDate` — not in TRREB RESO schema
- ❌ `DaysOnMarketCumulative` — not in TRREB RESO schema
- ✅ `LivingAreaRange` — confirmed working (string like "1500-2000")
- ✅ `OriginalEntryTimestamp` — confirmed working (ISO timestamp)
- ✅ `DaysOnMarket` — exists but is 0 for active listings (see §3 below)

### District code mapping — Scarborough / Etobicoke / North York
TRREB stores City as district codes, not plain city names:
```
"Scarborough"  → City field: "Toronto E01" through "Toronto E11"
"Etobicoke"    → City field: "Toronto W01" through "Toronto W10"
"North York"   → City field: "Toronto C01" through "Toronto C15"
"East York"    → City field: "Toronto E01" through "Toronto E05" (subset)
```
**Fix:** Use `startswith(City,'Toronto E')` not `City eq 'Scarborough'`

In `api/listings.js` (line 56):
```js
if (city) filters.push(`startswith(City,'${city.replace(/'/g, "''")}')`);
```

In `AC_ALL` autocomplete list (ListingsPage.jsx):
```js
ac('Scarborough', 'Toronto District', 'city', '', '', 'Toronto E'),
ac('Etobicoke',   'Toronto District', 'city', '', '', 'Toronto W'),
ac('North York',  'Toronto District', 'city', '', '', 'Toronto C'),
ac('East York',   'Toronto District', 'city', '', '', 'Toronto E0'),
```

The `searchCity` property (e.g. `'Toronto E'`) is what gets passed to the API via `commitSuggestion` and `applyWith({ city: s.searchCity || s.label })`.

### DaysOnMarket behavior
- **Active listings:** `DaysOnMarket` is 0 or absent. Use `OriginalEntryTimestamp` fallback.
- **Sold listings:** `DaysOnMarket` is set (final DOM). Use directly.

```js
// calcDOM — used in both Signal.jsx and MarketVelocity (ListingDetailPage.jsx)
function calcDOM(listing) {
  if (listing.DaysOnMarket > 0) return listing.DaysOnMarket;
  if (listing.OriginalEntryTimestamp) {
    const ms = Date.now() - new Date(listing.OriginalEntryTimestamp).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }
  return null; // truly unknown
}
```

### Pagination
```
$top = Math.min(parseInt(limit) || 20, 50)   // max 50 per page
$skip = (page - 1) * top
$count=true                                   // returns @odata.count for total
```

### Photo deduplication
TRREB returns 5 variants per photo (original, -l, -m, -nw, -t). Keep only originals:
```js
// api/photos.js line 81
if (m.MediaKey.match(/-(l|m|nw|t)$/)) return false;
```

---

## 4. WHAT WE BUILT — VERIFIED IMPLEMENTATIONS

### Signal logic (`src/components/Signal.jsx`)
```js
function calcDOM(listing) {
  if (listing.DaysOnMarket > 0) return listing.DaysOnMarket;
  if (listing.OriginalEntryTimestamp) {
    return Math.max(0, Math.floor((Date.now() - new Date(listing.OriginalEntryTimestamp).getTime()) / 86400000));
  }
  return 0;
}

function computeSignals(listing, areaCount) {
  const isSold = listing.StandardStatus === 'Closed';
  const dom    = calcDOM(listing);
  // Signal 1: Market timing (dom vs thresholds, different text for sold vs active)
  // Signal 2: Price positioning (sold: ClosePrice vs ListPrice; active: price reduction)
  // Signal 3: Area competitiveness (areaCount from postal code API call)
  // Signal 4: Property age (YearBuilt, appended if signals.length < 3)
  return signals.slice(0, 3); // max 3 shown
}
```
Area count fetched via: `GET /api/listings?page=1&limit=1&postalCode={prefix}` → uses `d.total`.

### DaysOnMarket fallback (`MarketVelocity` in `src/pages/ListingDetailPage.jsx`)
```js
function calcDOM(listing) {
  if (listing.DaysOnMarket > 0) return listing.DaysOnMarket;
  if (listing.OriginalEntryTimestamp) {
    const ms = Date.now() - new Date(listing.OriginalEntryTimestamp).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }
  return null;
}
```
Returns `null` → renders "data not available" gracefully.

### Scarborough/Etobicoke filter (`api/listings.js` line 56)
```js
if (city) filters.push(`startswith(City,'${city.replace(/'/g, "''")}')`);
```

### Filter search triggers fetch (`src/hooks/useListings.js` line 55 + 59)
```js
// Fetch fires when 'applied' changes (not 'filters')
useEffect(() => { fetchListings(applied, page); }, [applied, page, fetchListings]);

// applyWith immediately updates both filters + applied → triggers fetch
const applyWith = useCallback(patch => {
  setFiltersState(p => { const next = { ...p, ...patch }; setApplied(next); return next; });
  setPage(1);
}, []);
```
`handleApplyFilters` in ListingsPage.jsx calls `applyWith({ city: m.city || '', ... })` — city must be explicitly included or it's silently ignored.

### LivingAreaRange in `$select` (`api/listing.js` line 39)
```js
const select = [
  'ListingKey', 'ListingId', 'StandardStatus', 'TransactionType',
  'ListPrice', 'OriginalListPrice', 'ClosePrice',
  'UnparsedAddress', 'StreetNumber', 'StreetName',
  'UnitNumber', 'City', 'StateOrProvince', 'PostalCode',
  'BedroomsTotal', 'BathroomsTotalInteger',
  'PropertyType', 'PropertySubType',
  'YearBuilt', 'ParkingTotal',
  'LivingAreaRange',                                        // ← added; was missing
  'CloseDate', 'DaysOnMarket', 'OriginalEntryTimestamp', 'ModificationTimestamp',
  'ListAgentFullName', 'ListOfficeName',
  'PublicRemarks', 'Latitude', 'Longitude',
  'InternetEntireListingDisplayYN',
].join(',');
```

### Photo dedup filter (`api/photos.js` line 81)
```js
const photos = (data.value || [])
  .filter(m => {
    if (m.MediaCategory !== 'Photo') return false;
    if (!m.MediaURL) return false;
    if (m.MediaKey.match(/-(l|m|nw|t)$/)) return false;  // ← keep originals only
    return true;
  })
  .sort((a, b) => {
    if (a.PreferredPhotoYN && !b.PreferredPhotoYN) return -1;
    if (!a.PreferredPhotoYN && b.PreferredPhotoYN) return 1;
    return (a.Order || 999) - (b.Order || 999);
  })
```

---

## 5. BUGS FIXED — NEVER REPEAT THESE

### Bug 1: Scarborough/Etobicoke showing 0 listings
- **Symptom:** Search "Scarborough" → 0 results
- **Root cause:** API sent `City eq 'Scarborough'` but TRREB stores `City = 'Toronto E08'`
- **Fix:** Changed to `startswith(City,'Toronto E')` + added `searchCity` property to AC_ALL entries
- **Files:** `api/listings.js:56`, `src/pages/ListingsPage.jsx` (AC_ALL, commitSuggestion)
- **Lesson:** TRREB City field = district codes, not plain names. Always use `startswith` for Toronto districts.

### Bug 2: DaysOnMarket showing 0 for active listings
- **Symptom:** All active listings show "0 days" / "Just listed"
- **Root cause:** TRREB doesn't populate `DaysOnMarket` for active listings (only for sold)
- **Fix:** `calcDOM()` falls back to `Math.floor((now - OriginalEntryTimestamp) / 86400000)`
- **Files:** `src/components/Signal.jsx:15-21`, `src/pages/ListingDetailPage.jsx:47-54`
- **Lesson:** Never trust `DaysOnMarket > 0` on active listings. Always have OriginalEntryTimestamp fallback.

### Bug 3: LivingAreaRange blank on detail page
- **Symptom:** PriceSqFt component always shows "Square footage not reported"
- **Root cause:** `LivingAreaRange` was missing from the `$select` in `api/listing.js`
- **Fix:** Added `'LivingAreaRange'` to the select array
- **Files:** `api/listing.js:39`
- **Lesson:** Detail page (`listing.js`) and list page (`listings.js`) have separate `$select` arrays. Adding a field to one doesn't add it to the other.

### Bug 4: Detail page showing "Listing not found" after adding fields
- **Symptom:** After adding candidate audit fields, all detail pages returned 404
- **Root cause:** TRREB returns HTTP 400 for any unknown field in `$select`. Fields `AboveGradeFinishedArea`, `BelowGradeFinishedArea`, `ApproximateSquareFootage`, `ListDate`, `DaysOnMarketCumulative` don't exist in TRREB's schema.
- **Fix:** Removed all unconfirmed candidate fields, kept only verified ones
- **Files:** `api/listing.js`
- **Lesson:** Never add a field to `$select` without first confirming it exists in TRREB's schema. One bad field name kills the entire query.

### Bug 5: Filter search not triggering API fetch
- **Symptom:** Typing city in filter modal changed URL but listings didn't update
- **Root cause:** `handleApplyFilters` called `applyWith({...})` without including `city: m.city`. City was written to URL only, never to `applied` state. `useEffect` only fires when `applied` changes.
- **Fix:** Added `city: m.city || ''` to the `applyWith({})` call
- **Files:** `src/pages/ListingsPage.jsx:628` (handleApplyFilters)
- **Lesson:** `applyWith` is the only path to trigger a fetch. URL writes and `setModalValues` alone do nothing. Every filter key must be in the `applyWith` call.

### Bug 6: Logo white box artifact on mobile
- **Symptom:** Logo appeared with dark background box, especially on mobile
- **Root cause:** The original ITERATION-LOGO.png had a baked-in dark background (#1f1f1e / #0c0d10)
- **Fix:** Processed PNG with pngjs to sample corner pixels, removed background via euclidean distance threshold, made ~96% of pixels transparent
- **Files:** `public/ITERATION-LOGO.png` (binary asset, processed offline)
- **Lesson:** `mix-blend-mode: screen` is not a substitute for true PNG transparency. Always ensure logo PNGs are transparent before importing.

### Bug 7: Mobile header cramped at 390px
- **Symptom:** Nav search field squished to ~20px on iPhone 14 viewport
- **Root cause:** Wordmark + signup button + logo consumed all flex space
- **Fix:** Hide `.mp-nav__wordmark` and `.mp-nav__signup` at ≤480px
- **Files:** `src/styles/listings.css:171-173`
- **Lesson:** Always test at 390px (iPhone 14). Flex navbars with 4+ items need a mobile breakpoint that hides non-essential items.

---

## 6. ANTI-PATTERNS (never try again)

| Anti-pattern | Why it failed |
|---|---|
| `URLSearchParams` for TRREB query params | Double-encodes OData `$filter`, `$orderby` etc. — TRREB rejects the malformed query |
| `$expand=Media` on Property endpoint | Causes timeout/500 on TRREB — photos must come from the Media endpoint separately |
| `mix-blend-mode: screen` for logos | Only works on pure black backgrounds; any slight color variation shows as artifact |
| Assuming `DaysOnMarket` is populated for active listings | TRREB only sets it on closed listings; active listings always have 0 |
| `City eq 'Scarborough'` | TRREB City field = district codes. Must use `startswith(City,'Toronto E')` |
| Adding unverified fields to `$select` | TRREB returns 400 for any unknown field, killing the entire query |
| Bundling multiple bug fixes in one prompt | Makes bisecting failures impossible; one bad fix masks others |
| Hardcoding "Fairly Priced" / "B+" / "82/100" | Fake intelligence erodes trust; removed in Insights redesign |

---

## 7. CURRENT FILE STATE

| File | What it does | Edge cases / fragility |
|---|---|---|
| `api/listings.js` | Paginated listing search with OData filters; IDX token | Max 50/page enforced; `startswith` for city/postalCode to avoid district code mismatch |
| `api/listing.js` | Single listing detail by ListingKey; VOW token for ClosePrice | Skips `InternetEntireListingDisplayYN` filter for sold listings — check it in code after fetch |
| `api/photos.js` | Fetches Media records, deduplicates 5-variant TRREB photos | Filter regex `/-(l|m|nw|t)$/` on MediaKey — if TRREB changes naming, dedup breaks |
| `src/hooks/useListings.js` | All listings state: filters, applied, page, fetch, abort | Fetch only fires when `applied` changes, not `filters`. Must use `applyWith()` not `setFilters()` to trigger fetch |
| `src/pages/ListingsPage.jsx` | Search UI, autocomplete (AC_ALL), filter modal wiring, URL ↔ state sync | `modalToURL` and `urlToModal` must stay in sync; city must be in both modal state AND applyWith call |
| `src/pages/ListingDetailPage.jsx` | Full detail view: Signal, PriceSqFt, MarketVelocity, Calculator, map | MarketVelocity and Signal share `calcDOM` logic; MarketVelocity is inline (not extracted to separate file) |
| `src/components/FilterModal.jsx` | Bottom-sheet with search input + applied chips + filter controls | `city` field in DEFAULT_MODAL; debounced auto-apply on search input (300ms); applies immediately on chip removal |
| `src/components/Signal.jsx` | Market signal badges (up to 3); makes API call for area listing count | If `OriginalEntryTimestamp` is ever missing, `calcDOM` returns 0 → "Just listed" badge |
| `src/components/PriceSqFt.jsx` | $/sqft for this listing + area comparables from same postal prefix | Only works if `LivingAreaRange` is in listing detail `$select` (was missing, now fixed); area comparables are active-only |
| `src/styles/listings.css` | All CSS for listings and detail pages including mobile breakpoints | Mobile hide rules at ≤480px; detail page 2-col grid at >768px; safe-area-inset-bottom in footer |

---

## 8. DESIGN SYSTEM (verified)

| Token | Value |
|---|---|
| Page background | `#0C0D10` |
| Card background | `#161719` |
| Teal accent | `#00B4A8` |
| Teal dark (hover) | `#009E94` |
| Text primary | `rgba(255,255,255,.85)` |
| Text secondary | `rgba(255,255,255,.55)` |
| Text muted | `rgba(255,255,255,.3)` |
| Border default | `rgba(255,255,255,.06)` |
| Border medium | `rgba(255,255,255,.14)` |
| Typography | DM Sans (Google Fonts), 300/400/500/600 |
| Mobile breakpoint | ≤480px (very small), ≤768px (mobile) |
| Touch target min | 44px height |
| Logo | `public/ITERATION-LOGO.png` — transparent PNG, CSS: `filter: brightness(1.1) drop-shadow(0 0 4px rgba(0,180,168,.4))` |
| Card style token | `{ background:'#161719', borderRadius:10, border:'1px solid rgba(255,255,255,.06)', padding:'15px 17px', marginBottom:11 }` |
| Section header token | `{ fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', ... }` |

---

## 9. WHAT'S NEXT (immediate priorities)

1. **Basement rental as property structure filter** — Add "Basement" to STRUCTURES array in FilterModal.jsx; map to appropriate TRREB PropertySubType. Requires research: what is the TRREB PropertySubType for basement apartments?

2. **Mobile QA — full 390px pass** — Open propedia.ca on iPhone (or DevTools 390×844). Check:
   - Nav bar (logo + search visible, no overflow)
   - Filter modal (all sections scrollable, chips wrap, footer buttons full-width)
   - Detail page (cards stack, images correct height, Signal/PriceSqFt readable)
   - PriceSqFt tab bar (both tabs tappable at 44px+)

3. **Signal card color backgrounds** — Currently plain `rgba(255,255,255,.03)` background on signal rows. Add subtle color wash matching the signal color (e.g. `rgba(52,211,153,.05)` for green signals).

4. **Final smoke test + production deploy** — Verify on real device: search works, detail opens, photos load, filter modal applies correctly, VOW wall triggers, Airtable capture fires.

---

## 10. DEBUG WORKFLOW — TRREB API ISSUE

When a feature breaks or returns wrong data:

1. **Open propedia.ca** → F12 → Network tab → filter by "api"

2. **Reproduce the issue** (search city, open listing, etc.)

3. **Find the API call** (e.g. `GET /api/listings?city=Mississauga` or `/api/listing?listingKey=X13211462`)

4. **Click the request** → Headers tab → check Status Code
   - `200` but wrong data → look at Response tab, check field values
   - `400` → TRREB rejected the query. Usually a bad field in `$select` or malformed filter
   - `404` from our API → listing not found (may be expired/sold/opted-out)
   - `500` → our serverless function crashed — check Vercel logs

5. **Check Response tab** — paste the raw JSON. Look at:
   - Is `DaysOnMarket` = 0 or missing? → Use `OriginalEntryTimestamp`
   - Is `LivingAreaRange` null/empty? → TRREB doesn't report sqft for this listing
   - Is `City` = "Toronto E08"? → That's Scarborough, not "Scarborough"

6. **Check Vercel logs** (vercel.com → project → Functions → click function name)
   - `[listings] URL: ...` log shows exact TRREB query URL
   - Look for `TRREB error: 400` followed by the error body — it names the invalid field

7. **Test TRREB query directly** — copy the URL from the log, swap Bearer token with your own, run in Insomnia/curl. Isolate which part of `$filter` or `$select` fails.

8. **Fix rule:** Only change one thing at a time. Test before committing. Never add unverified field names to `$select`.

---

## 11. GIT LOG

```
47dcf09 fix: pass city to applyWith so filter modal search triggers fetch
e7e2693 fix: Auto-apply city filter as user types (debounced)
43d5820 feat: Live filter updates - apply immediately on city/filter change
fcab2bc feat: Add search input + applied filters chips to filter modal
a519021 fix: Signal uses OriginalEntryTimestamp fallback for DaysOnMarket
482b7e7 fix: compute DaysOnMarket from OriginalEntryTimestamp when TRREB field is 0
1b88f45 fix: remove invalid TRREB fields from listing detail $select
c63420e fix: add LivingAreaRange + candidate area/date fields to listing detail API
f0fe283 feat: Redesign Insights tab with Signal, PriceSqFt, MarketVelocity
87a3907 fix: Fix mobile nav at 390px — hide wordmark + signup, wrap toolbar
f286d39 fix: Make logo background truly transparent (remove baked-in dark bg)
f00bdbc fix: Remove logo background artifact using mix-blend-mode screen
05fedd7 fix: Scarborough/Etobicoke use TRREB district prefix codes (Toronto E/W/C)
ca5eefb fix: Scarborough/Etobicoke/North York/East York show 0 listings
c13a118 feat: Add Propedia text next to logo in all page headers
```

---

## 12. QUICK REFERENCE

### TRREB District Code Table (GTA)

| Display name | City field prefix | Notes |
|---|---|---|
| Toronto (central) | `Toronto C` | C01–C15, downtown + midtown |
| Etobicoke | `Toronto W` | W01–W10, west Toronto |
| Scarborough | `Toronto E` | E01–E11, east Toronto |
| North York | `Toronto C` | C01–C15 (overlaps with central) |
| East York | `Toronto E0` | E01–E05, inner east |
| Mississauga | `Mississauga` | Direct match |
| Brampton | `Brampton` | Direct match |
| Oakville | `Oakville` | Direct match |
| All others | Direct city name | Burlington, Vaughan, Markham, etc. |

### Key TRREB field names (confirmed working)

| Field | Type | Notes |
|---|---|---|
| `ListingKey` | string | Primary key, e.g. "X13211462" |
| `ListingId` | string | MLS number |
| `StandardStatus` | string | "Active" or "Closed" |
| `TransactionType` | string | "For Sale" or "For Lease" |
| `ListPrice` | number | Current asking price |
| `OriginalListPrice` | number | Original ask (before reductions) |
| `ClosePrice` | number | Sold price — requires VOW token |
| `City` | string | District code, e.g. "Toronto E08" |
| `PostalCode` | string | e.g. "M1P 4Z2" |
| `PropertyType` | string | "Residential Freehold" or "Residential Condo & Other" |
| `PropertySubType` | string | "Detached", "Condo Apt", "Att/Row/Twnhouse", etc. |
| `BedroomsTotal` | number | Total bedrooms |
| `BathroomsTotalInteger` | number | Total bathrooms |
| `LivingAreaRange` | string | "1500-2000" — parse midpoint for $/sqft |
| `DaysOnMarket` | number | 0 for active; actual DOM for sold |
| `OriginalEntryTimestamp` | ISO string | Listing date — use for active DOM calculation |
| `ModificationTimestamp` | ISO string | Last updated — always present |
| `YearBuilt` | number | Year property was built |
| `ParkingTotal` | number | Parking spaces |
| `InternetEntireListingDisplayYN` | boolean | Must be true for active listings to display |
| `Latitude` / `Longitude` | number | For map |
| `MediaKey` | string | Photo key — variants end in -l, -m, -nw, -t (filter these out) |

### File → purpose map

| File | Purpose |
|---|---|
| `api/listings.js` | Paginated search with all filter params |
| `api/listing.js` | Single listing by ListingKey (VOW token) |
| `api/photos.js` | Photos from Media endpoint (IDX token) |
| `src/hooks/useListings.js` | All fetch state; `applyWith` is the only trigger |
| `src/pages/ListingsPage.jsx` | Search page, autocomplete, filter wiring |
| `src/pages/ListingDetailPage.jsx` | Detail page with all intelligence components |
| `src/components/FilterModal.jsx` | Bottom-sheet filter with search + chips |
| `src/components/Signal.jsx` | Market signal badges (timing + price + supply) |
| `src/components/PriceSqFt.jsx` | $/sqft vs area comparables |
| `src/components/ListingCard.jsx` | Search result card |
| `src/styles/listings.css` | All CSS including mobile breakpoints |
| `public/ITERATION-LOGO.png` | Transparent logo (processed) |
