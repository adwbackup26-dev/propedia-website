// src/pages/ListingsPage.jsx — Propedia marketplace homepage
// Dark theme · slim nav · filter modal · 2-column grid · photo carousel cards

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FilterModal, { PROP_TYPES, DEFAULT_MODAL } from '../components/FilterModal.jsx';
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard.jsx';
import CompareBar from '../components/CompareBar.jsx';
import VOWSignupWall from '../components/VOWSignupWall.jsx';
import propediaLogo from '/ITERATION-LOGO.png';
import { useListings, useCompare, getVOWSession, getUserPrefs, DEFAULT_FILTERS as DEFAULT_FILTERS_SHAPE } from '../hooks/useListings.js';
import { computeMatchScore } from '../utils/format.js';
import '../styles/listings.css';

// ── Icons ────────────────────────────────────────────────────────────────────
const SearchIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>;
const GridIcon   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="7" height="7" rx="1.5"/><rect x="9" y="0" width="7" height="7" rx="1.5"/><rect x="0" y="9" width="7" height="7" rx="1.5"/><rect x="9" y="9" width="7" height="7" rx="1.5"/></svg>;
const ListIcon   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="16" height="2.5" rx="1.25"/><rect x="0" y="6.75" width="16" height="2.5" rx="1.25"/><rect x="0" y="12.5" width="16" height="2.5" rx="1.25"/></svg>;

// ── Autocomplete data ─────────────────────────────────────────────────────────
// Entry shape: { label, display, type, city?, searchCity?, searchTerm? }
//   label       — what fills the search box on select
//   display     — right-column context tag shown in dropdown
//   type        — 'region' | 'city' | 'hood' | 'road' | 'intersection' | 'landmark'
//   city        — parent city (used for hood/road/landmark API calls)
//   searchCity  — city param sent to API (may differ from display city)
//   searchTerm  — overrides label for the API `search` param

function ac(label, display, type, city, searchTerm, searchCity) {
  return { label, display, type, city: city || '', searchTerm: searchTerm || label, searchCity: searchCity || '' };
}

