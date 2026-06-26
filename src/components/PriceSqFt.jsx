import React, { useState, useEffect } from 'react';

const card = { background:'#161719', borderRadius:10, border:'1px solid rgba(255,255,255,.06)', padding:'15px 17px', marginBottom:11 };
const sh   = { fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.28)', marginBottom:13, paddingBottom:9, borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', gap:7 };
const shI  = { fontSize:13, color:'#00B4A8' };

function parseSqftMid(range) {
  if (!range) return null;
  const m = String(range).match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)/);
  if (m) return (parseInt(m[1].replace(/,/g,'')) + parseInt(m[2].replace(/,/g,''))) / 2;
  const n = parseInt(String(range).replace(/,/g,''));
  return isNaN(n) ? null : n;
}

export default function PriceSqFt({ listing }) {
  const [comps, setComps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('this'); // 'this' | 'comps'

  const sqft        = parseSqftMid(listing.LivingAreaRange);
  const price       = listing.ListPrice || listing.ClosePrice;
  const thisPsf     = sqft && price ? Math.round(price / sqft) : null;

  useEffect(() => {
    const postal = listing.PostalCode;
    if (!postal) { setLoading(false); return; }
    const prefix = postal.replace(/\s/g,'').slice(0, 3);
    fetch(`/api/listings?page=1&limit=20&transactionType=For+Sale&postalCode=${encodeURIComponent(prefix)}`)
      .then(r => r.json())
      .then(d => {
        const withData = (d.listings || []).filter(
          l => l.LivingAreaRange && (l.ListPrice || l.ClosePrice) && l.ListingKey !== listing.ListingKey
        );
        setComps(withData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [listing.PostalCode, listing.ListingKey]);

  const compPsf = comps.map(l => {
    const s = parseSqftMid(l.LivingAreaRange);
    const p = l.ListPrice || l.ClosePrice;
    return s && p ? Math.round(p / s) : null;
  }).filter(Boolean);

  const areaAvg = compPsf.length > 0
    ? Math.round(compPsf.reduce((a, b) => a + b, 0) / compPsf.length)
    : null;

  const diff    = thisPsf && areaAvg ? thisPsf - areaAvg : null;
  const diffPct = diff && areaAvg    ? Math.round(diff / areaAvg * 100) : null;

  const barMax  = Math.max(thisPsf || 0, areaAvg || 0, 1);

  if (!thisPsf) {
    return (
      <div style={card}>
        <div style={sh}><i className="ti ti-ruler-measure" style={shI}/>Price per sq ft</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', textAlign:'center', padding:'18px 0' }}>Square footage not reported for this listing.</div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={sh}><i className="ti ti-ruler-measure" style={shI}/>Price per sq ft</div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['this','This property'],['comps','Comparables']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ height:28, padding:'0 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', border:`1.5px solid ${tab===key?'#00B4A8':'rgba(255,255,255,.13)'}`, background:tab===key?'rgba(0,180,168,.12)':'transparent', color:tab===key?'#00B4A8':'rgba(255,255,255,.4)', transition:'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'this' && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            <div style={{ flex:1, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'13px', border:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.3)', marginBottom:5 }}>This listing</div>
              <div style={{ fontSize:22, fontWeight:600, color:'#00B4A8', marginBottom:2 }}>${thisPsf.toLocaleString()}<span style={{ fontSize:12, fontWeight:400, color:'rgba(255,255,255,.35)' }}>/sqft</span></div>
              {sqft && <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>~{Math.round(sqft).toLocaleString()} sq ft (est.)</div>}
            </div>
            {areaAvg && (
              <div style={{ flex:1, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'13px', border:'1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.08em', color:'rgba(255,255,255,.3)', marginBottom:5 }}>Area avg ({loading?'…':compPsf.length} listings)</div>
                <div style={{ fontSize:22, fontWeight:600, color:'rgba(255,255,255,.75)', marginBottom:2 }}>${areaAvg.toLocaleString()}<span style={{ fontSize:12, fontWeight:400, color:'rgba(255,255,255,.35)' }}>/sqft</span></div>
                {diffPct !== null && (
                  <div style={{ fontSize:11, color: diff > 0 ? '#F59E0B' : '#34D399', fontWeight:500 }}>
                    {diff > 0 ? `+${diffPct}% vs area` : `${diffPct}% vs area`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visual bar comparison */}
          {areaAvg && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { label:'This listing', value:thisPsf, color:'#00B4A8' },
                { label:'Area average', value:areaAvg, color:'rgba(255,255,255,.25)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ width:90, fontSize:11, color:'rgba(255,255,255,.45)', flexShrink:0 }}>{label}</span>
                  <div style={{ flex:1, height:6, background:'rgba(255,255,255,.07)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.round(value/barMax*100)}%`, background:color, borderRadius:3, transition:'width .4s' }}/>
                  </div>
                  <span style={{ width:70, textAlign:'right', fontSize:11, fontWeight:600, color, flexShrink:0 }}>${value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'comps' && (
        <div>
          {loading ? (
            <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', padding:'14px 0' }}>Loading area listings…</div>
          ) : comps.length === 0 ? (
            <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', padding:'14px 0' }}>No nearby listings with size data found.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {comps.slice(0,8).map(l => {
                const s = parseSqftMid(l.LivingAreaRange);
                const p = l.ListPrice || l.ClosePrice;
                const psf = s && p ? Math.round(p / s) : null;
                if (!psf) return null;
                return (
                  <div key={l.ListingKey} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'rgba(255,255,255,.03)', borderRadius:7 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.7)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {[l.StreetNumber, l.StreetName].filter(Boolean).join(' ') || l.City}
                      </div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{l.LivingAreaRange} sqft · {l.BedroomsTotal}bd</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,.8)' }}>${psf.toLocaleString()}/sf</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>${Math.round(p/1000)}k</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:10 }}>Area comparables are active listings in the same postal code. $/sqft uses LivingAreaRange midpoint. Estimates only.</p>
    </div>
  );
}
