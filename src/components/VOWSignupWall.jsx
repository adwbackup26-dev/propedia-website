// src/components/VOWSignupWall.jsx
// VOW (Verified Online Visitor) signup modal — dark premium redesign
// Logic unchanged: writes to Airtable via /api/register, sets cookie,
// captures name, email, budget, areas, beds — feeds Match Score.

import React, { useState } from 'react';

const GTA_AREAS = [
  'Mississauga', 'Toronto', 'Brampton', 'Oakville',
  'Burlington', 'Vaughan', 'Markham', 'Richmond Hill',
];

// ── Shared style tokens ───────────────────────────────────────────────────────
const inp = {
  width: '100%', height: 42, background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.14)', borderRadius: 7,
  padding: '0 13px', fontSize: 14, color: '#fff', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6,
};
const btnPrimary = {
  width: '100%', height: 40, background: '#00B4A8', color: '#fff',
  border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s',
};
const btnSecondary = {
  flex: 1, height: 40, background: 'transparent',
  border: '1px solid rgba(255,255,255,.2)', borderRadius: 7,
  fontSize: 13, color: 'rgba(255,255,255,.6)', cursor: 'pointer',
  fontFamily: 'inherit',
};

const PERKS = [
  { icon: 'ti-chart-bar',      title: 'Sold prices',        desc: 'See what homes actually sold for, not just list prices' },
  { icon: 'ti-history',        title: 'Full price history',  desc: 'Every price cut and relisting on any property' },
  { icon: 'ti-target',         title: 'Propedia Match Score',desc: 'Personalised compatibility score on every listing' },
  { icon: 'ti-scale',          title: 'Fairness analysis',   desc: 'AI-powered "Is this fairly priced?" verdict per listing' },
];

