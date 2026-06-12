// api/listing.js
// Vercel serverless function — fetches a single listing by ListingKey.
// Powers the /listings/:listingKey detail page.
//
// GET /api/listing?key=XXXXXXXXXX
//
// Required env var: TRREB_TOKEN

const RESO_BASE = 'https://query.ampre.ca/odata/Property';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  // IDX token for listing detail (public display)
  const token = process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  if (!token) return res.status(500).json({ error: 'TRREB_IDX_TOKEN not configured' });

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key (ListingKey) is required' });

  // All fields for the detail page — much richer than the card $select
  const select = [
    'ListingKey', 'ListingId', 'StandardStatus', 'TransactionType',
    'ListPrice', 'OriginalListPrice', 'ClosePrice',
    'UnparsedAddress', 'StreetNumber', 'StreetName', 'StreetSuffix',
    'StreetDirPrefix', 'UnitNumber', 'City', 'StateOrProvince', 'PostalCode',
    'BedroomsTotal', 'BedroomsAboveGrade', 'BedroomsBelowGrade',
    'BathroomsTotalInteger', 'BathroomsHalf',
    'PropertyType', 'PropertySubType',
    'LivingArea', 'LivingAreaRange',
    'GarageSpaces', 'ParkingTotal', 'ParkingFeatures',
    'LotSizeArea', 'LotSizeDimensions',
    'YearBuilt', 'FoundationDetails',
    'HeatingType', 'CoolingType', 'Utilities',
    'BasementType', 'BasementFeatures',
    'FireplacesTotal',
    'PoolFeatures',
    'ExteriorFeatures', 'InteriorFeatures',
    'PublicRemarks',
    'Latitude', 'Longitude',
    'DaysOnMarket', 'OriginalEntryTimestamp', 'ModificationTimestamp',
    'PriceChangeTimestamp', 'CloseDate',
    'ListAgentFullName', 'ListAgentPhone', 'ListAgentEmail',
    'ListOfficeName', 'ListOfficePhone',
    'InternetEntireListingDisplayYN',
    'Media',
  ].join(',');

  const url = new URL(RESO_BASE);
  url.searchParams.set('$filter',  `ListingKey eq '${key}' and InternetEntireListingDisplayYN eq true`);
  url.searchParams.set('$top',     '1');
  url.searchParams.set('$select',  select);
  url.searchParams.set('$expand',  'Media');

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'TRREB API error' });
    }

    const data = await upstream.json();
    const listing = (data.value || [])[0];

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or no longer active' });
    }

    // Compliance check
    if (!listing.InternetEntireListingDisplayYN) {
      return res.status(403).json({ error: 'Listing not authorised for display' });
    }

    return res.status(200).json({ listing });

  } catch (err) {
    console.error('[api/listing] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch listing', detail: err.message });
  }
}
