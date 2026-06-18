// src/pages/ListingDetailPage.jsx — Propedia full intelligence detail page v3

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AvailableButton from '../components/AvailableButton.jsx';
import { useCompare } from '../hooks/useListings.js';
import { formatPrice, formatAddress, formatCityLine, propertyTypeLabel, estimateMortgage } from '../utils/format.js';
import '../styles/listings.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || null;

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
            <div style={{ fontSize:9,