export default function VOWSignupWall({ onSuccess, onDismiss, trigger = 'general' }) {
  const [step, setStep]       = useState('signup');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');

  const [maxBudget,    setMaxBudget]    = useState('');
  const [areas,        setAreas]        = useState([]);
  const [minBeds,      setMinBeds]      = useState('');
  const [needsParking, setNeedsParking] = useState(false);
  const [needsTransit, setNeedsTransit] = useState(false);

  const triggerCopy = {
    'sold-prices':   { headline: 'Unlock Sold Prices',       sub: 'See what homes actually sold for — not just asking prices.' },
    'price-history': { headline: 'Unlock Price History',     sub: 'See every price cut and relisting for this property.' },
    'general':       { headline: 'Unlock Full Market Data',  sub: 'Get the intelligence serious buyers use.' },
  }[trigger] || { headline: 'Unlock Full Market Data', sub: 'Get the intelligence serious buyers use.' };

  const handleSignup = () => {
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setStep('prefs'); setError('');
  };

  const handlePrefsSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, maxBudget, areas, minBeds, needsParking, needsTransit }),
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

  const toggleArea = area =>
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);

  return (
    <div className="vow-overlay" onClick={e => { if (e.target === e.currentTarget) onDismiss?.(); }}>
      <div className="vow-modal" style={{ position: 'relative' }}>

        {/* Close */}
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Close" style={{
            position: 'absolute', top: 14, right: 14, width: 32, height: 32,
            borderRadius: '50%', border: '1px solid rgba(255,255,255,.14)',
            background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)',
            fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', lineHeight: 1,
          }}>×</button>
        )}

        {/* ── Step 1: Signup ─────────────────────────────────────────────── */}
        {step === 'signup' && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#00B4A8', marginBottom: 8 }}>
              Free · No Spam
            </p>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: '#fff', margin: '0 0 8px', lineHeight: 1.2 }}>
              {triggerCopy.headline}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: 22 }}>
              {triggerCopy.sub}
            </p>

            {/* Perks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {PERKS.map(p => (
                <div key={p.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(0,180,168,.12)', border: '1px solid rgba(0,180,168,.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className={`ti ${p.icon}`} style={{ fontSize: 14, color: '#00B4A8' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 1 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.4 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lbl}>First name</label>
                <input style={inp} type="text" placeholder="Jane" value={name}
                  onChange={e => setName(e.target.value)} autoFocus
                  onFocus={e => { e.target.style.borderColor = '#00B4A8'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.14)'; }}/>
              </div>
              <div>
                <label style={lbl}>Email address *</label>
                <input style={inp} type="email" placeholder="jane@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                  onFocus={e => { e.target.style.borderColor = '#00B4A8'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.14)'; }}
                  required/>
              </div>
              {error && <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{error}</p>}
              <button style={btnPrimary} onClick={handleSignup}
                onMouseEnter={e => { e.target.style.background = '#009E94'; }}
                onMouseLeave={e => { e.target.style.background = '#00B4A8'; }}>
                Unlock Free Access →
              </button>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', lineHeight: 1.6, margin: 0 }}>
                By signing up you agree to receive property updates from Anirudha Warhadpande,
                REALTOR® · HomeLife Miracle Realty Ltd., Brokerage · RECO #6011384 · TRREB #6008999.
                You can unsubscribe at any time.
              </p>
            </div>
          </>
        )}

        {/* ── Step 2: Preferences ────────────────────────────────────────── */}
        {step === 'prefs' && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#00B4A8', marginBottom: 8 }}>
              Step 2 of 2
            </p>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: '#fff', margin: '0 0 6px', lineHeight: 1.2 }}>
              What are you looking for?
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.5, marginBottom: 22 }}>
              30 seconds — activates your personal Match Score on every listing.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Budget */}
              <div>
                <label style={lbl}>Max Budget</label>
                <select value={maxBudget} onChange={e => setMaxBudget(e.target.value)} style={{ ...inp, height: 42, paddingRight: 10, cursor: 'pointer' }}>
                  <option value="">Select budget range</option>
                  <option value="500000">Up to $500K</option>
                  <option value="750000">Up to $750K</option>
                  <option value="1000000">Up to $1M</option>
                  <option value="1500000">Up to $1.5M</option>
                  <option value="2000000">Up to $2M</option>
                  <option value="3000000">Up to $3M+</option>
                </select>
              </div>

              {/* Beds */}
              <div>
                <label style={lbl}>Minimum Bedrooms</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['1','2','3','4','5+'].map(b => {
                    const v = b.replace('+','');
                    const active = minBeds === v;
                    return (
                      <button key={b} onClick={() => setMinBeds(v)} style={{
                        flex: 1, height: 36, borderRadius: 7, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${active ? '#00B4A8' : 'rgba(255,255,255,.14)'}`,
                        background: active ? 'rgba(0,180,168,.15)' : 'rgba(255,255,255,.04)',
                        color: active ? '#00B4A8' : 'rgba(255,255,255,.5)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                      }}>{b}</button>
                    );
                  })}
                </div>
              </div>

              {/* Areas */}
              <div>
                <label style={lbl}>Preferred Areas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {GTA_AREAS.map(area => {
                    const active = areas.includes(area);
                    return (
                      <button key={area} onClick={() => toggleArea(area)} style={{
                        padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        border: `1.5px solid ${active ? '#00B4A8' : 'rgba(255,255,255,.14)'}`,
                        background: active ? 'rgba(0,180,168,.12)' : 'rgba(255,255,255,.04)',
                        color: active ? '#00B4A8' : 'rgba(255,255,255,.45)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                      }}>{area}</button>
                    );
                  })}
                </div>
              </div>

              {/* Needs */}
              <div style={{ display: 'flex', gap: 20 }}>
                {[
                  { label: 'Need parking', val: needsParking, set: setNeedsParking },
                  { label: 'Near transit', val: needsTransit, set: setNeedsTransit },
                ].map(({ label, val, set }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#00B4A8', cursor: 'pointer' }}/>
                    {label}
                  </label>
                ))}
              </div>

              {error && <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button style={{ ...btnSecondary }} onClick={handlePrefsSubmit} disabled={loading}>Skip</button>
                <button style={{ ...btnPrimary, flex: 2 }} onClick={handlePrefsSubmit} disabled={loading}
                  onMouseEnter={e => { e.currentTarget.style.background = '#009E94'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#00B4A8'; }}>
                  {loading ? 'Saving…' : 'Save My Preferences →'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px',
              background: 'rgba(0,180,168,.12)', border: '2px solid rgba(0,180,168,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="ti ti-check" style={{ fontSize: 26, color: '#00B4A8' }}/>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 10 }}>You're all set!</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: 0 }}>
              Sold prices and full market history are now unlocked.<br/>
              Your Match Score is active on every listing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
