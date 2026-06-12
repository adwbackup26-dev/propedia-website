// src/components/ListingCard.jsx — dark photo-first card with carousel + mortgage estimate

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AvailableButton from './AvailableButton.jsx';
import { formatPrice, formatAddress, formatCityLine, formatDOM, domIsHigh,
         propertyTypeLabel, computeMatchScore, estimateMortgage } from '../utils/format.js';

export function ListingCardSkeleton() {
  return (
    <div className="listing-card" style={{ pointerEvents:'none' }}>
      <div className="skeleton" style={{ paddingTop:'58%' }}/>
      <div style={{ padding:'13px 14px' }}>
        <div className="skeleton" style={{ height:14, width:'50%', borderRadius:4, marginBottom:10 }}/>
        <div className="skeleton" style={{ height:11, width:'75%', borderRadius:4, marginBottom:7 }}/>
        <div className="skeleton" style={{ height:11, width:'55%', borderRadius:4 }}/>
      </div>
    </div>
  );
}

export default function ListingCard({ listing, isSaved, onSave, userPrefs = null, listView = false }) {
  const navigate = useNavigate();
  const [photoIdx, setPhotoIdx] = useState(0);

  // Sort photos by Order
  const photos = (listing.Media || [])
    .filter(m => m.MediaURL)
    .sort((a, b) => (a.Order ?? 999) - (b.Order ?? 999));
  const photo     = photos[photoIdx]?.MediaURL || null;
  const photoCount = photos.length;

  const price      = listing.ListPrice;
  const address    = formatAddress(listing);
  const cityLine   = formatCityLine(listing);
  const dom        = listing.DaysOnMarket;
  const domHigh    = domIsHigh(dom);
  const subType    = propertyTypeLabel(listing.PropertySubType);
  const isLease    = listing.TransactionType === 'For Lease';
  const matchScore = computeMatchScore(listing, userPrefs);
  const mortgage   = !isLease && price ? estimateMortgage(price) : null;

  const prevPhoto = e => { e.stopPropagation(); setPhotoIdx(i => (i - 1 + photoCount) % photoCount); };
  const nextPhoto = e => { e.stopPropagation(); setPhotoIdx(i => (i + 1) % photoCount); };
  const handleCard = () => navigate(`/listing/${listing.ListingKey}`);
  const handleSave = e => { e.stopPropagation(); onSave?.(listing); };

  return (
    <article
      className={`listing-card${listView ? ' listing-card--list' : ''}`}
      onClick={handleCard}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleCard()}
      aria-label={`${address} — ${formatPrice(price)}`}
    >
      {/* ── Photo ─────────────────────────────────────────────────────── */}
      <div className={`card-photo`} style={{
        position: 'relative',
        ...(listView ? {} : { paddingTop: '58%' }),
        background: '#1e2028', overflow: 'hidden', flexShrink: 0,
      }}>
        {photo ? (
          <img src={photo} alt={address}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', transition:'transform .4s' }}
            loading="lazy" decoding="async"/>
        ) : (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-building-estate" style={{ fontSize:38, color:'rgba(255,255,255,.08)' }} aria-hidden="true"/>
          </div>
        )}

        {/* Carousel arrows */}
        {photoCount > 1 && <>
          <button onClick={prevPhoto} aria-label="Previous photo"
            style={{ position:'absolute', left:0, top:0, bottom:0, width:34, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s,color .2s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.5)';e.currentTarget.style.color='rgba(255,255,255,.9)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)';e.currentTarget.style.color='rgba(255,255,255,0)'}}>‹</button>
          <button onClick={nextPhoto} aria-label="Next photo"
            style={{ position:'absolute', right:0, top:0, bottom:0, width:34, background:'rgba(0,0,0,0)', border:'none', color:'rgba(255,255,255,0)', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s,color .2s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.5)';e.currentTarget.style.color='rgba(255,255,255,.9)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)';e.currentTarget.style.color='rgba(255,255,255,0)'}}>›</button>
        </>}

        {/* Status badge */}
        <span style={{ position:'absolute', top:10, left:10, fontSize:9, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', padding:'3px 9px', borderRadius:4, background: isLease ? 'rgba(59,130,246,.85)' : 'rgba(16,185,129,.85)', color:'#fff' }}>
          {listing.TransactionType}
        </span>

        {/* DOM badge */}
        {dom !== null && dom !== undefined && (
          <span style={{ position:'absolute', top:10, right:42, fontSize:9, fontWeight:600, padding:'3px 7px', borderRadius:4, background: domHigh ? 'rgba(239,68,68,.7)' : 'rgba(0,0,0,.55)', color:'rgba(255,255,255,.85)' }}>
            {dom === 0 ? 'New' : `${dom}d`}
          </span>
        )}

        {/* Photo count */}
        {photoCount > 1 && (
          <span style={{ position:'absolute', bottom:10, right:10, fontSize:9, padding:'3px 7px', borderRadius:4, background:'rgba(0,0,0,.55)', color:'rgba(255,255,255,.6)' }}>
            {photoIdx + 1} / {photoCount}
          </span>
        )}

        {/* Save to Compare */}
        <button onClick={handleSave}
          style={{ position:'absolute', top:8, right:8, width:28, height:28, borderRadius:'50%', border:'none', background: isSaved ? 'var(--teal)' : 'rgba(0,0,0,.55)', color: isSaved ? '#fff' : 'rgba(255,255,255,.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}
          title={isSaved ? 'Remove from compare' : 'Save to DeepCompare'} aria-label={isSaved ? 'Remove' : 'Save to compare'} aria-pressed={isSaved}>
          <i className={`ti ${isSaved ? 'ti-check' : 'ti-plus'}`} style={{ fontSize:12 }} aria-hidden="true"/>
        </button>
      </div>

      {/* ── Card body ─────────────────────────────────────────────────── */}
      <div style={{ padding:'13px 14px', flex:1, display:'flex', flexDirection:'column' }}>
        {/* Price */}
        <div style={{ fontSize:20, fontWeight:600, color:'var(--text-1)', letterSpacing:'-.025em', marginBottom:3 }}>
          {formatPrice(price)}
          {isLease && <span style={{ fontSize:11, fontWeight:400, color:'var(--text-4)' }}>/mo</span>}
        </div>

        {/* Mortgage estimate — For Sale only */}
        {mortgage && (
          <div style={{ fontSize:11, color:'rgba(0,180,168,.8)', marginBottom:8 }}>
            Est. {formatPrice(mortgage)}/mo{' '}
            <span style={{ color:'var(--text-4)', fontSize:10 }}>P&amp;I · 10% down · 5.49%</span>
          </div>
        )}

        <p style={{ fontSize:13, fontWeight:500, color:'var(--text-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:2 }}>{address}</p>
        <p style={{ fontSize:11, color:'var(--text-4)', marginBottom:10 }}>{cityLine}</p>

        {/* Specs */}
        <div style={{ display:'flex', marginBottom:9 }}>
          {listing.BedroomsTotal != null && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-3)', paddingRight:9, marginRight:9, borderRight:'1px solid var(--border)' }}><i className="ti ti-bed" style={{fontSize:12}} aria-hidden="true"/> {listing.BedroomsTotal} bd</span>}
          {listing.BathroomsTotalInteger != null && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-3)', paddingRight:9, marginRight:9, borderRight:'1px solid var(--border)' }}><i className="ti ti-bath" style={{fontSize:12}} aria-hidden="true"/> {listing.BathroomsTotalInteger} ba</span>}
          {listing.LivingArea > 0 && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-3)' }}><i className="ti ti-ruler-measure" style={{fontSize:12}} aria-hidden="true"/> {Math.round(listing.LivingArea).toLocaleString()}</span>}
        </div>

        {/* Type chip */}
        <span style={{ fontSize:9, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', padding:'3px 9px', borderRadius:4, background:'var(--teal-lt)', color:'var(--teal-mid)', display:'inline-block', marginBottom:12 }}>
          {subType}
        </span>

        {/* Match score */}
        {matchScore !== null && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--teal)', marginBottom:10 }}>
            <span>{matchScore}% match</span>
            <div style={{ flex:1, height:3, background:'rgba(0,180,168,.12)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${matchScore}%`, background:'var(--teal)', borderRadius:2 }}/>
            </div>
          </div>
        )}

        <AvailableButton listing={listing} compact={listView}/>
      </div>

      {/* ── Compliance ─────────────────────────────────────────────────── */}
      <footer style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 14px', borderTop:'1px solid var(--border)' }}>
        <span style={{ fontSize:10, color:'var(--text-4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>
          {listing.ListAgentFullName
            ? `${listing.ListAgentFullName} · ${listing.ListOfficeName || ''}`
            : listing.ListOfficeName || ''}
        </span>
        <span style={{ fontSize:10, color:'var(--text-4)', flexShrink:0 }}>
          MLS® {listing.ListingId || listing.ListingKey}
        </span>
      </footer>
    </article>
  );
}
