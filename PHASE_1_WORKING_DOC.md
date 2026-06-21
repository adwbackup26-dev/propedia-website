# PROPEDIA PHASE 1 WORKING DOCUMENT
## Status: IN PROGRESS (Polishing & Refinement Phase)

---

## PROJECT OVERVIEW

| Field | Value |
|-------|-------|
| **Project** | Propedia.ca — Dark-themed luxury GTA real estate marketplace |
| **Stack** | Vite + React 18 + React Router v6, Vercel serverless (Node.js) |
| **Data** | 70,000+ TRREB listings via PropTx RESO OData API |
| **Deploy** | GitHub → Vercel auto-deploy (propedia.ca) |
| **Repo** | https://github.com/adwbackup26-dev/propedia-website |
| **Local** | `C:\Users\anirudha\propedia-website` |
| **Owner** | Anirudha Warhadpande (RECO #6011384, TRREB #6008999) |
| **Target Launch** | Mid-July 2026 |

---

## PHASE 1 CURRENT STATUS

### ✅ FULLY WORKING & TESTED

| Ticket | Description |
|--------|-------------|
| P1-1 | Hero photo overlay removed from detail page |
| P1-2 | Similar listings API fixed (`$expand=Media` removed, `LivingArea` → `LivingAreaRange`) |
| P1-3 | Comps API fixed (URLSearchParams → manual query string, `LivingArea` → `LivingAreaRange`) |
| P1-3.5 | Price Intelligence disclaimer added |
| P1-4 | Property type tabs (Residential Sale/Rental, Commercial Sale/Rental) |
| P1-5 | Search autocomplete (all GTA cities, neighbourhoods, roads, intersections, landmarks, postal codes) |
| P1-6 | VOW signup modal redesigned (dark premium theme) |
| P1-7 | Smooth photo transitions + mobile swipe support |
| P1-9 | Mobile responsiveness audit (390px tested, 44px min touch targets, 16px+ inputs) |
| P1-10 | "View on Google Maps" button on detail page |
| P1-11 | Expanded autocomplete to 200+ GTA locations |
| P1-12 | Sort dropdown (9 options: price, newest, beds, baths, Propedia Score) |
| P1-13 | Price history section with VOW signup wall on detail page |
| P1-14 | Leaflet.js map search at `/mapsearch`: circle + polygon draw tools, Mapbox geocoding, result cards with photos |
| Phase 1.5 | FilterModal bottom-sheet redesign replacing scattered filter controls |

### ⏳ IN PROGRESS — NEEDS POLISH

- **VOW signup state persistence** — user signs up on listing A, listing B asks again. Needs localStorage fix.
- **Price History (P1-13)** — section renders, but VOW state flow needs verification across navigation.
- **Filter modal header** — filters work but header layout may feel cluttered on mobile, needs visual check.
- **Map search photos** — load with 2–3 sec delay (acceptable but slow). `ResultCard` makes one `/api/photos` call per card.

### 🐛 KNOWN BUGS TO FIX BEFORE LAUNCH

1. **VOW signup state doesn't persist** across listing navigation (React state resets on route change)
2. **Map search: first draw may show 0 results** if circle is drawn before geocoding finishes — user must wait for markers to appear, then draw
3. **Photo loading on map result cards** — each card hits `/api/photos` individually; no caching
4. **Mobile responsiveness** — filter modal and map results panel not tested on real 390px devices

### ❌ INTENTIONALLY SKIPPED (Not in Phase 1 scope)

- **P1-8: Mapbox map page** — ABANDONED after 5+ hours debugging. Pins never rendered. Replaced by Leaflet (P1-14). **DO NOT REVISIT.**
- Business for Sale property type (separate MLS class, Phase 2+)
- Unit type for rentals (requires parsing listing descriptions, Phase 2+)

---

## CRITICAL TRREB API RULES — NEVER BREAK THESE

```
1. NEVER use URLSearchParams — always manual query strings with encodeURIComponent
   Reason: URLSearchParams encodes spaces as + (not %20), TRREB returns 400

2. NEVER use $expand=Media — causes 400 on listings endpoint

3. NEVER use LivingArea — field is LivingAreaRange in TRREB

4. NEVER use ListDate — field doesn't exist. Use ModificationTimestamp

5. NEVER include MimeType in Media $select — invalid field

6. Photos endpoint: ALWAYS use $top=200 (default is 20, misses most photos)

7. Photo deduplication: MediaKey suffix pattern — filter -(l|m|nw|t) variants
   to get unique originals only

8. Field name is InternetEntireListingDisplayYN (not YPN — extra P breaks queries)

9. CloseDate IS valid (used for sold comps in api/comps.js)
   ListDate is NOT valid (removed from api/listing.js in commit 653b77d)

10. TRREB Latitude/Longitude are empty on ~80% of listings — always geocode fallback
```

---

## ARCHITECTURE

### Design System

```
Colors:
  #0C0D10  — bg-page (darkest background)
  #161719  — bg-card (card background)
  #111316  — bg-panel (darkest card variant)
  #00B4A8  — teal (primary accent)
  #009E94  — teal-dark
  rgba(0,180,168,.12) — teal-light

  rgba(255,255,255,.06)  — border subtle
  rgba(255,255,255,.12)  — border medium
  #fff                   — text primary
  rgba(255,255,255,.75)  — text secondary
  rgba(255,255,255,.45)  — text tertiary

Font: DM Sans (weights 300–600, optical size 9..40)
Heading accent: Cormorant Garamond (for luxury feel)
Border radius: 10px standard, 8px small, 16px modal
No gradients — flat colors only
Tabler Icons (ti-*) for all icons
```

### File Structure

```
src/
  pages/
    ListingsPage.jsx       — marketplace: filters, search, sort, pagination
    ListingDetailPage.jsx  — full detail: photos, price intel, comps, price history
    MapSearchPage.jsx      — Leaflet map with draw tools + geocoding
    MapPage.jsx            — legacy Mapbox page (ABANDONED, kept for reference)
  components/
    FilterModal.jsx        — dark bottom-sheet filter popup
    ListingCard.jsx        — grid card with photo carousel + swipe
    PriceHistorySection.jsx — price history table + VOW signup wall
    VOWSignupWall.jsx      — VOW lead capture (dark premium redesign)
  hooks/
    useListings.js         — fetch + filter hook for listings
  utils/
    format.js              — formatters + computeMatchScore (Propedia Score)
  styles/
    tokens.css             — CSS custom properties
    listings.css           — listings page styles
  config/
    tenant.js              — agent/brand config (white-label ready)

api/
  listings.js   — /api/listings (filter, sort, paginate)
  listing.js    — /api/listing (single listing by ListingKey)
  similar.js    — /api/similar (comparable active listings)
  comps.js      — /api/comps (sold price comparables)
  photos.js     — /api/photos (by listingKey, $top=200, deduped)
  register.js   — /api/register (VOW signup → Airtable)
  maptoken.js   — /api/maptoken (Mapbox token, Vercel env protected)
```

### TRREB OData API

```
Base:   https://query.ampre.ca/odata/Property
Auth:   Bearer {TRREB_IDX_TOKEN}
Format: OData 4.0

Pattern for all queries:
  const parts = [
    `$filter=${encodeURIComponent(filterStr)}`,
    `$select=${encodeURIComponent(fields)}`,
    `$top=50`,
    `$skip=0`,
    `$orderby=${encodeURIComponent('ModificationTimestamp desc')}`,
  ];
  const url = `${BASE}?${parts.join('&')}`;
  // NEVER: new URLSearchParams({...}).toString()
```

### Geocoding

**Mapbox Geocoding API** (primary, P1-14 production)
- Token via `/api/maptoken` (Vercel "Sensitive" env var, excluded from Vite bundle)
- 10 concurrent requests per batch
- Module-level `Map` cache — survives re-renders, avoids duplicate calls
- ~6 seconds for 200 listings
- Canada-scoped: `country=CA&types=address`

**Nominatim** (referenced in earlier debug, replaced by Mapbox)
- Free OpenStreetMap geocoder
- 1 req/sec hard limit — 200 listings = 200 seconds (too slow)
- Not used in production

### Map Implementation

| Approach | Status | Notes |
|----------|--------|-------|
| Mapbox GL JS (P1-8) | ❌ ABANDONED | 5+ hours debugging, pins never rendered |
| Leaflet 1.9 + leaflet-draw 1.0.4 (P1-14) | ✅ PRODUCTION | OpenStreetMap tiles, no token needed |

Leaflet specifics:
- `point-in-polygon` library for polygon hit-test — uses `[lng, lat]` convention (x, y)
- Haversine formula for circle distance (returns meters)
- `draw:created` Leaflet event → filter `markersRef.current` array
- `markersRef` is a plain ref `[{ marker: L.circleMarker, listing }]` — not state
- Map init in `useEffect([], [])` once; markers in separate `useEffect([listings])`

---

## ENVIRONMENT VARIABLES (Vercel Dashboard)

```
TRREB_IDX_TOKEN    — PropTx IDX bearer token (listings, search)
TRREB_VOW_TOKEN    — PropTx VOW bearer token (price history, sold data)
TRREB_DLA_TOKEN    — PropTx DLA bearer token (deeper listing access)
VITE_MAPBOX_TOKEN  — kept for future use (not actively used client-side)
MAPBOX_TOKEN       — server-side Mapbox token (served via /api/maptoken)
AIRTABLE_API_KEY   — (set in Vercel dashboard — do not commit)
AIRTABLE_BASE_ID   — (set in Vercel dashboard — do not commit)
```

### vercel.json (current — DO NOT BREAK)

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

---

## COMPONENT DETAILS

### FilterModal.jsx

```js
export const PROP_TYPES = [
  { id:'res-sale', label:'Buy',             sub:'Residential Sale',  tx:'For Sale',  pt:'Residential' },
  { id:'res-rent', label:'Rent',            sub:'Residential Lease', tx:'For Lease', pt:'Residential' },
  { id:'com-sale', label:'Commercial Sale', sub:'Commercial Sale',   tx:'For Sale',  pt:'Commercial'  },
  { id:'com-rent', label:'Commercial Rent', sub:'Commercial Lease',  tx:'For Lease', pt:'Commercial'  },
];
export const STRUCTURES = ['Freehold','Detached','Semi-Detached','Townhouse','Condo'];
export const DEFAULT_MODAL = {
  propType:'res-sale', minPrice:'', maxPrice:'', beds:'', baths:'',
  parking:'', structures:[],
};
```

- Position: `fixed; bottom:0; borderRadius:16px 16px 0 0` (bottom sheet)
- Property Structure hidden when `propType === 'res-rent' || 'com-rent'`
- Footer: Clear all + Apply (shows active filter count badge)
- Safe area: `env(safe-area-inset-bottom)` in footer padding

### MapSearchPage.jsx — Key state

```js
const [listings,        setListings]        = useState([]);   // geocoded listings
const [filtered,        setFiltered]        = useState(null); // null = no shape; [] = shape, 0 results
const [activeTool,      setActiveTool]      = useState(null); // 'circle' | 'polygon' | null
const [loading,         setLoading]         = useState(true);
const [geocodeProgress, setGeocodeProgress] = useState(null); // { done, total } | null

const markersRef   = useRef([]); // [{ marker: L.circleMarker, listing }]
const drawHandlers = useRef({}); // { circle: L.Draw.Circle, polygon: L.Draw.Polygon }
```

Flow:
1. Page loads → fetch 4 pages × 50 listings
2. Split: `hasCoords` (TRREB had lat/lng) vs `needsGeocode`
3. Fetch Mapbox token from `/api/maptoken`
4. Geocode in batches of 10, update progress badge
5. `setListings([...hasCoords, ...geocoded])`
6. Second useEffect plots `L.circleMarker` for each listing → `markersRef`
7. User draws shape → `draw:created` → filter `markersRef` → `setFiltered(inside)`
8. Results panel renders `<ResultCard>` per item in `filtered`

### ResultCard component (inside MapSearchPage.jsx)

```js
function ResultCard({ listing, onClick }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoState, setPhotoState] = useState('loading');
  // fetches /api/photos?listingKey=...&limit=1
  // reads data.photos[0].url (NOT .MediaURL — api/photos normalizes to .url)
}
```

### api/photos.js response shape

```js
{
  listingKey: '...',
  photos: [{ mediaKey, url, order, preferred, category, modifiedAt }],
  total: N,
  preferredPhoto: { ... } | null
}
// Note: field is .url NOT .MediaURL
```

---

## KNOWN ISSUES & FIXES

### 1. VOW Signup State Not Persisting

**Symptom:** User signs up on listing A. Navigate to listing B — signup modal appears again.

**Root cause:** `hasVOW` state is initialized per-mount via `getVOWSession()` (reads `propedia_vow=1` cookie). If cookie not set or expires, state resets.

**Fix needed:**
```js
// On successful signup in VOWSignupWall:
localStorage.setItem('propedia_vow', '1');
document.cookie = 'propedia_vow=1; max-age=31536000; path=/';

// In getVOWSession():
export function getVOWSession() {
  return document.cookie.includes('propedia_vow=1')
    || localStorage.getItem('propedia_vow') === '1';
}
```

### 2. Map Draw Before Geocoding Completes

**Symptom:** User draws circle immediately on page load → 0 results. Draw again after markers appear → correct results.

**Root cause:** `draw:created` filters `markersRef.current` which is empty until geocoding + marker plot useEffect completes.

**Fix needed:** Disable circle/polygon toolbar buttons while `loading === true`. Enable once markers are plotted.

### 3. Photo Loading Slow on Map Result Cards

**Symptom:** Result cards show "Loading…" for 2–3 seconds per card.

**Root cause:** Each `ResultCard` makes an independent `/api/photos` call on mount.

**Acceptable for Phase 1 launch.** Phase 2 optimization: prefetch photos during geocoding pass, or use `preferredPhoto` field returned by `/api/listings`.

---

## DEPLOYMENT WORKFLOW

```bash
# Standard deploy
git add src/pages/MapSearchPage.jsx   # or specific files
git commit -m "fix: description"
git push origin main
# Vercel auto-deploys in ~90 seconds

# Verify deploy
# Hard refresh: Ctrl+Shift+R on propedia.ca
# Check: propedia.ca/mapsearch, propedia.ca, propedia.ca/listing/[any key]
```

---

## PRE-LAUNCH CHECKLIST

### Desktop (1440px)
- [ ] Listings page: filters, search, sort all work
- [ ] Filter modal: all 4 property types, price/beds/baths/parking/structure filters apply
- [ ] Detail page: photos load, gallery opens, price intelligence shows
- [ ] Similar listings section loads
- [ ] Price history section shows (VOW wall for non-members)
- [ ] Map search `/mapsearch`: geocoding progress shows, markers appear, circle draw works, result cards with photos
- [ ] Polygon draw works
- [ ] VOW signup: sign up on one listing, navigate to another — stays signed in
- [ ] F12 console: zero errors

### Mobile (390px DevTools)
- [ ] Listings: filter modal opens as bottom sheet, scrollable
- [ ] Search autocomplete: full-width, tappable items
- [ ] Sort dropdown: usable with fingers
- [ ] Detail page: photos swipeable, "View on Google Maps" button 44px+
- [ ] Map search: toolbar buttons 44px+, results panel scrollable horizontally
- [ ] VOW modal: inputs 16px+ font (no iOS zoom), padded for safe area
- [ ] All inputs: `font-size: 16px` minimum

### API Smoke Tests
- [ ] `/api/listings?transactionType=For%20Sale&limit=1` → returns listing
- [ ] `/api/listing?listingKey=[key]` → returns single listing
- [ ] `/api/photos?listingKey=[key]` → returns `{ photos: [{url}] }`
- [ ] `/api/similar?city=Toronto&minPrice=800000&maxPrice=1200000` → returns listings
- [ ] `/api/comps?city=Toronto&minPrice=800000&maxPrice=1200000` → returns sold comps
- [ ] `/api/maptoken` → returns `{ token: 'pk.eyJ1...' }`

---

## REMAINING POLISH TASKS (Prioritized)

### HIGH — Must fix before launch
1. Fix VOW signup state persistence (localStorage + cookie double-write)
2. Disable map draw tools while `loading === true` (prevent empty-draw confusion)
3. Mobile test all pages on real 390px device or consistent DevTools session

### MEDIUM — Nice to have before launch
1. Show photo count badge on listing cards ("12 photos")
2. Polish "SOLD" badge styling on address search results
3. Verify filter count badge in FilterModal updates correctly on all filters

### LOW — Phase 2
1. Optimize map result card photo loading (batch prefetch)
2. Add skeleton loaders to result cards
3. Performance audit (bundle size is ~2.4MB, could code-split Leaflet)

---

## KEY LEARNINGS FROM PHASE 1

1. **TRREB is very strict** — wrong field names cause silent 400s with no helpful error. Always test field names against the RESO data dictionary.
2. **URLSearchParams breaks TRREB** — encodes spaces as `+`, not `%20`. Always build query strings manually.
3. **Mapbox is overkill for simple mapping** — Leaflet + OpenStreetMap, zero tokens, works perfectly.
4. **TRREB lat/lng is empty** — ~80% of listings have no coordinates. Mapbox geocoding via `/api/maptoken` solved it cleanly.
5. **React state resets on navigation** — use cookies or localStorage for persistence across routes.
6. **Hooks can't be called in .map()** — extract to a named component (`ResultCard`, etc.).
7. **Photo field is `.url` not `.MediaURL`** — `api/photos.js` normalizes the TRREB raw field on the way out.
8. **Test mobile early** — 16px input font-size and 44px touch targets are non-negotiable on iOS/Android.
9. **Vercel SPA rewrite** — must use negative lookahead `/((?!api/).*)` so `/api/*` routes reach serverless functions.

---

## WHAT'S NEXT

### Phase 2: InstantAgent (Target: Mid-August 2026)
- AI chatbot for lead qualification (Claude claude-sonnet-4-6 API)
- Facebook Messenger + ManyChat integration
- Make.com workflow automation
- BrokerBay showing booking integration

### Phase 3: InstantOffers (Target: Late September 2026)
- Document automation (offer letters, contracts)
- Template system + E-signature integration

### Phase 4: White-Label Propedia (Target: October 2026)
- Agent portal with custom branding per agent
- Revenue share model

---

## OWNER

**Anirudha Warhadpande**
RECO #6011384 | TRREB #6008999
HomeLife Miracle Realty Ltd. (Broker of Record: Ajay Shah)
647-803-5288 | adwpande@gmail.com

Non-technical founder — entire product built with Claude Code guidance.
CPA partner (wife) for investment/legal review.

---

*Document created: 2026-06-21*
*Phase 1 status: IN PROGRESS — Polish & Refinement*
*Estimated launch: Mid-July 2026*
*Next action: Fix VOW persistence, disable draw tools during load, mobile test all pages*
