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

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    console.error('[api/search] TRREB error', r.status, body.slice(0, 300));
    return [];
  }
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

  // Parse query into optional street number + street name parts.
  // Examples:
  //   "6100"              → numPart="6100", namePart=""
  //   "montevideo"        → numPart="",     namePart="montevideo"
  //   "6100 montevideo"   → numPart="6100", namePart="montevideo"
  //   "6100 Montevideo Rd"→ numPart="6100", namePart="Montevideo Rd"
  // TRREB stores StreetName in title/uppercase — normalise to uppercase so
  // contains() matches regardless of what case the user typed.
  const upper   = term.toUpperCase();
  const match   = upper.match(/^(\d+)\s*(.*)$/);
  const numPart  = match ? match[1].replace(/'/g, "''") : '';
  const namePart = (match ? match[2] : upper).replace(/'/g, "''").trim();

  let streetFilter;
  if (numPart && namePart) {
    // e.g. "6100 montevideo" → both conditions must be true
    streetFilter = `(startswith(StreetNumber,'${numPart}') and contains(StreetName,'${namePart}'))`;
  } else if (numPart) {
    // purely numeric → match street number
    streetFilter = `startswith(StreetNumber,'${numPart}')`;
  } else {
    // purely text → match street name
    streetFilter = `contains(StreetName,'${namePart}')`;
  }

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
