// api/register.js
// Vercel serverless function — handles VOW email signup.
// Writes lead profile to Airtable, returns a VOW session cookie.
//
// POST /api/register
// Body: { name, email, maxBudget, areas, minBeds, needsParking, needsTransit }
//
// Required env vars:
//   AIRTABLE_API_KEY   — Personal access token from airtable.com/account
//   AIRTABLE_BASE_ID   — Base ID (starts with "app...") from Airtable URL
//
// Graceful degradation: if Airtable vars are not set, VOW access is still granted
// (useful during development). Leads are logged to Vercel function logs only.

const AIRTABLE_API = 'https://api.airtable.com/v0';
const TABLE_NAME   = 'VOW Signups';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Parse body ───────────────────────────────────────────────────────────
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const {
    name           = '',
    email          = '',
    maxBudget      = '',
    areas          = [],
    minBeds        = '',
    needsParking   = false,
    needsTransit   = false,
    listingKey     = '',
    listingAddress = '',
  } = body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // ── Airtable write ───────────────────────────────────────────────────────
  const airtableKey  = process.env.AIRTABLE_API_KEY;
  const airtableBase = process.env.AIRTABLE_BASE_ID;

  if (airtableKey && airtableBase) {
    try {
      const airtableRes = await fetch(
        `${AIRTABLE_API}/${airtableBase}/${encodeURIComponent(TABLE_NAME)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${airtableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            records: [{
              fields: {
                Email:          email,
                Name:           name || '(not provided)',
                ListingAddress: listingAddress || '',
                ListingKey:     listingKey     || '',
                Timestamp:      new Date().toISOString(),
                Status:         'New',
                MaxBudget:      maxBudget ? parseInt(maxBudget) : null,
                PreferredAreas: Array.isArray(areas) ? areas.join(', ') : (areas || ''),
                MinBeds:        minBeds ? parseInt(minBeds) : null,
              },
            }],
          }),
        }
      );

      if (!airtableRes.ok) {
        const errBody = await airtableRes.json();
        // Log but don't block — user still gets VOW access
        console.error('[api/register] Airtable write failed:', errBody);
      }
    } catch (err) {
      console.error('[api/register] Airtable network error:', err.message);
      // Still grant VOW access
    }
  } else {
    // Dev mode: log to function console
    console.log('[api/register] Lead captured (Airtable not configured):', {
      name, email, maxBudget, areas, minBeds,
    });
  }

  // ── Set VOW session cookie ───────────────────────────────────────────────
  // HttpOnly + SameSite=Lax: secure enough for VOW gate, not for financial data.
  res.setHeader('Set-Cookie', [
    `propedia_vow=1; Path=/; Max-Age=${60 * 60 * 24 * 90}; SameSite=Lax; HttpOnly`,
    // Store minimal prefs in a readable cookie for Match Score on client
    `propedia_prefs=${encodeURIComponent(JSON.stringify({
      name:      name,
      maxBudget: maxBudget || null,
      areas:     Array.isArray(areas) ? areas : [],
      minBeds:   minBeds || null,
    }))}; Path=/; Max-Age=${60 * 60 * 24 * 90}; SameSite=Lax`,
  ]);

  return res.status(200).json({
    success: true,
    vow:     true,
    message: 'Account created. Sold prices and market history are now unlocked.',
  });
}
