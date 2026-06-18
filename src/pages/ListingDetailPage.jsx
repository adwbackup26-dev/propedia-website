// src/pages/ListingDetailPage.jsx — Propedia full intelligence detail page

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AvailableButton from '../components/AvailableButton.jsx';
import { useCompare } from '../hooks/useListings.js';
import { formatPrice, formatAddress, formatCityLine, propertyTypeLabel, estimateMortgage } from '../utils/format.js';
import '../styles/listings.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || null;
const ROOMS = ['Front exterior','Living room','Kitchen','Master bedroom','Backyard','Basement','Bathroom','Garage'];

const card  = { background:'#161719', borderRadius:10, border:'1px solid rgba(255,255,255,.06)', padding:'15px 17px', marginBottom:11 };
const sh    = { fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:13, paddingBottom:9, borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', gap:7 };
const shI   = { fontSize:13, color:'#00B4A8' };
const sc    = s => s >= 75 ? '#00B4A8' : s >= 50 ? '#F59E0B' : '#F87171';
const fmtM  = n => '$' + Math.round(n).toLocaleString() + '/mo';

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

const RATE_PRESETS = [
  { label:'Best rate',   rate:3.99, note:'Broker / monoline lender' },
  { label:'Typical',     rate:4.99, note:'What most buyers get' },
  { label:'Big bank avg',rate:4.75, note:'RBC / TD / BMO average' },
];

function Calculator({ price, city, propertyType }) {
  const isCondo = ['Condo Apt','Condo Townhouse','Co-Op Apt'].includes(propertyType);
  const rentalRangeStr = !isCondo ? getRentalRange(city) : null;
  const rentalMid = !isCondo ? getRentalMid(city) : 0;
  const [downPct, setDownPct] = useState(10);
  const [downAmt, setDownAmt] = useState(Math.round(price * 0.10));
  const syncFromPct = (pct) => { const p = Math.max(0, Math.min(95, parseFloat(pct) || 0)); setDownPct(+p.toFixed(1)); setDownAmt(Math.round(price * p / 100)); };
  const syncFromAmt = (amt) => { const a = Math.max(0, Math.min(price * 0.95, parseInt(amt) || 0)); setDownAmt(a); setDownPct(+(a / price * 100).toFixed(1)); };
  const [rate, setRate] = useState(4.99);
  const [rateInput, setRateInput] = useState('4.99');
  const handleRate = (val) => { setRateInput(val); const n = parseFloat(val); if (!isNaN(n) && n > 0 && n < 25) setRate(n); };
  const [amort, setAmort] = useState(25);
  const [includeRental, setIncludeRental] = useState(false);
  const [rentalAmt, setRentalAmt] = useState(rentalMid);
  const calc = useCallback(() => {
    const principal = Math.max(0, price - downAmt);
    const r = rate / 100 / 12, n = amort * 12;
    const pi = r > 0 ? Math.round(principal*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1)) : Math.round(principal/n);
    const tax = Math.round(price * 0.0085 / 12);
    const ins = 200, maint = 370, util = 330;
    const subtotal = pi + tax + ins + maint + util;
    return { pi, tax, ins, maint, util, subtotal, effective: Math.max(0, subtotal - (includeRental ? rentalAmt : 0)) };
  }, [price, downAmt, rate, amort, includeRental, rentalAmt]);
  const tc = calc();
  const minDown = price < 500000 ? price * 0.05 : price < 1500000 ? 25000 + (price - 500000) * 0.10 : price * 0.20;
  const minPct = +(minDown / price * 100).toFixed(1);
  const tooLow = downAmt < minDown;
  const items = [
    { l:'Mortgage (P&I)', v:tc.pi, c:'#00B4A8' },
    { l:'Property tax (est.)', v:tc.tax, c:'#60A5FA' },
    { l:'Home insurance (est.)', v:tc.ins, c:'#F59E0B' },
    { l:'Maintenance reserve', v:tc.maint, c:'#A78BFA' },
    { l:'Utilities (est.)', v:tc.util, c:'#34D399' },
  ];
  const inp = { height:32, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, padding:'0 10px', fontSize:13, color:'#fff', outline:'none', textAlign:'center' };
  const lbl = { fontSize:10, color:'rgba(255,255,255,.35)', display:'block', marginBottom:4 };
  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-calculator" style={shI}/>True cost calculator</div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:8 }}>Down payment</div>
        <div style={{ display:'flex', gap:5, marginBottom:10 }}>
          {[5,10,15,20,25].map(p => (
            <button key={p} onClick={() => syncFromPct(p)} style={{ flex:1, height:28, border:`1.5px solid ${Math.round(downPct)===p?'#00B4A8':'rgba(255,255,255,.13)'}`, borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:Math.round(downPct)===p?'#00B4A8':'transparent', color:Math.round(downPct)===p?'#fff':'rgba(255,255,255,.5)', transition:'all .15s' }}>{p}%</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <div style={{ flex:1 }}>
            <label style={lbl}>Percentage</label>
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden' }}>
              <input type="number" min="0" max="95" step="0.5" value={downPct} onChange={e => syncFromPct(e.target.value)} style={{ ...inp, flex:1, border:'none', borderRadius:0, background:'transparent' }}/>
              <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)', flexShrink:0 }}>%</span>
            </div>
          </div>
          <span style={{ color:'rgba(255,255,255,.18)', fontSize:15, paddingBottom:8 }}>↔</span>
          <div style={{ flex:1 }}>
            <label style={lbl}>Dollar amount</label>
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden' }}>
              <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)', flexShrink:0 }}>$</span>
              <input type="number" min="0" step="5000" value={downAmt} onChange={e => syncFromAmt(e.target.value)} style={{ ...inp, flex:1, border:'none', borderRadius:0, background:'transparent', textAlign:'left' }}/>
            </div>
          </div>
        </div>
        {tooLow && <p style={{ fontSize:10, color:'#F59E0B', marginTop:7, lineHeight:1.5 }}>⚠️ CMHC requires minimum {minPct}% down ({formatPrice(Math.round(minDown))}) on a {formatPrice(price)} property.</p>}
      </div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:8 }}>Mortgage rate</div>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {RATE_PRESETS.map(p => (
            <button key={p.label} onClick={() => { setRate(p.rate); setRateInput(String(p.rate)); }} style={{ flex:1, height:52, border:`1.5px solid ${rate===p.rate?'#00B4A8':'rgba(255,255,255,.12)'}`, borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:rate===p.rate?'rgba(0,180,168,.12)':'rgba(255,255,255,.04)', padding:'6px 4px', transition:'all .15s' }}>
              <div style={{ fontSize:14, fontWeight:600, color:rate===p.rate?'#00B4A8':'#fff' }}>{p.rate}%</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', marginTop:1 }}>{p.note}</div>
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}>
            <label style={lbl}>Custom rate (%)</label>
            <input type="number" min="1" max="20" step="0.05" value={rateInput} onChange={e => handleRate(e.target.value)} style={{ ...inp, width:'100%' }}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={lbl}>Amortization</label>
            <select value={amort} onChange={e => setAmort(+e.target.value)} style={{ width:'100%', height:32, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, padding:'0 9px', fontSize:12, color:'rgba(255,255,255,.8)', outline:'none', cursor:'pointer' }}>
              {[20,25,30].map(y => <option key={y} value={y}>{y} years</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ height:10, borderRadius:5, overflow:'hidden', display:'flex', marginBottom:14, gap:1 }}>
        {items.map(it => <div key={it.l} style={{ height:'100%', width:`${Math.round(it.v/tc.subtotal*100)}%`, background:it.c }} title={it.l}/>)}
      </div>
      {items.map(it => (
        <div key={it.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:it.c }}/>
            <span style={{ color:'rgba(255,255,255,.5)' }}>{it.l}</span>
          </div>
          <span style={{ fontWeight:500, color:'rgba(255,255,255,.75)' }}>{fmtM(it.v)}</span>
        </div>
      ))}
      {!isCondo && rentalRangeStr && (
        <div style={{ marginTop:14, padding:12, background:'rgba(0,180,168,.06)', borderRadius:8, border:'1px solid rgba(0,180,168,.18)' }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom: includeRental ? 14 : 0 }}>
            <div onClick={() => setIncludeRental(r => !r)} style={{ width:38, height:22, borderRadius:11, background:includeRental?'#00B4A8':'rgba(255,255,255,.15)', position:'relative', transition:'background .2s', flexShrink:0, cursor:'pointer' }}>
              <div style={{ position:'absolute', top:3, left:includeRental?19:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
            </div>
            <span style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.8)' }}>Include basement rental income</span>
            <span style={{ fontSize:10, color:'rgba(0,180,168,.7)', marginLeft:'auto', flexShrink:0 }}>est. ${rentalRangeStr[0]}–${rentalRangeStr[1]}/mo</span>
          </label>
          {includeRental && (
            <>
              <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:10 }}>
                <div style={{ flex:1 }}>
                  <label style={lbl}>Monthly rental income</label>
                  <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden', height:32 }}>
                    <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)', flexShrink:0 }}>$</span>
                    <input type="number" min="500" max="5000" step="50" value={rentalAmt} onChange={e => setRentalAmt(parseInt(e.target.value)||0)} style={{ flex:1, background:'transparent', border:'none', padding:'0 8px 0 0', fontSize:13, color:'#fff', outline:'none' }}/>
                    <span style={{ padding:'0 8px', fontSize:11, color:'rgba(255,255,255,.3)', flexShrink:0 }}>/mo</span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderTop:'1px solid rgba(0,180,168,.15)', borderBottom:'1px solid rgba(0,180,168,.15)', marginBottom:8 }}>
                <span style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>Basement rental offset</span>
                <span style={{ fontWeight:600, color:'#34D399', fontSize:13 }}>− {fmtM(rentalAmt)}</span>
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'12px 0 0', borderTop:'1px solid rgba(255,255,255,.1)', marginTop:12 }}>
        <div style={{ fontSize:13, fontWeight:600 }}>{includeRental && !isCondo ? 'Effective Monthly Cost' : 'True Monthly Cost'}</div>
        <div style={{ fontSize:18, fontWeight:600 }}>{fmtM(includeRental && !isCondo ? tc.effective : tc.subtotal)}</div>
      </div>
      <p style={{ fontSize:10, color:'rgba(255,255,255,.18)', marginTop:8, lineHeight:1.6 }}>All figures are estimates only. Not financial advice.</p>
    </div>
  );
}

