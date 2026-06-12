// ─── Formatting utilities ──────────────────────────────────────────────────

/**
 * Format a dollar amount for display.
 * $1,250,000 → "$1.25M"   |   $849,900 → "$849,900"
 */
export function formatPrice(amount) {
  if (!amount && amount !== 0) return '—';
  if (amount >= 1_000_000) {
    const m = (amount / 1_000_000).toFixed(2);
    return `$${parseFloat(m)}M`;
  }
  return `$${amount.toLocaleString('en-CA')}`;
}

/**
 * Extract the best available photo URL from a RESO Media array.
 */
export function getPrimaryPhoto(media) {
  if (!media || media.length === 0) return null;
  // RESO spec: Order is 1-based; prefer Order === 1
  const sorted = [...media].sort((a, b) => (a.Order ?? 999) - (b.Order ?? 999));
  return sorted[0]?.MediaURL || null;
}

/**
 * Format full street address from RESO fields.
 */
export function formatAddress(listing) {
  if (listing.UnparsedAddress) return listing.UnparsedAddress;
  const parts = [
    listing.StreetNumber,
    listing.StreetDirPrefix,
    listing.StreetName,
    listing.StreetSuffix,
    listing.UnitNumber ? `Unit ${listing.UnitNumber}` : null,
  ].filter(Boolean);
  return parts.join(' ') || 'Address unavailable';
}

/**
 * City + Province + Postal for the subtitle line.
 */
export function formatCityLine(listing) {
  return [listing.City, 'ON', listing.PostalCode].filter(Boolean).join(', ');
}

/**
 * Format days on market with context label.
 * < 7   → "New"
 * 7–30  → "X days"
 * > 30  → "X days — over avg"
 */
export function formatDOM(days) {
  if (days === null || days === undefined) return null;
  if (days <= 0) return 'New';
  if (days <= 6) return `${days}d`;
  if (days <= 30) return `${days} days`;
  return `${days} days`;
}

export function domIsHigh(days, avgDays = 28) {
  return days > avgDays;
}

/**
 * Monthly mortgage estimate (quick approximation).
 * Assumes 25-year amortization, 5% down on < $1M, 20% down on ≥ $1M.
 * Rate should be decimal e.g. 0.055 for 5.5%.
 */
export function estimateMortgage(price, annualRate = 0.055) {
  if (!price) return null;
  const downPct = price >= 1_000_000 ? 0.20 : 0.05;
  const principal = price * (1 - downPct);
  const monthlyRate = annualRate / 12;
  const n = 25 * 12; // 300 payments
  const monthly = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return Math.round(monthly);
}

/**
 * Property type → human label.
 */
export function propertyTypeLabel(subType) {
  const map = {
    'Detached': 'Detached',
    'Semi-Detached': 'Semi-Det.',
    'Att/Row/Twnhouse': 'Townhouse',
    'Condo Apt': 'Condo',
    'Condo Townhouse': 'Condo Town',
    'Link': 'Link',
    'Co-Op Apt': 'Co-op',
    'Multiplex': 'Multiplex',
    'Store W/Apt/Offc': 'Mixed Use',
  };
  return map[subType] || subType || 'Residential';
}

/**
 * Compute a rough Match Score (0–100) based on user preferences
 * stored in localStorage after VOW signup.
 */
export function computeMatchScore(listing, prefs) {
  if (!prefs) return null;
  let score = 60; // base

  // Budget match (±20% of max)
  if (prefs.maxBudget && listing.ListPrice) {
    if (listing.ListPrice <= prefs.maxBudget) score += 15;
    else if (listing.ListPrice <= prefs.maxBudget * 1.1) score += 5;
    else score -= 15;
  }

  // Beds match
  if (prefs.minBeds && listing.BedroomsTotal >= prefs.minBeds) score += 10;
  else if (prefs.minBeds) score -= 10;

  // Area match
  if (prefs.areas && prefs.areas.length > 0) {
    const city = (listing.City || '').toLowerCase();
    const matched = prefs.areas.some(a => city.includes(a.toLowerCase()));
    if (matched) score += 15;
    else score -= 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Format a match score for display ("94% Match").
 */
export function matchLabel(score) {
  if (score === null || score === undefined) return null;
  return `${score}% Match`;
}