const AC_ALL = [
  // ── Regions ──────────────────────────────────────────────────────────────
  ac('Toronto',        'Region',      'region'),
  ac('Peel Region',    'Region',      'region'),
  ac('York Region',    'Region',      'region'),
  ac('Durham Region',  'Region',      'region'),
  ac('Halton Region',  'Region',      'region'),
  ac('Simcoe County',  'Region',      'region'),

  // ── Cities ───────────────────────────────────────────────────────────────
  ac('Toronto',        'City',        'city'),
  ac('Mississauga',    'City',        'city'),
  ac('Brampton',       'City',        'city'),
  ac('Oakville',       'City',        'city'),
  ac('Burlington',     'City',        'city'),
  ac('Vaughan',        'City',        'city'),
  ac('Markham',        'City',        'city'),
  ac('Richmond Hill',  'City',        'city'),
  ac('Ajax',           'City',        'city'),
  ac('Pickering',      'City',        'city'),
  ac('Milton',         'City',        'city'),
  ac('Whitby',         'City',        'city'),
  ac('Oshawa',         'City',        'city'),
  ac('Halton Hills',   'City',        'city'),
  ac('Caledon',        'City',        'city'),
  ac('Aurora',         'City',        'city'),
  ac('Newmarket',      'City',        'city'),
  ac('King',           'City',        'city'),
  ac('Georgina',       'City',        'city'),
  ac('Innisfil',       'City',        'city'),
  ac('Barrie',         'City',        'city'),
  ac('Collingwood',    'City',        'city'),
  ac('Guelph',         'City',        'city'),
  ac('Hamilton',       'City',        'city'),
  ac('Kitchener',      'City',        'city'),
  ac('Waterloo',       'City',        'city'),
  ac('Cambridge',      'City',        'city'),

  // ── Toronto neighbourhoods ────────────────────────────────────────────────
  // TRREB stores Toronto districts as area codes: W=Etobicoke/West, E=Scarborough/East, C=Central/NorthYork
  // searchCity is the prefix passed to startswith(City,'...') in the API
  ac('Etobicoke',            'Toronto District', 'city', '', '', 'Toronto W'),
  ac('Scarborough',          'Toronto District', 'city', '', '', 'Toronto E'),
  ac('North York',           'Toronto District', 'city', '', '', 'Toronto C'),
  ac('East York',            'Toronto District', 'city', '', '', 'Toronto E0'),
  ac('Downtown Toronto',     'Toronto',    'hood', 'Toronto', 'Downtown'),
  ac('Midtown Toronto',      'Toronto',    'hood', 'Toronto', 'Midtown'),
  ac('The Beaches',          'Toronto',    'hood', 'Toronto', 'Beaches'),
  ac('Leslieville',          'Toronto',    'hood', 'Toronto'),
  ac('Riverdale',            'Toronto',    'hood', 'Toronto'),
  ac('Roncesvalles',         'Toronto',    'hood', 'Toronto'),
  ac('Junction',             'Toronto',    'hood', 'Toronto'),
  ac('Bloor West Village',   'Toronto',    'hood', 'Toronto', 'Bloor West'),
  ac('Lawrence Park',        'Toronto',    'hood', 'Toronto', 'Lawrence'),
  ac('Forest Hill',          'Toronto',    'hood', 'Toronto'),
  ac('Rosedale',             'Toronto',    'hood', 'Toronto'),
  ac('Moore Park',           'Toronto',    'hood', 'Toronto'),
  ac('Leaside',              'Toronto',    'hood', 'Toronto'),
  ac('Don Mills',            'Toronto',    'hood', 'Toronto'),
  ac('Agincourt',            'Toronto',    'hood', 'Toronto'),
  ac('Malvern',              'Toronto',    'hood', 'Toronto'),
  ac('Liberty Village',      'Toronto',    'hood', 'Toronto'),
  ac('King West',            'Toronto',    'hood', 'Toronto', 'King'),
  ac('Queen West',           'Toronto',    'hood', 'Toronto', 'Queen'),
  ac('Chinatown',            'Toronto',    'hood', 'Toronto'),
  ac('Kensington Market',    'Toronto',    'hood', 'Toronto', 'Kensington'),
  ac('Parkdale',             'Toronto',    'hood', 'Toronto'),
  ac('Little Italy',         'Toronto',    'hood', 'Toronto'),
  ac('Ossington',            'Toronto',    'hood', 'Toronto'),
  ac('Yorkville',            'Toronto',    'hood', 'Toronto'),
  ac('St. Lawrence',         'Toronto',    'hood', 'Toronto', 'Lawrence'),
  ac('Distillery District',  'Toronto',    'hood', 'Toronto', 'Distillery'),
  ac('Cabbagetown',          'Toronto',    'hood', 'Toronto'),
  ac('Corso Italia',         'Toronto',    'hood', 'Toronto'),
  ac('Greektown',            'Toronto',    'hood', 'Toronto'),
  ac('Koreatown',            'Toronto',    'hood', 'Toronto'),
  ac('The Annex',            'Toronto',    'hood', 'Toronto', 'Annex'),
  ac('Regent Park',          'Toronto',    'hood', 'Toronto'),
  ac('Fort York',            'Toronto',    'hood', 'Toronto'),

  // ── Mississauga neighbourhoods ────────────────────────────────────────────
  ac('Port Credit',          'Mississauga', 'hood', 'Mississauga'),
  ac('Streetsville',         'Mississauga', 'hood', 'Mississauga'),
  ac('Meadowvale',           'Mississauga', 'hood', 'Mississauga'),
  ac('Erin Mills',           'Mississauga', 'hood', 'Mississauga'),
  ac('Cooksville',           'Mississauga', 'hood', 'Mississauga'),
  ac('Clarkson',             'Mississauga', 'hood', 'Mississauga'),
  ac('Lakeview',             'Mississauga', 'hood', 'Mississauga'),
  ac('Applewood',            'Mississauga', 'hood', 'Mississauga'),
  ac('Malton',               'Mississauga', 'hood', 'Mississauga'),
  ac('Britannia',            'Mississauga', 'hood', 'Mississauga'),
  ac('Erindale',             'Mississauga', 'hood', 'Mississauga'),
  ac('Hurontario',           'Mississauga', 'hood', 'Mississauga'),
  ac('Lisgar',               'Mississauga', 'hood', 'Mississauga'),
  ac('Lorne Park',           'Mississauga', 'hood', 'Mississauga'),
  ac('Mineola',              'Mississauga', 'hood', 'Mississauga'),
  ac('Credit Valley',        'Mississauga', 'hood', 'Mississauga'),
  ac('Creditview',           'Mississauga', 'hood', 'Mississauga'),
  ac('Central Mississauga',  'Mississauga', 'hood', 'Mississauga', 'Central'),

  // ── Brampton neighbourhoods ───────────────────────────────────────────────
  ac('Bramalea',             'Brampton',   'hood', 'Brampton'),
  ac('Sandringham',          'Brampton',   'hood', 'Brampton'),
  ac('Mount Pleasant',       'Brampton',   'hood', 'Brampton'),
  ac('Springdale',           'Brampton',   'hood', 'Brampton'),
  ac('Downtown Brampton',    'Brampton',   'hood', 'Brampton', 'Downtown'),
  ac('Snelgrove',            'Brampton',   'hood', 'Brampton'),
  ac('Castlemore',           'Brampton',   'hood', 'Brampton'),
  ac('East Brampton',        'Brampton',   'hood', 'Brampton'),

  // ── Markham neighbourhoods ────────────────────────────────────────────────
  ac('Downtown Markham',     'Markham',    'hood', 'Markham', 'Downtown'),
  ac('Unionville',           'Markham',    'hood', 'Markham'),
  ac('Cornell',              'Markham',    'hood', 'Markham'),
  ac('Berczy',               'Markham',    'hood', 'Markham'),
  ac('Angus Glen',           'Markham',    'hood', 'Markham'),
  ac('Milliken Mills',       'Markham',    'hood', 'Markham'),
  ac('Buttonville',          'Markham',    'hood', 'Markham'),
  ac('Thornhill',            'Markham',    'hood', 'Markham'),

  // ── Oakville neighbourhoods ───────────────────────────────────────────────
  ac('Downtown Oakville',    'Oakville',   'hood', 'Oakville', 'Downtown'),
  ac('Bronte',               'Oakville',   'hood', 'Oakville'),
  ac('Glen Abbey',           'Oakville',   'hood', 'Oakville'),
  ac('Palermo',              'Oakville',   'hood', 'Oakville'),
  ac('White Oaks',           'Oakville',   'hood', 'Oakville'),
  ac('East Oakville',        'Oakville',   'hood', 'Oakville'),
  ac('Midtown Oakville',     'Oakville',   'hood', 'Oakville'),

  // ── Richmond Hill & Vaughan neighbourhoods ────────────────────────────────
  ac('Jefferson',            'Richmond Hill', 'hood', 'Richmond Hill'),
  ac('Langstaff',            'Richmond Hill', 'hood', 'Richmond Hill'),
  ac('Woodbridge',           'Vaughan',    'hood', 'Vaughan'),
  ac('Concord',              'Vaughan',    'hood', 'Vaughan'),
  ac('Kleinburg',            'Vaughan',    'hood', 'Vaughan'),
  ac('Maple',                'Vaughan',    'hood', 'Vaughan'),

  // ── Ajax, Whitby, Oshawa ──────────────────────────────────────────────────
  ac('Downtown Ajax',        'Ajax',       'hood', 'Ajax', 'Downtown'),
  ac('Westney',              'Ajax',       'hood', 'Ajax'),
  ac('Brooklin',             'Whitby',     'hood', 'Whitby'),
  ac('Downtown Whitby',      'Whitby',     'hood', 'Whitby', 'Downtown'),
  ac('Downtown Oshawa',      'Oshawa',     'hood', 'Oshawa', 'Downtown'),
  ac('Port Oshawa',          'Oshawa',     'hood', 'Oshawa'),

  // ── Major roads & streets ─────────────────────────────────────────────────
  ac('Yonge Street',         'Road',       'road', 'Toronto',     'Yonge'),
  ac('Bloor Street',         'Road',       'road', 'Toronto',     'Bloor'),
  ac('King Street',          'Road',       'road', 'Toronto',     'King'),
  ac('Queen Street',         'Road',       'road', 'Toronto',     'Queen'),
  ac('Dundas Street',        'Road',       'road', 'Toronto',     'Dundas'),
  ac('College Street',       'Road',       'road', 'Toronto',     'College'),
  ac('Eglinton Avenue',      'Road',       'road', 'Toronto',     'Eglinton'),
  ac('Lawrence Avenue',      'Road',       'road', 'Toronto',     'Lawrence'),
  ac('Steeles Avenue',       'Road',       'road', '',            'Steeles'),
  ac('Finch Avenue',         'Road',       'road', 'Toronto',     'Finch'),
  ac('Sheppard Avenue',      'Road',       'road', 'Toronto',     'Sheppard'),
  ac('Bathurst Street',      'Road',       'road', 'Toronto',     'Bathurst'),
  ac('University Avenue',    'Road',       'road', 'Toronto',     'University'),
  ac('Spadina Avenue',       'Road',       'road', 'Toronto',     'Spadina'),
  ac('Avenue Road',          'Road',       'road', 'Toronto',     'Avenue'),
  ac('Bay Street',           'Road',       'road', 'Toronto',     'Bay'),
  ac('Bayview Avenue',       'Road',       'road', 'Toronto',     'Bayview'),
  ac('Don Mills Road',       'Road',       'road', 'Toronto',     'Don Mills'),
  ac('Islington Avenue',     'Road',       'road', 'Toronto',     'Islington'),
  ac('Kipling Avenue',       'Road',       'road', 'Toronto',     'Kipling'),
  ac('Victoria Park',        'Road',       'road', 'Toronto',     'Victoria Park'),
  ac('Woodbine Avenue',      'Road',       'road', 'Toronto',     'Woodbine'),
  ac('Warden Avenue',        'Road',       'road', 'Toronto',     'Warden'),
  ac('Kennedy Road',         'Road',       'road', 'Toronto',     'Kennedy'),
  ac('McCowan Road',         'Road',       'road', 'Toronto',     'McCowan'),
  ac('Morningside Avenue',   'Road',       'road', 'Toronto',     'Morningside'),
  ac('Markham Road',         'Road',       'road', 'Toronto',     'Markham Road'),
  ac('Ellesmere Road',       'Road',       'road', 'Toronto',     'Ellesmere'),
  ac('Burnhamthorpe Road',   'Road',       'road', 'Mississauga', 'Burnhamthorpe'),
  ac('Hurontario Street',    'Road',       'road', 'Mississauga', 'Hurontario'),
  ac('Mississauga Road',     'Road',       'road', 'Mississauga', 'Mississauga Road'),
  ac('Erin Mills Parkway',   'Road',       'road', 'Mississauga', 'Erin Mills'),
  ac('Mavis Road',           'Road',       'road', 'Mississauga', 'Mavis'),
  ac('Credit Valley Road',   'Road',       'road', 'Mississauga', 'Credit Valley'),
  ac('Highway 401',          'Road',       'road', '',            'Highway 401'),
  ac('Highway 407',          'Road',       'road', '',            'Highway 407'),
  ac('Queen Elizabeth Way',  'Road (QEW)', 'road', '',            'Queen Elizabeth'),
  ac('Don Valley Parkway',   'Road',       'road', 'Toronto',     'Don Valley'),
  ac('Gardiner Expressway',  'Road',       'road', 'Toronto',     'Gardiner'),

  // ── Major intersections ───────────────────────────────────────────────────
  ac('Yonge & Dundas',       'Intersection', 'intersection', 'Toronto', 'Yonge'),
  ac('Yonge & Bloor',        'Intersection', 'intersection', 'Toronto', 'Yonge'),
  ac('Yonge & College',      'Intersection', 'intersection', 'Toronto', 'Yonge'),
  ac('Yonge & Eglinton',     'Intersection', 'intersection', 'Toronto', 'Eglinton'),
  ac('Yonge & Sheppard',     'Intersection', 'intersection', 'Toronto', 'Sheppard'),
  ac('Yonge & Finch',        'Intersection', 'intersection', 'Toronto', 'Finch'),
  ac('Yonge & Lawrence',     'Intersection', 'intersection', 'Toronto', 'Lawrence'),
  ac('Yonge & Steeles',      'Intersection', 'intersection', 'Toronto', 'Steeles'),
  ac('Bloor & Spadina',      'Intersection', 'intersection', 'Toronto', 'Bloor'),
  ac('Bloor & Bathurst',     'Intersection', 'intersection', 'Toronto', 'Bloor'),
  ac('Bloor & Bay',          'Intersection', 'intersection', 'Toronto', 'Bloor'),
  ac('Bloor & Kipling',      'Intersection', 'intersection', 'Toronto', 'Bloor'),
  ac('King & Yonge',         'Intersection', 'intersection', 'Toronto', 'King'),
  ac('King & Simcoe',        'Intersection', 'intersection', 'Toronto', 'King'),
  ac('King & University',    'Intersection', 'intersection', 'Toronto', 'King'),
  ac('Queen & Spadina',      'Intersection', 'intersection', 'Toronto', 'Queen'),
  ac('Queen & Bay',          'Intersection', 'intersection', 'Toronto', 'Queen'),
  ac('Queen & Bathurst',     'Intersection', 'intersection', 'Toronto', 'Queen'),
  ac('Dundas & Bathurst',    'Intersection', 'intersection', 'Toronto', 'Dundas'),
  ac('Dundas & Spadina',     'Intersection', 'intersection', 'Toronto', 'Dundas'),
  ac('Dundas & University',  'Intersection', 'intersection', 'Toronto', 'Dundas'),
  ac('Dundas & Kipling',     'Intersection', 'intersection', 'Toronto', 'Dundas'),
  ac('Eglinton & Avenue Road','Intersection','intersection', 'Toronto', 'Eglinton'),
  ac('Eglinton & Bathurst',  'Intersection', 'intersection', 'Toronto', 'Eglinton'),
  ac('Sheppard & Don Mills', 'Intersection', 'intersection', 'Toronto', 'Sheppard'),
  ac('Dundas & Hurontario',  'Intersection', 'intersection', 'Mississauga', 'Dundas'),

  // ── Landmark buildings & developments ────────────────────────────────────
  ac('Marilyn Monroe Condos',   'Landmark · Mississauga', 'landmark', 'Mississauga', 'Absolute'),
  ac('Absolute Towers',         'Landmark · Mississauga', 'landmark', 'Mississauga', 'Absolute'),
  ac('One Absolute World',      'Landmark · Mississauga', 'landmark', 'Mississauga', 'Absolute'),
  ac('Square One',              'Landmark · Mississauga', 'landmark', 'Mississauga', 'Square One'),
  ac('m City',                  'Landmark · Mississauga', 'landmark', 'Mississauga', 'm City'),
  ac('Daniels Erin Mills',      'Landmark · Mississauga', 'landmark', 'Mississauga', 'Daniels'),
  ac('Port Credit Village',     'Landmark · Mississauga', 'landmark', 'Mississauga', 'Port Credit'),
  ac('Pinnacle Towers',         'Landmark · Mississauga', 'landmark', 'Mississauga', 'Pinnacle'),
  ac('Halo Condos',             'Landmark · Mississauga', 'landmark', 'Mississauga', 'Halo'),
  ac('Mississauga City Centre', 'Landmark · Mississauga', 'landmark', 'Mississauga', 'City Centre'),
  ac('CN Tower',                'Landmark · Toronto',     'landmark', 'Toronto',     'CN Tower'),
  ac('Distillery District',     'Landmark · Toronto',     'landmark', 'Toronto',     'Distillery'),
  ac('Entertainment District',  'Landmark · Toronto',     'landmark', 'Toronto',     'Entertainment'),
  ac('Kensington Market',       'Landmark · Toronto',     'landmark', 'Toronto',     'Kensington'),
  ac('Eaton Centre',            'Landmark · Toronto',     'landmark', 'Toronto',     'Eaton'),
  ac('Regent Park',             'Landmark · Toronto',     'landmark', 'Toronto',     'Regent Park'),
  ac('Casa Loma',               'Landmark · Toronto',     'landmark', 'Toronto',     'Casa Loma'),
  ac('High Park',               'Landmark · Toronto',     'landmark', 'Toronto',     'High Park'),
  ac('Scarborough Bluffs',      'Landmark · Toronto',     'landmark', 'Toronto',     'Bluffs'),
  ac('Vaughan Metropolitan Centre','Landmark · Vaughan',  'landmark', 'Vaughan',     'Metropolitan'),
  ac('Bramalea City Centre',    'Landmark · Brampton',    'landmark', 'Brampton',    'Bramalea'),
  ac('Markham Centre',          'Landmark · Markham',     'landmark', 'Markham',     'Markham Centre'),
  ac('Unionville Village',      'Landmark · Markham',     'landmark', 'Markham',     'Unionville'),
];

