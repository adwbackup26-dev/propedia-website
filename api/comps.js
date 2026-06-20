// api/comps.js
// Vercel serverless function — fetches recent sold comparables for a listing.
// Powers the "Is This Fairly Priced?" badge and Buy vs Rent breakeven logic.
//
// GET /api/comps?postalCode=L5B1A1&propertySubType=Detached&listPrice=1200000
//
// Required env var: TRREB_TOKEN (VOW bearer token — sold data requires VOW)
// Note: This endpoint should only be called for VOW-registered users.

const RESO_BASE = 'https://query.ampre.ca/odata/Property';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  // VOW token — required for sold/closed data. Falls back to IDX token in dev.
  const token = process.env.TRREB_VOW_TOKEN || process.env.TRREB_TOKEN;
  if (!token) return res.status(500).json({ error: 'TRREB_VOW_TOKEN not configured' });

  const {
    postalCode,
    propertySubType = '',
    listPrice       = '',
    transactionType = 'For Sale',
  } = req.query;

  if (!postalCode) {
    return res.status(400).json({ error: 'postalCode is required' });
  }

  // ── Date: 6 months ago ───────────────────────────────────────────────────
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  const cutoffStr = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD

  // ── Price band: ±25% of list price ───────────────────────────────────────
  const priceLo = listPrice ? Math.floor(parseInt(listPrice) * 0.75) : 0;
  const priceHi = listPrice ? Math.ceil(parseInt(listPrice) * 1.25)  : 99_999_999;

  // ── Postal prefix (first 3 chars, e.g. "L5B") ────────────────────────────
  const postalPrefix = postalCode.replace(/\s/g, '').substring(0, 3).toUpperCase();

  // ── Build filter ─────────────────────────────────────────────────────────
  const filters = [
    'InternetEntireListingDisplayYN eq true',
    "StandardStatus eq 'Closed'",
    `startswith(PostalCode,'${postalPrefix}')`,
    `CloseDate ge ${cutoffStr}`,
  ];

  if (transactionType === 'For Lease') {
    filters.push("TransactionType eq 'For Lease'");
    if (listPrice) {
      filters.push(`ListPrice ge ${priceLo}`);
      filters.push(`ListPrice le ${priceHi}`);
    }
  } else {
    filters.push("TransactionType eq 'For Sale'");
    if (listPrice) {
      filters.push(`ClosePrice ge ${priceLo}`);
      filters.push(`ClosePrice le ${priceHi}`);
    }
  }

  if (propertySubType) {
    filters.push(`PropertySubType eq '${propertySubType}'`);
  }

  const select = [
    'ListingKey',
    'ClosePrice',
    'CloseDate',
    'ListPrice',
    'PostalCode',
    'City',
    'PropertySubType',
    'BedroomsTotal',
    'LivingAreaRange',
  ].join(',');

  const qs = [
    `$filter=${encodeURIComponent(filters.join(' and '))}`,
    `$top=12`,
    `$orderby=${encodeURIComponent('CloseDate desc')}`,
    `$select=${encodeURIComponent(select)}`,
  ].join('&');
  const apiUrl = `${RESO_BASE}?${qs}`;

  try {
    const upstream = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'TRREB API error fetching comps' });
    }

    const data = await upstream.json();
    const comps = data.value || [];

    // ── Derive fairness label ─────────────────────────────────────────────
    let fairnessLabel  = null;
    let fairnessDetail = null;
    let avgCompPrice   = null;

    if (comps.length >= 2 && listPrice) {
      const prices = comps
        .map(c => c.ClosePrice || c.ListPrice)
        .filter(Boolean);

      if (prices.length > 0) {
        avgCompPrice = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
        const diffPct = (parseInt(listPrice) - avgCompPrice) / avgCompPrice;

        if (diffPct < -0.05) {
          fairnessLabel  = 'Underpriced';
          fairnessDetail = `Listed ${Math.abs(Math.round(diffPct * 100))}% below recent sold comps nearby`;
        } else if (diffPct > 0.05) {
          fairnessLabel  = 'Overpriced';
          fairnessDetail = `Listed ${Math.round(diffPct * 100)}% above recent sold comps nearby`;
        } else {
          fairnessLabel  = 'Fair';
          fairnessDetail = `Priced in line with ${comps.length} recent comparable sales`;
        }
      }
    } else if (comps.length > 0 && comps.length < 2) {
      fairnessLabel  = 'Fair';
      fairnessDetail = 'Limited comp data — price appears reasonable';
    } else {
      fairnessLabel  = null;
      fairnessDetail = 'No recent sold comps found nearby';
    }

    return res.status(200).json({
      comps,
      compCount:     comps.length,
      avgCompPrice,
      fairnessLabel,
      fairnessDetail,
    });

  } catch (err) {
    console.error('[api/comps] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch comps', detail: err.message });
  }
}
