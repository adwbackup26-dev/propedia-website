// src/pages/ListingsPage.jsx — Propedia marketplace homepage
// Dark theme · slim nav · filter modal · 2-column grid · photo carousel cards

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FilterModal, { PROP_TYPES, DEFAULT_MODAL } from '../components/FilterModal.jsx';
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard.jsx';
import CompareBar from '../components/CompareBar.jsx';
import VOWSignupWall from '../components/VOWSignupWall.jsx';
import { useListings, useCompare, getVOWSession, getUserPrefs } from '../hooks/useListings.js';
import '../styles/listings.css';

// ── Icons ────────────────────────────────────────────────────────────────────
const SearchIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>;
const GridIcon   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="7" height="7" rx="1.5"/><rect x="9" y="0" width="7" height="7" rx="1.5"/><rect x="0" y="9" width="7" height="7" rx="1.5"/><rect x="9" y="9" width="7" height="7" rx="1.5"/></svg>;
const ListIcon   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="16" height="2.5" rx="1.25"/><rect x="0" y="6.75" width="16" height="2.5" rx="1.25"/><rect x="0" y="12.5" width="16" height="2.5" rx="1.25"/></svg>;

// ── Autocomplete data ─────────────────────────────────────────────────────────
const AC_CITIES = [
  'Toronto','Mississauga','Brampton','Oakville','Burlington','Vaughan','Markham',
  'Richmond Hill','Ajax','Pickering','Milton','Whitby','Oshawa','Halton Hills',
  'Caledon','Aurora','Newmarket','King','Georgina','Innisfil','Barrie',
  'Collingwood','Guelph','Hamilton','Kitchener','Waterloo','Cambridge',
];
const AC_HOODS = [
  'Etobicoke','Scarborough','North York','East York','York','Downtown Toronto',
  'Midtown Toronto','The Beaches','Leslieville','Riverdale','Roncesvalles',
  'Junction','Bloor West Village','Lawrence Park','Forest Hill','Rosedale',
  'Moore Park','Leaside','Don Mills','Agincourt','Malvern','Rouge','Woburn',
  'Port Credit','Streetsville','Meadowvale','Erin Mills','Cooksville',
  'Clarkson','Lakeview','Applewood','Malton',
];
const AC_ALL = [
  ...AC_CITIES.map(v => ({ label: v, type: 'city' })),
  ...AC_HOODS.map(v => ({ label: v, type: 'hood' })),
];
function getSuggestions(q) {
  if (!q || q.length < 2) return [];
  const lq = q.toLowerCase();
  return AC_ALL.filter(s => s.label.toLowerCase().includes(lq)).slice(0, 6);
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, pages, onPageChange }) {
  if (pages <= 1) return null;
  const nums = [];
  if (pages <= 7) { for (let i = 1; i <= pages; i++) nums.push(i); }
  else {
    nums.push(1);
    if (page > 3) nums.push('…');
    for (let i = Math.max(2, page-1); i <= Math.min(pages-1, page+1); i++) nums.push(i);
    if (page < pages-2) nums.push('…');
    nums.push(pages);
  }
  return (
    <nav className="pagination" aria-label="Listings pagination">
      <button className="pagination__btn" onClick={() => onPageChange(page-1)} disabled={page===1} aria-label="Previous">‹</button>
      {nums.map((p,i) => p === '…'
        ? <span key={`e${i}`} className="pagination__ellipsis">…</span>
        : <button key={p} className={`pagination__btn${p===page?' active':''}`} onClick={() => onPageChange(p)} aria-current={p===page?'page':undefined}>{p}</button>)}
      <button className="pagination__btn" onClick={() => onPageChange(page+1)} disabled={page===pages} aria-label="Next">›</button>
    </nav>
  );
}

