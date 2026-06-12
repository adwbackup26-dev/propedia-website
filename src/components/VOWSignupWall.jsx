// src/components/VOWSignupWall.jsx
// VOW (Verified Online Visitor) signup modal.
// Shown when a non-registered user tries to access sold prices / price history.
// On successful signup → writes to Airtable via /api/register, sets cookie,
// captures: name, email, budget, areas, beds — feeds Match Score.

import React, { useState } from 'react';

const GTA_AREAS = [
  'Mississauga', 'Toronto', 'Brampton', 'Oakville',
  'Burlington', 'Vaughan', 'Markham', 'Richmond Hill',
];

/**
 * VOWSignupWall
 *
 * Props:
 *   onSuccess  {function}  — () => void — called after successful signup
 *   onDismiss  {function}  — () => void — called when user closes modal
 *   trigger    {string}    — what triggered the wall: "sold-prices" | "price-history" | "general"
 */
export default function VOWSignupWall({ onSuccess, onDismiss, trigger = 'general' }) {
  const [step, setStep]       = useState('signup'); // 'signup' | 'prefs' | 'done'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Step 1 fields
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');

  // Step 2 fields
  const [maxBudget,    setMaxBudget]    = useState('');
  const [areas,        setAreas]        = useState([]);
  const [minBeds,      setMinBeds]      = useState('');
  const [needsParking, setNeedsParking] = useState(false);
  const [needsTransit, setNeedsTransit] = useState(false);

  // Heading copy based on trigger
  const triggerCopy = {
    'sold-prices':   { headline: 'Unlock Sold Prices', sub: 'See what homes actually sold for — not just asking prices.' },
    'price-history': { headline: 'Unlock Price History', sub: 'See every price cut and relisting for this property.' },
    'general':       { headline: 'Unlock Full Market Data', sub: 'Get the data that serious buyers use.' },
  }[trigger] || { headline: 'Unlock Full Market Data', sub: 'Get the data that serious buyers use.' };

  // ── Step 1: Email signup ─────────────────────────────────────────────────
  const handleSignup = async () => {
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setStep('prefs');
    setError('');
  };

  // ── Step 2: Preferences + API write ─────────────────────────────────────
  const handlePrefsSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          maxBudget,
          areas,
          minBeds,
          needsParking,
          needsTransit,
        }),
      });

      if (!res.ok) throw new Error('Registration failed. Please try again.');

      setStep('done');
      setTimeout(() => onSuccess?.(), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleArea = (area) => {
    setAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="vow-overlay" onClick={e => { if (e.target === e.currentTarget) onDismiss?.(); }}>
      <div className="vow-modal" style={{ position: 'relative' }}>

        {/* Close */}
        {onDismiss && (
          <button className="vow-modal__close" onClick={onDismiss} aria-label="Close">×</button>
        )}

        {/* ── Step 1: Signup ─────────────────────────────────────────── */}
        {step === 'signup' && (
          <>
            <p className="vow-modal__eyebrow">Free — No Spam</p>
            <h2 className="vow-modal__heading">{triggerCopy.headline}</h2>
            <p className="vow-modal__sub">{triggerCopy.sub}</p>

            <ul className="vow-modal__perks">
              <li className="vow-modal__perk">
                <span className="vow-modal__perk-icon">📊</span>
                Sold prices & price change history
              </li>
              <li className="vow-modal__perk">
                <span className="vow-modal__perk-icon">📈</span>
                Neighbourhood sold trends (90 days)
              </li>
              <li className="vow-modal__perk">
                <span className="vow-modal__perk-icon">🎯</span>
                Propedia Match Score on every listing
              </li>
              <li className="vow-modal__perk">
                <span className="vow-modal__perk-icon">⚖️</span>
                AI "Is This Fairly Priced?" analysis
              </li>
            </ul>

            <div className="vow-modal__form">
              <input
                className="vow-modal__input"
                type="text"
                placeholder="Your first name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
              <input
                className="vow-modal__input"
                type="email"
                placeholder="Email address *"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
                required
              />
              {error && (
                <p style={{ fontSize: '12px', color: 'var(--red)', marginTop: '-4px' }}>
                  {error}
                </p>
              )}
              <button className="vow-modal__submit" onClick={handleSignup}>
                Unlock Free Access →
              </button>
              <p className="vow-modal__disclaimer">
                By signing up you agree to receive property updates from Anirudha Warhadpande,
                REALTOR® · HomeLife Miracle Realty Ltd., Brokerage.
                RECO #6011384 · TRREB Member #6008999.
                You can unsubscribe at any time.
              </p>
            </div>
          </>
        )}

        {/* ── Step 2: Preferences (Match Score setup) ────────────────── */}
        {step === 'prefs' && (
          <>
            <p className="vow-modal__eyebrow">Quick Setup</p>
            <h2 className="vow-modal__heading">What are you looking for?</h2>
            <p className="vow-modal__sub">
              Takes 30 seconds — unlocks your personal Match Score on every listing.
            </p>

            <div className="vow-modal__form">
              {/* Budget */}
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Max Budget
              </label>
              <select
                className="vow-modal__input"
                value={maxBudget}
                onChange={e => setMaxBudget(e.target.value)}
              >
                <option value="">Select budget range</option>
                <option value="500000">Up to $500K</option>
                <option value="750000">Up to $750K</option>
                <option value="1000000">Up to $1M</option>
                <option value="1500000">Up to $1.5M</option>
                <option value="2000000">Up to $2M</option>
                <option value="3000000">Up to $3M+</option>
              </select>

              {/* Min beds */}
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' }}>
                Bedrooms (minimum)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['1', '2', '3', '4', '5+'].map(b => (
                  <button
                    key={b}
                    onClick={() => setMinBeds(b.replace('+', ''))}
                    style={{
                      flex: 1, height: '36px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                      border: '1.5px solid',
                      borderColor: minBeds === b.replace('+', '') ? 'var(--teal)' : 'var(--border)',
                      background: minBeds === b.replace('+', '') ? 'var(--teal)' : '#fff',
                      color: minBeds === b.replace('+', '') ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>

              {/* Areas */}
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' }}>
                Preferred Areas (select all)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {GTA_AREAS.map(area => (
                  <button
                    key={area}
                    onClick={() => toggleArea(area)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                      border: '1.5px solid',
                      borderColor: areas.includes(area) ? 'var(--teal)' : 'var(--border)',
                      background: areas.includes(area) ? 'var(--teal-lt)' : '#fff',
                      color: areas.includes(area) ? 'var(--teal-dk)' : 'var(--text-secondary)',
                    }}
                  >
                    {area}
                  </button>
                ))}
              </div>

              {/* Needs */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={needsParking} onChange={e => setNeedsParking(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--teal)' }} />
                  Need parking
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={needsTransit} onChange={e => setNeedsTransit(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--teal)' }} />
                  Near transit
                </label>
              </div>

              {error && (
                <p style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  className="vow-modal__submit"
                  onClick={handlePrefsSubmit}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  {loading ? 'Saving…' : 'Save My Preferences →'}
                </button>
                <button
                  onClick={handlePrefsSubmit}
                  disabled={loading}
                  style={{
                    padding: '0 16px', border: '1.5px solid var(--border)',
                    borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)',
                    background: '#fff',
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 className="vow-modal__heading">You're all set!</h2>
            <p className="vow-modal__sub" style={{ marginBottom: 0 }}>
              Sold prices and full market history are now unlocked.
              Your Match Score is active on every listing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
