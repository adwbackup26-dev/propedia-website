// api/search.js
// Address-level search: returns active + sold listings matching a street query.
// Used by the search autocomplete dropdown to show specific addresses.
//
// GET /api/search?q=montevideo
// Returns: { results: [{ listingKey, address, city, province, postalCode, status, transactionType }] }

const RESO_BASE = 'https://query.ampre.ca/odata/Property';

const ADDRESS_SELECT = [
  'ListingKey', 'ListingId',
  'StreetNumber', 'StreetName', 'UnitNumber',
  'City', 'StateOrProvince', 'PostalCode',
  'StandardStatus', 'TransactionType',
  'ListPrice', 'ClosePrice',
  'InternetEntireListingDisplayYN',
].join(',');

async function queryTRREB(token, filter, top = 8) {
  const qs = [
    `$filter=${encodeURIComponent(filter)}`,
    `$top=${top}`,
    `$select=${encodeURIComponent(ADDRESS_SELECT)}`,
    `$orderby=${encodeURIComponent('ModificationTimestamp desc')}`,
  ].join('&');

  const r = await fetch(`${RESO_BASE}?${qs}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });

  if (!r.ok) return [];
  const data = await r.json();
  return (data.value || []).filter(l => l.InternetEntireListingDisplayYN !== false);
}

function formatResult(l) {
  const parts = [l.StreetNumber, l.StreetName].filter(Boolean).join(' ');
  const unit   = l.UnitNumber ? `#${l.UnitNumber} ` : '';
  const address = `${unit}${parts}`;
  return {
    listingKey:      l.ListingKey,
    address,
    city:            l.City            || '',
    province:        l.StateOrProvince || 'ON',
    postalCode:      l.PostalCode      || '',
    status:          l.StandardStatus  === 'Closed' ? 'Sold' : 'Active',
    transactionType: l.TransactionType || '',
    listPrice:       l.ListPrice       || null,
    closePrice:      l.ClosePrice      || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).end();

  const { q = '' } = req.query;
  const term = q.trim();
  if (term.length < 2) return res.status(200).json({ results: [] });

  // IDX token covers active; VOW token needed for sold. Fall back gracefully.
  const idxToken = process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  const vowToken = process.env.TRREB_VOW_TOKEN  || idxToken;
  if (!idxToken) return res.status(500).json({ error: 'No TRREB token' });

  // Escape single quotes for OData
  const safe = term.replace(/'/g, "''");

  // Determine if query starts with digits (street number search) or is a name
  const isNumeric = /^\d/.test(safe);
  const streetFilter = isNumeric
    ? `(startswith(StreetNumber,'${safe}') or contains(StreetName,'${safe}'))`
    : `contains(StreetName,'${safe}')`;

  const baseActive = [
    'InternetEntireListingDisplayYN eq true',
    "StandardStatus eq 'Active'",
    streetFilter,
  ].join(' and ');

  const baseSold = [
    'InternetEntireListingDisplayYN eq true',
    "StandardStatus eq 'Closed'",
    streetFilter,
  ].join(' and ');

  // Run both queries in parallel
  const [activeRaw, soldRaw] = await Promise.allSettled([
    queryTRREB(idxToken, baseActive, 6),
    queryTRREB(vowToken, baseSold,   6),
  ]);

  const active = activeRaw.status === 'fulfilled' ? activeRaw.value : [];
  const sold   = soldRaw.status   === 'fulfilled' ? soldRaw.value   : [];

  // Deduplicate by ListingKey
  const seen    = new Set();
  const results = [];
  for (const l of [...active, ...sold]) {
    if (!seen.has(l.ListingKey)) {
      seen.add(l.ListingKey);
      results.push(formatResult(l));
    }
  }

  return res.status(200).json({ results });
}
