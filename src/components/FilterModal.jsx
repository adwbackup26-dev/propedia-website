// src/components/FilterModal.jsx — bottom-sheet filter modal for Propedia

import React, { useState, useEffect } from 'react';

export const PROP_TYPES = [
  { id: 'res-sale',  label: 'Buy',             sub: 'Residential Sale',   tx: 'For Sale',  pt: 'Residential' },
  { id: 'res-rent',  label: 'Rent',            sub: 'Residential Lease',  tx: 'For Lease', pt: 'Residential' },
  { id: 'com-sale',  label: 'Commercial Sale', sub: 'Commercial Sale',    tx: 'For Sale',  pt: 'Commercial'  },
  { id: 'com-rent',  label: 'Commercial Rent', sub: 'Commercial Lease',   tx: 'For Lease', pt: 'Commercial'  },
];

const BEDS     = [{ v:'', l:'Any' }, { v:'1', l:'1' }, { v:'2', l:'2' }, { v:'3', l:'3' }, { v:'4', l:'4+' }];
const BATHS    = [{ v:'', l:'Any' }, { v:'1', l:'1' }, { v:'2', l:'2' }, { v:'3', l:'3+' }];
const PARKING  = [{ v:'', l:'Any' }, { v:'0', l:'0' }, { v:'1', l:'1' }, { v:'2', l:'2' }, { v:'3', l:'3+' }];
export const STRUCTURES = ['Freehold', 'Detached', 'Semi-Detached', 'Townhouse', 'Condo'];

export const DEFAULT_MODAL = {
  propType:   'res-sale',
  minPrice:   '',
  maxPrice:   '',
  beds:       '',
  baths:      '',
  parking:    '',
  structures: [],
};

// ── style tokens ──────────────────────────────────────────────────────────────
const chip = active => ({
  height: 38, padding: '0 16px', borderRadius: 8,
  border: `1.5px solid ${active ? '#00B4A8' : 'rgba(255,255,255,.14)'}`,
  background: active ? '#00B4A8' : 'rgba(255,255,255,.06)',
  color: active ? '#fff' : 'rgba(255,255,255,.7)',
  fontSize: 13, fontWeight: active ? 600 : 400,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
  whiteSpace: 'nowrap',
});

const lbl = {
  fontSize: 11, fontWeight: 600, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,.4)',
  marginBottom: 12, display: 'block',
};

const inp = {
  height: 44, background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.14)', borderRadius: 8,
  padding: '0 12px', fontSize: 16, color: '#fff',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  width: '100%',
};

