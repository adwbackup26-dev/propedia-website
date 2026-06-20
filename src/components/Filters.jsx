// src/components/Filters.jsx — dropdown filter panel below the nav

import React from 'react';

const BEDS  = ['Any','1','2','3','4+'];
const BATHS = ['Any','1','2','3+'];
const TYPES = [
  { value:'', label:'All types' },
  { value:'Detached',          label:'Detached' },
  { value:'Semi-Detached',     label:'Semi-Detached' },
  { value:'Att/Row/Twnhouse',  label:'Townhouse' },
  { value:'Condo Apt',         label:'Condo' },
  { value:'Multiplex',         label:'Multiplex' },
];
const SORTS = [
  { value:'ModificationTimestamp_desc', label:'Newest listed' },
  { value:'ListPrice_asc',             label:'Price: low → high' },
  { value:'ListPrice_desc',            label:'Price: high → low' },
  { value:'BedroomsTotal_desc',        label:'Most bedrooms' },
  { value:'BathroomsTotalInteger_desc',label:'Most bathrooms' },
  { value:'LivingArea_desc',           label:'Most sq ft' },
  { value:'DaysOnMarket_desc',         label:'Longest on market' },
];

export default function Filters({ filters, setFilters, applyFilters, resetFilters, isCommercial = false }) {
  const isLease = filters.transactionType === 'For Lease';
  const currentSort = `${filters.sortBy}_${filters.sortDir}`;
  const setBeds  = v => setFilters({ minBeds: v });
  const setBaths = v => setFilters({ minBaths: v });
  const handleSort = e => {
    const parts = e.target.value.split('_');
    const sortDir = parts.pop();
    setFilters({ sortBy: parts.join('_'), sortDir });
  };
  const handleKey = e => { if (e.key === 'Enter') applyFilters(); };

  return (
    <div className="filter-panel">
      {/* Buy / Rent */}
      <div className="fp-tx">
        {['For Sale','For Lease'].map(t => (
          <button key={t} className={`fp-tx-btn${filters.transactionType===t?' active':''}`}
            onClick={() => setFilters({ transactionType: t })}>
            {t === 'For Sale' ? 'Buy' : 'Rent'}
          </button>
        ))}
      </div>

      <div className="fp-sep"/>

      {/* Price range */}
      <span className="fp-label">Price</span>
      <input className="fp-input" type="number" placeholder={isLease?'Min $/mo':'Min $'}
        value={filters.minPrice} onChange={e => setFilters({ minPrice: e.target.value })} onKeyDown={handleKey}/>
      <span style={{fontSize:11,color:'var(--text-4)'}}>–</span>
      <input className="fp-input" type="number" placeholder={isLease?'Max $/mo':'Max $'}
        value={filters.maxPrice} onChange={e => setFilters({ maxPrice: e.target.value })} onKeyDown={handleKey}/>

      <div className="fp-sep"/>

      {/* Beds — hidden for commercial */}
      {!isCommercial && <>
        <span className="fp-label">Beds</span>
        {BEDS.map(b => { const v = b==='Any'?'':b.replace('+',''); return (
          <button key={b} className={`fp-pill${filters.minBeds===v?' active':''}`} onClick={() => setBeds(v)}>{b}</button>
        );})}
        <div className="fp-sep"/>
        <span className="fp-label">Baths</span>
        {BATHS.map(b => { const v = b==='Any'?'':b.replace('+',''); return (
          <button key={b} className={`fp-pill${filters.minBaths===v?' active':''}`} onClick={() => setBaths(v)}>{b}</button>
        );})}
        <div className="fp-sep"/>
      </>}

      {/* Type */}
      <select className="fp-select" value={filters.propertySubType||''}
        onChange={e => setFilters({ propertySubType: e.target.value })}>
        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <div className="fp-sep"/>

      {/* Sort */}
      <span className="fp-label">Sort</span>
      <select className="fp-select" value={currentSort} onChange={handleSort}>
        {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <button className="fp-apply" onClick={applyFilters}>Apply</button>
      <button className="fp-reset" onClick={resetFilters}>Clear all</button>
    </div>
  );
}
