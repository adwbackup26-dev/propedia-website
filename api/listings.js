// api/listings.js
// Vercel serverless function — proxies TRREB RESO API.
// Keeps TRREB_TOKEN server-side only. Never exposed to client.
//
// GET /api/listings?page=1&limit=20&transactionType=For+Sale&minPrice=...
//
// Required env var:  TRREB_TOKEN   (IDX bearer token, set in Vercel dashboard)
// Optional env vars: none for this file

const RESO_BASE = 'https://query.ampre.ca/odata/Property';

export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth check ───────────────────────────────────────────────────────────
  // IDX token — public listings only, never shows sold/closed data
  const token = process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'TRREB_IDX_TOKEN not configured in Vercel environment variables.' });
  }

  // ── Parse query params ───────────────────────────────────────────────────
  const {
    page           = '1',
    limit          = '20',
    transactionType = 'For Sale',  // 'For Sale' | 'For Lease'
    minPrice       = '',
    maxPrice       = '',
    minBeds        = '',
    minBaths       = '',
    propertySubType = '',          // 'Detached', 'Condo Apt', etc.
    city           = '',
    postalCode     = '',
    search         = '',           // free-text address search
    sortBy         = 'ModificationTimestamp', // field name for $orderby
    sortDir        = 'desc',       // 'asc' | 'desc'
  } = req.query;

  const top  = Math.min(parseInt(limit)  || 20, 50);  // cap at 50
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * top;

  // ── Build OData $filter ──────────────────────────────────────────────────
  const filters = [
    // Compliance: never show listings where display is forbidden
    'InternetEntireListingDisplayYN eq true',
    // Only active listings
    "StandardStatus eq 'Active'",
  ];

  // Transaction type
  if (transactionType === 'For Lease') {
    filters.push("TransactionType eq 'For Lease'");
  } else {
    filters.push("TransactionType eq 'For Sale'");
  }

  if (minPrice)        filters.push(`ListPrice ge ${parseInt(minPrice)}`);
  if (maxPrice)        filters.push(`ListPrice le ${parseInt(maxPrice)}`);
  if (minBeds)         filters.push(`BedroomsTotal ge ${parseInt(minBeds)}`);
  if (minBaths)        filters.push(`BathroomsTotalInteger ge ${parseInt(minBaths)}`);
  if (propertySubType) filters.push(`PropertySubType eq '${propertySubType}'`);
  if (city)            filters.push(`City eq '${city}'`);

  // Postal code prefix search (e.g. "L5B" matches L5B 1A1, L5B 2C4 …)
  if (postalCode) {
    const prefix = postalCode.replace(/\s/g, '').substring(0, 3).toUpperCase();
    filters.push(`startswith(PostalCode,'${prefix}')`);
  }

  // Free-text address search via StreetName contains
  if (search) {
    const escaped = search.replace(/'/g, "''");
    filters.push(`contains(StreetName,'${escaped}')`);
  }

  // ── Build RESO URL ───────────────────────────────────────────────────────
  // $select: only fetch fields we actually render — reduces payload size
  const select = [
    'ListingKey',
    'ListingId',
    'StandardStatus',
    'TransactionType',
    'ListPrice',
    'OriginalListPrice',
    'ClosePrice',
    'UnparsedAddress',
    'StreetNumber',
    'StreetName',
    'UnitNumber',
    'City',
    'StateOrProvince',
    'PostalCode',
    'BedroomsTotal',
    'BathroomsTotalInteger',
    'PropertyType',
    'PropertySubType',
    'LivingArea',
    'DaysOnMarket',
    'InternetEntireListingDisplayYN',
    'ListAgentFullName',
    'ListOfficeName',
    'ModificationTimestamp',
    'PriceChangeTimestamp',
    'Media',
  ].join(',');

  const url = new URL(RESO_BASE);
  url.searchParams.set('$filter',  filters.join(' and '));
  url.searchParams.set('$top',     top.toString());
  url.searchParams.set('$skip',    skip.toString());
  url.searchParams.set('$orderby', `${sortBy} ${sortDir}`);
  url.searchParams.set('$select',  select);
  url.searchParams.set('$expand',  'Media');
  url.searchParams.set('$count',   'true');

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
      console.error('[api/listings] TRREB error:', upstream.status, errorBody);
      return res.status(upstream.status).json({
        error: 'TRREB API returned an error',
        status: upstream.status,
        detail: errorBody.substring(0, 500), // truncate for safety
      });
    }

    const data = await upstream.json();

    // ── Safety: re-enforce compliance filter server-side ─────────────────
    const listings = (data.value || []).filter(
      l => l.InternetEntireListingDisplayYN === true
    );

    return res.status(200).json({
      listings,
      total: data['@odata.count'] ?? listings.length,
      page:  parseInt(page),
      limit: top,
      pages: Math.ceil((data['@odata.count'] ?? listings.length) / top),
    });

  } catch (err) {
    console.error('[api/listings] Fetch error:', err);
    return res.status(500).json({
      error: 'Failed to reach TRREB API',
      detail: err.message,
    });
  }
}
