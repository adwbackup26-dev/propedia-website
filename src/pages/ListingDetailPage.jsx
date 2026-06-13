// src/pages/ListingDetailPage.jsx — Single listing detail view
// Full property details · photo gallery · agent info · lead capture

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AvailableButton from '../components/AvailableButton.jsx';
import { formatPrice, formatAddress, formatCityLine, domIsHigh, propertyTypeLabel, estimateMortgage } from '../utils/format.js';

export default function ListingDetailPage() {
  const { listingKey } = useParams();
  const navigate = useNavigate();
  
  // DEBUG: Log the listingKey to see if it's being passed correctly
  console.log('ListingDetailPage - listingKey from URL:', listingKey);
  
  const [listing, setListing] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch listing detail
  useEffect(() => {
    const fetchListing = async () => {
      try {
        if (!listingKey) {
          setError('No listing key provided');
          setLoading(false);
          return;
        }
        
        const url = `/api/listing?listingKey=${encodeURIComponent(listingKey)}`;
        console.log('Fetching listing from:', url);
        
        const res = await fetch(url);
        console.log('Listing API response status:', res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error('Listing API error:', errorData);
          throw new Error(errorData.error || 'Failed to fetch listing');
        }
        
        const data = await res.json();
        console.log('Listing data received:', data);
        setListing(data.listing);
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError(err.message);
      }
    };
    
    fetchListing();
  }, [listingKey]);

  // Fetch photos
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        if (!listingKey) return;
        
        const res = await fetch(`/api/photos?listingKey=${encodeURIComponent(listingKey)}`);
        if (res.ok) {
          const data = await res.json();
          setPhotos(data.photos || []);
        }
      } catch (err) {
        console.error('Failed to fetch photos:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPhotos();
  }, [listingKey]);

  if (error) return <div style={{ padding:'40px', textAlign:'center', color:'var(--red)' }}>Error: {error}</div>;
  if (loading) return <div style={{ padding:'40px', textAlign:'center' }}>Loading…</div>;
  if (!listing) return <div style={{ padding:'40px', textAlign:'center' }}>Listing not found</div>;

  const photo = photos[photoIdx]?.url || null;
  const photoCount = photos.length;
  const price = listing.ListPrice;
  const address = formatAddress(listing);
  const cityLine = formatCityLine(listing);
  const dom = listing.DaysOnMarket;
  const domHigh = domIsHigh(dom);
  const subType = propertyTypeLabel(listing.PropertySubType);
  const isLease = listing.TransactionType === 'For Lease';
  const mortgage = !isLease && price ? estimateMortgage(price) : null;

  const prevPhoto = () => setPhotoIdx(i => (i - 1 + photoCount) % photoCount);
  const nextPhoto = () => setPhotoIdx(i => (i + 1) % photoCount);

  return (
    <div className="detail-page" style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text-1)' }}>
      {/* Header nav */}
      <header style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={() => navigate(-1)} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:18 }} title="Go back">←</button>
        <span style={{ fontSize:14, fontWeight:600 }}>Listing Details</span>
        <div style={{ width:20 }}/>
      </header>

      {/* Main content */}
      <main style={{ maxWidth:'100%', padding:'20px' }}>
        {/* Photo gallery */}
        <div style={{ position:'relative', paddingTop:'66%', background:'#1e2028', borderRadius:8, overflow:'hidden', marginBottom:20 }}>
          {photo ? (
            <img src={photo} alt={address}
              style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
              onError={e => e.target.style.display='none'}/>
          ) : (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-building-estate" style={{ fontSize:48, color:'rgba(255,255,255,.08)' }}/>
            </div>
          )}

          {/* Carousel controls */}
          {photoCount > 1 && <>
            <button onClick={prevPhoto} style={{ position:'absolute', left:0, top:0, bottom:0, width:40, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }} onMouseEnter={e=>{e.target.style.background='rgba(0,0,0,.5)';e.target.style.color='rgba(255,255,255,.9)'}} onMouseLeave={e=>{e.target.style.background='rgba(0,0,0,0)';e.target.style.color='rgba(255,255,255,0)'}}>‹</button>
            <button onClick={nextPhoto} style={{ position:'absolute', right:0, top:0, bottom:0, width:40, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }} onMouseEnter={e=>{e.target.style.background='rgba(0,0,0,.5)';e.target.style.color='rgba(255,255,255,.9)'}} onMouseLeave={e=>{e.target.style.background='rgba(0,0,0,0)';e.target.style.color='rgba(255,255,255,0)'}}>›</button>
          </>}

          {/* Photo counter */}
          {photoCount > 1 && (
            <span style={{ position:'absolute', bottom:12, right:12, fontSize:12, padding:'4px 8px', borderRadius:4, background:'rgba(0,0,0,.55)', color:'rgba(255,255,255,.6)' }}>
              {photoIdx+1} / {photoCount}
            </span>
          )}
        </div>

        {/* Property info */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:28, fontWeight:700, marginBottom:8, letterSpacing:'-.025em' }}>
            {formatPrice(price)}
            {isLease && <span style={{ fontSize:13, fontWeight:400, color:'var(--text-4)' }}>/mo</span>}
          </div>

          {mortgage && (
            <div style={{ fontSize:12, color:'rgba(0,180,168,.8)', marginBottom:12 }}>
              Est. {formatPrice(mortgage)}/mo · <span style={{ color:'var(--text-4)' }}>P&I · 10% down · 5.49%</span>
            </div>
          )}

          <h1 style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>{address}</h1>
          <p style={{ fontSize:13, color:'var(--text-4)', marginBottom:12 }}>{cityLine}</p>

          {/* Specs */}
          <div style={{ display:'flex', gap:16, marginBottom:12, padding:'12px 0', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
            {listing.BedroomsTotal != null && <span style={{ fontSize:12, color:'var(--text-3)' }}><strong>{listing.BedroomsTotal}</strong> bed{listing.BedroomsTotal!==1?'s':''}</span>}
            {listing.BathroomsTotalInteger != null && <span style={{ fontSize:12, color:'var(--text-3)' }}><strong>{listing.BathroomsTotalInteger}</strong> bath{listing.BathroomsTotalInteger!==1?'s':''}</span>}
            {dom !== null && dom !== undefined && <span style={{ fontSize:12, color: domHigh ? 'var(--red)' : 'var(--text-3)' }}><strong>{dom === 0 ? 'New' : `${dom}d`}</strong> on market</span>}
          </div>

          {/* Type */}
          <span style={{ fontSize:10, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', padding:'6px 10px', borderRadius:4, background:'var(--teal-lt)', color:'var(--teal-mid)', display:'inline-block', marginBottom:16 }}>
            {subType}
          </span>

          {/* Description */}
          <p style={{ fontSize:13, lineHeight:1.6, color:'var(--text-2)', marginBottom:16 }}>
            {listing.PublicRemarks || 'No description provided.'}
          </p>
        </div>

        {/* CTA rail */}
        <div style={{ background:'var(--bg-2)', padding:16, borderRadius:8, marginBottom:20 }}>
          <AvailableButton listing={listing}/>
        </div>

        {/* Agent info */}
        <div style={{ padding:16, background:'var(--bg-2)', borderRadius:8 }}>
          <h3 style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--text-4)', marginBottom:8 }}>Listing Agent</h3>
          <p style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{listing.ListAgentFullName || 'Not available'}</p>
          <p style={{ fontSize:12, color:'var(--text-4)' }}>{listing.ListOfficeName || 'Not available'}</p>
          {listing.ListingId && <p style={{ fontSize:11, color:'var(--text-4)', marginTop:8 }}>MLS® {listing.ListingId}</p>}
        </div>
      </main>
    </div>
  );
}