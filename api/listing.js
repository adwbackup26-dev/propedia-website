// api/listing.js
// Vercel serverless function — fetches a single listing by ListingKey.
// Powers the /listing/:listingKey detail page.
//
// GET /api/listing?listingKey=XXXXXXXXXX
//
// Required env var: TRREB_IDX_TOKEN

const RESO_BASE = 'https://query.ampre.ca/odata/Property';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth check ───────────────────────────────────────────────────────────
  // VOW token required for ClosePrice/CloseDate on sold listings.
  // Falls back to IDX token; sold price fields will be absent but listing loads.
  const token = process.env.TRREB_VOW_TOKEN || process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  if (!token) return res.status(500).json({ error: 'TRREB token not configured' });

  // ── Parse query params ───────────────────────────────────────────────────
  const { listingKey } = req.query;
  if (!listingKey) return res.status(400).json({ error: 'listingKey query parameter is required' });

  // ── Build $select for detail page ────────────────────────────────────────
  const select = [
    'ListingKey', 'ListingId', 'StandardStatus', 'TransactionType',
    'ListPrice', 'OriginalListPrice', 'ClosePrice',
    'UnparsedAddress', 'StreetNumber', 'StreetName',
    'UnitNumber', 'City', 'StateOrProvince', 'PostalCode',
    'BedroomsTotal', 'BathroomsTotalInteger',
    'PropertyType', 'PropertySubType',
    'YearBuilt',
    'ParkingTotal',
    'LivingAreaRange',
    'CloseDate', 'DaysOnMarket', 'ModificationTimestamp',
    'ListAgentFullName', 'ListOfficeName',
    'PublicRemarks',
    'Latitude', 'Longitude',
    'InternetEntireListingDisplayYN',
  ].join(',');

  // ── Build OData query ────────────────────────────────────────────────────
  // Do NOT filter by InternetEntireListingDisplayYN here — sold/closed listings
  // often have it set to false after closing, which would cause a false 404.
  // We check the flag in code after fetching and return 403 for active listings
  // that explicitly opt out; sold listings are displayed regardless.
  const filterString = `ListingKey eq '${listingKey}'`;
  const queryParts = [
    `$filter=${encodeURIComponent(filterString)}`,
    `$top=1`,
    `$select=${encodeURIComponent(select)}`,
  ];

  const url = new URL(`${RESO_BASE}?${queryParts.join('&')}`);

  // ── Proxy request to TRREB ───────────────────────────────────────────────
  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    });

    if (!upstream.ok) {
      const errorBody = await upstream.text();
      console.error('[api/listing] TRREB error:', upstream.status, errorBody);
      return res.status(upstream.status).json({ 
        error: 'TRREB API returned an error',
        detail: errorBody.substring(0, 300),
      });
    }

    const data = await upstream.json();
    const listing = (data.value || [])[0];

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // ── Compliance: block active/non-closed listings that opted out ──────
    // Sold/closed listings are always displayable (they're historical records).
    const isClosed = listing.StandardStatus === 'Closed';
    if (!isClosed && listing.InternetEntireListingDisplayYN === false) {
      return res.status(403).json({ error: 'Listing not authorised for display' });
    }

    return res.status(200).json({ listing });

  } catch (err) {
    console.error('[api/listing] Fetch error:', err);
    return res.status(500).json({
      error: 'Failed to fetch listing',
      detail: err.message,
    });
  }
}