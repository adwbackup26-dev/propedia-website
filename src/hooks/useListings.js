// src/hooks/useListings.js — data hook with full filter/sort/pagination state

import { useState, useEffect, useCallback, useRef } from 'react';

export const DEFAULT_FILTERS = {
  transactionType: 'For Sale',
  propertyType:    'Residential',
  minPrice:        '',
  maxPrice:        '',
  minBeds:         '',
  minBaths:        '',
  propertySubType: '',
  city:            '',
  postalCode:      '',
  search:          '',
  sortBy:          'ModificationTimestamp',
  sortDir:         'desc',
};

const PAGE_SIZE = 20;

export function useListings() {
  const [filters, setFiltersState]   = useState(DEFAULT_FILTERS);
  const [applied, setApplied]        = useState(DEFAULT_FILTERS);
  const [page, setPage]              = useState(1);
  const [listings, setListings]      = useState([]);
  const [total, setTotal]            = useState(0);
  const [pages, setPages]            = useState(0);
  const [loading, setLoading]        = useState(false);
  const [error, setError]            = useState(null);
  const abortRef = useRef(null);

  const fetchListings = useCallback(async (f, p) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    const params = new URLSearchParams({ page: p, limit: PAGE_SIZE,
      ...Object.fromEntries(Object.entries(f).filter(([,v]) => v !== '')) });
    try {
      const res = await fetch(`/api/listings?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setListings(data.listings || []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e.message); setListings([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchListings(applied, page); }, [applied, page, fetchListings]);

  const setFilters = useCallback(patch => setFiltersState(p => ({ ...p, ...patch })), []);
  const applyFilters = useCallback(() => { setApplied(filters); setPage(1); }, [filters]);
  const applyWith = useCallback(patch => {
    setFiltersState(p => { const next = { ...p, ...patch }; setApplied(next); return next; });
    setPage(1);
  }, []);
  const resetFilters = useCallback(() => { setFiltersState(DEFAULT_FILTERS); setApplied(DEFAULT_FILTERS); setPage(1); }, []);
  const goToPage = useCallback(p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  return { listings, total, pages, page, filters, loading, error, setFilters, applyFilters, applyWith, resetFilters, goToPage };
}

export function getVOWSession() {
  try { return document.cookie.split(';').some(c => c.trim().startsWith('propedia_vow=1')); } catch { return false; }
}
export function getUserPrefs() {
  try {
    const raw = document.cookie.split(';').find(c => c.trim().startsWith('propedia_prefs='));
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=')));
  } catch { return null; }
}

const MAX_COMPARE = 5;
export function useCompare() {
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('propedia_compare') || '[]'); } catch { return []; }
  });
  const persist = next => { setSaved(next); try { sessionStorage.setItem('propedia_compare', JSON.stringify(next)); } catch {} };
  const toggleSave = useCallback(listing => {
    setSaved(prev => {
      const exists = prev.some(l => l.ListingKey === listing.ListingKey);
      const next = exists ? prev.filter(l => l.ListingKey !== listing.ListingKey)
        : prev.length >= MAX_COMPARE ? [...prev.slice(1), listing] : [...prev, listing];
      try { sessionStorage.setItem('propedia_compare', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const isSaved = useCallback(key => saved.some(l => l.ListingKey === key), [saved]);
  const clearAll = useCallback(() => persist([]), []);
  return { saved, toggleSave, isSaved, clearAll, maxCompare: MAX_COMPARE };
}
