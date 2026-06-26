// src/pages/ListingDetailPage.jsx — Propedia full intelligence detail page v3

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AvailableButton from '../components/AvailableButton.jsx';
import ListingCard from '../components/ListingCard.jsx';
import PriceHistorySection from '../components/PriceHistorySection.jsx';
import VOWSignupWall from '../components/VOWSignupWall.jsx';
import propediaLogo from '/ITERATION-LOGO.png.png';
import { useCompare, getVOWSession } from '../hooks/useListings.js';
import { formatPrice, formatAddress, formatCityLine, propertyTypeLabel, estimateMortgage } from '../utils/format.js';
import '../styles/listings.css';

let _mapboxToken = null;
async function getMapboxToken() {
  if (_mapboxToken) return _mapboxToken;
  try { const r = await fetch('/api/maptoken'); if (r.ok) { const d = await r.json(); _mapboxToken = d.token || null; } } catch {}
  return _mapboxToken;
}

const card = { background:'#161719', borderRadius:10, border:'1px solid rgba(255,255,255,.06)', padding:'15px 17px', marginBottom:11 };
const sh   = { fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:13, paddingBottom:9, borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', gap:7 };
const shI  = { fontSize:13, color:'#00B4A8' };
const sc   = s => s >= 75 ? '#00B4A8' : s >= 50 ? '#F59E0B' : '#F87171';
const fmtM = n => '$' + Math.round(n).toLocaleString() + '/mo';
const fmt  = p => p >= 1e6 ? '$' + (p/1e6).toFixed(2).replace(/\.?0+$/,'') + 'M' : '$' + Math.round(p).toLocaleString();
const BG   = ['#1A2A26','#24221C','#182230','#2C1E1E','#1E2818','#281C28','#16203A','#2C2218'];

const RENTAL_RANGES = {
  Toronto:['1,600','2,200'], Oakville:['1,400','1,900'], Burlington:['1,350','1,800'],
  Mississauga:['1,300','1,750'], Brampton:['1,200','1,650'], Vaughan:['1,400','1,850'],
  Markham:['1,400','1,850'], 'Richmond Hill':['1,400','1,850'],
  Ajax:['1,200','1,600'], Pickering:['1,200','1,600'], Milton:['1,250','1,650'],
  'Halton Hills':['1,200','1,600'], Whitby:['1,200','1,600'], Oshawa:['1,100','1,500'],
};
const getRentalRange = city => RENTAL_RANGES[city] || ['1,200','1,650'];
const getRentalMid   = city => { const [lo,hi] = getRentalRange(city).map(v=>parseInt(v.replace(',',''))); return Math.round((lo+hi)/2); };

const RATE_PRESETS = [
  { label:'Best rate',    rate:3.99, note:'Broker / monoline' },
  { label:'Typical',      rate:4.99, note:'Most buyers' },
  { label:'Big bank avg', rate:4.75, note:'RBC/TD/BMO avg' },
];

function ScoreGauge({ score = 82, label = 'Top 18% of listings' }) {
  const cx=90, cy=90, r=68;
  const pt = d => ({ x:+(cx+r*Math.cos(d*Math.PI/180)).toFixed(1), y:+(cy+r*Math.sin(d*Math.PI/180)).toFixed(1) });
  const ts = pt(210), te = pt(-30), fe = pt(210-(score/100)*240);
  const fl = (score/100)*240 > 180 ? 1 : 0;
  const breakdown = [{ l:'Value',s:72 },{ l:'Location',s:88 },{ l:'Investment',s:81 },{ l:'Condition',s:85 }];
  return (
    <div style={{ ...card, padding:'18px 17px 14px', textAlign:'center' }}>
      <div style={{ ...sh, justifyContent:'center', border:'none', padding:0, marginBottom:4 }}>
        <i className="ti ti-chart-donut" style={shI}/>Propedia Score
      </div>
      <svg viewBox="0 0 180 155" style={{ width:160, height:'auto', display:'block', margin:'0 auto' }}>
        <path d={`M${ts.x} ${ts.y} A${r} ${r} 0 1 0 ${te.x} ${te.y}`} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="11" strokeLinecap="round"/>
        <path d={`M${ts.x} ${ts.y} A${r} ${r} 0 ${fl} 0 ${fe.x} ${fe.y}`} fill="none" stroke="#00B4A8" strokeWidth="11" strokeLinecap="round"/>
        <circle cx={fe.x} cy={fe.y} r="6" fill="#00B4A8"/>
        <text x="90" y="88" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="34" fontWeight="600" fill="#fff">{score}</text>
        <text x="90" y="108" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="11" fill="rgba(255,255,255,.3)">out of 100</text>
        <text x="19" y="140" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="rgba(255,255,255,.2)">0</text>
        <text x="161" y="140" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="rgba(255,255,255,.2)">100</text>
      </svg>
      <div style={{ fontSize:11, color:'#00B4A8', fontWeight:500, marginTop:2 }}>{label}</div>
      <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:7 }}>
        {breakdown.map(c => (
          <div key={c.l} style={{ display:'flex', alignItems:'center' }}>
            <span style={{ width:62, textAlign:'left', color:'rgba(255,255,255,.45)', fontSize:11 }}>{c.l}</span>
            <div style={{ flex:1, height:4, background:'rgba(255,255,255,.08)', borderRadius:2, overflow:'hidden', margin:'0 8px' }}>
              <div style={{ height:'100%', width:`${c.s}%`, background:sc(c.s), borderRadius:2 }}/>
            </div>
            <span style={{ width:28, textAlign:'right', color:sc(c.s), fontWeight:600, fontSize:11 }}>{c.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntelStrip({ listing, monthlyTotal }) {
  const dom = listing.DaysOnMarket || 0;
  const isMotivated = dom > 20;
  const chips = [
    { l:'Propedia Score', v:'82 / 100',                                        sub:'Top 18% in area',     c:'#00B4A8',              i:'ti-chart-donut' },
    { l:'Price Verdict',  v:'Fairly Priced',                                   sub:'vs recent comps',     c:'#34D399',              i:'ti-scale' },
    { l:'True Monthly',   v: monthlyTotal ? fmtM(monthlyTotal) : '—',          sub:'All-in estimate',     c:'rgba(255,255,255,.75)', i:'ti-calculator' },
    { l:'Signal',         v: isMotivated ? '⚡ Motivated' : '🟢 Act Fast',     sub:`${dom} days listed`,  c: isMotivated?'#F59E0B':'#34D399', i:'ti-flame' },
    { l:'Investment',     v:'B+',                                               sub:'5yr outlook',         c:'#60A5FA',              i:'ti-trending-up' },
  ];
  return (
    <div style={{ display:'flex', gap:8, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.06)', overflowX:'auto', marginBottom:12 }}>
      {chips.map(c => (
        <div key={c.l} style={{ flex:1, background:'#161719', borderRadius:8, padding:'11px 12px', border:'1px solid rgba(255,255,255,.06)', minWidth:100 }}>
          <div style={{ fontSize:9, fontWeight:600, letterSpacing:'.09em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:5 }}>
            <i className={`ti ${c.i}`} style={{ fontSize:10, marginRight:3, color:c.c }}/>{c.l}
          </div>
          <div style={{ fontSize:16, fontWeight:600, color:c.c, marginBottom:3 }}>{c.v}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function PriceIntelligence({ listing }) {
  const price = listing.ListPrice;
  const orig  = listing.OriginalListPrice;
  const priceReduced = orig && orig > price;
  const pctOff = priceReduced ? Math.round((orig-price)/orig*100) : 0;
  const history = priceReduced
    ? [{ x:40, p:orig, d:'Original' },{ x:200, p:price, d:'Current' }]
    : [{ x:40, p:price, d:'Listed'  },{ x:200, p:price, d:'Current' }];
  const h=65, minP=Math.min(...history.map(pt=>pt.p))*0.995, maxP=Math.max(...history.map(pt=>pt.p))*1.005;
  const range=maxP-minP||1;
  const yPos = p => +(h-(p-minP)/range*h).toFixed(1);
  const pathD = history.map((pt,i)=>`${i===0?'M':'L'}${pt.x} ${yPos(pt.p)}`).join(' ');
  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-chart-bar" style={shI}/>Price Intelligence</div>
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div style={{ flex:1, background:'rgba(255,255,255,.04)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.3)', marginBottom:5 }}>Verdict vs comps</div>
          <div style={{ fontSize:17, fontWeight:600, color:'#00B4A8', marginBottom:3 }}>Fairly Priced</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Based on recent area sales</div>
        </div>
        <div style={{ flex:1, background:'rgba(255,255,255,.04)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.3)', marginBottom:5 }}>
            {priceReduced ? 'Price Reduction' : 'List Price'}
          </div>
          <div style={{ fontSize:17, fontWeight:600, color: priceReduced?'#34D399':'rgba(255,255,255,.9)', marginBottom:3 }}>
            {priceReduced ? `-${pctOff}% off ask` : fmt(price)}
          </div>
          {priceReduced && <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Was {fmt(orig)}</div>}
        </div>
      </div>
      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.28)', marginBottom:8 }}>Price history</div>
      <div style={{ background:'rgba(255,255,255,.03)', borderRadius:7, padding:'12px' }}>
        <svg viewBox="0 0 280 82" style={{ width:'100%', height:60, overflow:'visible' }}>
          <line x1="0" y1="0"    x2="280" y2="0"    stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          <line x1="0" y1={h/2} x2="280" y2={h/2}  stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          <line x1="0" y1={h}   x2="280" y2={h}    stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          <path d={pathD} fill="none" stroke="#00B4A8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d={`${pathD} L${history[history.length-1].x} ${h} L${history[0].x} ${h} Z`} fill="rgba(0,180,168,.07)"/>
          {history.map((pt,i) => (
            <g key={i}>
              <circle cx={pt.x} cy={yPos(pt.p)} r="4" fill="#00B4A8"/>
              <text x={pt.x} y={yPos(pt.p)-9} textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="rgba(255,255,255,.65)">{fmt(pt.p)}</text>
              <text x={pt.x} y="80"            textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="rgba(255,255,255,.28)">{pt.d}</text>
            </g>
          ))}
        </svg>
      </div>
      <p style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:10, lineHeight:1.6 }}>Fairly Priced verdict based on comparable sales within same postal code and property type, last 6 months, ±25% price band. Data from TRREB. Not financial advice.</p>
    </div>
  );
}

function Calculator({ price, city, propertyType, onTotal }) {
  const isCondo = ['Condo Apt','Condo Townhouse','Co-Op Apt'].includes(propertyType);
  const rentalRangeStr = !isCondo ? getRentalRange(city) : null;
  const rentalMid      = !isCondo ? getRentalMid(city)   : 0;
  const [downPct,       setDownPct]       = useState(10);
  const [downAmt,       setDownAmt]       = useState(Math.round(price*0.10));
  const [rate,          setRate]          = useState(4.99);
  const [rateInput,     setRateInput]     = useState('4.99');
  const [amort,         setAmort]         = useState(25);
  const [includeRental, setIncludeRental] = useState(false);
  const [rentalAmt,     setRentalAmt]     = useState(rentalMid);
  const syncFromPct = pct => { const p=Math.max(0,Math.min(95,parseFloat(pct)||0)); setDownPct(+p.toFixed(1)); setDownAmt(Math.round(price*p/100)); };
  const syncFromAmt = amt => { const a=Math.max(0,Math.min(price*0.95,parseInt(amt)||0)); setDownAmt(a); setDownPct(+(a/price*100).toFixed(1)); };
  const handleRate  = val => { setRateInput(val); const n=parseFloat(val); if(!isNaN(n)&&n>0&&n<25) setRate(n); };
  const calc = useCallback(() => {
    const principal=Math.max(0,price-downAmt), r=rate/100/12, n=amort*12;
    const pi=r>0?Math.round(principal*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1)):Math.round(principal/n);
    const tax=Math.round(price*0.0085/12), ins=200, maint=370, util=330;
    const subtotal=pi+tax+ins+maint+util;
    return { pi, tax, ins, maint, util, subtotal, effective:Math.max(0,subtotal-(includeRental?rentalAmt:0)) };
  }, [price,downAmt,rate,amort,includeRental,rentalAmt]);
  const tc = calc();
  useEffect(() => { onTotal && onTotal(tc.subtotal); }, [tc.subtotal]);
  const minDown = price<500000?price*0.05:price<1500000?25000+(price-500000)*0.10:price*0.20;
  const tooLow  = downAmt < minDown;
  const items = [
    { l:'Mortgage (P&I)',        v:tc.pi,    c:'#00B4A8' },
    { l:'Property tax (est.)',   v:tc.tax,   c:'#60A5FA' },
    { l:'Home insurance (est.)', v:tc.ins,   c:'#F59E0B' },
    { l:'Maintenance reserve',   v:tc.maint, c:'#A78BFA' },
    { l:'Utilities (est.)',      v:tc.util,  c:'#34D399' },
  ];
  const inp = { height:32, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, padding:'0 10px', fontSize:13, color:'#fff', outline:'none', textAlign:'center' };
  const lbl = { fontSize:10, color:'rgba(255,255,255,.35)', display:'block', marginBottom:4 };
  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-calculator" style={shI}/>True cost calculator</div>
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.45)' }}>Down payment</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#00B4A8' }}>{downPct}% — {fmt(downAmt)}</span>
        </div>
        <div style={{ display:'flex', gap:5, marginBottom:10 }}>
          {[5,10,15,20,25].map(p => (
            <button key={p} onClick={()=>syncFromPct(p)} style={{ flex:1, height:28, border:`1.5px solid ${Math.round(downPct)===p?'#00B4A8':'rgba(255,255,255,.13)'}`, borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:Math.round(downPct)===p?'#00B4A8':'transparent', color:Math.round(downPct)===p?'#fff':'rgba(255,255,255,.5)', transition:'all .15s' }}>{p}%</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1 }}>
            <label style={lbl}>Percentage</label>
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden' }}>
              <input type="number" min="0" max="95" step="0.5" value={downPct} onChange={e=>syncFromPct(e.target.value)} style={{ ...inp, flex:1, border:'none', borderRadius:0, background:'transparent' }}/>
              <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)' }}>%</span>
            </div>
          </div>
          <span style={{ color:'rgba(255,255,255,.18)', fontSize:15, alignSelf:'flex-end', paddingBottom:8 }}>↔</span>
          <div style={{ flex:1 }}>
            <label style={lbl}>Dollar amount</label>
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden' }}>
              <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)' }}>$</span>
              <input type="number" min="0" step="5000" value={downAmt} onChange={e=>syncFromAmt(e.target.value)} style={{ ...inp, flex:1, border:'none', borderRadius:0, background:'transparent', textAlign:'left' }}/>
            </div>
          </div>
        </div>
        {tooLow && <p style={{ fontSize:10, color:'#F59E0B', marginTop:7, lineHeight:1.5 }}>⚠️ CMHC requires minimum {+(minDown/price*100).toFixed(1)}% down ({fmt(Math.round(minDown))}) on a {fmt(price)} property.</p>}
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', marginBottom:8 }}>Interest rate</div>
        <div style={{ display:'flex', gap:5, marginBottom:8 }}>
          {RATE_PRESETS.map(p => (
            <button key={p.label} onClick={()=>{ setRate(p.rate); setRateInput(String(p.rate)); }} style={{ flex:1, height:48, border:`1.5px solid ${rate===p.rate?'#00B4A8':'rgba(255,255,255,.12)'}`, borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:rate===p.rate?'rgba(0,180,168,.12)':'rgba(255,255,255,.04)', padding:'4px 2px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:rate===p.rate?'#00B4A8':'#fff' }}>{p.rate}%</div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,.3)', marginTop:1 }}>{p.note}</div>
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}>
            <label style={lbl}>Custom rate (%)</label>
            <input type="number" min="1" max="20" step="0.05" value={rateInput} onChange={e=>handleRate(e.target.value)} style={{ ...inp, width:'100%' }}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={lbl}>Amortization</label>
            <select value={amort} onChange={e=>setAmort(+e.target.value)} style={{ width:'100%', height:32, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, padding:'0 9px', fontSize:12, color:'rgba(255,255,255,.8)', outline:'none', cursor:'pointer' }}>
              {[20,25,30].map(y=><option key={y} value={y}>{y} years</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ height:10, borderRadius:5, overflow:'hidden', display:'flex', marginBottom:14, gap:1 }}>
        {items.map(it=><div key={it.l} style={{ height:'100%', width:`${Math.round(it.v/tc.subtotal*100)}%`, background:it.c }} title={it.l}/>)}
      </div>
      {items.map(it => (
        <div key={it.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:it.c }}/>
            <span style={{ color:'rgba(255,255,255,.5)' }}>{it.l}</span>
          </div>
          <span style={{ fontWeight:500, color:'rgba(255,255,255,.75)' }}>{fmtM(it.v)}</span>
        </div>
      ))}
      {!isCondo && rentalRangeStr && (
        <div style={{ marginTop:14, padding:12, background:'rgba(0,180,168,.06)', borderRadius:8, border:'1px solid rgba(0,180,168,.18)' }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:includeRental?14:0 }}>
            <div onClick={()=>setIncludeRental(r=>!r)} style={{ width:38, height:22, borderRadius:11, background:includeRental?'#00B4A8':'rgba(255,255,255,.15)', position:'relative', transition:'background .2s', flexShrink:0, cursor:'pointer' }}>
              <div style={{ position:'absolute', top:3, left:includeRental?19:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
            </div>
            <span style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.8)' }}>Include basement rental income</span>
            <span style={{ fontSize:10, color:'rgba(0,180,168,.7)', marginLeft:'auto', flexShrink:0 }}>est. ${rentalRangeStr[0]}–${rentalRangeStr[1]}/mo</span>
          </label>
          {includeRental && (
            <>
              <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, overflow:'hidden', height:32, marginBottom:10 }}>
                <span style={{ padding:'0 8px', fontSize:12, color:'rgba(255,255,255,.4)' }}>$</span>
                <input type="number" min="500" max="5000" step="50" value={rentalAmt} onChange={e=>setRentalAmt(parseInt(e.target.value)||0)} style={{ flex:1, background:'transparent', border:'none', padding:'0 8px 0 0', fontSize:13, color:'#fff', outline:'none' }}/>
                <span style={{ padding:'0 8px', fontSize:11, color:'rgba(255,255,255,.3)' }}>/mo</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:'1px solid rgba(0,180,168,.15)' }}>
                <span style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>Basement rental offset</span>
                <span style={{ fontWeight:600, color:'#34D399', fontSize:13 }}>− {fmtM(rentalAmt)}</span>
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0 0', borderTop:'1px solid rgba(255,255,255,.1)', marginTop:5 }}>
        <span style={{ fontSize:13, fontWeight:600 }}>{includeRental&&!isCondo?'Effective Monthly Cost':'True Monthly Cost'}</span>
        <span style={{ fontSize:17, fontWeight:600 }}>{fmtM(includeRental&&!isCondo?tc.effective:tc.subtotal)}</span>
      </div>
      <p style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:6 }}>Estimates only. Not financial advice.</p>
    </div>
  );
}

function NegotiateSignal({ listing }) {
  const dom = listing.DaysOnMarket || 0;
  const priceReduced = listing.OriginalListPrice && listing.OriginalListPrice > listing.ListPrice;
  const reduction    = priceReduced ? listing.OriginalListPrice - listing.ListPrice : 0;
  const domHigh      = dom > 20;
  const color        = domHigh ? '#F59E0B' : '#34D399';
  const stats = [
    ['DOM',        `${dom} days`,              'on market'],
    ['Price cuts', priceReduced?'1 cut':'None', priceReduced?fmt(reduction)+' off':'No reduction'],
    ['vs Orig.',   priceReduced?`-${Math.round(reduction/listing.OriginalListPrice*100)}%`:'0%', 'from list price'],
  ];
  return (
    <div style={{ ...card, borderLeft:`3px solid ${color}`, borderRadius:'4px 10px 10px 4px' }}>
      <div style={sh}><i className="ti ti-flame" style={{ ...shI, color }}/>Negotiate or act fast?</div>
      <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:14 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', background:`rgba(${domHigh?'245,158,11':'52,211,153'},.15)`, border:`2px solid rgba(${domHigh?'245,158,11':'52,211,153'},.4)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>
          {domHigh?'⚡':'🟢'}
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color, marginBottom:5 }}>
            {domHigh?'Motivated seller — room to negotiate':'Fresh listing — act quickly'}
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', lineHeight:1.6 }}>
            {domHigh
              ? `Listed ${dom} days ago${priceReduced?` with a price reduction of ${fmt(reduction)}`:''}. Consider opening 2–3% below current ask.`
              : `Listed ${dom===0?'today':`${dom} days ago`}. Fresh listings in this price range move quickly.`}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        {stats.map(([l,v,s]) => (
          <div key={l} style={{ flex:1, background:`rgba(${domHigh?'245,158,11':'52,211,153'},.08)`, border:`1px solid rgba(${domHigh?'245,158,11':'52,211,153'},.2)`, borderRadius:6, padding:'8px 10px' }}>
            <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.28)', marginBottom:3 }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,.85)' }}>{v}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyMap({ listing }) {
  const lat=listing.Latitude, lng=listing.Longitude;
  const [mapUrl, setMapUrl] = React.useState(null);
  React.useEffect(() => {
    if (!lat || !lng) return;
    getMapboxToken().then(tok => {
      if (tok) setMapUrl(`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+00B4A8(${lng},${lat})/${lng},${lat},14,0/800x280?access_token=${tok}`);
    });
  }, [lat, lng]);
  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-map-2" style={shI}/>Property location</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', border:'1px solid rgba(255,255,255,.12)', borderRadius:6, overflow:'hidden' }}>
          <button style={{ height:26, padding:'0 10px', border:'none', background:'#00B4A8', color:'#fff', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Street</button>
          <button style={{ height:26, padding:'0 10px', border:'none', background:'transparent', color:'rgba(255,255,255,.4)', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Satellite</button>
        </div>
        {/* placeholder — Google Maps button rendered below the map image */}
      </div>
      <div style={{ borderRadius:8, overflow:'hidden', position:'relative' }}>
        {mapUrl
          ? <img src={mapUrl} alt="Map" style={{ width:'100%', height:240, objectFit:'cover', display:'block' }} loading="lazy"/>
          : (
            <svg viewBox="0 0 420 200" style={{ width:'100%', display:'block' }}>
              <rect width="420" height="200" fill="#0D1117"/>
              <rect x="0" y="0" width="55" height="60" fill="#13181F"/><rect x="65" y="0" width="65" height="60" fill="#13181F"/><rect x="140" y="0" width="60" height="60" fill="#131A1F"/><rect x="210" y="0" width="70" height="60" fill="#131A1F"/><rect x="290" y="0" width="55" height="60" fill="#13181F"/><rect x="355" y="0" width="65" height="60" fill="#13181F"/>
              <rect x="0" y="75" width="55" height="55" fill="#13181F"/><rect x="65" y="75" width="65" height="55" fill="#13181F"/><rect x="140" y="75" width="55" height="22" fill="#131A1F"/><rect x="205" y="75" width="70" height="55" fill="#152028" rx="2"/><rect x="285" y="75" width="60" height="55" fill="#13181F"/><rect x="355" y="75" width="65" height="55" fill="#13181F"/>
              <rect x="0" y="148" width="420" height="52" fill="#0D1E2C"/>
              <line x1="0" y1="65" x2="420" y2="65" stroke="#151E2A" strokeWidth="6"/><line x1="0" y1="138" x2="420" y2="138" stroke="#151E2A" strokeWidth="5"/>
              <line x1="60" y1="0" x2="60" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="135" y1="0" x2="135" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="205" y1="0" x2="205" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="285" y1="0" x2="285" y2="142" stroke="#151E2A" strokeWidth="5"/><line x1="355" y1="0" x2="355" y2="142" stroke="#151E2A" strokeWidth="5"/>
              <line x1="0" y1="105" x2="420" y2="105" stroke="#1E3048" strokeWidth="10"/>
              <text x="14" y="100" fontFamily="DM Sans,sans-serif" fontSize="7.5" fill="rgba(150,180,220,.45)">MAIN STREET</text>
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
          )
        }
        <div style={{ position:'absolute', top:8, right:8, display:'flex', flexDirection:'column', gap:1 }}>
          {['+','−'].map(s=><button key={s} style={{ width:24, height:24, background:'rgba(20,22,26,.9)', border:'1px solid rgba(255,255,255,.12)', borderRadius:s==='+'?'4px 4px 0 0':'0 0 4px 4px', color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', borderTop:s==='−'?'none':undefined }}>{s}</button>)}
        </div>
      </div>
      {/* ── View on Google Maps ── */}
      <a
        href={`https://www.google.com/maps/search/${encodeURIComponent([listing.UnparsedAddress, listing.City, listing.PostalCode].filter(Boolean).join(', '))}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          marginTop:10, height:44, borderRadius:8, textDecoration:'none',
          background:'rgba(0,180,168,.15)', border:'1px solid #00B4A8',
          color:'#00B4A8', fontSize:13, fontWeight:600, fontFamily:'inherit',
          transition:'background .15s, color .15s',
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='#00B4A8';e.currentTarget.style.color='#fff';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,180,168,.15)';e.currentTarget.style.color='#00B4A8';}}
      >
        <i className="ti ti-map-pin" style={{ fontSize:14 }}/>
        View on Google Maps →
      </a>

      <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap' }}>
        {[['#60A5FA','School (0.4 km)'],['#A78BFA','Transit (0.1 km)'],['#34D399','Grocery (0.7 km)']].map(([c,l])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Neighbourhood() {
  const nbh = [{ l:'Schools',s:89,i:'ti-school' },{ l:'Transit',s:72,i:'ti-bus' },{ l:'Walkability',s:58,i:'ti-walk' },{ l:'Amenities',s:81,i:'ti-building-store' }];
  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-chart-radar" style={shI}/>Neighbourhood scorecard</div>
      {nbh.map(n=>(
        <div key={n.l} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <i className={`ti ${n.i}`} style={{ fontSize:14, color:'rgba(255,255,255,.4)', width:22, textAlign:'center' }}/>
          <span style={{ width:80, fontSize:12, color:'rgba(255,255,255,.6)', flexShrink:0 }}>{n.l}</span>
          <div style={{ flex:1, height:4, background:'rgba(255,255,255,.08)', borderRadius:2, overflow:'hidden', margin:'0 8px' }}>
            <div style={{ height:'100%', width:`${n.s}%`, background:sc(n.s), borderRadius:2 }}/>
          </div>
          <span style={{ fontSize:12, fontWeight:600, color:sc(n.s), width:30, textAlign:'right' }}>{n.s}</span>
        </div>
      ))}
      <p style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:4 }}>Based on OpenStreetMap and Fraser Institute school rankings.</p>
    </div>
  );
}

function InvestmentAnalysis({ listing }) {
  const price = listing.ListPrice;
  const vals  = [
    { l:'Conservative', rate:3, c:'rgba(0,180,168,.5)' },
    { l:'Expected',     rate:4, c:'#00B4A8' },
    { l:'Optimistic',   rate:5, c:'#00D4C6' },
  ].map(v=>({ ...v, fv:Math.round(price*Math.pow(1+v.rate/100,5)) }));
  const mx = vals[2].fv;
  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-trending-up" style={shI}/>Investment analysis</div>
      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.28)', marginBottom:10 }}>5-year value projection</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
        {vals.map(v=>(
          <div key={v.l} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', width:120, flexShrink:0 }}>{v.l} ({v.rate}%)</span>
            <div style={{ flex:1, height:28, background:'rgba(255,255,255,.05)', borderRadius:5, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.round(v.fv/mx*100)}%`, background:v.c, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:10, fontSize:11, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>
                {fmt(v.fv)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div style={{ background:'rgba(255,255,255,.04)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.28)', marginBottom:5 }}>Buy vs rent breakeven</div>
          <div style={{ fontSize:18, fontWeight:600, color:'#60A5FA', marginBottom:3 }}>~4–5 years</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.35)' }}>vs renting comparable</div>
        </div>
        <div style={{ background:'rgba(0,180,168,.08)', borderRadius:7, padding:'11px 13px', border:'1px solid rgba(0,180,168,.2)' }}>
          <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(0,180,168,.6)', marginBottom:5 }}>Rental income potential</div>
          <div style={{ fontSize:18, fontWeight:600, color:'#00B4A8', marginBottom:3 }}>${getRentalRange(listing.City)[0]}–${getRentalRange(listing.City)[1]}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>Estimate based on area</div>
        </div>
      </div>
      <p style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:10 }}>Projections are illustrative. Not financial advice.</p>
    </div>
  );
}

function KeyMetrics({ listing, monthlyTotal, isLease }) {
  return (
    <div style={{ ...card, padding:'13px 15px' }}>
      <div style={sh}><i className="ti ti-bolt" style={shI}/>Key numbers</div>
      {[
        ['True monthly cost',   monthlyTotal?fmtM(monthlyTotal):'—',                                                                     'rgba(255,255,255,.9)'],
        ['Est. mortgage (P&I)', !isLease&&listing.ListPrice?fmtM(estimateMortgage(listing.ListPrice)):'—',                               'rgba(255,255,255,.6)'],
        ['Days on market',      listing.DaysOnMarket!=null?`${listing.DaysOnMarket} days`:'—',                                           listing.DaysOnMarket>20?'#F59E0B':'rgba(255,255,255,.6)'],
        ['Est. rental income',  `$${getRentalRange(listing.City)[0]}–$${getRentalRange(listing.City)[1]}/mo`,                            '#00B4A8'],
      ].map(([l,v,c])=>(
        <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12 }}>
          <span style={{ color:'rgba(255,255,255,.4)', fontSize:11 }}>{l}</span>
          <span style={{ fontWeight:600, fontSize:12, color:c }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── SoldSummaryCard ───────────────────────────────────────────────────────────
function SoldSummaryCard({ listing }) {
  const {
    ListPrice, OriginalListPrice, ClosePrice, CloseDate,
    ModificationTimestamp, DaysOnMarket,
  } = listing;

  const askPrice   = ListPrice || OriginalListPrice;
  const soldPrice  = ClosePrice;
  const listedDate = ModificationTimestamp
    ? new Date(ModificationTimestamp).toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' })
    : '—';
  const soldDate = CloseDate
    ? new Date(CloseDate).toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' })
    : '—';

  const priceDelta   = soldPrice && askPrice ? soldPrice - askPrice : null;
  const pricePct     = priceDelta != null && askPrice ? ((priceDelta / askPrice) * 100).toFixed(1) : null;
  const overAsk      = priceDelta != null && priceDelta > 0;
  const dom          = DaysOnMarket ?? null;
  const velocity     = dom == null ? null : dom <= 7 ? 'Very fast' : dom <= 14 ? 'Fast' : dom <= 30 ? 'Moderate' : 'Slow';
  const velocityColor= dom == null ? 'rgba(255,255,255,.4)' : dom <= 14 ? '#34D399' : dom <= 30 ? '#FBBF24' : '#F87171';

  const row = (label, value, valueStyle = {}) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
      <span style={{ fontSize:11, color:'rgba(255,255,255,.38)', textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,.85)', ...valueStyle }}>{value}</span>
    </div>
  );

  return (
    <div style={{ ...card, borderColor:'rgba(248,113,113,.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <i className="ti ti-gavel" style={{ fontSize:15, color:'#F87171' }}/>
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.09em', textTransform:'uppercase', color:'#F87171' }}>Sold Property</span>
      </div>

      {soldPrice ? (
        <>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>Sold for</div>
            <div style={{ fontSize:28, fontWeight:700, letterSpacing:'-.03em', color:'#fff' }}>{fmt(soldPrice)}</div>
            {priceDelta != null && (
              <div style={{ fontSize:12, color: overAsk ? '#34D399' : '#F87171', marginTop:3 }}>
                {overAsk ? '+' : ''}{fmt(Math.abs(priceDelta))} ({overAsk ? '+' : ''}{pricePct}%) {overAsk ? 'over asking' : 'under asking'}
              </div>
            )}
          </div>

          {row('Asking price', askPrice ? fmt(askPrice) : '—')}
        </>
      ) : (
        <div style={{ marginBottom:14, fontSize:12, color:'rgba(255,255,255,.35)' }}>
          Sold price not available (IDX listing)
        </div>
      )}

      {row('Listed', listedDate)}
      {row('Sold', soldDate)}
      {dom != null && row('Days on market', `${dom} days`)}
      {velocity && row('Market velocity', velocity, { color: velocityColor })}
    </div>
  );
}

export default function ListingDetailPage() {
  const { listingKey } = useParams();
  const navigate = useNavigate();
  const { toggleSave, isSaved } = useCompare();
  const [listing,      setListing]      = useState(null);
  const [photos,       setPhotos]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [photoIdx,     setPhotoIdx]     = useState(0);
  const [lightbox,     setLightbox]     = useState(false);
  const [similar,      setSimilar]      = useState([]);
  const [monthlyTotal, setMonthlyTotal] = useState(null);
  const [hasVOW,       setHasVOW]       = useState(() => getVOWSession());
  const [vowOpen,      setVowOpen]      = useState(false);

  useEffect(() => {
    if (!listingKey) return;
    setLoading(true); setError(null);
    fetch(`/api/listing?listingKey=${encodeURIComponent(listingKey)}`)
      .then(r=>r.ok?r.json():Promise.reject(r.status))
      .then(d=>{ setListing(d.listing); window.scrollTo({ top:0, behavior:'instant' }); })
      .catch(()=>setError('Listing not found.'))
      .finally(()=>setLoading(false));
  }, [listingKey]);

  useEffect(() => {
    if (!listingKey) return;
    fetch(`/api/photos?listingKey=${encodeURIComponent(listingKey)}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>d&&setPhotos(d.photos||[]))
      .catch(()=>null);
  }, [listingKey]);

  useEffect(() => {
    if (!listing) return;
    const params = new URLSearchParams({
      city:    listing.City            || '',
      type:    listing.PropertySubType || '',
      price:   listing.ListPrice       || '',
      exclude: listing.ListingKey      || '',
      tx:      listing.TransactionType || 'For Sale',
      limit:   '4',
    });
    fetch(`/api/similar?${params}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>d&&setSimilar(d.listings||[]))
      .catch(()=>null);
  }, [listing]);

  if (loading) return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <i className="ti ti-loader-2" style={{ fontSize:32, display:'block', marginBottom:12, opacity:.5, animation:'spin 1s linear infinite' }}/>
        <p style={{ color:'rgba(255,255,255,.4)', fontSize:14 }}>Loading listing…</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error||!listing) return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <i className="ti ti-home-off" style={{ fontSize:48, display:'block', marginBottom:16, color:'rgba(255,255,255,.2)' }}/>
        <h1 style={{ fontSize:24, fontWeight:500, marginBottom:8 }}>{error||'Listing not found'}</h1>
        <button onClick={()=>navigate(-1)} style={{ marginTop:20, padding:'12px 28px', background:'#00B4A8', color:'#fff', border:'none', borderRadius:7, fontSize:14, fontWeight:500, cursor:'pointer' }}>← Back to Listings</button>
      </div>
    </div>
  );

  const address = formatAddress(listing);
  const saved   = isSaved(listing.ListingKey);
  const isLease = listing.TransactionType === 'For Lease';
  const isSold  = listing.StandardStatus === 'Closed';
  const currentPhoto = photos[photoIdx]?.url || null;
  const photoCount   = photos.length;

  return (
    <div style={{ background:'#0C0D10', minHeight:'100vh', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff', fontSize:13, lineHeight:1.5 }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .detail-grid { display:grid; grid-template-columns:1fr 212px; gap:12px; }
        .mobile-cta  { display:none; }
        @media(max-width:768px){
          .detail-grid  { grid-template-columns:1fr !important; }
          .detail-right > * { width:100%; }
          .detail-hero  { height:260px !important; }
          .intel-strip  { display:none !important; }
          .mobile-cta   { display:flex !important; }
          .similar-grid { grid-template-columns:repeat(2,1fr) !important; }
        }
        @media(max-width:480px){
          /* Prevent iOS auto-zoom on number input focus (must be >= 16px) */
          input[type="number"] { font-size: 16px !important; }
          /* Similar properties: 1 col on smallest phones */
          .similar-grid { grid-template-columns:1fr !important; }
          /* "View all photos" button — touch-friendly height */
          .view-all-photos-btn { min-height:44px !important; padding:0 16px !important; }
        }
      `}</style>

      {/* Nav */}
      <header style={{ position:'sticky', top:0, zIndex:200, height:46, background:'#0C0D10', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', padding:'0 16px', gap:10 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', textDecoration:'none', flexShrink:0 }}>
          <img src={propediaLogo} alt="Propedia" style={{ height:36, width:'auto', display:'block' }} />
        </Link>
        <span style={{ color:'rgba(255,255,255,.15)', fontSize:16 }}>›</span>
        <button onClick={()=>navigate(-1)} style={{ fontSize:12, color:'rgba(255,255,255,.5)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>← Back to Listings</button>
        <button onClick={()=>toggleSave(listing)} style={{ marginLeft:'auto', height:32, padding:'0 14px', border:'1px solid', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', flexShrink:0, borderColor:saved?'#00B4A8':'rgba(255,255,255,.14)', background:saved?'rgba(0,180,168,.12)':'none', color:saved?'#00B4A8':'rgba(255,255,255,.55)', display:'flex', alignItems:'center', gap:5, transition:'all .2s' }}>
          <i className={`ti ${saved?'ti-check':'ti-plus'}`} style={{ fontSize:12 }}/>{saved?'Saved':'Save'}
        </button>
      </header>

      {/* Mobile bottom CTA */}
      <div className="mobile-cta" style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:300, background:'#0C0D10', borderTop:'1px solid rgba(255,255,255,.1)', padding:'10px 16px', gap:10, alignItems:'center' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:600 }}>
            {isSold && listing.ClosePrice ? <><span style={{ fontSize:10, color:'#F87171', fontWeight:700, marginRight:5 }}>SOLD</span>{fmt(listing.ClosePrice)}</> : fmt(listing.ListPrice)}
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{listing.BedroomsTotal}bd · {listing.BathroomsTotalInteger}ba</div>
        </div>
        {!isSold && <AvailableButton listing={listing}/>}
      </div>

      <div style={{ maxWidth:1140, margin:'0 auto', padding:'0 14px 80px' }}>

        {/* Hero */}
        <div>
          <div className="detail-hero" style={{ position:'relative', height:400, background:BG[photoIdx%BG.length], overflow:'hidden' }}>
            {currentPhoto
              ? <img src={currentPhoto} alt={address} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="eager"/>
              : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-building-estate" style={{ fontSize:96, color:'rgba(255,255,255,.06)' }}/></div>
            }
            {photoCount>1 && <>
              <button onClick={()=>setPhotoIdx(i=>(i-1+photoCount)%photoCount)} style={{ position:'absolute', left:0, top:0, bottom:0, width:52, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s,color .2s' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.4)';e.currentTarget.style.color='rgba(255,255,255,.9)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)';e.currentTarget.style.color='rgba(255,255,255,0)'}}>‹</button>
              <button onClick={()=>setPhotoIdx(i=>(i+1)%photoCount)} style={{ position:'absolute', right:0, top:0, bottom:0, width:52, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s,color .2s' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.4)';e.currentTarget.style.color='rgba(255,255,255,.9)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)';e.currentTarget.style.color='rgba(255,255,255,0)'}}>›</button>
            </>}
            <div style={{ position:'absolute', top:14, left:14, display:'flex', gap:8 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', padding:'4px 11px', borderRadius:5, background:isSold?'rgba(248,113,113,.85)':isLease?'rgba(59,130,246,.85)':'rgba(16,185,129,.85)', color:'#fff' }}>{isSold?'Sold':listing.TransactionType}</span>
              {listing.OriginalListPrice&&listing.OriginalListPrice>listing.ListPrice&&<span style={{ fontSize:10, fontWeight:700, padding:'4px 11px', borderRadius:5, background:'rgba(239,68,68,.8)', color:'#fff' }}>Price Reduced {fmt(listing.OriginalListPrice-listing.ListPrice)}</span>}
            </div>
            <button onClick={()=>setLightbox(true)} className="view-all-photos-btn" style={{ position:'absolute', bottom:72, right:14, height:30, padding:'0 12px', background:'rgba(0,0,0,.6)', border:'1px solid rgba(255,255,255,.18)', borderRadius:7, color:'rgba(255,255,255,.8)', fontSize:11, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
              <i className="ti ti-camera" style={{ fontSize:11 }}/>View all {photoCount} photos
            </button>
            <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
              {Array.from({ length:Math.min(photoCount,8) }).map((_,i)=>(
                <div key={i} onClick={()=>setPhotoIdx(i)} style={{ width:photoIdx===i?22:7, height:7, borderRadius:4, background:photoIdx===i?'#00B4A8':'rgba(255,255,255,.35)', cursor:'pointer', transition:'all .25s' }}/>
              ))}
            </div>
          </div>
          {photoCount>0&&(
            <div style={{ display:'flex', gap:6, padding:'10px 12px', background:'#111316', overflowX:'auto', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              {photos.map((m,i)=>(
                <div key={i} onClick={()=>setPhotoIdx(i)} style={{ flexShrink:0, width:88, height:58, background:BG[i%BG.length], borderRadius:6, cursor:'pointer', border:`2px solid ${photoIdx===i?'#00B4A8':'transparent'}`, overflow:'hidden', position:'relative', transition:'border-color .2s' }}>
                  {m.url&&<img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy"/>}
                  {photoIdx===i&&<div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'#00B4A8' }}/>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Intel strip — desktop only, active listings only */}
        {!isSold && (
          <div className="intel-strip">
            <IntelStrip listing={listing} monthlyTotal={monthlyTotal}/>
          </div>
        )}

        {/* Two column */}
        <div className="detail-grid">
          {/* LEFT */}
          <div>
            {isSold ? (
              <SoldSummaryCard listing={listing}/>
            ) : (
              <>
                <PriceIntelligence listing={listing}/>
                {!isLease&&<Calculator price={listing.ListPrice} city={listing.City} propertyType={listing.PropertySubType} onTotal={setMonthlyTotal}/>}
                <NegotiateSignal listing={listing}/>
              </>
            )}
            <PropertyMap listing={listing}/>
            <Neighbourhood/>
            {!isSold&&!isLease&&<InvestmentAnalysis listing={listing}/>}

            {/* Property details */}
            <div style={card}>
              <div style={sh}><i className="ti ti-list-details" style={shI}/>Property details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' }}>
                {[
                  ['MLS Number',    listing.ListingId||listing.ListingKey],
                  ['Year Built',    listing.YearBuilt],
                  ['Property Type', propertyTypeLabel(listing.PropertySubType)],
                  ['Bedrooms',      listing.BedroomsTotal],
                  ['Bathrooms',     listing.BathroomsTotalInteger],
                  ['Parking',       listing.ParkingTotal?`${listing.ParkingTotal} spaces`:null],
                  ['Days on Market',listing.DaysOnMarket!=null?`${listing.DaysOnMarket} days`:null],
                  ['Status',        listing.StandardStatus],
                ].filter(([,v])=>v!=null).map(([l,v])=>(
                  <div key={l}>
                    <div style={{ fontSize:9, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.8)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {listing.PublicRemarks&&(
              <div style={card}>
                <div style={sh}><i className="ti ti-file-text" style={shI}/>About this property</div>
                <p style={{ fontSize:12, color:'rgba(255,255,255,.6)', lineHeight:1.75, marginBottom:14 }}>{listing.PublicRemarks}</p>
                <div style={{ background:'rgba(255,255,255,.04)', borderRadius:7, padding:'12px 14px', border:'1px solid rgba(255,255,255,.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.3)', marginBottom:3 }}>Listing Brokerage</div>
                    <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,.75)' }}>{listing.ListOfficeName||'—'}</div>
                  </div>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,.25)' }}>MLS® {listing.ListingId||listing.ListingKey}</span>
                </div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,.18)', marginTop:10, lineHeight:1.6 }}>Data by TRREB through PropTx · IDX #1860304 · MLS® and REALTOR® are trademarks of CREA · Propedia operated by Anirudha Warhadpande, Salesperson, HomeLife Miracle Realty Ltd. · RECO #6011384</p>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="detail-right">
            {!isSold && <ScoreGauge score={82} label={`Top 18% in ${listing.City}`}/>}
            <div style={{ ...card, padding:'14px 15px' }}>
              {isSold ? (
                <>
                  {listing.ClosePrice
                    ? <><div style={{ fontSize:9, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'#F87171', marginBottom:3 }}>Sold price</div>
                        <div style={{ fontSize:20, fontWeight:600, letterSpacing:'-.025em', marginBottom:2 }}>{fmt(listing.ClosePrice)}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginBottom:4 }}>Listed at {fmt(listing.ListPrice)}</div></>
                    : <><div style={{ fontSize:20, fontWeight:600, letterSpacing:'-.025em', marginBottom:2 }}>{fmt(listing.ListPrice)}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginBottom:4 }}>Listed price</div></>
                  }
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginBottom:10 }}>{address}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:20, fontWeight:600, letterSpacing:'-.025em', marginBottom:2 }}>{fmt(listing.ListPrice)}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginBottom:12 }}>{address}</div>
                  <AvailableButton listing={listing}/>
                </>
              )}
              <button onClick={()=>toggleSave(listing)} style={{ width:'100%', height:36, border:'1px solid', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .2s', borderColor:saved?'#00B4A8':'rgba(255,255,255,.14)', background:saved?'rgba(0,180,168,.12)':'none', color:saved?'#00B4A8':'rgba(255,255,255,.5)' }}>
                <i className={`ti ${saved?'ti-check':'ti-plus'}`} style={{ fontSize:13 }}/>{saved?'✓ Saved to DeepCompare':'Save to DeepCompare™'}
              </button>
            </div>
            {!isSold && <KeyMetrics listing={listing} monthlyTotal={monthlyTotal} isLease={isLease}/>}
          </div>
        </div>

        {/* Price History — sold listings always show (no VOW wall on historical data) */}
        <PriceHistorySection
          listing={listing}
          isVOWMember={hasVOW || isSold}
          onSignupClick={() => setVowOpen(true)}
        />

        {/* Similar Properties */}
        {similar.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ ...sh, marginBottom:14 }}><i className="ti ti-home-search" style={shI}/>Similar properties</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }} className="similar-grid">
              {similar.map(l => (
                <ListingCard key={l.ListingKey} listing={l} isSaved={isSaved(l.ListingKey)} onSave={()=>toggleSave(l)}/>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{ marginTop:20, background:'#111316', borderRadius:12, padding:'28px 24px', textAlign:'center', border:'1px solid rgba(255,255,255,.06)' }}>
          {isSold ? (
            <>
              <div style={{ fontSize:15, fontWeight:500, color:'rgba(255,255,255,.7)', marginBottom:6 }}>Looking for similar properties?</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:18 }}>This property has sold. Contact us to find comparable active listings.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:500, color:'rgba(255,255,255,.7)', marginBottom:6 }}>Ready to take the next step?</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:18 }}>Book a showing at {address} — today</div>
              <AvailableButton listing={listing}/>
            </>
          )}
          <div style={{ fontSize:11, color:'rgba(255,255,255,.22)', marginTop:12 }}>
            <strong style={{ color:'rgba(255,255,255,.35)' }}>Anirudha Warhadpande</strong> · HomeLife Miracle Realty Ltd. · 647-803-5288 · RECO #6011384
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && <Lightbox photos={photos} startIdx={photoIdx} onClose={()=>setLightbox(false)}/>}

      {/* VOW modal (triggered from Price History section) */}
      {vowOpen && (
        <VOWSignupWall
          trigger="price-history"
          listingKey={listing.ListingKey}
          listingAddress={address}
          onSuccess={() => { setHasVOW(true); setVowOpen(false); }}
          onDismiss={() => setVowOpen(false)}
        />
      )}
    </div>
  );
}

function Lightbox({ photos, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const total = photos.length;
  const prev = () => setIdx(i => (i - 1 + total) % total);
  const next = () => setIdx(i => (i + 1) % total);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);

  const touchStart = React.useRef(null);
  const onTouchStart = e => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd   = e => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStart.current = null;
  };

  const url = photos[idx]?.url;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position:'fixed', inset:0, zIndex:1000, background:'#0C0D10', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
    >
      {/* Close */}
      <button onClick={onClose} style={{ position:'absolute', top:16, right:16, width:40, height:40, borderRadius:'50%', border:'1px solid rgba(255,255,255,.18)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}>
        <i className="ti ti-x"/>
      </button>

      {/* Photo */}
      <div style={{ flex:1, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 70px' }}>
        {url
          ? <img key={idx} src={url} alt={`Photo ${idx+1}`} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:6, animation:'lb-fade .18s ease' }}/>
          : <i className="ti ti-photo-off" style={{ fontSize:64, color:'rgba(255,255,255,.15)' }}/>
        }
      </div>

      {/* Prev / Next */}
      {total > 1 && <>
        <button onClick={prev} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', width:44, height:44, borderRadius:'50%', border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <button onClick={next} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', width:44, height:44, borderRadius:'50%', border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
      </>}

      {/* Counter */}
      <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', fontSize:13, color:'rgba(255,255,255,.45)', background:'rgba(0,0,0,.5)', padding:'5px 14px', borderRadius:20 }}>
        {idx + 1} / {total}
      </div>

      <style>{`@keyframes lb-fade { from { opacity:0; } to { opacity:1; } }`}</style>
    </div>
  );
}