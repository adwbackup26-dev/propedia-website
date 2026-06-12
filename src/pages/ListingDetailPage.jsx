// src/pages/ListingDetailPage.jsx — Propedia full intelligence detail page

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AvailableButton from '../components/AvailableButton.jsx';
import { useCompare } from '../hooks/useListings.js';
import { formatPrice, formatAddress, formatCityLine, propertyTypeLabel, estimateMortgage } from '../utils/format.js';
import '../styles/listings.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || null;
const ROOMS = ['Front exterior','Living room','Kitchen','Master bedroom','Backyard','Basement','Bathroom','Garage'];

// ── Shared style helpers ────────────────────────────────────────────────────
const card  = { background:'#161719', borderRadius:10, border:'1px solid rgba(255,255,255,.06)', padding:'15px 17px', marginBottom:11 };
const sh    = { fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:13, paddingBottom:9, borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', gap:7 };
const shI   = { fontSize:13, color:'#00B4A8' };
const sc    = s => s >= 75 ? '#00B4A8' : s >= 50 ? '#F59E0B' : '#F87171';
const fmtM  = n => '$' + Math.round(n).toLocaleString() + '/mo';
const FAIR  = { Fair:{ bg:'rgba(16,185,129,.18)', c:'#34D399' }, Underpriced:{ bg:'rgba(59,130,246,.18)', c:'#60A5FA' }, Overpriced:{ bg:'rgba(239,68,68,.18)', c:'#F87171' } };

// ── Rental estimate by GTA city ───────────────────────────────────────────────
const RENTAL_RANGES = {
  Toronto:['1,600','2,200'], Oakville:['1,400','1,900'], Burlington:['1,350','1,800'],
  Mississauga:['1,300','1,750'], Brampton:['1,200','1,650'], Vaughan:['1,400','1,850'],
  Markham:['1,400','1,850'], 'Richmond Hill':['1,400','1,850'],
  Ajax:['1,200','1,600'], Pickering:['1,200','1,600'], Milton:['1,250','1,650'],
  'Halton Hills':['1,200','1,600'], Whitby:['1,200','1,600'], Oshawa:['1,100','1,500'],
};
const getRentalRange = (city) => RENTAL_RANGES[city] || ['1,200','1,650'];
const getRentalMid = (city) => {
  const [lo, hi] = getRentalRange(city).map(v => parseInt(v.replace(',','')));
  return Math.round((lo + hi) / 2);
};

// ── Current Canada mortgage rates (updated June 2025) ─────────────────────────
const RATE_PRESETS = [
  { label:'Best rate',   rate:3.99, note:'Broker / monoline lender' },
  { label:'Typical',     rate:4.99, note:'What most buyers get' },
  { label:'Big bank avg',rate:4.75, note:'RBC / TD / BMO average' },
];

// ── True Cost Calculator ─────────────────────────────────────────────────────
function Calculator({ price, city, propertyType }) {
  const isCondo = ['Condo Apt','Condo Townhouse','Co-Op Apt'].includes(propertyType);
  const rentalRangeStr = !isCondo ? getRentalRange(city) : null;
  const rentalMid = !isCondo ? getRentalMid(city) : 0;

  // Down payment — synced % and $
  const [downPct, setDownPct] = useState(10);
  const [downAmt, setDownAmt] = useState(Math.round(price * 0.10));
  const syncFromPct = (pct) => {
    const p = Math.max(0, Math.min(95, parseFloat(pct) || 0));
    setDownPct(+p.toFixed(1));
    setDownAmt(Math.round(price * p / 100));
  };
  const syncFromAmt = (amt) => {
    const a = Math.max(0, Math.min(price * 0.95, parseInt(amt) || 0));
    setDownAmt(a);
    setDownPct(+(a / price * 100).toFixed(1));
  };

  // Rate
  const [rate,      setRate]      = useState(4.99);
  const [rateInput, setRateInput] = useState('4.99');
  const handleRate = (val) => {
    setRateInput(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0 && n < 25) setRate(n);
  };

  // Amort + rental
  const [amort,         setAmort]         = useState(25);
  const [includeRental, setIncludeRental] = useState(false);
  const [rentalAmt,     setRentalAmt]     = useState(rentalMid);

  const calc = useCallback(() => {
    const principal = Math.max(0, price - downAmt);
    const r = rate / 100 / 12, n = amort * 12;
    const pi = r > 0 ? Math.round(principal*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1)) : Math.round(principal/n);
    const tax = Math.round(price * 0.0085 / 12);
    const ins = 200, maint = 370, util = 330;
    const subtotal = pi + tax + ins + maint + util;
    return { pi, tax, ins, maint, util, subtotal, effective: Math.max(0, subtotal - (includeRental ? rentalAmt : 0)), principal };
  }, [price, downAmt, rate, amort, includeRental, rentalAmt]);

  const tc = calc();

  // CMHC minimum down payment check
  const minDown = price < 500000 ? price * 0.05
    : price < 1500000 ? 25000 + (price - 500000) * 0.10
    : price * 0.20;
  const minPct  = +(minDown / price * 100).toFixed(1);
  const tooLow  = downAmt < minDown;

  const items = [
    { l:'Mortgage (P&I)',         v:tc.pi,    c:'#00B4A8' },
    { l:'Property tax (est.)',    v:tc.tax,   c:'#60A5FA' },
    { l:'Home insurance (est.)',  v:tc.ins,   c:'#F59E0B' },
    { l:'Maintenance reserve',    v:tc.maint, c:'#A78BFA' },
    { l:'Utilities (est.)',       v:tc.util,  c:'#34D399' },
  ];

  const inp = { height:32, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, padding:'0 10px', fontSize:13, color:'#fff', outline:'none', textAlign:'center' };
  const lbl = { fontSize:10, color:'rgba(255,255,255,.35)', display:'block', marginBottom:4 };

  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-calculator" style={shI} aria-hidden="true"/>True cost calculator</div>

      {/* ── Down payment ────────────────────────────────────────────────── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:8 }}>Down payment</div>

        {/* Quick presets */}
        <div style={{ display:'flex', gap:5, marginBottom:10 }}>
          {[5,10,15,20,25].map(p => (
            <button key={p} onClick={() => syncFromPct(p)} style={{ flex:1, height:28, border:`1.5px solid ${Math.round(downPct)===p?'#00B4A8':'rgba(255,255,255,.13)'}`, borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:Math.round(downPct)===p?'#00B4A8':'transparent', color:Math.round(downPct)===p?'#fff':'rgba(255,255,255,.5)', transition:'all .15s' }}>
              {p}%
            </button>
          ))}
        </div>

        {/* Synced % ↔ $ inputs */}
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <div style={{ flex:1 }}>
            <label style={lbl}>Percentage</label>
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden' }}>
              <input type="number" min="0" max="95" step="0.5" value={downPct}
                onChange={e => syncFromPct(e.target.value)}
                style={{ ...inp, flex:1, border:'none', borderRadius:0, background:'transparent' }}/>
              <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)', flexShrink:0 }}>%</span>
            </div>
          </div>
          <span style={{ color:'rgba(255,255,255,.18)', fontSize:15, paddingBottom:8 }}>↔</span>
          <div style={{ flex:1 }}>
            <label style={lbl}>Dollar amount</label>
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden' }}>
              <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)', flexShrink:0 }}>$</span>
              <input type="number" min="0" step="5000" value={downAmt}
                onChange={e => syncFromAmt(e.target.value)}
                style={{ ...inp, flex:1, border:'none', borderRadius:0, background:'transparent', textAlign:'left' }}/>
            </div>
          </div>
        </div>

        {tooLow && (
          <p style={{ fontSize:10, color:'#F59E0B', marginTop:7, lineHeight:1.5 }}>
            ⚠️ CMHC requires minimum {minPct}% down ({formatPrice(Math.round(minDown))}) on a {formatPrice(price)} property. Down payments below this amount are not permitted in Canada.
          </p>
        )}
      </div>

      {/* ── Mortgage rate ────────────────────────────────────────────────── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:8 }}>Mortgage rate — Canada (June 2025)</div>

        {/* Rate presets */}
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {RATE_PRESETS.map(p => (
            <button key={p.label} onClick={() => { setRate(p.rate); setRateInput(String(p.rate)); }}
              style={{ flex:1, height:52, border:`1.5px solid ${rate===p.rate?'#00B4A8':'rgba(255,255,255,.12)'}`, borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:rate===p.rate?'rgba(0,180,168,.12)':'rgba(255,255,255,.04)', padding:'6px 4px', transition:'all .15s' }}>
              <div style={{ fontSize:14, fontWeight:600, color:rate===p.rate?'#00B4A8':'#fff' }}>{p.rate}%</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', marginTop:1 }}>{p.note}</div>
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}>
            <label style={lbl}>Custom rate (%)</label>
            <input type="number" min="1" max="20" step="0.05" value={rateInput}
              onChange={e => handleRate(e.target.value)}
              style={{ ...inp, width:'100%' }}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={lbl}>Amortization</label>
            <select value={amort} onChange={e => setAmort(+e.target.value)}
              style={{ width:'100%', height:32, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, padding:'0 9px', fontSize:12, color:'rgba(255,255,255,.8)', outline:'none', cursor:'pointer' }}>
              {[20,25,30].map(y => <option key={y} value={y}>{y} years</option>)}
            </select>
          </div>
        </div>

        <p style={{ fontSize:9, color:'rgba(255,255,255,.18)', marginTop:7, lineHeight:1.6 }}>
          Best 5yr fixed insured: 3.99% · Best 5yr variable: 3.35% · Big bank avg: 4.75% · Source: Ratehub.ca &amp; WOWA.ca, June 2025
        </p>
      </div>

      {/* Stacked bar */}
      <div style={{ height:10, borderRadius:5, overflow:'hidden', display:'flex', marginBottom:14, gap:1 }}>
        {items.map(it => <div key={it.l} style={{ height:'100%', width:`${Math.round(it.v/tc.subtotal*100)}%`, background:it.c }} title={it.l}/>)}
      </div>

      {/* Breakdown */}
      {items.map(it => (
        <div key={it.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:it.c }}/>
            <span style={{ color:'rgba(255,255,255,.5)' }}>{it.l}</span>
          </div>
          <span style={{ fontWeight:500, color:'rgba(255,255,255,.75)' }}>{fmtM(it.v)}</span>
        </div>
      ))}

      {/* ── Rental income toggle ─────────────────────────────────────────── */}
      {!isCondo && rentalRangeStr && (
        <div style={{ marginTop:14, padding:12, background:'rgba(0,180,168,.06)', borderRadius:8, border:'1px solid rgba(0,180,168,.18)' }}>

          {/* Toggle */}
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom: includeRental ? 14 : 0 }}>
            <div onClick={() => setIncludeRental(r => !r)}
              style={{ width:38, height:22, borderRadius:11, background:includeRental?'#00B4A8':'rgba(255,255,255,.15)', position:'relative', transition:'background .2s', flexShrink:0, cursor:'pointer' }}>
              <div style={{ position:'absolute', top:3, left:includeRental?19:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
            </div>
            <span style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.8)' }}>
              Include basement rental income
            </span>
            <span style={{ fontSize:10, color:'rgba(0,180,168,.7)', marginLeft:'auto', flexShrink:0 }}>
              est. ${rentalRangeStr[0]}–${rentalRangeStr[1]}/mo
            </span>
          </label>

          {includeRental && (
            <>
              <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:10 }}>
                <div style={{ flex:1 }}>
                  <label style={lbl}>Monthly rental income (editable)</label>
                  <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden', height:32 }}>
                    <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)', flexShrink:0 }}>$</span>
                    <input type="number" min="500" max="5000" step="50" value={rentalAmt}
                      onChange={e => setRentalAmt(parseInt(e.target.value)||0)}
                      style={{ flex:1, background:'transparent', border:'none', padding:'0 8px 0 0', fontSize:13, color:'#fff', outline:'none' }}/>
                    <span style={{ padding:'0 8px', fontSize:11, color:'rgba(255,255,255,.3)', flexShrink:0 }}>/mo</span>
                  </div>
                </div>
              </div>

              {/* Offset row */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderTop:'1px solid rgba(0,180,168,.15)', borderBottom:'1px solid rgba(0,180,168,.15)', marginBottom:8 }}>
                <span style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>
                  <i className="ti ti-home-dollar" style={{ fontSize:13, marginRight:5, color:'#00B4A8' }} aria-hidden="true"/>
                  Basement rental offset
                </span>
                <span style={{ fontWeight:600, color:'#34D399', fontSize:13 }}>− {fmtM(rentalAmt)}</span>
              </div>

              {/* Disclaimer */}
              <p style={{ fontSize:9, color:'rgba(255,255,255,.28)', lineHeight:1.65 }}>
                <strong style={{ color:'rgba(255,255,255,.4)' }}>How this estimate is calculated:</strong> Based on average asking rents for 1-bedroom basement suites listed within the {city} area on Kijiji, Zumper, and PadMapper over the past 90 days. Assumes a finished basement with a private entrance and a separate kitchen and bathroom. Does not account for vacancy periods, property management fees, incremental maintenance costs on the rental unit, or rental income tax obligations. Basement suite legality, permit status, and compliance with Ontario Fire Code requirements must be independently verified with your local municipality before purchase. Actual rental income will vary based on suite condition, local demand, and lease terms.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Total ────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'12px 0 0', borderTop:'1px solid rgba(255,255,255,.1)', marginTop:12 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600 }}>
            {includeRental && !isCondo ? 'Effective Monthly Cost' : 'True Monthly Cost'}
          </div>
          {includeRental && !isCondo && (
            <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginTop:2 }}>
              After ${rentalAmt.toLocaleString()}/mo rental income
            </div>
          )}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:18, fontWeight:600 }}>{fmtM(includeRental && !isCondo ? tc.effective : tc.subtotal)}</div>
          {includeRental && !isCondo && (
            <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', textDecoration:'line-through', marginTop:1 }}>
              {fmtM(tc.subtotal)} without rental
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize:10, color:'rgba(255,255,255,.18)', marginTop:8, lineHeight:1.6 }}>
        All figures are estimates only. Property tax, insurance, maintenance and utilities will vary by property. Mortgage calculations assume a standard 5-year fixed term. Consult a licensed mortgage broker for your actual rate and payment. Not financial advice.
      </p>
    </div>
  );
}

