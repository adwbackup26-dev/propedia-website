// Returns the Mapbox public token to the browser.
// The token is a PUBLIC Mapbox access token — exposing it is intentional and safe.
// It's served here because Vercel "Sensitive" env vars are excluded from Vite client bundles.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = process.env.VITE_MAPBOX_TOKEN || '';
  if (!token) return res.status(500).json({ error: 'VITE_MAPBOX_TOKEN not set' });
  return res.status(200).json({ token });
}
