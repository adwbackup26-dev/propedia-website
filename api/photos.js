// api/photos.js
// Vercel serverless function — fetches property photos from TRREB Media endpoint.
// Keeps TRREB_TOKEN server-side only. Never exposed to client.
//
// GET /api/photos?listingKey=W13440690
//
// Required env var:  TRREB_IDX_TOKEN   (IDX bearer token, set in Vercel dashboard)

const MEDIA_BASE = 'https://query.ampre.ca/odata/Media';

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
  // IDX token — same token as listings endpoint
  const token = process.env.TRREB_IDX_TOKEN || process.env.TRREB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'TRREB_IDX_TOKEN not configured in Vercel environment variables.' });
  }

  // ── Parse query params ───────────────────────────────────────────────────
  const { listingKey } = req.query;

  if (!listingKey) {
    return res.status(400).json({ error: 'listingKey query parameter is required' });
  }

  // ── Build OData filter for Media resource ────────────────────────────────
  // Filter: ResourceRecordKey eq '{ListingKey}' and ResourceName eq 'Property'
  const filterString = `ResourceRecordKey eq '${listingKey}' and ResourceName eq 'Property'`;
  const orderby = 'ModificationTimestamp desc,MediaKey';

  // ── Build query string manually ──────────────────────────────────────────
  const queryParts = [
    `$filter=${encodeURIComponent(filterString)}`,
    `$orderby=${encodeURIComponent(orderby)}`,
    `$select=MediaKey,MediaURL,Order,PreferredPhotoYN,MediaCategory,ModificationTimestamp`,
  ];

  const url = new URL(`${MEDIA_BASE}?${queryParts.join('&')}`);

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
      console.error('[api/photos] TRREB error:', upstream.status, errorBody);
      return res.status(upstream.status).json({
        error: 'TRREB API returned an error',
        status: upstream.status,
        detail: errorBody.substring(0, 500),
      });
    }

    const data = await upstream.json();

    // ── Process media records ────────────────────────────────────────────
    // Deduplicate by MediaURL first, then sort by Order and PreferredPhotoYN
    const uniquePhotos = new Map();
    
    (data.value || [])
      .filter(m => m.MediaCategory === 'Photo')  // Only photos, not documents
      .forEach(m => {
        if (m.MediaURL && !uniquePhotos.has(m.MediaURL)) {
          uniquePhotos.set(m.MediaURL, m);
        }
      });

    const photos = Array.from(uniquePhotos.values())
      .sort((a, b) => {
        // Preferred photo first
        if (a.PreferredPhotoYN && !b.PreferredPhotoYN) return -1;
        if (!a.PreferredPhotoYN && b.PreferredPhotoYN) return 1;
        // Then by Order
        return (a.Order || 999) - (b.Order || 999);
      })
      .map(m => ({
        mediaKey: m.MediaKey,
        url: m.MediaURL,
        order: m.Order,
        preferred: m.PreferredPhotoYN,
        category: m.MediaCategory,
        modifiedAt: m.ModificationTimestamp,
      }));

    return res.status(200).json({
      listingKey,
      photos,
      total: photos.length,
      preferredPhoto: photos.find(p => p.preferred) || photos[0] || null,
    });

  } catch (err) {
    console.error('[api/photos] Fetch error:', err);
    return res.status(500).json({
      error: 'Failed to reach TRREB Media API',
      detail: err.message,
    });
  }
}