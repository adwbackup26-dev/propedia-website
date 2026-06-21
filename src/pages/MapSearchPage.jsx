// src/pages/MapSearchPage.jsx — Leaflet map search with draw tools

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import pip from 'point-in-polygon';

// ── Haversine distance (meters) ────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmt(n) {
  if (!n) return '';
  return '$' + Math.round(n).toLocaleString('en-CA');
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GTA = { center: [43.65, -79.4], zoom: 11 };

const STYLE_ON  = { radius: 7, color: '#00B4A8', weight: 2, opacity: 0.9, fillColor: '#00B4A8', fillOpacity: 0.75 };
const STYLE_DIM = { radius: 5, color: '#555',    weight: 1, opacity: 0.3, fillColor: '#444',    fillOpacity: 0.25 };
const DRAW_STYLE = { color: '#00B4A8', fillColor: '#00B4A8', fillOpacity: 0.1, weight: 2.5 };

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapSearchPage() {
  const navigate      = useNavigate();
  const mapEl         = useRef(null);
  const map           = useRef(null);
  const drawnLayer    = useRef(null);
  const markersRef    = useRef([]);     // [{ marker, listing }]
  const drawHandlers  = useRef({});

  const [listings,   setListings]   = useState([]);
  const [filtered,   setFiltered]   = useState(null);   // null = no shape drawn
  const [activeTool, setActiveTool] = useState(null);   // 'circle' | 'polygon' | null
  const [loading,    setLoading]    = useState(true);

  // ── Init map (once) ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current || !mapEl.current) return;

    // Leaflet-draw rewrites the default icon path; reset it so other code isn't affected
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });

    map.current = L.map(mapEl.current, { center: GTA.center, zoom: GTA.zoom });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    drawnLayer.current = new L.FeatureGroup().addTo(map.current);

    // Draw handlers — triggered programmatically from toolbar buttons
    drawHandlers.current.circle = new L.Draw.Circle(map.current, { shapeOptions: DRAW_STYLE, repeatMode: false });
    drawHandlers.current.polygon = new L.Draw.Polygon(map.current, {
      shapeOptions: DRAW_STYLE,
      allowIntersection: false,
      repeatMode: false,
    });

    // When a shape is finished
    map.current.on(L.Draw.Event.CREATED, e => {
      console.log('[MapSearch] draw:created fired, layerType:', e.layerType);
      drawnLayer.current.clearLayers();
      drawnLayer.current.addLayer(e.layer);
      setActiveTool(null);

      const inside = [];

      if (e.layerType === 'circle') {
        const { lat, lng } = e.layer.getLatLng();
        const radius = e.layer.getRadius();
        console.log('[MapSearch] Circle drawn — center:', lat, lng, '| radius (m):', radius);
        console.log('[MapSearch] Total markers in ref:', markersRef.current.length);

        markersRef.current.forEach(({ marker, listing }, i) => {
          const dist = haversine(lat, lng, listing.Latitude, listing.Longitude);
          if (i < 3) console.log(`[MapSearch] Listing #${i} lat=${listing.Latitude} lng=${listing.Longitude} dist=${Math.round(dist)}m radius=${Math.round(radius)}m hit=${dist <= radius}`);
          const hit = dist <= radius;
          marker.setStyle(hit ? STYLE_ON : STYLE_DIM);
          if (hit) inside.push(listing);
        });

        console.log('[MapSearch] Circle filter — listings total:', markersRef.current.length, '| inside:', inside.length);

      } else if (e.layerType === 'polygon') {
        const ring    = e.layer.getLatLngs()[0];
        const polygon = ring.map(ll => [ll.lng, ll.lat]);
        console.log('[MapSearch] Polygon drawn — points:', ring.length, '| markers:', markersRef.current.length);

        markersRef.current.forEach(({ marker, listing }, i) => {
          const hit = pip([listing.Longitude, listing.Latitude], polygon);
          if (i < 3) console.log(`[MapSearch] Listing #${i} lng=${listing.Longitude} lat=${listing.Latitude} hit=${!!hit}`);
          marker.setStyle(hit ? STYLE_ON : STYLE_DIM);
          if (hit) inside.push(listing);
        });

        console.log('[MapSearch] Polygon filter — listings total:', markersRef.current.length, '| inside:', inside.length);
      }

      setFiltered(inside);
    });

    return () => { map.current?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch listings (4 pages × 50, keep those with coords) ───────────────────
  useEffect(() => {
    setLoading(true);
    console.log('[MapSearch] Fetching listings from API...');

    Promise.allSettled([
      fetch('/api/listings?limit=50&page=1&transactionType=For%20Sale&sortBy=ModificationTimestamp&sortDir=desc'),
      fetch('/api/listings?limit=50&page=2&transactionType=For%20Sale&sortBy=ModificationTimestamp&sortDir=desc'),
      fetch('/api/listings?limit=50&page=3&transactionType=For%20Sale&sortBy=ModificationTimestamp&sortDir=desc'),
      fetch('/api/listings?limit=50&page=4&transactionType=For%20Sale&sortBy=ModificationTimestamp&sortDir=desc'),
    ]).then(async results => {
      console.log('[MapSearch] Fetch results:', results.map(r => r.status));

      const allListings = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const data = await result.value.json();
          console.log('[MapSearch] API response — status:', result.value.status, '| listings count:', data.listings?.length ?? 0, '| total:', data.total, '| sample lat/lng:', data.listings?.[0]?.Latitude, data.listings?.[0]?.Longitude);
          allListings.push(...(data.listings || []));
        } else {
          console.error('[MapSearch] Fetch failed:', result.reason);
        }
      }

      console.log('[MapSearch] Total listings fetched:', allListings.length);
      const withCoords = allListings.filter(l => l.Latitude && l.Longitude);
      console.log('[MapSearch] Listings with Latitude+Longitude:', withCoords.length, '(will be plotted as markers)');
      if (withCoords.length === 0 && allListings.length > 0) {
        console.warn('[MapSearch] ⚠️  All', allListings.length, 'listings are missing coordinates — TRREB Latitude/Longitude fields are empty. Geocoding fallback needed.');
      }
      setListings(withCoords);
      setLoading(false);
    });
  }, []);

  // ── Plot circle markers when listings arrive ───────────────────────────────
  useEffect(() => {
    if (!map.current || !listings.length) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];

    console.log('[MapSearch] Plotting', listings.length, 'listings as markers');
    if (listings[0]) console.log('[MapSearch] First listing sample — lat:', listings[0].Latitude, 'lng:', listings[0].Longitude, 'key:', listings[0].ListingKey);

    listings.forEach(listing => {
      const marker = L.circleMarker([listing.Latitude, listing.Longitude], STYLE_ON)
        .addTo(map.current);

      marker.on('click', () => {
        const addr  = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ');
        const beds  = listing.BedroomsTotal;
        const baths = listing.BathroomsTotalInteger;
        const key   = listing.ListingKey;

        // Build popup DOM
        const wrap = document.createElement('div');
        wrap.style.cssText = 'width:190px;font-family:DM Sans,system-ui,sans-serif;color:#fff;';
        wrap.innerHTML = `
          <div class="ph-img" style="width:100%;height:95px;background:#0C0D10;display:flex;align-items:center;justify-content:center;font-size:26px;color:rgba(255,255,255,.12);">⌂</div>
          <div style="padding:10px 12px 12px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:3px;">${fmt(listing.ListPrice)}</div>
            <div style="color:rgba(255,255,255,.45);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px;">${addr || 'Address not listed'}</div>
            <div style="color:rgba(255,255,255,.3);font-size:11px;margin-bottom:10px;">${listing.City || ''}${beds ? ' · ' + beds + ' bd' : ''}${baths ? ' · ' + baths + ' ba' : ''}</div>
            <button data-key="${key}" style="width:100%;height:34px;background:#00B4A8;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">View Details →</button>
          </div>`;

        // Lazy-load first photo
        fetch(`/api/photos?listingKey=${encodeURIComponent(key)}&limit=1`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            const url = d?.photos?.[0]?.url;
            if (url) {
              const imgEl = wrap.querySelector('.ph-img');
              if (imgEl) imgEl.innerHTML = `<img src="${url}" style="width:100%;height:95px;object-fit:cover;display:block;" loading="lazy"/>`;
            }
          }).catch(() => {});

        const popup = L.popup({
          maxWidth: 200, minWidth: 200,
          className: 'pp-dark',
          closeButton: true,
          autoPan: true,
        }).setContent(wrap);

        marker.bindPopup(popup).openPopup();

        wrap.querySelector('[data-key]').addEventListener('click', () => {
          navigate(`/listing/${key}`);
        });
      });

      markersRef.current.push({ marker, listing });
    });
  }, [listings, navigate]);

  // ── Toolbar actions ───────────────────────────────────────────────────────────
  const activateTool = tool => {
    Object.values(drawHandlers.current).forEach(h => { try { h.disable(); } catch {} });
    if (activeTool === tool) { setActiveTool(null); return; }
    console.log('[MapSearch] Enabling draw tool:', tool, '| handler:', !!drawHandlers.current[tool]);
    drawHandlers.current[tool]?.enable();
    setActiveTool(tool);
  };

  const handleReset = () => {
    Object.values(drawHandlers.current).forEach(h => { try { h.disable(); } catch {} });
    drawnLayer.current?.clearLayers();
    markersRef.current.forEach(({ marker }) => marker.setStyle(STYLE_ON));
    map.current?.setView(GTA.center, GTA.zoom);
    map.current?.closePopup();
    setFiltered(null);
    setActiveTool(null);
  };

  const hasShape       = filtered !== null;
  const resultCount    = filtered?.length ?? 0;
  const showResults    = hasShape;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0C0D10', fontFamily:'DM Sans,system-ui,sans-serif', color:'#fff', overflow:'hidden' }}>

      {/* Leaflet popup dark theme */}
      <style>{`
        .pp-dark .leaflet-popup-content-wrapper {
          background: #161719 !important;
          color: #fff !important;
          border: 1px solid rgba(0,180,168,.3) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 28px rgba(0,0,0,.6) !important;
          padding: 0 !important;
          overflow: hidden;
        }
        .pp-dark .leaflet-popup-content { margin: 0 !important; line-height: 1 !important; }
        .pp-dark .leaflet-popup-tip { background: #161719 !important; }
        .leaflet-draw-toolbar a { background-color: #161719 !important; }
      `}</style>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, background: '#161719', borderBottom: '1px solid rgba(255,255,255,.08)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8, flexShrink: 0,
        zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ height:34, padding:'0 12px', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, background:'transparent', color:'rgba(255,255,255,.65)', fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}
        >
          ← Back
        </button>

        <span style={{ fontWeight:700, fontSize:14, flex:1 }}>Map Search</span>

        {/* Draw: Circle */}
        <button
          onClick={() => activateTool('circle')}
          title="Draw a circle to select area"
          style={{
            height:34, padding:'0 12px', borderRadius:7, fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5,
            border: `1.5px solid ${activeTool === 'circle' ? '#00B4A8' : 'rgba(255,255,255,.14)'}`,
            background: activeTool === 'circle' ? 'rgba(0,180,168,.15)' : 'transparent',
            color: activeTool === 'circle' ? '#00B4A8' : 'rgba(255,255,255,.6)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="5.5"/></svg>
          Circle
        </button>

        {/* Draw: Polygon */}
        <button
          onClick={() => activateTool('polygon')}
          title="Draw a polygon to select area"
          style={{
            height:34, padding:'0 12px', borderRadius:7, fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5,
            border: `1.5px solid ${activeTool === 'polygon' ? '#00B4A8' : 'rgba(255,255,255,.14)'}`,
            background: activeTool === 'polygon' ? 'rgba(0,180,168,.15)' : 'transparent',
            color: activeTool === 'polygon' ? '#00B4A8' : 'rgba(255,255,255,.6)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7,2 12,11 2,11"/></svg>
          Freeform
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          style={{ height:34, padding:'0 12px', border:'1px solid rgba(255,255,255,.12)', borderRadius:7, background:'transparent', color:'rgba(255,255,255,.45)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
        >
          Reset
        </button>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        <div ref={mapEl} style={{ width:'100%', height:'100%' }}/>

        {/* Loading badge */}
        {loading && (
          <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', background:'rgba(22,23,25,.93)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'8px 16px', fontSize:12, color:'rgba(255,255,255,.6)', zIndex:1000, pointerEvents:'none', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ display:'inline-block', width:10, height:10, border:'2px solid #00B4A8', borderTopColor:'transparent', borderRadius:'50%', animation:'mapspin .8s linear infinite' }}/>
            Loading listings…
          </div>
        )}

        {/* Count badge (after load) */}
        {!loading && !hasShape && (
          <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', background:'rgba(22,23,25,.88)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'7px 14px', fontSize:11, color:'rgba(255,255,255,.5)', zIndex:500, pointerEvents:'none' }}>
            {listings.length} listings loaded · draw a shape to filter
          </div>
        )}

        {/* Active tool hint */}
        {activeTool === 'circle' && (
          <div style={{ position:'absolute', bottom:hasShape ? 8 : 14, left:'50%', transform:'translateX(-50%)', background:'rgba(0,180,168,.13)', border:'1px solid rgba(0,180,168,.35)', borderRadius:8, padding:'9px 18px', fontSize:12, color:'#00B4A8', zIndex:500, pointerEvents:'none', fontWeight:600, whiteSpace:'nowrap' }}>
            Click and drag on the map to draw a circle
          </div>
        )}
        {activeTool === 'polygon' && (
          <div style={{ position:'absolute', bottom:hasShape ? 8 : 14, left:'50%', transform:'translateX(-50%)', background:'rgba(0,180,168,.13)', border:'1px solid rgba(0,180,168,.35)', borderRadius:8, padding:'9px 18px', fontSize:12, color:'#00B4A8', zIndex:500, pointerEvents:'none', fontWeight:600, whiteSpace:'nowrap' }}>
            Click to place points · Double-click to finish polygon
          </div>
        )}

        <style>{`@keyframes mapspin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ── Results panel ───────────────────────────────────────────────────── */}
      {showResults && (
        <div style={{ background:'#161719', borderTop:'1px solid rgba(255,255,255,.08)', flexShrink:0 }}>
          {/* Header */}
          <div style={{ padding:'9px 14px 5px', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>
              <strong style={{ color:'#00B4A8', fontSize:14 }}>{resultCount}</strong>{' '}
              {resultCount === 1 ? 'property' : 'properties'} found in selected area
            </span>
            {resultCount === 0 && (
              <span style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginLeft:4 }}>— try a larger shape</span>
            )}
          </div>

          {/* Cards */}
          {resultCount > 0 && (
            <div style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 14px 12px', WebkitOverflowScrolling:'touch', maxHeight:210 }}>
              {filtered.map(l => {
                const addr = [l.StreetNumber, l.StreetName].filter(Boolean).join(' ');
                return (
                  <div
                    key={l.ListingKey}
                    onClick={() => navigate(`/listing/${l.ListingKey}`)}
                    style={{ minWidth:148, maxWidth:148, background:'#0C0D10', border:'1px solid rgba(255,255,255,.07)', borderRadius:8, overflow:'hidden', cursor:'pointer', flexShrink:0, transition:'border-color .12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,180,168,.4)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'}
                  >
                    <div style={{ height:76, background:'rgba(0,180,168,.04)', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.12)', fontSize:22 }}>⌂</div>
                    <div style={{ padding:'8px 9px 10px' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:2 }}>{fmt(l.ListPrice)}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>{addr || l.City}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.25)' }}>
                        {[l.BedroomsTotal && `${l.BedroomsTotal} bd`, l.BathroomsTotalInteger && `${l.BathroomsTotalInteger} ba`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
