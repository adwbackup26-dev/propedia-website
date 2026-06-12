# Propedia Phase 1 — Deployment Guide

## What you're deploying
A full Vite + React app replacing the current static `index.html` on `propedia.ca`.
Vercel auto-deploys from GitHub on every push.

---

## Step 1 — Copy these files into your repo

Your repo is at: `github.com/adwbackup26-dev/propedia-website`

**Keep these existing files exactly as they are:**
- `CNAME` — do not touch (keeps propedia.ca pointed at Vercel)

**Replace / add everything else with the files in this ZIP:**

```
propedia-website/
├── api/
│   ├── listing.js          ← NEW — single listing fetch for detail page
│   ├── listings.js         ← NEW — TRREB RESO proxy (main feed)
│   ├── comps.js            ← NEW — sold comps for pricing intelligence
│   └── register.js         ← NEW — VOW email signup → Airtable
├── src/
│   ├── components/
│   │   ├── AvailableButton.jsx   ← Phase 1/2 toggle button
│   │   ├── CompareBar.jsx        ← Floating compare bar (Phase 3 prep)
│   │   ├── Filters.jsx           ← Filter sidebar
│   │   ├── ListingCard.jsx       ← Photo-first property card
│   │   └── VOWSignupWall.jsx     ← Email capture modal
│   ├── hooks/
│   │   └── useListings.js        ← Data + compare state
│   ├── pages/
│   │   ├── ListingsPage.jsx      ← Main listings page
│   │   └── ListingDetailPage.jsx ← Individual listing detail
│   ├── styles/
│   │   ├── tokens.css            ← Global design tokens
│   │   └── listings.css          ← All listings UI styles
│   ├── utils/
│   │   └── format.js             ← Price / address / score utils
│   ├── App.jsx                   ← React Router setup
│   └── main.jsx                  ← React entry point
├── index.html              ← Vite entry (replaces static agent page)
├── package.json            ← React + Vite dependencies
├── vite.config.js          ← Vite config
└── vercel.json             ← SPA routing + API config
```

> ⚠️ The existing `index.html` (your dark/gold agent landing page) will be replaced.
> Your agent homepage is now a stub at `src/pages/HomePage.jsx` (see Step 5).

---

## Step 2 — Set environment variables in Vercel

Go to: **Vercel Dashboard → propedia-website → Settings → Environment Variables**

| Variable | Value | Notes |
|---|---|---|
| `TRREB_TOKEN` | your IDX bearer token | ✅ Already set |
| `CHAT_MODE` | `passive` | Phase 1. Change to `ai` to activate Phase 2 |
| `VITE_CHAT_MODE` | `passive` | Frontend version of same flag |
| `AIRTABLE_API_KEY` | your Airtable personal access token | Add now |
| `AIRTABLE_BASE_ID` | e.g. `appXXXXXXXXXXXXXX` | Add now |
| `VITE_MAPBOX_TOKEN` | your Mapbox public token | Add when enabling map view |

> **Airtable setup:** Create a free base at airtable.com → add a table called `Leads`
> with these fields: Name, Email, MaxBudget (Number), PreferredAreas, MinBeds (Number),
> NeedsParking (Checkbox), NeedsTransit (Checkbox), SignupDate, VOWEnabled (Checkbox), Source.

---

## Step 3 — Push to GitHub

```bash
# From your local repo root
git add .
git commit -m "Phase 1: Listings frontend + TRREB API + intelligence cards"
git push origin main
```

Vercel will detect the push, run `npm run build`, and deploy automatically.
Build time: ~45 seconds.

---

## Step 4 — Verify deployment

Once Vercel deploys, test these URLs:

| URL | Expected |
|---|---|
| `propedia.ca` | Homepage stub (port your agent HTML here — see Step 5) |
| `propedia.ca/listings` | Live TRREB listings with filter sidebar |
| `propedia.ca/listings/[any-ListingKey]` | Detail page with intel cards |
| `propedia.ca/api/listings?transactionType=For+Sale&limit=5` | Raw JSON from TRREB |
| `propedia.ca/api/comps?postalCode=L5B&listPrice=900000` | Comp data JSON |

---

## Step 5 — Port your existing agent homepage (10 min)

The old `index.html` content is preserved on your machine. To restore it as the React homepage:

1. Open `src/App.jsx`
2. Find the `const HomePage = () => (...)` stub at the top
3. Replace it with a real component — either paste your HTML into a JSX wrapper,
   or do `import HomePage from './pages/HomePage.jsx'` and create that file

For now, `propedia.ca` shows a "View Listings →" button which is functional.
The agent landing page migration is cosmetic and doesn't block Phase 1 going live.

---

## Step 6 — Test the full lead funnel

1. Go to `propedia.ca/listings`
2. Click "Sign up free — unlock sold prices"
3. Fill in the VOW signup modal
4. Verify the lead appears in your Airtable **Leads** table
5. Verify the sold-prices-unlocked state persists on refresh (cookie check)

---

## Phase 2 activation (when ready)

When you're ready to activate the AI chat (InstantAgent):

1. In Vercel env vars, change `CHAT_MODE` and `VITE_CHAT_MODE` from `passive` → `ai`
2. Create `api/chat.js` (Make.com webhook receiver)
3. That's it — `AvailableButton.jsx` already handles the switch with zero UI rebuild

---

## Phase 3 activation (DeepCompare™)

The "Save to Compare" button and floating `CompareBar` are already live in Phase 1.
Users can save up to 5 properties. The `DeepCompare™` button routes to `/compare?keys=...`
Phase 3 just fills in that route — no Phase 1 code changes needed.

---

## Local development

```bash
npm install
npx vercel dev   # runs Vite + serverless functions together on localhost:3000
```

> Use `vercel dev` (not `npm run dev`) so the `/api/` routes work locally.
> Your `.env.local` needs `TRREB_TOKEN=...` for local API calls to work.

---

## File count summary

| Layer | Files | Status |
|---|---|---|
| Scaffolding | `package.json`, `vite.config.js`, `vercel.json`, `index.html` | ✅ Phase 1 |
| API (Vercel serverless) | `listings.js`, `listing.js`, `comps.js`, `register.js` | ✅ Phase 1 |
| React core | `main.jsx`, `App.jsx` | ✅ Phase 1 |
| Components | `ListingCard`, `Filters`, `CompareBar`, `AvailableButton`, `VOWSignupWall` | ✅ Phase 1 |
| Pages | `ListingsPage`, `ListingDetailPage` | ✅ Phase 1 |
| Styles | `tokens.css`, `listings.css` | ✅ Phase 1 |
| Utilities | `format.js`, `useListings.js` | ✅ Phase 1 |
| `api/chat.js` | AI chat receiver | Phase 2 |
| `api/compare.js` | DeepCompare™ scoring | Phase 3 |

**Total Phase 1: 21 files. Zero dependencies beyond React, React Router, and Vite.**
