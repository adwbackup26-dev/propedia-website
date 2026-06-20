// src/pages/MapPage.jsx — Full-screen Mapbox listing map

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Filters from '../components/Filters.jsx';
import { formatPrice } from '../utils/format.js';
import { DEFAULT_FILTERS } from '../hooks/useListings.js';

// ── Popup card component rendered into a DOM node via innerHTML ───────────────
function popupHTML(listing, photoUrl) {
  const price   = listing.ListPrice ? formatPrice(listing.ListPrice) : '—';
  const addr    = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ') || listing.UnparsedAddress || '—';
  const city    = listing.City || '';
  const beds    = listing.BedroomsTotal    != null ? `${listing.BedroomsTotal} bd` : '';
  const baths   = listing.BathroomsTotalInteger != null ? `${listing.BathroomsTotalInteger} ba` : '';
  const specs   = [beds, baths].filter(Boolean).join(' · ');
  const img     = photoUrl
    ? `<img src="${photoUrl}" alt="" style="width:100%;height:110px;object-fit:cover;display:block;border-radius:6px 6px 0 0;"/>`
    : `<div style="width:100%;height:80px;display:flex;align-items:center;justify-content:center;background:#0C0D10;border-radius:6px 6px 0 0;font-size:28px;color:rgba(255,255,255,.08);">🏠</div>`;
  return `
    <div style="width:200px;background:#161719;border-radius:8px;overflow:hidden;font-family:DM Sans,system-ui,sans-serif;border:1px solid rgba(255,255,255,.1);">
      ${img}
      <div style="padding:10px 11px 12px;">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:2px;">${price}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${addr}${city ? ', ' + city : ''}</div>
        ${specs ? `<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:10px;">${specs}</div>` : ''}
        <a href="/listing/${listing.ListingKey}" style="display:block;text-align:center;background:#00B4A8;color:#fff;font-size:12px;font-weight:600;padding:7px 0;border-radius:6px;text-decoration:none;">View Details →</a>
      </div>
    </div>`;
}

export default function MapPage() {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const markersRef   = useRef([]);
  const popupRef     = useRef(null);

  const [token, setToken]             = useState('');
  const [tokenError, setTokenError]   = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFiltersState]    = useState(DEFAULT_FILTERS);
  const [listingCount, setListingCount] = useState(0);
  const [loading, setLoading]         = useState(false);

  const setFilters = useCallback(patch => setFiltersState(p => ({ ...p, ...patch })), []);

  // ── Plot markers — defined FIRST so fetchAndPlot can close over it ────────
  const plotMarkers = useCallback(listings => {
    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

    listings.forEach(listing => {
      // Teal circle marker element
      const el = document.createElement('div');
      el.style.cssText = `
        width:14px;height:14px;border-radius:50%;
        background:#00B4A8;border:2px solid #fff;
        cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.5);
        transition:transform .15s;
      `;
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.4)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

      el.addEventListener('click', async e => {
        e.stopPropagation();
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

        // Fetch first photo
        let photoUrl = null;
        try {
          const r = await fetch(`/api/photos?listingKey=${listing.ListingKey}&limit=1`);
          if (r.ok) { const d = await r.json(); photoUrl = d.photos?.[0]?.url || null; }
        } catch {}

        const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, maxWidth: 'none' })
          .setLngLat([listing.Longitude, listing.Latitude])
          .setHTML(popupHTML(listing, photoUrl))
          .addTo(map.current);

        // Style the Mapbox popup wrapper to be dark/transparent
        const wrapper = popup.getElement();
        if (wrapper) {
          wrapper.style.background = 'transparent';
          wrapper.style.boxShadow  = 'none';
          const tip = wrapper.querySelector('.mapboxgl-popup-tip');
          if (tip) tip.style.display = 'none';
          const content = wrapper.querySelector('.mapboxgl-popup-content');
          if (content) { content.style.background = 'transparent'; content.style.padding = '0'; content.style.boxShadow = 'none'; }
        }

        popupRef.current = popup;
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([listing.Longitude, listing.Latitude])
        .addTo(map.current);
      markersRef.current.push(marker);
    });
  }, []);

  // ── Fetch listings + plot ─────────────────────────────────────────────────
  const fetchAndPlot = useCallback(async (bounds, currentFilters) => {
    if (!map.current) return;
    setLoading(true);
    try {
      const tx = encodeURIComponent(currentFilters.transactionType || 'For Sale');
      let qs = `limit=50&transactionType=${tx}`;
      if (currentFilters.propertyType)    qs += `&propertyType=${encodeURIComponent(currentFilters.propertyType)}`;
      if (currentFilters.minPrice)        qs += `&minPrice=${currentFilters.minPrice}`;
      if (currentFilters.maxPrice)        qs += `&maxPrice=${currentFilters.maxPrice}`;
      if (currentFilters.minBeds)         qs += `&minBeds=${currentFilters.minBeds}`;
      if (currentFilters.minBaths)        qs += `&minBaths=${currentFilters.minBaths}`;
      if (currentFilters.propertySubType) qs += `&propertySubType=${encodeURIComponent(currentFilters.propertySubType)}`;
      if (currentFilters.city)            qs += `&city=${encodeURIComponent(currentFilters.city)}`;

      const res = await fetch(`/api/listings?${qs}`);
      if (!res.ok) { console.error('[MapPage] fetch failed', res.status); return; }
      const data = await res.json();

      const all = data.listings || [];
      const withCoords = all.filter(l => l.Latitude && l.Longitude);
      console.log(`[MapPage] total=${all.length} withCoords=${withCoords.length}`, withCoords[0] ? `first=(${withCoords[0].Latitude},${withCoords[0].Longitude})` : 'none');
      setListingCount(withCoords.length);
      plotMarkers(withCoords);
    } catch (err) {
      console.error('[MapPage] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [plotMarkers]);

  // ── Fetch token from server (avoids Vite build-time embedding issues) ────
  useEffect(() => {
    fetch('/api/maptoken')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setToken(d.token || ''))
      .catch(() => setTokenError(true));
  }, []);

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || map.current) return;
    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     'mapbox://styles/mapbox/dark-v11',
      bounds:    [[-79.64, 43.55], [-78.90, 44.10]], // GTA bbox
      fitBoundsOptions: { padding: 20 },
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    const onMoveEnd = () => {
      if (!map.current) return;
      setFiltersState(f => { fetchAndPlot(map.current.getBounds(), f); return f; });
    };

    map.current.on('load',    onMoveEnd);
    map.current.on('moveend', onMoveEnd);

    return () => { map.current?.remove(); map.current = null; };
  }, [token, fetchAndPlot]);

  // ── Re-fetch when filters applied ────────────────────────────────────────
  const applyFilters = useCallback(() => {
    setFiltersOpen(false);
    if (map.current) fetchAndPlot(map.current.getBounds(), filters);
  }, [filters, fetchAndPlot]);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setFiltersOpen(false);
    if (map.current) fetchAndPlot(map.current.getBounds(), DEFAULT_FILTERS);
  }, [fetchAndPlot]);

  if (tokenError) return (
    <div style={{ background:'#0C0D10', color:'#fff', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,sans-serif', flexDirection:'column', gap:12 }}>
      <p style={{ color:'rgba(255,255,255,.5)', fontSize:14 }}>Map unavailable — VITE_MAPBOX_TOKEN not configured in Vercel.</p>
      <button onClick={() => navigate('/')} style={{ background:'#00B4A8', color:'#fff', border:'none', padding:'10px 22px', borderRadius:7, cursor:'pointer', fontFamily:'inherit' }}>← Back to listings</button>
    </div>
  );

  if (!token) return (
    <div style={{ background:'#0C0D10', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'2px solid rgba(0,180,168,.3)', borderTopColor:'#00B4A8', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ position:'relative', width:'100%', height:'100vh', fontFamily:'DM Sans,system-ui,sans-serif' }}>

      {/* ── Map container ── */}
      <div ref={mapContainer} style={{ width:'100%', height:'100%' }}/>

      {/* ── Top nav bar ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:200, height:46, background:'rgba(12,13,16,.92)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', padding:'0 14px', gap:10 }}>
        <Link to="/" style={{ fontSize:18, fontWeight:600, color:'#00B4A8', letterSpacing:'-.02em', textDecoration:'none', flexShrink:0 }}>Propedia</Link>
        <span style={{ color:'rgba(255,255,255,.15)', fontSize:16 }}>›</span>
        <span style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>Map</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>
            {loading ? 'Loading…' : `${listingCount} listing${listingCount !== 1 ? 's' : ''} in view`}
          </span>
          <button onClick={() => setFiltersOpen(o => !o)} style={{
            height:30, padding:'0 12px', borderRadius:6, border:`1px solid ${filtersOpen ? '#00B4A8' : 'rgba(255,255,255,.18)'}`,
            background: filtersOpen ? 'rgba(0,180,168,.12)' : 'rgba(255,255,255,.06)',
            color: filtersOpen ? '#00B4A8' : 'rgba(255,255,255,.7)', fontSize:12, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5,
          }}>
            <i className="ti ti-adjustments-horizontal" style={{ fontSize:12 }}/>Filters
          </button>
          <button onClick={() => navigate('/')} style={{
            height:30, padding:'0 12px', borderRadius:6, border:'1px solid rgba(255,255,255,.18)',
            background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.7)', fontSize:12, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5,
          }}>
            <i className="ti ti-list" style={{ fontSize:12 }}/>List view
          </button>
        </div>
      </div>

      {/* ── Filter panel ── */}
      {filtersOpen && (
        <div style={{ position:'absolute', top:54, left:14, zIndex:300, width:320, maxHeight:'calc(100vh - 70px)', overflowY:'auto', borderRadius:10, boxShadow:'0 8px 32px rgba(0,0,0,.6)' }}>
          <Filters
            filters={filters}
            setFilters={setFilters}
            isCommercial={filters.propertyType === 'Commercial'}
            applyFilters={applyFilters}
            resetFilters={resetFilters}
          />
        </div>
      )}
    </div>
  );
}