// ── type → icon mapping ───────────────────────────────────────────────────────
const TYPE_ICON = {
  region:       'ti-map-2',
  city:         'ti-building-community',
  hood:         'ti-map-pin',
  road:         'ti-road',
  intersection: 'ti-arrows-cross',
  landmark:     'ti-star',
  postal:       'ti-mail',
  listing:      'ti-home',
};

// ── suggestion engine ─────────────────────────────────────────────────────────
function getSuggestions(q) {
  if (!q || q.length < 2) return [];
  const lq = q.toLowerCase().trim();

  // Detect postal code query (letter + digit pattern, e.g. "L4T", "M5V 2X3")
  const postalSuggestions = [];
  if (/^[a-z]\d/i.test(lq) && lq.length <= 7) {
    const code = lq.replace(/\s/g, '').toUpperCase().slice(0, 6);
    postalSuggestions.push({
      label:      code,
      display:    'Postal code',
      type:       'postal',
      city:       '',
      searchTerm: code,
    });
  }

  const matched = AC_ALL.filter(s => {
    const haystack = s.label.toLowerCase();
    return haystack.includes(lq);
  });

  // Exact-start matches first, then contains; stable within each group
  matched.sort((a, b) => {
    const al = a.label.toLowerCase();
    const bl = b.label.toLowerCase();
    const aStarts = al.startsWith(lq) ? 0 : 1;
    const bStarts = bl.startsWith(lq) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    // Within same priority: cities before hoods before others
    const rank = { city:0, region:1, hood:2, road:3, intersection:4, landmark:5 };
    return (rank[a.type] ?? 9) - (rank[b.type] ?? 9);
  });

  return [...postalSuggestions, ...matched].slice(0, 8);
}

