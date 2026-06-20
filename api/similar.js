// api/similar.js
// Returns similar active listings for the detail page "You may also like" row.
// GET /api/similar?city=Oakville&type=Detached&price=1489000&exclude=LISTING_KEY&tx=For+Sale

const RESO_BASE = 'https://query.ampre.ca/odata/Property';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const token = process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  if (!token) return res.status(500).json({ error: 'TRREB token not configured' });

  const { city = '', type = '', price = '', exclude = '', tx = 'For Sale', limit = '4' } = req.query;

  const filters = [
    'InternetEntireListingDisplayYN eq true',
    "StandardStatus eq 'Active'",
    `TransactionType eq '${tx}'`,
  ];
  if (city)  filters.push(`City eq '${city}'`);
  if (type)  filters.push(`PropertySubType eq '${type}'`);
  if (price) {
    const p = parseInt(price);
    filters.push(`ListPrice ge ${Math.floor(p * 0.75)}`);
    filters.push(`ListPrice le ${Math.ceil(p * 1.30)}`);
  }
  // Exclude the current listing
  if (exclude) filters.push(`ListingKey ne '${exclude}'`);

  const select = [
    'ListingKey','ListingId','ListPrice','TransactionType',
    'UnparsedAddress','StreetNumber','StreetName','City','PostalCode',
    'BedroomsTotal','BathroomsTotalInteger','LivingAreaRange',
    'PropertyType','PropertySubType','DaysOnMarket',
    'InternetEntireListingDisplayYN','ListAgentFullName','ListOfficeName',
  ].join(',');

  const qs = [
    `$filter=${encodeURIComponent(filters.join(' and '))}`,
    `$top=${Math.min(parseInt(limit), 8)}`,
    `$orderby=${encodeURIComponent('ModificationTimestamp desc')}`,
    `$select=${encodeURIComponent(select)}`,
  ].join('&');
  const apiUrl = `${RESO_BASE}?${qs}`;

  try {
    const upstream = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'TRREB error' });
    const data = await upstream.json();
    const listings = (data.value || []).filter(l => l.InternetEntireListingDisplayYN === true);
    return res.status(200).json({ listings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
