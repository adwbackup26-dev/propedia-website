const RESO_BASE = 'https://query.ampre.ca/odata/Property';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  if (!token) return res.status(500).json({ error: 'No token' });

  const {
    page            = '1',
    limit           = '20',
    transactionType = 'For Sale',
    propertyType    = '',
    minPrice        = '',
    maxPrice        = '',
    minBeds         = '',
    minBaths        = '',
    propertySubType = '',
    city            = '',
    search          = '',
    sortBy          = 'ModificationTimestamp',
    sortDir         = 'desc',
  } = req.query;

  const top  = Math.min(parseInt(limit) || 20, 50);
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * top;

  const filters = [
    'InternetEntireListingDisplayYN eq true',
    "StandardStatus eq 'Active'",
    transactionType === 'For Lease'
      ? "TransactionType eq 'For Lease'"
      : "TransactionType eq 'For Sale'",
  ];

  // Commercial tabs: exclude residential. Residential tabs: no PropertyType filter —
  // TRREB uses values like 'Residential Freehold'/'Residential Condo & Other' so
  // eq 'Residential' would return 0 results.
  if (propertyType === 'Commercial') filters.push("PropertyType ne 'Residential'");

  if (minPrice)        filters.push(`ListPrice ge ${parseInt(minPrice)}`);
  if (maxPrice)        filters.push(`ListPrice le ${parseInt(maxPrice)}`);
  if (minBeds)         filters.push(`BedroomsTotal ge ${parseInt(minBeds)}`);
  if (minBaths)        filters.push(`BathroomsTotalInteger ge ${parseInt(minBaths)}`);
  if (propertySubType) filters.push(`PropertySubType eq '${propertySubType}'`);
  if (city)            filters.push(`City eq '${city}'`);
  if (search)          filters.push(`contains(StreetName,'${search.replace(/'/g, "''")}')`);

  const select = [
    'ListingKey', 'ListingId', 'StandardStatus', 'TransactionType',
    'ListPrice', 'OriginalListPrice',
    'UnparsedAddress', 'StreetNumber', 'StreetName', 'UnitNumber',
    'City', 'StateOrProvince', 'PostalCode',
    'BedroomsTotal', 'BathroomsTotalInteger',
    'PropertyType', 'PropertySubType',
    'LivingAreaRange', 'DaysOnMarket',
    'InternetEntireListingDisplayYN',
    'ListAgentFullName', 'ListOfficeName',
    'ModificationTimestamp',
  ].join(',');

  const qs = [
    `$filter=${encodeURIComponent(filters.join(' and '))}`,
    `$top=${top}`,
    `$skip=${skip}`,
    `$orderby=${encodeURIComponent(sortBy + ' ' + sortDir)}`,
    `$select=${encodeURIComponent(select)}`,
    `$count=true`,
  ].join('&');

  console.log('[listings] URL:', `${RESO_BASE}?${qs}`);

  try {
    const r = await fetch(`${RESO_BASE}?${qs}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    });

    if (!r.ok) {
      const body = await r.text();
      console.error('[listings] error:', r.status, body);
      return res.status(r.status).json({
        error: 'TRREB API returned an error',
        status: r.status,
        detail: body.substring(0, 500),
      });
    }

    const data = await r.json();
    const listings = (data.value || []).filter(
      l => l.InternetEntireListingDisplayYN === true
    );
    // Diagnostic: log unique PropertyType values to understand TRREB's actual data
    const ptValues = [...new Set(listings.map(l => l.PropertyType).filter(Boolean))];
    console.log('[listings] PropertyType values in response:', ptValues, '| propertyType param:', propertyType, '| tx:', transactionType);

    return res.status(200).json({
      listings,
      total: data['@odata.count'] ?? listings.length,
      page:  parseInt(page),
      limit: top,
      pages: Math.ceil((data['@odata.count'] ?? listings.length) / top),
    });

  } catch (err) {
    console.error('[listings] fetch error:', err);
    return res.status(500).json({
      error: 'Failed to reach TRREB API',
      detail: err.message,
    });
  }
}