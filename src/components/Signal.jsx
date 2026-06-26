import React, { useState, useEffect } from 'react';

const card = { background:'#161719', borderRadius:10, border:'1px solid rgba(255,255,255,.06)', padding:'15px 17px', marginBottom:11 };
const sh   = { fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:13, paddingBottom:9, borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', gap:7 };
const shI  = { fontSize:13, color:'#00B4A8' };

function parseSqft(range) {
  if (!range) return null;
  const m = range.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)/);
  if (m) return (parseInt(m[1].replace(/,/g,'')) + parseInt(m[2].replace(/,/g,''))) / 2;
  const n = parseInt(String(range).replace(/,/g,''));
  return isNaN(n) ? null : n;
}

function calcDOM(listing) {
  if (listing.DaysOnMarket > 0) return listing.DaysOnMarket;
  if (listing.OriginalEntryTimestamp) {
    return Math.max(0, Math.floor((Date.now() - new Date(listing.OriginalEntryTimestamp).getTime()) / 86400000));
  }
  return 0;
}

function computeSignals(listing, areaCount) {
  const isSold = listing.StandardStatus === 'Closed';
  const dom    = calcDOM(listing);
  const signals = [];

  // 1 — Market timing
  let timing;
  if (isSold) {
    if (dom < 7)       timing = { icon:'🔥', label:'Sold in a week',      sub:`DOM: ${dom} day${dom===1?'':'s'}`,  color:'#F87171' };
    else if (dom < 15) timing = { icon:'⚡', label:'Fast sale',            sub:`Sold in ${dom} days`,               color:'#F59E0B' };
    else if (dom < 30) timing = { icon:'📈', label:'Normal pace',          sub:`${dom} days on market`,             color:'#34D399' };
    else if (dom < 60) timing = { icon:'⏱️', label:'Extended market time', sub:`${dom} days on market`,             color:'rgba(255,255,255,.55)' };
    else               timing = { icon:'📉', label:'Long-listed',          sub:`${dom} days on market`,             color:'rgba(255,255,255,.35)' };
  } else {
    if (dom === 0)     timing = { icon:'🆕', label:'Just listed',          sub:'Listed today',                      color:'#34D399' };
    else if (dom < 7)  timing = { icon:'⚡', label:'Fresh listing',         sub:`${dom} day${dom===1?'':'s'} old`,  color:'#34D399' };
    else if (dom < 21) timing = { icon:'📈', label:'Active listing',        sub:`${dom} days on market`,            color:'rgba(255,255,255,.55)' };
    else if (dom < 45) timing = { icon:'⏱️', label:'Sitting a while',      sub:`${dom} days — room to negotiate`,   color:'#F59E0B' };
    else               timing = { icon:'📉', label:'Long-listed',           sub:`${dom} days — motivated seller`,   color:'#F87171' };
  }
  signals.push(timing);

  // 2 — Price positioning
  if (isSold && listing.ClosePrice && listing.ListPrice) {
    const pct = (listing.ClosePrice - listing.ListPrice) / listing.ListPrice * 100;
    let price;
    if (pct > 5)        price = { icon:'🏆', label:'Bidding war',       sub:`Sold ${pct.toFixed(1)}% over ask`,   color:'#F87171' };
    else if (pct > 0.5) price = { icon:'📈', label:'Sold over ask',     sub:`+${pct.toFixed(1)}% on list price`,  color:'#F59E0B' };
    else if (pct > -2)  price = { icon:'✅', label:'At asking',          sub:'Sold near list price',               color:'#34D399' };
    else if (pct > -6)  price = { icon:'💰', label:'Below asking',       sub:`${Math.abs(pct).toFixed(1)}% off`,  color:'rgba(255,255,255,.55)' };
    else                price = { icon:'🔻', label:'Heavy discount',     sub:`${Math.abs(pct).toFixed(1)}% off`,  color:'#60A5FA' };
    signals.push(price);
  } else if (!isSold && listing.OriginalListPrice && listing.OriginalListPrice > listing.ListPrice) {
    const reduction = listing.OriginalListPrice - listing.ListPrice;
    const pct = Math.round(reduction / listing.OriginalListPrice * 100);
    signals.push({ icon:'💰', label:'Price reduced', sub:`Down ${pct}% from original ask`, color:'#F59E0B' });
  }

  // 3 — Area competitiveness (from API fetch result)
  if (areaCount !== null) {
    let area;
    if (areaCount > 50)       area = { icon:'📊', label:'Competitive area',   sub:`${areaCount}+ active listings nearby`,  color:'#60A5FA' };
    else if (areaCount > 20)  area = { icon:'⚖️', label:'Balanced market',    sub:`${areaCount} listings in area`,          color:'rgba(255,255,255,.55)' };
    else if (areaCount > 5)   area = { icon:'🎯', label:'Low supply area',     sub:`Only ${areaCount} listings nearby`,      color:'#34D399' };
    else                      area = { icon:'🏆', label:'Very limited supply', sub:'Few comparable listings',               color:'#00B4A8' };
    signals.push(area);
  }

  // 4 — Property age
  if (listing.YearBuilt) {
    const age = new Date().getFullYear() - listing.YearBuilt;
    let ageSignal;
    if (age <= 5)        ageSignal = { icon:'✨', label:'Near-new build',   sub:`Built ${listing.YearBuilt}`,   color:'#34D399' };
    else if (age <= 15)  ageSignal = { icon:'🏗️', label:'Modern property',  sub:`Built ${listing.YearBuilt}`,   color:'rgba(255,255,255,.55)' };
    else if (age <= 40)  ageSignal = { icon:'🏠', label:'Established home',  sub:`Built ${listing.YearBuilt}`,   color:'rgba(255,255,255,.35)' };
    else                 ageSignal = { icon:'🏛️', label:'Heritage-era',       sub:`Built ${listing.YearBuilt}`,   color:'rgba(255,255,255,.25)' };
    if (signals.length < 3) signals.push(ageSignal);
  }

  return signals.slice(0, 3);
}

export default function Signal({ listing }) {
  const [areaCount, setAreaCount] = useState(null);

  useEffect(() => {
    const postal = listing.PostalCode;
    if (!postal) return;
    const prefix = postal.replace(/\s/g,'').slice(0, 3);
    fetch(`/api/listings?page=1&limit=1&transactionType=For+Sale&postalCode=${encodeURIComponent(prefix)}`)
      .then(r => r.json())
      .then(d => setAreaCount(typeof d.total === 'number' ? d.total : null))
      .catch(() => {});
  }, [listing.PostalCode]);

  const signals = computeSignals(listing, areaCount);

  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-bolt" style={shI}/>Market signal</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {signals.map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'rgba(255,255,255,.03)', borderRadius:8, border:'1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize:22, flexShrink:0, width:32, textAlign:'center' }}>{s.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:s.color, marginBottom:2 }}>{s.label}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
