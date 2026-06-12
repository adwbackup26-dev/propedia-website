// src/components/CompareBar.jsx — dark floating compare bar (Phase 3 prep)

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../utils/format.js';

export default function CompareBar({ saved, onRemove, onClear }) {
  const navigate = useNavigate();
  const isVisible = saved.length >= 1;
  const canCompare = saved.length >= 2;

  const handleCompare = () => {
    if (!canCompare) return;
    navigate(`/compare?keys=${saved.map(l => l.ListingKey).join(',')}`);
  };

  const getPhoto = l => {
    const media = (l.Media || []).sort((a,b) => (a.Order??999)-(b.Order??999));
    return media[0]?.MediaURL || null;
  };

  return (
    <div className={`compare-bar${isVisible ? ' visible' : ''}`} role="complementary" aria-label="Compare properties" aria-live="polite">
      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-4)', letterSpacing:'.08em', textTransform:'uppercase', flexShrink:0 }}>
        Compare {saved.length}/5
      </span>

      <div style={{ display:'flex', gap:8, flex:1, overflow:'hidden' }}>
        {saved.map(l => {
          const photo = getPhoto(l);
          const addr = l.UnparsedAddress || `${l.StreetNumber} ${l.StreetName}`;
          return (
            <div key={l.ListingKey} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:7, padding:'5px 9px', flexShrink:0 }}>
              {photo
                ? <img src={photo} alt={addr} style={{ width:34, height:26, objectFit:'cover', borderRadius:3 }} loading="lazy"/>
                : <div style={{ width:34, height:26, background:'var(--bg-hover)', borderRadius:3, display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-home" style={{ fontSize:12, color:'var(--text-4)' }} aria-hidden="true"/></div>
              }
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:500, color:'#fff' }}>{formatPrice(l.ListPrice)}</div>
                <div style={{ fontSize:10, color:'var(--text-4)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:100 }}>{l.City}</div>
              </div>
              <button onClick={() => onRemove(l)} style={{ background:'none', border:'none', color:'var(--text-4)', fontSize:16, lineHeight:1, padding:'0 3px', cursor:'pointer' }} aria-label={`Remove ${addr}`}>×</button>
            </div>
          );
        })}
      </div>

      {saved.length > 0 && (
        <button onClick={onClear} style={{ fontSize:11, color:'var(--text-4)', flexShrink:0, transition:'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-2)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>
          Clear all
        </button>
      )}

      {/* DeepCompare — Phase 3 activates here */}
      <button className="compare-bar__btn" onClick={handleCompare} disabled={!canCompare}
        title={canCompare ? 'AI-powered comparison' : `Add ${2 - saved.length} more`}>
        {canCompare ? `DeepCompare (${saved.length})` : `Add ${2 - saved.length} more →`}
      </button>
    </div>
  );
}