// ── component ─────────────────────────────────────────────────────────────────
export default function FilterModal({ isOpen, onClose, onApply, initialValues }) {
  const [local, setLocal] = useState(DEFAULT_MODAL);

  useEffect(() => {
    if (isOpen) setLocal(initialValues ?? DEFAULT_MODAL);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const set = patch => setLocal(p => ({ ...p, ...patch }));

  const isRent      = local.propType === 'res-rent' || local.propType === 'com-rent';
  const showStructure = !isRent;

  const toggleStructure = s =>
    set({ structures: local.structures.includes(s)
      ? local.structures.filter(x => x !== s)
      : [...local.structures, s] });

  const handleApply = () => { onApply(local); onClose(); };
  const handleClear = () => setLocal(DEFAULT_MODAL);

  // active filter count for footer hint
  const activeCount = [
    local.propType !== 'res-sale',
    !!local.minPrice,
    !!local.maxPrice,
    !!local.beds,
    !!local.baths,
    !!local.parking,
    local.structures.length > 0,
  ].filter(Boolean).length;

  return (
    <>
      {/* ── Overlay ──────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:1000 }}
      />

      {/* ── Sheet ────────────────────────────────────────────────────────── */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:1001,
        background:'#161719', borderRadius:'16px 16px 0 0',
        border:'1px solid rgba(0,180,168,.2)', borderBottom:'none',
        maxHeight:'90vh', display:'flex', flexDirection:'column',
        fontFamily:'DM Sans, sans-serif',
      }}>

        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'18px 20px 14px', borderBottom:'1px solid rgba(255,255,255,.08)',
          flexShrink:0,
        }}>
          <span style={{ fontSize:16, fontWeight:700, color:'#fff' }}>Filters</span>
          <button
            onClick={onClose}
            aria-label="Close filters"
            style={{
              width:32, height:32, borderRadius:'50%',
              border:'1px solid rgba(255,255,255,.14)', background:'rgba(255,255,255,.06)',
              color:'rgba(255,255,255,.7)', fontSize:20, lineHeight:1,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'inherit',
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY:'auto', padding:'20px 20px 8px', flex:1, WebkitOverflowScrolling:'touch' }}>

          {/* ── Property Type ─────────────────────────────────────────── */}
          <section style={{ marginBottom:28 }}>
            <span style={lbl}>Property Type</span>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {PROP_TYPES.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => set({ propType: pt.id, structures: [] })}
                  style={chip(local.propType === pt.id)}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Price Range ───────────────────────────────────────────── */}
          <section style={{ marginBottom:28 }}>
            <span style={lbl}>Price Range</span>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1, position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.35)', fontSize:13, pointerEvents:'none' }}>$</span>
                <input
                  type="number" placeholder="Min" value={local.minPrice}
                  onChange={e => set({ minPrice: e.target.value })}
                  style={{ ...inp, paddingLeft:26 }}
                />
              </div>
              <div style={{ flex:1, position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.35)', fontSize:13, pointerEvents:'none' }}>$</span>
                <input
                  type="number" placeholder="Max" value={local.maxPrice}
                  onChange={e => set({ maxPrice: e.target.value })}
                  style={{ ...inp, paddingLeft:26 }}
                />
              </div>
            </div>
          </section>

          {/* ── Bedrooms ──────────────────────────────────────────────── */}
          <section style={{ marginBottom:28 }}>
            <span style={lbl}>Bedrooms</span>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {BEDS.map(b => (
                <button key={b.v} onClick={() => set({ beds: b.v })} style={chip(local.beds === b.v)}>{b.l}</button>
              ))}
            </div>
          </section>

          {/* ── Bathrooms ─────────────────────────────────────────────── */}
          <section style={{ marginBottom:28 }}>
            <span style={lbl}>Bathrooms</span>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {BATHS.map(b => (
                <button key={b.v} onClick={() => set({ baths: b.v })} style={chip(local.baths === b.v)}>{b.l}</button>
              ))}
            </div>
          </section>

          {/* ── Parking ───────────────────────────────────────────────── */}
          <section style={{ marginBottom:28 }}>
            <span style={lbl}>Parking Spaces</span>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PARKING.map(p => (
                <button key={p.v} onClick={() => set({ parking: p.v })} style={chip(local.parking === p.v)}>{p.l}</button>
              ))}
            </div>
            <p style={{ margin:'8px 0 0', fontSize:11, color:'rgba(255,255,255,.25)' }}>
              Not all listings include parking data
            </p>
          </section>

          {/* ── Property Structure (sales only) ───────────────────────── */}
          {showStructure && (
            <section style={{ marginBottom:28 }}>
              <span style={lbl}>Property Structure</span>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {STRUCTURES.map(s => {
                  const checked = local.structures.includes(s);
                  return (
                    <label
                      key={s}
                      onClick={() => toggleStructure(s)}
                      style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', userSelect:'none' }}
                    >
                      <div style={{
                        width:20, height:20, borderRadius:5, flexShrink:0,
                        border:`2px solid ${checked ? '#00B4A8' : 'rgba(255,255,255,.25)'}`,
                        background: checked ? '#00B4A8' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all .12s',
                      }}>
                        {checked && (
                          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                            <path d="M1 4.5l3.5 3L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize:14, color:'rgba(255,255,255,.85)' }}>{s}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display:'flex', gap:10, padding:'14px 20px',
          borderTop:'1px solid rgba(255,255,255,.08)', flexShrink:0,
          paddingBottom:'max(14px, env(safe-area-inset-bottom))',
        }}>
          <button
            onClick={handleClear}
            style={{
              flex:1, height:48, borderRadius:10,
              border:'1px solid rgba(255,255,255,.14)', background:'transparent',
              color:'rgba(255,255,255,.6)', fontSize:14, fontWeight:500,
              cursor:'pointer', fontFamily:'inherit',
            }}
          >
            Clear all
          </button>
          <button
            onClick={handleApply}
            style={{
              flex:2, height:48, borderRadius:10,
              border:'none', background:'#00B4A8',
              color:'#fff', fontSize:14, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit',
            }}
          >
            {activeCount > 0 ? `Apply (${activeCount})` : 'Apply filters'}
          </button>
        </div>
      </div>
    </>
  );
}
