// api/listings.js
const RESO_BASE = 'https://query.ampre.ca/odata/Property';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'TRREB_IDX_TOKEN not configured in Vercel environment variables.' });
  }

  const {
    page            = '1',
    limit           = '20',
    transactionType = 'For Sale',
    minPrice        = '',
    maxPrice        = '',
    minBeds         = '',
    minBaths        = '',
    propertySubType = '',
    city            = '',
    postalCode      = '',
    search          = '',
    sortBy          = 'ModificationTimestamp',
    sortDir         = 'desc',
  } = req.query;

  const top  = Math.min(parseInt(limit)  || 20, 50);
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * top;

  const filters = [
    'InternetEntireListingDisplayYN eq true',
    "StandardStatus eq 'Active'",
  ];

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

  if (postalCode) {
    const prefix = postalCode.replace(/\s/g, '').substring(0, 3).toUpperCase();
    filters.push(`startswith(PostalCode,'${prefix}')`);
  }

  if (search) {
    const escaped = search.replace(/'/g, "''");
    filters.push(`contains(StreetName,'${escaped}')`);
  }

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
  ].join(',');

  const url = new URL(RESO_BASE);
  url.searchParams.set('$filter',  filters.join(' and '));
  url.searchParams.set('$top',     top.toString());
  url.searchParams.set('$skip',    skip.toString());
  url.searchParams.set('$orderby', `${sortBy} ${sortDir}`);
  url.searchParams.set('$select',  select);
  url.searchParams.set('$expand',  'Media');
  url.searchParams.set('$count',   'true');

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
        detail: errorBody.substring(0, 500),
      });
    }

    const data = await upstream.json();

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