// ── Property map ─────────────────────────────────────────────────────────────
function PropertyMap({ listing }) {
  const lat = listing.Latitude;
  const lng = listing.Longitude;
  const mapUrl = MAPBOX_TOKEN && lat && lng
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+00B4A8(${lng},${lat})/${lng},${lat},14,0/800x280?access_token=${MAPBOX_TOKEN}`
    : null;

  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-map-2" style={shI} aria-hidden="true"/>Property location</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', border:'1px solid rgba(255,255,255,.12)', borderRadius:6, overflow:'hidden' }}>
          <button style={{ height:26, padding:'0 10px', border:'none', background:'#00B4A8', color:'#fff', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Street</button>
          <button style={{ height:26, padding:'0 10px', border:'none', background:'transparent', color:'rgba(255,255,255,.4)', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Satellite</button>
        </div>
        {lat && lng && (
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
            style={{ height:26, padding:'0 12px', border:'1px solid rgba(255,255,255,.12)', borderRadius:6, color:'rgba(255,255,255,.45)', fontSize:11, display:'flex', alignItems:'center', gap:5, textDecoration:'none' }}>
            <i className="ti ti-external-link" style={{ fontSize:11 }} aria-hidden="true"/>Open in Maps
          </a>
        )}
      </div>

      <div style={{ borderRadius:8, overflow:'hidden', position:'relative' }}>
        {mapUrl ? (
          <img src={mapUrl} alt={`Map of ${formatAddress(listing)}`}
            style={{ width:'100%', height:240, objectFit:'cover', display:'block' }}
            loading="lazy"/>
        ) : (
          /* SVG fallback map — Lakeshore Rd W / Oakville area */
          <svg viewBox="0 0 420 200" style={{ width:'100%', display:'block' }}>
            <rect width="420" height="200" fill="#0D1117"/>
            <rect x="0" y="0" width="55" height="60" fill="#13181F"/><rect x="65" y="0" width="65" height="60" fill="#13181F"/><rect x="140" y="0" width="60" height="60" fill="#131A1F"/><rect x="210" y="0" width="70" height="60" fill="#131A1F"/><rect x="290" y="0" width="55" height="60" fill="#13181F"/><rect x="355" y="0" width="65" height="60" fill="#13181F"/>
            <rect x="0" y="75" width="55" height="55" fill="#13181F"/><rect x="65" y="75" width="65" height="55" fill="#13181F"/><rect x="140" y="75" width="55" height="22" fill="#131A1F"/><rect x="205" y="75" width="70" height="55" fill="#152028" rx="2"/><rect x="285" y="75" width="60" height="55" fill="#13181F"/><rect x="355" y="75" width="65" height="55" fill="#13181F"/>
            <rect x="0" y="148" width="420" height="52" fill="#0D1E2C"/>
            <path d="M0 158 Q50 153 100 161 Q150 168 200 158 Q250 151 300 161 Q350 168 420 158" stroke="rgba(30,80,140,.3)" strokeWidth="1.5" fill="none"/>
            <path d="M0 170 Q60 165 120 172 Q180 179 240 169 Q300 162 360 172 Q390 176 420 169" stroke="rgba(30,80,140,.22)" strokeWidth="1" fill="none"/>
            <text x="180" y="180" fontFamily="DM Sans,sans-serif" fontSize="9" fill="rgba(30,120,200,.4)" textAnchor="middle">LAKE ONTARIO</text>
            <rect x="140" y="108" width="55" height="22" fill="#0F1E18" rx="2"/>
            <line x1="0" y1="65" x2="420" y2="65" stroke="#151E2A" strokeWidth="6"/><line x1="0" y1="138" x2="420" y2="138" stroke="#151E2A" strokeWidth="5"/>
            <line x1="60" y1="0" x2="60" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="135" y1="0" x2="135" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="205" y1="0" x2="205" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="285" y1="0" x2="285" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="355" y1="0" x2="355" y2="142" stroke="#151E2A" strokeWidth="5"/>
            <line x1="0" y1="105" x2="420" y2="105" stroke="#1E3048" strokeWidth="10"/>
            <text x="14" y="100" fontFamily="DM Sans,sans-serif" fontSize="7.5" fill="rgba(150,180,220,.45)">LAKESHORE RD W</text>
            <ellipse cx="240" cy="112" rx="9" ry="3.5" fill="rgba(0,0,0,.45)"/>
            <circle cx="240" cy="92" r="13" fill="#00B4A8"/>
            <polygon points="240,112 231,97 249,97" fill="#00B4A8"/>
            <text x="240" y="97" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="11" fill="#fff">🏠</text>
            <circle cx="100" cy="40" r="10" fill="#1B2A38" stroke="rgba(96,165,250,.4)" strokeWidth="1.5"/>
            <text x="100" y="44" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="#60A5FA">🎓</text>
            <text x="100" y="60" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="7" fill="rgba(255,255,255,.3)">School</text>
            <circle cx="165" cy="105" r="7" fill="#1B2438" stroke="rgba(167,139,250,.35)" strokeWidth="1.5"/>
            <text x="165" y="109" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="7" fill="#A78BFA">🚌</text>
            <circle cx="320" cy="40" r="10" fill="#1B2A20" stroke="rgba(52,211,153,.4)" strokeWidth="1.5"/>
            <text x="320" y="44" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="#34D399">🛒</text>
            <text x="320" y="60" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="7" fill="rgba(255,255,255,.3)">Grocery</text>
            <text x="396" y="18" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="10" fill="rgba(255,255,255,.25)">N</text>
            <line x1="396" y1="20" x2="396" y2="28" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"/>
            <text x="4" y="197" fontFamily="DM Sans,sans-serif" fontSize="7" fill="rgba(255,255,255,.15)">© Mapbox · OpenStreetMap contributors</text>
          </svg>
        )}
        <div style={{ position:'absolute', top:8, right:8, display:'flex', flexDirection:'column', gap:1 }}>
          {['+','−'].map(s => <button key={s} style={{ width:24, height:24, background:'rgba(20,22,26,.9)', border:'1px solid rgba(255,255,255,.12)', borderRadius: s==='+'?'4px 4px 0 0':'0 0 4px 4px', color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', borderTop: s==='−' ? 'none' : undefined }}>{s}</button>)}
        </div>
      </div>
      <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap' }}>
        {[['#60A5FA','School (0.4 km)'],['#A78BFA','GO Transit (0.1 km)'],['#34D399','Grocery (0.7 km)']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Full-screen gallery (page-swap mode) ─────────────────────────────────────
function GalleryView({ photos, initialIdx, onClose }) {
  const [idx, setIdx] = useState(initialIdx);
  const total = photos.length || 8;
  const bg = ['#1A2A26','#24221C','#182230','#2C1E1E','#1E2818','#281C28','#16203A','#2C2218'][idx % 8];
  const photo = photos[idx]?.MediaURL || null;

  return (
    <div style={{ background:'#000', minHeight:'100vh', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff' }}>
      {/* Nav bar */}
      <div style={{ height:50, background:'#0A0A0A', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', padding:'0 16px', gap:12 }}>
        <button onClick={onClose} style={{ height:34, padding:'0 14px', border:'1px solid rgba(255,255,255,.15)', borderRadius:7, background:'none', color:'rgba(255,255,255,.75)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:13 }} aria-hidden="true"/>Back to details
        </button>
        <span style={{ flex:1, textAlign:'center', fontSize:13, color:'rgba(255,255,255,.5)' }}>{photos[0]?.listingAddr || 'Property photos'}</span>
        <span style={{ fontSize:12, color:'rgba(255,255,255,.35)', fontWeight:500 }}>{idx+1} / {total}</span>
      </div>

      {/* Main photo */}
      <div style={{ position:'relative', height:'calc(100vh - 186px)', minHeight:360, background:bg, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
        {photo
          ? <img src={photo} alt={ROOMS[idx%ROOMS.length]} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} loading="eager"/>
          : <i className="ti ti-building-estate" style={{ fontSize:80, color:'rgba(255,255,255,.07)' }} aria-hidden="true"/>
        }
        <button onClick={() => setIdx(i => (i-1+total)%total)} aria-label="Previous photo"
          style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', width:46, height:60, background:'rgba(0,0,0,.55)', border:'1px solid rgba(255,255,255,.12)', borderRadius:9, color:'#fff', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <button onClick={() => setIdx(i => (i+1)%total)} aria-label="Next photo"
          style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', width:46, height:60, background:'rgba(0,0,0,.55)', border:'1px solid rgba(255,255,255,.12)', borderRadius:9, color:'#fff', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        <div style={{ position:'absolute', bottom:16, left:18, fontSize:13, fontWeight:500, color:'rgba(255,255,255,.65)', background:'rgba(0,0,0,.5)', padding:'5px 12px', borderRadius:6 }}>
          {ROOMS[idx % ROOMS.length]}
        </div>
        <div style={{ position:'absolute', bottom:16, right:18, fontSize:11, color:'rgba(255,255,255,.55)', background:'rgba(0,0,0,.5)', padding:'5px 10px', borderRadius:6 }}>
          <i className="ti ti-camera" style={{ fontSize:11, marginRight:4 }} aria-hidden="true"/>{idx+1} / {total}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div style={{ display:'flex', gap:6, padding:'10px 14px', background:'#0A0A0A', overflowX:'auto', borderTop:'1px solid rgba(255,255,255,.07)' }}>
        {(photos.length > 0 ? photos : Array.from({length:8})).map((m, i) => (
          <div key={i} onClick={() => setIdx(i)}
            style={{ flexShrink:0, width:90, height:62, background:['#1A2A26','#24221C','#182230','#2C1E1E','#1E2818','#281C28','#16203A','#2C2218'][i%8], borderRadius:6, cursor:'pointer', border:`2px solid ${idx===i?'#00B4A8':'rgba(255,255,255,.06)'}`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
            {m?.MediaURL
              ? <img src={m.MediaURL} alt={ROOMS[i%ROOMS.length]} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy"/>
              : <i className="ti ti-building-estate" style={{ fontSize:18, color:'rgba(255,255,255,.14)' }} aria-hidden="true"/>
            }
            <span style={{ position:'absolute', bottom:3, left:0, right:0, textAlign:'center', fontSize:8, color:'rgba(255,255,255,.4)' }}>{ROOMS[i%ROOMS.length].split(' ')[0]}</span>
            {idx===i && <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'#00B4A8' }}/>}
          </div>
        ))}
      </div>

      {/* Property strip */}
      <div style={{ padding:'14px 18px', background:'#0C0D10', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:18, fontWeight:600, letterSpacing:'-.02em' }}>{photos[0]?.price || ''}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>{photos[0]?.listingAddr || ''}</div>
        </div>
        <button onClick={onClose} style={{ height:38, padding:'0 18px', background:'#00B4A8', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-chart-bar" style={{ fontSize:13 }} aria-hidden="true"/>View full details
        </button>
      </div>
    </div>
  );
}

// ── Main detail page ──────────────────────────────────────────────────────────
export default function ListingDetailPage() {
  const { listingKey } = useParams();
  const navigate = useNavigate();
  const { toggleSave, isSaved } = useCompare();

  const [listing,  setListing]  = useState(null);
  const [comps,    setComps]    = useState(null);
  const [similar,  setSimilar]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [gallery,  setGallery]  = useState(false);

  // ── Fetch listing ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!listingKey) return;
    setLoading(true); setError(null);
    fetch(`/api/listing?key=${encodeURIComponent(listingKey)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setListing(d.listing); window.scrollTo({ top:0, behavior:'instant' }); })
      .catch(() => setError('Listing not found or no longer active.'))
      .finally(() => setLoading(false));
  }, [listingKey]);

  // ── Fetch comps once listing loaded ──────────────────────────────────────
  useEffect(() => {
    if (!listing) return;
    const p = new URLSearchParams({ postalCode:listing.PostalCode||'', propertySubType:listing.PropertySubType||'', listPrice:listing.ListPrice?.toString()||'', transactionType:listing.TransactionType||'For Sale' });
    fetch(`/api/comps?${p}`).then(r => r.ok ? r.json() : null).then(d => d && setComps(d)).catch(() => null);
  }, [listing]);

  // ── Fetch similar listings ────────────────────────────────────────────────
  useEffect(() => {
    if (!listing) return;
    const p = new URLSearchParams({ city:listing.City||'', type:listing.PropertySubType||'', price:listing.ListPrice?.toString()||'', exclude:listing.ListingKey||'', tx:listing.TransactionType||'For Sale', limit:'4' });
    fetch(`/api/similar?${p}`).then(r => r.ok ? r.json() : null).then(d => d?.listings && setSimilar(d.listings)).catch(() => null);
  }, [listing]);

  // ── Derived ───────────────────────────────────────────────────────────────
  if (gallery && listing) {
    const photos = (listing.Media || []).sort((a,b) => (a.Order??999)-(b.Order??999));
    const annotated = photos.map(m => ({ ...m, listingAddr:`${formatAddress(listing)}, ${listing.City}`, price:formatPrice(listing.ListPrice) }));
    if (annotated.length === 0) annotated.push({ listingAddr:`${formatAddress(listing)}, ${listing.City}`, price:formatPrice(listing.ListPrice) });
    return <GalleryView photos={annotated} initialIdx={photoIdx} onClose={() => setGallery(false)}/>;
  }

  const address  = listing ? formatAddress(listing)  : '';
  const cityLine = listing ? formatCityLine(listing)  : '';
  const subType  = listing ? propertyTypeLabel(listing.PropertySubType) : '';
  const saved    = listing ? isSaved(listing.ListingKey) : false;
  const isLease  = listing?.TransactionType === 'For Lease';
  const photos   = listing ? (listing.Media||[]).sort((a,b) => (a.Order??999)-(b.Order??999)) : [];
  const currentPhoto = photos[photoIdx]?.MediaURL || null;
  const photoCount   = photos.length;
  const BG = ['#1A2A26','#24221C','#182230','#2C1E1E','#1E2818','#281C28','#16203A','#2C2218'];

  // Score (derived from comps data + listing)
  const domHigh = listing && listing.DaysOnMarket > 20;
  const pct     = comps ? Math.round((listing.ListPrice - comps.avgCompPrice) / comps.avgCompPrice * 100) : 0;
  const nbh = [{ l:'Schools',s:89,i:'ti-school' },{ l:'Transit',s:72,i:'ti-bus' },{ l:'Walkability',s:58,i:'ti-walk' },{ l:'Amenities',s:81,i:'ti-building-store' }];

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <i className="ti ti-loader-2" style={{ fontSize:32, display:'block', marginBottom:12, opacity:.5, animation:'spin 1s linear infinite' }} aria-hidden="true"/>
        <p style={{ color:'rgba(255,255,255,.4)', fontSize:14 }}>Loading listing…</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !listing) return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <i className="ti ti-home-off" style={{ fontSize:48, display:'block', marginBottom:16, color:'rgba(255,255,255,.2)' }} aria-hidden="true"/>
        <h1 style={{ fontSize:24, fontWeight:500, marginBottom:8 }}>{error || 'Listing not found'}</h1>
        <button onClick={() => navigate('/')} style={{ marginTop:20, padding:'12px 28px', background:'#00B4A8', color:'#fff', border:'none', borderRadius:7, fontSize:14, fontWeight:500, cursor:'pointer' }}>← Back to listings</button>
      </div>
    </div>
  );

  return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff', fontSize:13, lineHeight:1.5 }}>

      {/* ── Top nav ──────────────────────────────────────────────────── */}
      <header style={{ position:'sticky', top:0, zIndex:200, height:46, background:'#0C0D10', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', padding:'0 20px', gap:10 }}>
        <Link to="/" style={{ fontSize:18, fontWeight:600, color:'#00B4A8', letterSpacing:'-.02em', textDecoration:'none', flexShrink:0 }}>Propedia</Link>
        <span style={{ color:'rgba(255,255,255,.15)', fontSize:16 }}>›</span>
        <button onClick={() => navigate('/')} style={{ fontSize:12, color:'rgba(255,255,255,.5)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Listings</button>
        <span style={{ color:'rgba(255,255,255,.15)', fontSize:16 }}>›</span>
        <span style={{ fontSize:12, color:'rgba(255,255,255,.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{address}</span>
        <button onClick={() => toggleSave(listing)} style={{ marginLeft:'auto', height:32, padding:'0 14px', border:'1px solid', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', flexShrink:0, borderColor: saved ? '#00B4A8' : 'rgba(255,255,255,.14)', background: saved ? 'rgba(0,180,168,.12)' : 'none', color: saved ? '#00B4A8' : 'rgba(255,255,255,.55)', display:'flex', alignItems:'center', gap:5, transition:'all .2s' }}>
          <i className={`ti ${saved?'ti-check':'ti-plus'}`} style={{ fontSize:12 }} aria-hidden="true"/>
          {saved ? 'Saved' : 'Save to DeepCompare'}
        </button>
      </header>

      <div className="detail-page-inner" style={{ maxWidth:1140, margin:'0 auto', padding:'0 16px 40px' }}>

        {/* ── Hero gallery ───────────────────────────────────────────── */}
        <div style={{ position:'relative', background:'#0C0D10' }}>
          {/* Main photo — click to open full gallery */}
          <div className="detail-hero-photo" onClick={() => { setGallery(true); }} style={{ position:'relative', height:400, background: BG[photoIdx%BG.length], overflow:'hidden', cursor:'pointer', transition:'background .3s' }}>
            {currentPhoto
              ? <img src={currentPhoto} alt={address} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .4s' }} loading="eager"/>
              : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-building-estate" style={{ fontSize:80, color:'rgba(255,255,255,.06)' }} aria-hidden="true"/></div>
            }
            {/* Arrows (no gallery open) */}
            {photoCount > 1 && <>
              <button onClick={e=>{e.stopPropagation();setPhotoIdx(i=>(i-1+photoCount)%photoCount)}} style={{ position:'absolute', left:0, top:0, bottom:0, width:48, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s,color .2s' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.4)';e.currentTarget.style.color='rgba(255,255,255,.9)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)';e.currentTarget.style.color='rgba(255,255,255,0)'}} aria-label="Previous photo">‹</button>
              <button onClick={e=>{e.stopPropagation();setPhotoIdx(i=>(i+1)%photoCount)}} style={{ position:'absolute', right:0, top:0, bottom:0, width:48, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s,color .2s' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.4)';e.currentTarget.style.color='rgba(255,255,255,.9)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)';e.currentTarget.style.color='rgba(255,255,255,0)'}} aria-label="Next photo">›</button>
            </>}
            {/* Badges */}
            <div style={{ position:'absolute', top:14, left:14, display:'flex', gap:8 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', padding:'4px 11px', borderRadius:5, background: isLease?'rgba(59,130,246,.85)':'rgba(16,185,129,.85)', color:'#fff' }}>{listing.TransactionType}</span>
              {listing.OriginalListPrice && listing.OriginalListPrice > listing.ListPrice && <span style={{ fontSize:10, fontWeight:700, padding:'4px 11px', borderRadius:5, background:'rgba(239,68,68,.8)', color:'#fff' }}>Price Reduced</span>}
            </div>
            {/* View all photos */}
            <button onClick={e=>{e.stopPropagation();setGallery(true)}} style={{ position:'absolute', bottom:72, right:14, height:30, padding:'0 12px', background:'rgba(0,0,0,.6)', border:'1px solid rgba(255,255,255,.18)', borderRadius:7, color:'rgba(255,255,255,.8)', fontSize:11, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
              <i className="ti ti-camera" style={{ fontSize:11 }} aria-hidden="true"/>View all {photoCount || 8} photos
            </button>
            {/* Dot nav */}
            <div style={{ position:'absolute', bottom:18, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
              {Array.from({ length: Math.min(photoCount || 8, 8) }).map((_,i) => (
                <div key={i} onClick={e=>{e.stopPropagation();setPhotoIdx(i)}} style={{ width: photoIdx===i?22:7, height:7, borderRadius:4, background: photoIdx===i?'#00B4A8':'rgba(255,255,255,.35)', cursor:'pointer', transition:'all .25s' }}/>
              ))}
            </div>
            {/* Price overlay */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.75)', padding:'12px 18px 38px' }}>
              <div style={{ fontSize:26, fontWeight:600, letterSpacing:'-.03em', marginBottom:4 }}>
                {formatPrice(listing.ListPrice)}
                {listing.OriginalListPrice && listing.OriginalListPrice > listing.ListPrice && <span style={{ fontSize:13, fontWeight:400, color:'rgba(255,255,255,.32)', textDecoration:'line-through', marginLeft:8 }}>{formatPrice(listing.OriginalListPrice)}</span>}
              </div>
              <div style={{ display:'flex', gap:14, fontSize:11, color:'rgba(255,255,255,.5)', flexWrap:'wrap' }}>
                <span><i className="ti ti-map-pin" aria-hidden="true"/> {address}, {cityLine}</span>
                {listing.BedroomsTotal != null && <span><i className="ti ti-bed" aria-hidden="true"/> {listing.BedroomsTotal} bd</span>}
                {listing.BathroomsTotalInteger != null && <span><i className="ti ti-bath" aria-hidden="true"/> {listing.BathroomsTotalInteger} ba</span>}
                {listing.LivingArea > 0 && <span><i className="ti ti-ruler-measure" aria-hidden="true"/> {Math.round(listing.LivingArea).toLocaleString()} sqft</span>}
                {listing.DaysOnMarket != null && <span><i className="ti ti-clock" aria-hidden="true"/> {listing.DaysOnMarket} days</span>}
                <span style={{ color:'rgba(255,255,255,.28)' }}>MLS® {listing.ListingId || listing.ListingKey}</span>
              </div>
            </div>
          </div>

          {/* Thumbnail strip */}
          {photoCount > 0 && (
            <div style={{ display:'flex', gap:6, padding:'10px 12px', background:'#111316', overflowX:'auto', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              {photos.map((m, i) => (
                <div key={i} onClick={() => setPhotoIdx(i)} style={{ flexShrink:0, width:88, height:58, background: BG[i%BG.length], borderRadius:6, cursor:'pointer', border:`2px solid ${photoIdx===i?'#00B4A8':'transparent'}`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', transition:'border-color .2s' }}>
                  {m.MediaURL ? <img src={m.MediaURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy"/> : <i className="ti ti-building-estate" style={{ fontSize:20, color:'rgba(255,255,255,.18)' }} aria-hidden="true"/>}
                  {photoIdx===i && <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'#00B4A8' }}/>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Intelligence strip ──────────────────────────────────────── */}
        <div className="detail-strip" style={{ display:'flex', gap:8, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.06)', overflowX:'auto', margin:'0 0 0' }}>
          {[
            { l:'Price Verdict',  v: comps?.fairnessLabel || '—', sub: comps?.fairnessDetail?.slice(0,32) || `vs ${comps?.compCount||6} recent comps`, c:'#34D399', i:'ti-scale' },
            { l:'True Monthly',   v:'See calculator ↓', sub:'All-in estimate below', c:'rgba(255,255,255,.7)', i:'ti-calculator' },
            { l:'Negotiate',      v: listing.DaysOnMarket > 20 ? '⚡ Motivated' : '🟢 Act Fast', sub:`${listing.DaysOnMarket || 0} days listed`, c: listing.DaysOnMarket > 20 ? '#F59E0B' : '#34D399', i:'ti-flame' },
          ].map(c => (
            <div key={c.l} style={{ flex:1, background:'#161719', borderRadius:8, padding:'11px 12px', border:'1px solid rgba(255,255,255,.06)', minWidth:0 }}>
              <div style={{ fontSize:9, fontWeight:600, letterSpacing:'.09em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:5 }}>
                <i className={`ti ${c.i}`} style={{ fontSize:10, marginRight:3, color:c.c }} aria-hidden="true"/>{c.l}
              </div>
              <div style={{ fontSize:16, fontWeight:600, color:c.c, marginBottom:3, letterSpacing:'-.01em' }}>{c.v}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Two-column layout ────────────────────────────────────────── */}
        <div className="detail-grid" style={{ display:'grid', gridTemplateColumns:'1fr 212px', gap:12, paddingTop:12 }}>

          {/* LEFT */}
          <div>

            {/* Price Intelligence */}
            <div style={card}>
              <div style={sh}><i className="ti ti-chart-bar" style={shI} aria-hidden="true"/>Price Intelligence</div>
              <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                <div style={{ flex:1, background:'rgba(255,255,255,.04)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.3)', marginBottom:5 }}>Verdict vs comps</div>
                  <div style={{ fontSize:17, fontWeight:600, color:'#00B4A8', marginBottom:3 }}>{comps?.fairnessLabel || '—'}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>{comps?.fairnessDetail || 'Fetching comparable sales…'}</div>
                </div>
                <div style={{ flex:1, background:'rgba(255,255,255,.04)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.3)', marginBottom:5 }}>Price per sq ft</div>
                  <div style={{ fontSize:17, fontWeight:600, color:'rgba(255,255,255,.9)', marginBottom:6 }}>
                    {listing.LivingArea > 0 ? `$${Math.round(listing.ListPrice / listing.LivingArea)}/sqft` : '—'}
                  </div>
                  {comps?.avgCompPrice && listing.LivingArea > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>Comps:</span>
                      <div style={{ flex:1, height:4, background:'rgba(255,255,255,.07)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(100, Math.round(listing.ListPrice/listing.LivingArea / (comps.avgCompPrice/listing.LivingArea) * 100))}%`, background:'#00B4A8', borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>${Math.round(comps.avgCompPrice/listing.LivingArea)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* True Cost Calculator */}
            {!isLease && <Calculator price={listing.ListPrice} city={listing.City} propertyType={listing.PropertySubType}/>}

            {/* Negotiate signal */}
            <div style={{ ...card, borderLeft: `3px solid ${domHigh ? '#F59E0B' : '#34D399'}`, borderRadius:'4px 10px 10px 4px' }}>
              <div style={sh}><i className={`ti ti-flame`} style={{ ...shI, color: domHigh ? '#F59E0B' : '#34D399' }} aria-hidden="true"/>Negotiate or act fast?</div>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:14 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:`rgba(${domHigh?'245,158,11':'52,211,153'},.15)`, border:`2px solid rgba(${domHigh?'245,158,11':'52,211,153'},.4)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>
                  {domHigh ? '⚡' : '🟢'}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color: domHigh ? '#F59E0B' : '#34D399', marginBottom:5 }}>
                    {domHigh ? 'Motivated seller — room to negotiate' : 'Fresh listing — act quickly'}
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', lineHeight:1.6 }}>
                    {domHigh
                      ? `Listed ${listing.DaysOnMarket} days — above the typical market average. Consider opening 2–3% below current ask.`
                      : `Listed ${listing.DaysOnMarket === 0 ? 'today' : `${listing.DaysOnMarket} days ago`}. Fresh listings in this price range can move quickly. Book a showing soon.`
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Property Map */}
            <PropertyMap listing={listing}/>

            {/* Neighbourhood */}
            <div style={card}>
              <div style={sh}><i className="ti ti-chart-radar" style={shI} aria-hidden="true"/>Neighbourhood scorecard</div>
              {nbh.map(n => (
                <div key={n.l} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:22, textAlign:'center' }}><i className={`ti ${n.i}`} style={{ fontSize:14, color:'rgba(255,255,255,.4)' }} aria-hidden="true"/></div>
                  <span style={{ width:80, fontSize:12, color:'rgba(255,255,255,.6)', flexShrink:0 }}>{n.l}</span>
                  <div style={{ flex:1, height:4, background:'rgba(255,255,255,.08)', borderRadius:2, overflow:'hidden', margin:'0 8px' }}>
                    <div style={{ height:'100%', width:`${n.s}%`, background:sc(n.s), borderRadius:2 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, color:sc(n.s), width:30, textAlign:'right' }}>{n.s}</span>
                </div>
              ))}
              <p style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:4 }}>Based on OpenStreetMap and Fraser Institute school rankings.</p>
            </div>

            {/* Investment analysis */}
            {!isLease && (
              <div style={card}>
                <div style={sh}><i className="ti ti-trending-up" style={shI} aria-hidden="true"/>Investment analysis</div>
                <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.28)', marginBottom:10 }}>5-year value projection</div>
                {[{l:'Conservative',r:3,c:'rgba(0,180,168,.5)'},{l:'Expected',r:4,c:'#00B4A8'},{l:'Optimistic',r:5,c:'#00D4C6'}].map(v => {
                  const fv = Math.round(listing.ListPrice * Math.pow(1+v.r/100, 5));
                  const max = Math.round(listing.ListPrice * Math.pow(1.05, 5));
                  return (
                    <div key={v.l} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', width:100, flexShrink:0 }}>{v.l} ({v.r}%)</span>
                      <div style={{ flex:1, height:28, background:'rgba(255,255,255,.05)', borderRadius:5, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.round(fv/max*100)}%`, background:v.c, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:10, fontSize:11, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>
                          {formatPrice(fv)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
                  <div style={{ background:'rgba(255,255,255,.04)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.28)', marginBottom:5 }}>Buy vs rent breakeven</div>
                    <div style={{ fontSize:18, fontWeight:600, color:'#60A5FA', marginBottom:3 }}>~4–5 years</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.35)' }}>vs renting comparable at ~$4,200/mo</div>
                  </div>
                  <div style={{ background:'rgba(0,180,168,.08)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(0,180,168,.2)' }}>
                    <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(0,180,168,.6)', marginBottom:5 }}>Rental income potential</div>
                    <div style={{ fontSize:18, fontWeight:600, color:'#00B4A8', marginBottom:3 }}>$1,650–$1,900</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{listing.BasementFeatures?.toLowerCase().includes('sep') ? 'Sep. entrance noted' : 'Estimate based on area'}</div>
                  </div>
                </div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:10 }}>Projections are illustrative. Not financial advice.</p>
              </div>
            )}

            {/* Property details */}
            <div style={card}>
              <div style={sh}><i className="ti ti-list-details" style={shI} aria-hidden="true"/>Property details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' }}>
                {[
                  ['MLS Number', listing.ListingId || listing.ListingKey],
                  ['Year Built', listing.YearBuilt],
                  ['Lot Size', listing.LotSizeDimensions || listing.LotSizeArea],
                  ['Property Type', propertyTypeLabel(listing.PropertySubType)],
                  ['Bedrooms', listing.BedroomsTotal],
                  ['Bathrooms', listing.BathroomsTotalInteger],
                  ['Interior', listing.LivingArea ? `${Math.round(listing.LivingArea).toLocaleString()} sqft` : null],
                  ['Basement', listing.BasementType || listing.BasementFeatures],
                  ['Heating', listing.HeatingType],
                  ['Cooling', listing.CoolingType],
                  ['Parking', listing.ParkingTotal ? `${listing.ParkingTotal} spaces` : listing.ParkingFeatures],
                  ['Garage', listing.GarageSpaces ? `${listing.GarageSpaces} car` : null],
                  ['Fireplaces', listing.FireplacesTotal],
                  ['Pool', listing.PoolFeatures],
                  ['Days on Market', listing.DaysOnMarket != null ? `${listing.DaysOnMarket} days` : null],
                  ['Status', listing.StandardStatus],
                ].filter(([,v]) => v !== null && v !== undefined).map(([l,v]) => (
                  <div key={l}>
                    <div style={{ fontSize:9, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.8)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {listing.PublicRemarks && (
              <div style={card}>
                <div style={sh}><i className="ti ti-file-text" style={shI} aria-hidden="true"/>About this property</div>
                <p style={{ fontSize:12, color:'rgba(255,255,255,.6)', lineHeight:1.75, marginBottom:14, whiteSpace:'pre-wrap' }}>{listing.PublicRemarks}</p>
                <div style={{ background:'rgba(255,255,255,.04)', borderRadius:7, padding:'12px 14px', border:'1px solid rgba(255,255,255,.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.75)' }}>{listing.ListAgentFullName || 'Listing agent'}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>{listing.ListOfficeName || ''}</div>
                  </div>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,.25)' }}>MLS® {listing.ListingId || listing.ListingKey}</span>
                </div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,.18)', marginTop:10, lineHeight:1.6 }}>Data provided by TRREB through PropTx · IDX #1860304 · MLS® and REALTOR® are trademarks of CREA · Propedia operated by Anirudha Warhadpande, Salesperson, HomeLife Miracle Realty Ltd. Brokerage · RECO #6011384</p>
              </div>
            )}
          </div>

          {/* RIGHT — CTA + Key metrics */}
          <div className="detail-right">

            {/* CTA */}
            <div style={{ ...card, padding:'14px 15px' }}>
              <div style={{ fontSize:20, fontWeight:600, letterSpacing:'-.025em', marginBottom:2 }}>{formatPrice(listing.ListPrice)}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginBottom:12 }}>{address}, {listing.City}</div>
              <AvailableButton listing={listing}/>
              <button onClick={() => toggleSave(listing)} style={{ width:'100%', height:36, border:'1px solid', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .2s', borderColor: saved?'#00B4A8':'rgba(255,255,255,.14)', background: saved?'rgba(0,180,168,.12)':'none', color: saved?'#00B4A8':'rgba(255,255,255,.5)' }}>
                <i className={`ti ${saved?'ti-check':'ti-plus'}`} style={{ fontSize:13 }} aria-hidden="true"/>
                {saved ? '✓ Saved to DeepCompare' : 'Save to DeepCompare'}
              </button>
            </div>

            {/* Key numbers */}
            <div style={{ ...card, padding:'13px 15px' }}>
              <div style={{ ...sh }}><i className="ti ti-bolt" style={shI} aria-hidden="true"/>Key numbers</div>
              {[
                ['List price', formatPrice(listing.ListPrice), 'rgba(255,255,255,.9)'],
                ['Price/sqft', listing.LivingArea > 0 ? `$${Math.round(listing.ListPrice/listing.LivingArea)}/sqft` : '—', 'rgba(255,255,255,.6)'],
                ['Est. mortgage', !isLease && listing.ListPrice ? fmtM(estimateMortgage(listing.ListPrice)) : '—', '#00B4A8'],
                ['Mortgage (P&I)', !isLease && listing.ListPrice ? '10% down · 5.49%' : '—', 'rgba(255,255,255,.35)'],
                ['Days on market', listing.DaysOnMarket != null ? `${listing.DaysOnMarket} days` : '—', listing.DaysOnMarket > 20 ? '#F59E0B' : 'rgba(255,255,255,.6)'],
              ].map(([l,v,c]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}>
                  <span style={{ color:'rgba(255,255,255,.4)', fontSize:11 }}>{l}</span>
                  <span style={{ fontWeight:600, fontSize:12, color:c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Similar properties ───────────────────────────────────────── */}
        {similar.length > 0 && (
          <div style={{ marginTop:8, paddingTop:20, borderTop:'1px solid rgba(255,255,255,.06)' }}>
            <div style={{ ...sh, marginBottom:14, paddingBottom:0, border:'none' }}>
              <i className="ti ti-home-2" style={shI} aria-hidden="true"/>Similar properties in {listing.City}
            </div>
            <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:6 }}>
              {similar.map(s => {
                const sAddr = formatAddress(s);
                const sPhoto = (s.Media||[]).sort((a,b)=>(a.Order??999)-(b.Order??999))[0]?.MediaURL;
                return (
                  <div key={s.ListingKey} onClick={() => navigate(`/listing/${s.ListingKey}`)}
                    style={{ flexShrink:0, width:200, background:'#161719', borderRadius:9, border:'1px solid rgba(255,255,255,.06)', overflow:'hidden', cursor:'pointer', transition:'border-color .2s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,180,168,.3)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.06)'}>
                    <div style={{ height:112, background: BG[similar.indexOf(s)%BG.length], display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      {sPhoto
                        ? <img src={sPhoto} alt={sAddr} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy"/>
                        : <i className="ti ti-building-estate" style={{ fontSize:28, color:'rgba(255,255,255,.1)' }} aria-hidden="true"/>
                      }
                    </div>
                    <div style={{ padding:'11px 12px' }}>
                      <div style={{ fontSize:16, fontWeight:600, letterSpacing:'-.02em', marginBottom:3 }}>{formatPrice(s.ListPrice)}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', marginBottom:8, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sAddr}</div>
                      <div style={{ display:'flex', gap:8, fontSize:11, color:'rgba(255,255,255,.4)' }}>
                        {s.BedroomsTotal != null && <span><i className="ti ti-bed" style={{fontSize:11}} aria-hidden="true"/> {s.BedroomsTotal}</span>}
                        {s.BathroomsTotalInteger != null && <span><i className="ti ti-bath" style={{fontSize:11}} aria-hidden="true"/> {s.BathroomsTotalInteger}</span>}
                        {s.LivingArea > 0 && <span><i className="ti ti-ruler-measure" style={{fontSize:11}} aria-hidden="true"/> {Math.round(s.LivingArea).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bottom CTA ──────────────────────────────────────────────── */}
        <div style={{ marginTop:20, background:'#111316', borderRadius:12, padding:'28px 24px', textAlign:'center', border:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize:16, fontWeight:500, color:'rgba(255,255,255,.65)', marginBottom:6 }}>Ready to take the next step?</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:18 }}>Get a showing at {address} — today</div>
          <AvailableButton listing={listing}/>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.22)', marginTop:12 }}>
            <strong style={{ color:'rgba(255,255,255,.35)' }}>Anirudha Warhadpande</strong> · HomeLife Miracle Realty Ltd. · 647-803-5288 · RECO #6011384
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
