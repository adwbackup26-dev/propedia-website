// src/pages/ListingsPage.jsx — Propedia marketplace homepage
// Dark theme · slim nav · dropdown filters · 2-column grid · photo carousel cards

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Filters from '../components/Filters.jsx';
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard.jsx';
import CompareBar from '../components/CompareBar.jsx';
import VOWSignupWall from '../components/VOWSignupWall.jsx';
import { useListings, useCompare, getVOWSession, getUserPrefs } from '../hooks/useListings.js';
import '../styles/listings.css';

// ── Icons ────────────────────────────────────────────────────────────────────
const SearchIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>;
const GridIcon   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="7" height="7" rx="1.5"/><rect x="9" y="0" width="7" height="7" rx="1.5"/><rect x="0" y="9" width="7" height="7" rx="1.5"/><rect x="9" y="9" width="7" height="7" rx="1.5"/></svg>;
const ListIcon   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="16" height="2.5" rx="1.25"/><rect x="0" y="6.75" width="16" height="2.5" rx="1.25"/><rect x="0" y="12.5" width="16" height="2.5" rx="1.25"/></svg>;

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

// ── Active filter summary (shown in Filters button label) ────────────────────
function filterSummary(filters) {
  const parts = [];
  if (filters.transactionType === 'For Lease') parts.push('Rent');
  if (filters.minPrice) parts.push(`$${parseInt(filters.minPrice)/1000|0}K+`);
  if (filters.maxPrice) parts.push(`under $${parseInt(filters.maxPrice)/1000|0}K`);
  if (filters.minBeds)  parts.push(`${filters.minBeds}+ bd`);
  if (filters.minBaths) parts.push(`${filters.minBaths}+ ba`);
  if (filters.propertySubType) parts.push(filters.propertySubType);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const { listings, total, pages, page, filters, loading, error,
          setFilters, applyFilters, resetFilters, goToPage } = useListings();
  const { saved, toggleSave, isSaved, clearAll } = useCompare();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode,    setViewMode]    = useState('grid');
  const [vowOpen,     setVowOpen]     = useState(false);
  const [hasVOW,      setHasVOW]      = useState(() => getVOWSession());
  const [userPrefs,   setUserPrefs]   = useState(() => getUserPrefs());
  const [search,      setSearch]      = useState('');

  const handleSearch = e => {
    e.preventDefault();
    setFilters({ search });
    applyFilters();
  };
  const handleVOWSuccess = () => {
    setHasVOW(true); setUserPrefs(getUserPrefs()); setVowOpen(false);
  };
  const isLease = filters.transactionType === 'For Lease';

  return (
    <>
      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <header className="mp-nav" role="banner">
        <Link to="/" className="mp-nav__logo">Propedia</Link>

        <form className="mp-nav__search" onSubmit={handleSearch} role="search">
          <span className="mp-nav__search-icon" aria-hidden="true"><SearchIcon /></span>
          <input type="search" placeholder="City, address, or postal code…" value={search}
            onChange={e => setSearch(e.target.value)} aria-label="Search listings"/>
          <button type="submit" className="mp-nav__search-btn">Search</button>
        </form>

        <button
          className={`mp-nav__filters${filtersOpen ? ' active' : ''}`}
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
          aria-controls="filter-panel">
          <i className="ti ti-adjustments-horizontal" style={{ fontSize:13 }} aria-hidden="true"/>
          Filters{filterSummary(filters)}
        </button>

        <div className="mp-nav__right">
          {!hasVOW
            ? <button className="mp-nav__signup" onClick={() => setVowOpen(true)}>Sign up free</button>
            : <span className="mp-nav__vow"><i className="ti ti-circle-check" style={{fontSize:13,verticalAlign:-2}} aria-hidden="true"/> Sold prices unlocked</span>
          }
        </div>
      </header>

      {/* ── Filter panel ─────────────────────────────────────────────── */}
      {filtersOpen && (
        <div id="filter-panel">
          <Filters filters={filters} setFilters={setFilters} applyFilters={() => { applyFilters(); setFiltersOpen(false); }} resetFilters={() => { resetFilters(); setFiltersOpen(false); }}/>
        </div>
      )}

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
            </div>
          </div>

          {/* Grid */}
          {error && !loading ? (
            <div className="listings-empty" role="alert">
              <i className="listings-empty__icon ti ti-alert-triangle" aria-hidden="true"/>
              <h2>Something went wrong</h2><p>{error}</p>
              <button className="reset-btn" onClick={resetFilters}>Reset &amp; try again</button>
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
                    <button className="reset-btn" onClick={resetFilters}>Clear all filters</button>
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
    </>
  );
}