// ── URL ↔ modal state helpers ─────────────────────────────────────────────────
function modalToURL(m) {
  const sp = new URLSearchParams();
  if (m.propType   !== 'res-sale') sp.set('pt',       m.propType);
  if (m.minPrice)                  sp.set('minPrice',  m.minPrice);
  if (m.maxPrice)                  sp.set('maxPrice',  m.maxPrice);
  if (m.beds)                      sp.set('beds',      m.beds);
  if (m.baths)                     sp.set('baths',     m.baths);
  if (m.parking)                   sp.set('parking',   m.parking);
  if (m.structures.length)         sp.set('st',        m.structures.join(','));
  return sp.toString();
}

function urlToModal() {
  const sp = new URLSearchParams(window.location.search);
  const stRaw = sp.get('st') || '';
  return {
    propType:   sp.get('pt')       || 'res-sale',
    minPrice:   sp.get('minPrice') || '',
    maxPrice:   sp.get('maxPrice') || '',
    beds:       sp.get('beds')     || '',
    baths:      sp.get('baths')    || '',
    parking:    sp.get('parking')  || '',
    structures: stRaw ? stRaw.split(',').filter(Boolean) : [],
  };
}

// ── active filter count for Filters button badge ──────────────────────────────
function countActive(m) {
  return [
    m.propType !== 'res-sale',
    !!m.minPrice, !!m.maxPrice,
    !!m.beds, !!m.baths, !!m.parking,
    m.structures.length > 0,
  ].filter(Boolean).length;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const { listings, total, pages, page, filters, loading, error,
          applyWith, resetFilters, goToPage } = useListings();
  const { saved, toggleSave, isSaved, clearAll } = useCompare();
  const navigate = useNavigate();

  const [modalOpen,  setModalOpen]  = useState(false);
  const [viewMode,   setViewMode]   = useState('grid');
  const [vowOpen,    setVowOpen]    = useState(false);
  const [hasVOW,     setHasVOW]     = useState(() => getVOWSession());
  const [userPrefs,  setUserPrefs]  = useState(() => getUserPrefs());
  const [search,     setSearch]     = useState('');
  const [acOpen,     setAcOpen]     = useState(false);
  const [acIdx,      setAcIdx]      = useState(-1);

  // modal state mirrors what's currently applied (for pre-populating on re-open)
  const [modalValues, setModalValues] = useState(() => urlToModal());

  const searchWrapRef = useRef(null);
  const suggestions   = getSuggestions(search);

  // On mount: apply any filters encoded in the URL
  useEffect(() => {
    const m = urlToModal();
    const pt = PROP_TYPES.find(p => p.id === m.propType) || PROP_TYPES[0];
    applyWith({
      transactionType: pt.tx,
      propertyType:    pt.pt,
      minPrice:        m.minPrice,
      maxPrice:        m.maxPrice,
      minBeds:         m.beds,
      minBaths:        m.baths,
      minParking:      m.parking,
      structures:      m.structures.join(','),
    });
    setModalValues(m);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commitSuggestion = useCallback(s => {
    setSearch(s.label); setAcOpen(false); setAcIdx(-1);
    if (s.type === 'city') applyWith({ city: s.label, search: '' });
    else                   applyWith({ search: s.label, city: '' });
  }, [applyWith]);

  const handleSearch = e => { e.preventDefault(); setAcOpen(false); applyWith({ search, city: '' }); };

  const handleSearchKey = e => {
    if (!acOpen || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(i => Math.min(i+1, suggestions.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(i => Math.max(i-1, -1)); }
    else if (e.key === 'Enter' && acIdx >= 0) { e.preventDefault(); commitSuggestion(suggestions[acIdx]); }
    else if (e.key === 'Escape') { setAcOpen(false); setAcIdx(-1); }
  };

  useEffect(() => {
    const h = e => { if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setAcOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleVOWSuccess = () => { setHasVOW(true); setUserPrefs(getUserPrefs()); setVowOpen(false); };

  // ── Apply filters from modal ────────────────────────────────────────────────
  const handleApplyFilters = useCallback(m => {
    const pt = PROP_TYPES.find(p => p.id === m.propType) || PROP_TYPES[0];
    applyWith({
      transactionType: pt.tx,
      propertyType:    pt.pt,
      minPrice:        m.minPrice,
      maxPrice:        m.maxPrice,
      minBeds:         m.beds,
      minBaths:        m.baths,
      minParking:      m.parking,
      structures:      m.structures.join(','),
      propertySubType: '',   // structures supersedes legacy propertySubType
    });
    setModalValues(m);
    // sync URL for shareable links
    const qs = modalToURL(m);
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [applyWith]);

  const handleReset = useCallback(() => {
    resetFilters();
    setModalValues(DEFAULT_MODAL);
    window.history.replaceState(null, '', window.location.pathname);
  }, [resetFilters]);

  const isLease   = filters.transactionType === 'For Lease';
  const activeCount = countActive(modalValues);

  return (
    <>
      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <header className="mp-nav" role="banner">
        <Link to="/" className="mp-nav__logo">Propedia</Link>

        <div ref={searchWrapRef} style={{ position:'relative', flex:1, minWidth:0 }}>
          <form className="mp-nav__search" onSubmit={handleSearch} role="search">
            <span className="mp-nav__search-icon" aria-hidden="true"><SearchIcon /></span>
            <input
              type="search"
              placeholder="City, address, or postal code…"
              value={search}
              onChange={e => { setSearch(e.target.value); setAcOpen(true); setAcIdx(-1); }}
              onKeyDown={handleSearchKey}
              onFocus={() => search.length >= 2 && setAcOpen(true)}
              aria-label="Search listings"
              aria-autocomplete="list"
              aria-expanded={acOpen && suggestions.length > 0}
              autoComplete="off"
            />
            <button type="submit" className="mp-nav__search-btn">Search</button>
          </form>

          {/* Autocomplete dropdown */}
          {acOpen && search.length >= 2 && (
            <div style={{
              position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:500,
              background:'#161719', border:'1px solid rgba(255,255,255,.12)', borderRadius:8,
              boxShadow:'0 8px 24px rgba(0,0,0,.5)', overflow:'hidden',
            }}>
              {suggestions.length === 0 ? (
                <div style={{ padding:'10px 14px', fontSize:12, color:'rgba(255,255,255,.3)' }}>No suggestions</div>
              ) : suggestions.map((s, i) => (
                <div
                  key={s.label}
                  onMouseDown={e => { e.preventDefault(); commitSuggestion(s); }}
                  onMouseEnter={() => setAcIdx(i)}
                  style={{
                    padding:'9px 14px', fontSize:12, cursor:'pointer', display:'flex',
                    alignItems:'center', gap:8,
                    background: i === acIdx ? 'rgba(0,180,168,.12)' : 'transparent',
                    color: i === acIdx ? '#00B4A8' : 'rgba(255,255,255,.75)',
                    borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                  }}
                >
                  <i className={`ti ${s.type === 'city' ? 'ti-building-community' : 'ti-map-pin'}`}
                     style={{ fontSize:11, color: i === acIdx ? '#00B4A8' : 'rgba(255,255,255,.3)', flexShrink:0 }}/>
                  <span>{s.label}</span>
                  <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,.25)' }}>
                    {s.type === 'city' ? 'City' : 'Neighbourhood'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters button */}
        <button
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
          style={{
            display:'flex', alignItems:'center', gap:6,
            height:36, padding:'0 14px', borderRadius:8,
            border:`1.5px solid ${activeCount > 0 ? '#00B4A8' : 'rgba(255,255,255,.18)'}`,
            background: activeCount > 0 ? 'rgba(0,180,168,.15)' : 'rgba(255,255,255,.05)',
            color: activeCount > 0 ? '#00B4A8' : 'rgba(255,255,255,.7)',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            whiteSpace:'nowrap', flexShrink:0,
          }}
        >
          <i className="ti ti-adjustments-horizontal" style={{ fontSize:14 }} aria-hidden="true"/>
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>

        <div className="mp-nav__right">
          {!hasVOW
            ? <button className="mp-nav__signup" onClick={() => setVowOpen(true)}>Sign up free</button>
            : <span className="mp-nav__vow"><i className="ti ti-circle-check" style={{fontSize:13,verticalAlign:-2}} aria-hidden="true"/> Sold prices unlocked</span>
          }
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <div className="listings-page">
        <main className="listings-main" id="main-content" role="main">

          {/* Toolbar */}
          <div className="listings-toolbar">
            <span className="listings-count">
              {loading ? 'Searching…'
                : error   ? <span style={{ color:'var(--red)' }}>Error loading listings</span>
                : <><strong>{total.toLocaleString()}</strong> {isLease ? 'rentals' : 'homes'} for {isLease ? 'lease' : 'sale'} in the GTA</>
              }
            </span>
            <div className="view-toggle" role="group" aria-label="View mode">
              <button className={`view-btn${viewMode==='grid'?' active':''}`} onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode==='grid'} title="Grid"><GridIcon /></button>
              <button className={`view-btn${viewMode==='list'?' active':''}`} onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode==='list'} title="List"><ListIcon /></button>
              <button className="view-btn" onClick={() => navigate('/map')} aria-label="Map view" title="Map" style={{ display:'flex', alignItems:'center', gap:4, padding:'0 8px', fontSize:11 }}>
                <i className="ti ti-map-2" style={{ fontSize:13 }}/>Map
              </button>
            </div>
          </div>

          {/* Grid */}
          {error && !loading ? (
            <div className="listings-empty" role="alert">
              <i className="listings-empty__icon ti ti-alert-triangle" aria-hidden="true"/>
              <h2>Something went wrong</h2><p>{error}</p>
              <button className="reset-btn" onClick={handleReset}>Reset &amp; try again</button>
            </div>
          ) : (
            <div className={`listings-grid${viewMode==='list' ? ' listings-grid--list' : ''}`} aria-busy={loading} aria-live="polite">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i}/>)
                : listings.length === 0
                ? (
                  <div className="listings-empty">
                    <i className="listings-empty__icon ti ti-search" aria-hidden="true"/>
                    <h2>No listings found</h2>
                    <p>Try widening your search or clearing all filters.</p>
                    <button className="reset-btn" onClick={handleReset}>Clear all filters</button>
                  </div>
                )
                : listings.map(l => (
                  <ListingCard key={l.ListingKey} listing={l} isSaved={isSaved(l.ListingKey)}
                    onSave={toggleSave} userPrefs={userPrefs} listView={viewMode==='list'}/>
                ))
              }
            </div>
          )}

          {!loading && !error && <Pagination page={page} pages={pages} onPageChange={goToPage}/>}

          {/* Compliance */}
          <div className="mp-compliance" role="contentinfo">
            <p>Listing data provided by the Toronto Regional Real Estate Board (TRREB) through PropTx · IDX Agreement #1860304 · Data refreshed daily · The trademarks MLS®, Multiple Listing Service® and the associated logos are owned by The Canadian Real Estate Association (CREA). Not intended to solicit properties already listed.</p>
            <p>Propedia is operated by <strong>Anirudha Warhadpande</strong>, Salesperson · HomeLife Miracle Realty Ltd., Brokerage · 1339 Matheson Blvd E, Mississauga ON L4W 1R1 · RECO #6011384 · TRREB #6008999 · <a href="tel:+16478035288" style={{ color:'inherit' }}>647-803-5288</a></p>
          </div>
        </main>
      </div>

      {/* Compare bar */}
      <CompareBar saved={saved} onRemove={toggleSave} onClear={clearAll}/>

      {/* VOW wall */}
      {vowOpen && <VOWSignupWall trigger="general" onSuccess={handleVOWSuccess} onDismiss={() => setVowOpen(false)}/>}

      {/* Filter modal */}
      <FilterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onApply={handleApplyFilters}
        initialValues={modalValues}
      />
    </>
  );
}