// ── Address search hook — debounced API call for specific addresses ────────────
function useAddressSearch(query) {
  const [results, setResults] = React.useState([]);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // Only run address search when query looks like a specific address
    // (contains digit, or long enough that no static suggestions match well)
    const q = query.trim();
    if (q.length < 3) { setResults([]); return; }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        setResults((data.results || []).map(r => ({
          type:       'listing',
          listingKey: r.listingKey,
          status:     r.status,
          label:      [r.address, r.city, r.province, r.postalCode].filter(Boolean).join(', '),
          display:    r.status,
          city:       r.city,
          searchTerm: r.address,
          transactionType: r.transactionType,
        })));
      } catch { /* silent */ }
    }, 380);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  return results;
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
function modalToURL(m, extra = {}) {
  const sp = new URLSearchParams();
  if (m.propType   !== 'res-sale') sp.set('pt',       m.propType);
  if (m.minPrice)                  sp.set('minPrice',  m.minPrice);
  if (m.maxPrice)                  sp.set('maxPrice',  m.maxPrice);
  if (m.beds)                      sp.set('beds',      m.beds);
  if (m.baths)                     sp.set('baths',     m.baths);
  if (m.parking)                   sp.set('parking',   m.parking);
  if (m.structures.length)         sp.set('st',        m.structures.join(','));
  if (extra.city)                  sp.set('city',      extra.city);
  if (extra.search)                sp.set('search',    extra.search);
  if (extra.postalCode)            sp.set('postal',    extra.postalCode);
  if (extra.sort && extra.sort !== 'relevance') sp.set('sort', extra.sort);
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

function urlToApiFilters() {
  const sp = new URLSearchParams(window.location.search);
  const m  = urlToModal();
  const pt = PROP_TYPES.find(p => p.id === m.propType) || PROP_TYPES[0];
  const sortId  = sp.get('sort') || 'relevance';
  const sortOpt = SORT_OPTIONS.find(o => o.id === sortId) || SORT_OPTIONS[0];
  return {
    ...DEFAULT_FILTERS_SHAPE,
    transactionType: pt.tx,
    propertyType:    pt.pt,
    minPrice:        m.minPrice,
    maxPrice:        m.maxPrice,
    minBeds:         m.beds,
    minBaths:        m.baths,
    minParking:      m.parking,
    structures:      m.structures.join(','),
    city:            sp.get('city')   || '',
    search:          sp.get('search') || '',
    postalCode:      sp.get('postal') || '',
    sortBy:          sortOpt.sortBy,
    sortDir:         sortOpt.sortDir,
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

// ── Sort options ──────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: 'relevance',    label: 'Relevance',               sortBy: 'ModificationTimestamp', sortDir: 'desc',  clientSort: null },
  { id: 'price-asc',   label: 'Price: Low to High',       sortBy: 'ListPrice',             sortDir: 'asc',   clientSort: null },
  { id: 'price-desc',  label: 'Price: High to Low',       sortBy: 'ListPrice',             sortDir: 'desc',  clientSort: null },
  { id: 'newest',      label: 'Newest Listed',            sortBy: 'ModificationTimestamp', sortDir: 'desc',  clientSort: null },
  { id: 'oldest',      label: 'Oldest Listed',            sortBy: 'ModificationTimestamp', sortDir: 'asc',   clientSort: null },
  { id: 'dom-asc',     label: 'Days on Market: Fewest',   sortBy: 'DaysOnMarket',          sortDir: 'asc',   clientSort: null },
  { id: 'dom-desc',    label: 'Days on Market: Most',     sortBy: 'DaysOnMarket',          sortDir: 'desc',  clientSort: null },
  { id: 'score-desc',  label: 'Propedia Score: Highest',  sortBy: 'ModificationTimestamp', sortDir: 'desc',  clientSort: 'score-desc' },
  { id: 'score-asc',   label: 'Propedia Score: Lowest',   sortBy: 'ModificationTimestamp', sortDir: 'desc',  clientSort: 'score-asc'  },
];

// ── Sort dropdown ─────────────────────────────────────────────────────────────
function SortDropdown({ current, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const opt = SORT_OPTIONS.find(o => o.id === current) || SORT_OPTIONS[0];

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:5,
          height:32, padding:'0 10px', borderRadius:7,
          border:'1px solid rgba(255,255,255,.14)',
          background:'rgba(255,255,255,.05)',
          color:'rgba(255,255,255,.7)', fontSize:12, fontWeight:500,
          cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
        }}
      >
        <i className="ti ti-arrows-sort" style={{ fontSize:12 }}/>
        Sort: {opt.label}
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:10, marginLeft:2 }}/>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:400,
          background:'#161719', border:'1px solid rgba(255,255,255,.12)',
          borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,.55)',
          minWidth:200, overflow:'hidden',
        }}>
          {SORT_OPTIONS.map((o, i) => {
            const active = o.id === current;
            return (
              <div
                key={o.id}
                onMouseDown={e => { e.preventDefault(); onChange(o.id); setOpen(false); }}
                style={{
                  padding:'9px 14px', fontSize:12, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:8,
                  background: active ? 'rgba(0,180,168,.1)' : 'transparent',
                  color: active ? '#00B4A8' : 'rgba(255,255,255,.75)',
                  borderBottom: i < SORT_OPTIONS.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {active && <i className="ti ti-check" style={{ fontSize:11, flexShrink:0 }}/>}
                {!active && <span style={{ width:11, flexShrink:0 }}/>}
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const { listings, total, pages, page, filters, loading, error,
          applyWith, resetFilters, goToPage } = useListings(urlToApiFilters());
  const { saved, toggleSave, isSaved, clearAll } = useCompare();
  const navigate = useNavigate();

  const [modalOpen,  setModalOpen]  = useState(false);
  const [viewMode,   setViewMode]   = useState('grid');
  const [sortId,     setSortId]     = useState(() => new URLSearchParams(window.location.search).get('sort') || 'relevance');
  const [vowOpen,    setVowOpen]    = useState(false);
  const [hasVOW,     setHasVOW]     = useState(() => getVOWSession());
  const [userPrefs,  setUserPrefs]  = useState(() => getUserPrefs());
  const [search,     setSearch]     = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    const cityParam = sp.get('city') || '';
    // Reverse-map TRREB prefix codes to friendly display labels
    const cityLabel = AC_ALL.find(e => e.searchCity && e.searchCity === cityParam)?.label || cityParam;
    return sp.get('search') || cityLabel;
  });
  const [acOpen,     setAcOpen]     = useState(false);
  const [acIdx,      setAcIdx]      = useState(-1);

  // modal state mirrors what's currently applied (for pre-populating on re-open)
  const [modalValues, setModalValues] = useState(() => urlToModal());

  const searchWrapRef  = useRef(null);
  const staticSuggestions  = getSuggestions(search);
  const addressResults     = useAddressSearch(search);
  // Merge: address results first when query looks specific, static suggestions after (deduped by label)
  const addressLabels = new Set(addressResults.map(r => r.label));
  const suggestions = [
    ...addressResults,
    ...staticSuggestions.filter(s => !addressLabels.has(s.label)),
  ].slice(0, 14);

  const syncSearchURL = useCallback((patch) => {
    const sp = new URLSearchParams(window.location.search);
    const set = (k, v) => v ? sp.set(k, v) : sp.delete(k);
    set('city',   patch.city   ?? sp.get('city')   ?? '');
    set('search', patch.search ?? sp.get('search') ?? '');
    set('postal', patch.postalCode ?? sp.get('postal') ?? '');
    window.history.replaceState(null, '', sp.toString() ? `?${sp}` : window.location.pathname);
  }, []);

  const commitSuggestion = useCallback(s => {
    setAcOpen(false); setAcIdx(-1);

    // Direct-navigate to listing detail page — don't touch filter state
    if (s.type === 'listing') {
      navigate(`/listing/${s.listingKey}`);
      return;
    }

    setSearch(s.label);
    const term = s.searchTerm || s.label;
    let patch;
    switch (s.type) {
      case 'city':
        patch = { city: s.searchCity || s.label, search: '', postalCode: '' }; break;
      case 'region':
        patch = { city: '', search: '', postalCode: '' }; break;
      case 'hood':
      case 'road':
      case 'landmark':
      case 'intersection':
        patch = { search: term, city: s.city || '', postalCode: '' }; break;
      case 'postal':
        patch = { postalCode: term, city: '', search: '' }; break;
      default:
        patch = { search: term, city: '', postalCode: '' };
    }
    applyWith(patch);
    syncSearchURL(patch);
  }, [applyWith, syncSearchURL, navigate]);

  const handleSearch = e => {
    e.preventDefault(); setAcOpen(false);
    const patch = { search, city: '' };
    applyWith(patch);
    syncSearchURL(patch);
  };

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
    const sortOpt = SORT_OPTIONS.find(o => o.id === sortId) || SORT_OPTIONS[0];
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
      sortBy:          sortOpt.sortBy,
      sortDir:         sortOpt.sortDir,
    });
    setModalValues(m);
    // sync URL — preserve city/search/postal already in URL, add modal fields
    const sp = new URLSearchParams(window.location.search);
    const qs = modalToURL(m, {
      city:       sp.get('city')   || '',
      search:     sp.get('search') || '',
      postalCode: sp.get('postal') || '',
      sort:       sortId,
    });
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [applyWith, sortId]);

  const handleReset = useCallback(() => {
    resetFilters();
    setModalValues(DEFAULT_MODAL);
    setSortId('relevance');
    window.history.replaceState(null, '', window.location.pathname);
  }, [resetFilters]);

  const handleSort = useCallback(id => {
    setSortId(id);
    const opt = SORT_OPTIONS.find(o => o.id === id) || SORT_OPTIONS[0];
    // Client-sort options don't change the API order; server-sort options do
    if (!opt.clientSort) {
      applyWith({ sortBy: opt.sortBy, sortDir: opt.sortDir });
    }
    // Update URL
    const sp = new URLSearchParams(window.location.search);
    if (id === 'relevance') sp.delete('sort'); else sp.set('sort', id);
    window.history.replaceState(null, '', sp.toString() ? `?${sp}` : window.location.pathname);
  }, [applyWith]);

  // Client-side score sort (Propedia Score options)
  const currentOpt = SORT_OPTIONS.find(o => o.id === sortId) || SORT_OPTIONS[0];
  const displayListings = useMemo(() => {
    if (!currentOpt.clientSort) return listings;
    const scored = listings.map(l => ({ l, score: computeMatchScore(l, userPrefs) ?? 50 }));
    scored.sort((a, b) => currentOpt.clientSort === 'score-desc' ? b.score - a.score : a.score - b.score);
    return scored.map(x => x.l);
  }, [listings, currentOpt, userPrefs]);

  const isLease   = filters.transactionType === 'For Lease';
  const activeCount = countActive(modalValues);

  return (
    <>
      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <header className="mp-nav" role="banner">
        <Link to="/" className="mp-nav__logo" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
          <img src={propediaLogo} alt="Propedia" style={{ height:40, width:'auto', display:'block' }} />
          <span className="mp-nav__wordmark" style={{ fontSize:18, fontWeight:700, color:'#00B4A8', letterSpacing:'-.02em' }}>Propedia</span>
        </Link>

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
              ) : suggestions.map((s, i) => {
                const isListing = s.type === 'listing';
                const isActive  = i === acIdx;
                const statusColor = s.status === 'Sold' ? 'rgba(248,113,113,.9)' : 'rgba(52,211,153,.9)';
                return (
                  <div
                    key={isListing ? `listing-${s.listingKey}` : `${s.type}-${s.label}`}
                    onMouseDown={e => { e.preventDefault(); commitSuggestion(s); }}
                    onMouseEnter={() => setAcIdx(i)}
                    style={{
                      padding:'9px 14px', fontSize:13, cursor:'pointer', display:'flex',
                      alignItems:'center', gap:8,
                      background: isActive ? 'rgba(0,180,168,.12)' : 'transparent',
                      color: isActive ? '#00B4A8' : 'rgba(255,255,255,.8)',
                      borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                    }}
                  >
                    <i className={`ti ${TYPE_ICON[s.type] || 'ti-map-pin'}`}
                       style={{ fontSize:12, color: isActive ? '#00B4A8' : isListing ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)', flexShrink:0, width:14, textAlign:'center' }}/>
                    <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.label}
                      {!isListing && s.city ? <span style={{ color:'rgba(255,255,255,.35)', marginLeft:4, fontSize:11 }}>· {s.city}</span> : null}
                    </span>
                    {isListing ? (
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:3, background: s.status === 'Sold' ? 'rgba(248,113,113,.15)' : 'rgba(52,211,153,.15)', color: statusColor, flexShrink:0 }}>
                        {s.status}
                      </span>
                    ) : (
                      <span style={{ fontSize:10, color:'rgba(255,255,255,.22)', flexShrink:0 }}>{s.display}</span>
                    )}
                  </div>
                );
              })}
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
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div className="view-toggle" role="group" aria-label="View mode">
                <button className={`view-btn${viewMode==='grid'?' active':''}`} onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode==='grid'} title="Grid"><GridIcon /></button>
                <button className={`view-btn${viewMode==='list'?' active':''}`} onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode==='list'} title="List"><ListIcon /></button>
                <button className="view-btn" onClick={() => navigate('/map')} aria-label="Map view" title="Map" style={{ display:'flex', alignItems:'center', gap:4, padding:'0 8px', fontSize:11 }}>
                  <i className="ti ti-map-2" style={{ fontSize:13 }}/>Map
                </button>
                <button className="view-btn" onClick={() => navigate('/mapsearch')} aria-label="Draw map search" title="Draw to search" style={{ display:'flex', alignItems:'center', gap:4, padding:'0 8px', fontSize:11 }}>
                  <i className="ti ti-pencil" style={{ fontSize:13 }}/>Draw
                </button>
              </div>
              <SortDropdown current={sortId} onChange={handleSort}/>
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
                : displayListings.map(l => (
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