function PropertyMap({ listing }) {
  const lat = listing.Latitude;
  const lng = listing.Longitude;
  const mapUrl = MAPBOX_TOKEN && lat && lng
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+00B4A8(${lng},${lat})/${lng},${lat},14,0/800x280?access_token=${MAPBOX_TOKEN}`
    : null;
  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-map-2" style={shI}/>Property location</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        {lat && lng && (
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" style={{ height:26, padding:'0 12px', border:'1px solid rgba(255,255,255,.12)', borderRadius:6, color:'rgba(255,255,255,.45)', fontSize:11, display:'flex', alignItems:'center', gap:5, textDecoration:'none' }}>
            <i className="ti ti-external-link" style={{ fontSize:11 }}/>Open in Google Maps
          </a>
        )}
      </div>
      <div style={{ borderRadius:8, overflow:'hidden' }}>
        {mapUrl
          ? <img src={mapUrl} alt="Property map" style={{ width:'100%', height:240, objectFit:'cover', display:'block' }} loading="lazy"/>
          : <div style={{ height:200, background:'#111316', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, border:'1px solid rgba(255,255,255,.06)' }}><span style={{ fontSize:12, color:'rgba(255,255,255,.2)' }}>Map available when Mapbox token is configured</span></div>
        }
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  const { listingKey } = useParams();
  const navigate = useNavigate();
  const { toggleSave, isSaved } = useCompare();
  const [listing, setListing] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (!listingKey) return;
    setLoading(true); setError(null);
    fetch(`/api/listing?listingKey=${encodeURIComponent(listingKey)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setListing(d.listing); window.scrollTo({ top:0, behavior:'instant' }); })
      .catch(() => setError('Listing not found or no longer active.'))
      .finally(() => setLoading(false));
  }, [listingKey]);

  useEffect(() => {
    if (!listingKey) return;
    fetch(`/api/photos?listingKey=${encodeURIComponent(listingKey)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setPhotos(d.photos || []))
      .catch(() => null);
  }, [listingKey]);

  const address  = listing ? formatAddress(listing) : '';
  const saved    = listing ? isSaved(listing.ListingKey) : false;
  const isLease  = listing?.TransactionType === 'For Lease';
  const currentPhoto = photos[photoIdx]?.url || null;
  const photoCount   = photos.length;
  const BG = ['#1A2A26','#24221C','#182230','#2C1E1E','#1E2818','#281C28','#16203A','#2C2218'];
  const nbh = [{ l:'Schools',s:89,i:'ti-school' },{ l:'Transit',s:72,i:'ti-bus' },{ l:'Walkability',s:58,i:'ti-walk' },{ l:'Amenities',s:81,i:'ti-building-store' }];
  const domHigh = listing && listing.DaysOnMarket > 20;

  if (loading) return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <i className="ti ti-loader-2" style={{ fontSize:32, display:'block', marginBottom:12, opacity:.5, animation:'spin 1s linear infinite' }}/>
        <p style={{ color:'rgba(255,255,255,.4)', fontSize:14 }}>Loading listing…</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !listing) return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <i className="ti ti-home-off" style={{ fontSize:48, display:'block', marginBottom:16, color:'rgba(255,255,255,.2)' }}/>
        <h1 style={{ fontSize:24, fontWeight:500, marginBottom:8 }}>{error || 'Listing not found'}</h1>
        <button onClick={() => navigate('/')} style={{ marginTop:20, padding:'12px 28px', background:'#00B4A8', color:'#fff', border:'none', borderRadius:7, fontSize:14, fontWeight:500, cursor:'pointer' }}>← Back to listings</button>
      </div>
    </div>
  );

  return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff', fontSize:13, lineHeight:1.5 }}>
      <header style={{ position:'sticky', top:0, zIndex:200, height:46, background:'#0C0D10', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', padding:'0 20px', gap:10 }}>
        <Link to="/" style={{ fontSize:18, fontWeight:600, color:'#00B4A8', letterSpacing:'-.02em', textDecoration:'none', flexShrink:0 }}>Propedia</Link>
        <span style={{ color:'rgba(255,255,255,.15)', fontSize:16 }}>›</span>
        <button onClick={() => navigate('/')} style={{ fontSize:12, color:'rgba(255,255,255,.5)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Listings</button>
        <span style={{ color:'rgba(255,255,255,.15)', fontSize:16 }}>›</span>
        <span style={{ fontSize:12, color:'rgba(255,255,255,.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{address}</span>
        <button onClick={() => toggleSave(listing)} style={{ marginLeft:'auto', height:32, padding:'0 14px', border:'1px solid', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', flexShrink:0, borderColor: saved?'#00B4A8':'rgba(255,255,255,.14)', background: saved?'rgba(0,180,168,.12)':'none', color: saved?'#00B4A8':'rgba(255,255,255,.55)', display:'flex', alignItems:'center', gap:5, transition:'all .2s' }}>
          <i className={`ti ${saved?'ti-check':'ti-plus'}`} style={{ fontSize:12 }}/>{saved ? 'Saved' : 'Save'}
        </button>
      </header>

      <div style={{ maxWidth:1140, margin:'0 auto', padding:'0 16px 40px' }}>

        {/* Hero */}
        <div style={{ position:'relative', marginBottom:20 }}>
          <div style={{ position:'relative', height:400, background: BG[photoIdx%BG.length], overflow:'hidden' }}>
            {currentPhoto
              ? <img src={currentPhoto} alt={address} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="eager"/>
              : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-building-estate" style={{ fontSize:80, color:'rgba(255,255,255,.06)' }}/></div>
            }
            {photoCount > 1 && <>
              <button onClick={() => setPhotoIdx(i=>(i-1+photoCount)%photoCount)} style={{ position:'absolute', left:0, top:0, bottom:0, width:48, background:'rgba(0,0,0,.35)', border:'none', color:'#fff', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
              <button onClick={() => setPhotoIdx(i=>(i+1)%photoCount)} style={{ position:'absolute', right:0, top:0, bottom:0, width:48, background:'rgba(0,0,0,.35)', border:'none', color:'#fff', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
            </>}
            <div style={{ position:'absolute', top:14, left:14, display:'flex', gap:8 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', padding:'4px 11px', borderRadius:5, background: isLease?'rgba(59,130,246,.85)':'rgba(16,185,129,.85)', color:'#fff' }}>{listing.TransactionType}</span>
              {listing.OriginalListPrice && listing.OriginalListPrice > listing.ListPrice && <span style={{ fontSize:10, fontWeight:700, padding:'4px 11px', borderRadius:5, background:'rgba(239,68,68,.8)', color:'#fff' }}>Price Reduced</span>}
            </div>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.75)', padding:'12px 18px 16px' }}>
              <div style={{ fontSize:26, fontWeight:600, letterSpacing:'-.03em', marginBottom:4 }}>{formatPrice(listing.ListPrice)}</div>
              <div style={{ display:'flex', gap:14, fontSize:11, color:'rgba(255,255,255,.5)', flexWrap:'wrap' }}>
                <span>{address}</span>
                {listing.BedroomsTotal != null && <span>{listing.BedroomsTotal} bd</span>}
                {listing.BathroomsTotalInteger != null && <span>{listing.BathroomsTotalInteger} ba</span>}
                {listing.DaysOnMarket != null && <span>{listing.DaysOnMarket} days on market</span>}
              </div>
            </div>
          </div>
          {photoCount > 0 && (
            <div style={{ display:'flex', gap:6, padding:'10px 12px', background:'#111316', overflowX:'auto', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              {photos.map((m, i) => (
                <div key={i} onClick={() => setPhotoIdx(i)} style={{ flexShrink:0, width:88, height:58, background: BG[i%BG.length], borderRadius:6, cursor:'pointer', border:`2px solid ${photoIdx===i?'#00B4A8':'transparent'}`, overflow:'hidden' }}>
                  {m.url && <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy"/>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two column */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:12 }}>

          {/* LEFT */}
          <div>
            {!isLease && <Calculator price={listing.ListPrice} city={listing.City} propertyType={listing.PropertySubType}/>}

            {/* Negotiate signal */}
            <div style={{ ...card, borderLeft:`3px solid ${domHigh?'#F59E0B':'#34D399'}` }}>
              <div style={sh}><i className="ti ti-flame" style={{ ...shI, color: domHigh?'#F59E0B':'#34D399' }}/>Negotiate or act fast?</div>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:`rgba(${domHigh?'245,158,11':'52,211,153'},.15)`, border:`2px solid rgba(${domHigh?'245,158,11':'52,211,153'},.4)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>
                  {domHigh ? '⚡' : '🟢'}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color: domHigh?'#F59E0B':'#34D399', marginBottom:5 }}>
                    {domHigh ? 'Motivated seller — room to negotiate' : 'Fresh listing — act quickly'}
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', lineHeight:1.6 }}>
                    {domHigh ? `Listed ${listing.DaysOnMarket} days. Consider opening 2–3% below ask.` : `Listed ${listing.DaysOnMarket === 0 ? 'today' : `${listing.DaysOnMarket} days ago`}. Book a showing soon.`}
                  </div>
                </div>
              </div>
            </div>

            <PropertyMap listing={listing}/>

            {/* Neighbourhood scorecard */}
            <div style={card}>
              <div style={sh}><i className="ti ti-chart-radar" style={shI}/>Neighbourhood scorecard</div>
              {nbh.map(n => (
                <div key={n.l} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <i className={`ti ${n.i}`} style={{ fontSize:14, color:'rgba(255,255,255,.4)', width:22, textAlign:'center' }}/>
                  <span style={{ width:80, fontSize:12, color:'rgba(255,255,255,.6)', flexShrink:0 }}>{n.l}</span>
                  <div style={{ flex:1, height:4, background:'rgba(255,255,255,.08)', borderRadius:2, overflow:'hidden', margin:'0 8px' }}>
                    <div style={{ height:'100%', width:`${n.s}%`, background:sc(n.s), borderRadius:2 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, color:sc(n.s), width:30, textAlign:'right' }}>{n.s}</span>
                </div>
              ))}
            </div>

            {/* Property details */}
            <div style={card}>
              <div style={sh}><i className="ti ti-list-details" style={shI}/>Property details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' }}>
                {[
                  ['MLS Number', listing.ListingId || listing.ListingKey],
                  ['Year Built', listing.YearBuilt],
                  ['Property Type', propertyTypeLabel(listing.PropertySubType)],
                  ['Bedrooms', listing.BedroomsTotal],
                  ['Bathrooms', listing.BathroomsTotalInteger],
                  ['Parking', listing.ParkingTotal ? `${listing.ParkingTotal} spaces` : null],
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
                <div style={sh}><i className="ti ti-file-text" style={shI}/>About this property</div>
                <p style={{ fontSize:12, color:'rgba(255,255,255,.6)', lineHeight:1.75, marginBottom:14 }}>{listing.PublicRemarks}</p>
                <div style={{ background:'rgba(255,255,255,.04)', borderRadius:7, padding:'12px 14px', border:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Listing Brokerage</div>
                  <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.75)' }}>{listing.ListOfficeName || '—'}</div>
                </div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,.18)', marginTop:10, lineHeight:1.6 }}>Data by TRREB through PropTx · IDX #1860304 · MLS® and REALTOR® are trademarks of CREA · Propedia operated by Anirudha Warhadpande, Salesperson, HomeLife Miracle Realty Ltd. · RECO #6011384</p>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div>
            <div style={{ ...card, padding:'14px 15px', position:'sticky', top:50 }}>
              <div style={{ fontSize:20, fontWeight:600, letterSpacing:'-.025em', marginBottom:2 }}>{formatPrice(listing.ListPrice)}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginBottom:12 }}>{address}</div>
              <AvailableButton listing={listing}/>
              <button onClick={() => toggleSave(listing)} style={{ width:'100%', height:36, border:'1px solid', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .2s', borderColor: saved?'#00B4A8':'rgba(255,255,255,.14)', background: saved?'rgba(0,180,168,.12)':'none', color: saved?'#00B4A8':'rgba(255,255,255,.5)' }}>
                <i className={`ti ${saved?'ti-check':'ti-plus'}`} style={{ fontSize:13 }}/>{saved ? '✓ Saved' : 'Save'}
              </button>
            </div>
            <div style={{ ...card, padding:'13px 15px' }}>
              <div style={sh}><i className="ti ti-bolt" style={shI}/>Key numbers</div>
              {[
                ['List price', formatPrice(listing.ListPrice), 'rgba(255,255,255,.9)'],
                ['Est. mortgage', !isLease && listing.ListPrice ? fmtM(estimateMortgage(listing.ListPrice)) : '—', '#00B4A8'],
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

        {/* Bottom CTA */}
        <div style={{ marginTop:20, background:'#111316', borderRadius:12, padding:'28px 24px', textAlign:'center', border:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize:16, fontWeight:500, color:'rgba(255,255,255,.65)', marginBottom:6 }}>Ready to take the next step?</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:18 }}>Book a showing at {address}</div>
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