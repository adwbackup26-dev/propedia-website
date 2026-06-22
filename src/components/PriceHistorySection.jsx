// src/components/PriceHistorySection.jsx
// Premium price history section with VOW signup wall for non-members.
//
// Data is derived from TRREB fields on the listing object:
//   OriginalListPrice  — price when first listed
//   ListPrice          — current asking price
//   ClosePrice         — sale price (if sold)
//   ModificationTimestamp — used as listing date (ListDate doesn't exist in TRREB)
//   CloseDate          — date sold (if sold)
//   DaysOnMarket       — DOM counter

import React, { useMemo } from 'react';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Math.round(n).toLocaleString('en-CA');
}

function fmtDate(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' });
}

// Build a price-event array from the single TRREB listing record.
// TRREB doesn't provide a full event log, so we reconstruct from available fields.
function buildHistory(listing) {
  const events = [];
  const {
    OriginalListPrice, ListPrice, ClosePrice,
    CloseDate, ModificationTimestamp,
    StandardStatus,
  } = listing;

  const originalPrice = OriginalListPrice || ListPrice;

  // 1. Listed event
  if (originalPrice) {
    events.push({
      date:   ModificationTimestamp,
      event:  'Listed',
      price:  originalPrice,
      change: null,
    });
  }

  // 2. Price change event (if current price differs from original)
  if (ListPrice && originalPrice && ListPrice !== originalPrice) {
    const delta = ListPrice - originalPrice;
    events.push({
      date:   ModificationTimestamp,
      event:  delta < 0 ? 'Price reduced' : 'Price increased',
      price:  ListPrice,
      change: delta,
    });
  }

  // 3. Sold event
  if (ClosePrice && CloseDate) {
    const delta = ClosePrice - (ListPrice || originalPrice || 0);
    events.push({
      date:   CloseDate,
      event:  'Sold',
      price:  ClosePrice,
      change: delta,
    });
  } else if (StandardStatus === 'Closed' && ClosePrice) {
    events.push({
      date:   ModificationTimestamp,
      event:  'Sold',
      price:  ClosePrice,
      change: null,
    });
  }

  // Sort ascending by date
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

// ── shared style tokens ───────────────────────────────────────────────────────
const card = {
  background: '#161719', borderRadius: 12,
  border: '1px solid rgba(255,255,255,.08)', marginBottom: 14, overflow: 'hidden',
};
const sh  = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 7 };
const shI = { fontSize: 13, color: '#00B4A8' };

// ── table ─────────────────────────────────────────────────────────────────────
function HistoryTable({ rows }) {
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
      <thead>
        <tr style={{ background:'rgba(0,180,168,.08)' }}>
          {['Date','Event','Price','Change'].map(h => (
            <th key={h} style={{
              padding:'10px 14px', textAlign: h === 'Price' || h === 'Change' ? 'right' : 'left',
              color:'#00B4A8', fontWeight:600, fontSize:11, letterSpacing:'.04em',
              borderBottom:'1px solid rgba(0,180,168,.15)',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const changeColor = row.change == null ? 'rgba(255,255,255,.3)'
            : row.change < 0 ? '#F87171' : '#34D399';
          const changeText = row.change == null ? '—'
            : (row.change < 0 ? '−' : '+') + fmt(Math.abs(row.change)).replace('$','$');
          return (
            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.05)' }}>
              <td style={{ padding:'11px 14px', color:'rgba(255,255,255,.55)', whiteSpace:'nowrap' }}>
                {fmtDate(row.date)}
              </td>
              <td style={{ padding:'11px 14px', color:'rgba(255,255,255,.85)', fontWeight:500 }}>
                {row.event}
              </td>
              <td style={{ padding:'11px 14px', textAlign:'right', color:'#fff', fontWeight:600, whiteSpace:'nowrap' }}>
                {fmt(row.price)}
              </td>
              <td style={{ padding:'11px 14px', textAlign:'right', color:changeColor, fontWeight:500, whiteSpace:'nowrap' }}>
                {changeText}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── placeholder rows shown blurred to non-members ─────────────────────────────
function buildPlaceholderRows(listing) {
  const price = listing.ListPrice || 1000000;
  const rows = [
    { date: listing.ModificationTimestamp, event: 'Listed', price, change: null },
  ];
  if (listing.OriginalListPrice && listing.OriginalListPrice !== listing.ListPrice) {
    rows.push({ date: listing.ModificationTimestamp, event: 'Price reduced', price: listing.ListPrice, change: listing.ListPrice - listing.OriginalListPrice });
  } else {
    // Synthetic second row so the blur wall has something to cover
    rows.push({ date: listing.ModificationTimestamp, event: 'Price reduced', price: Math.round(price * 0.97), change: -Math.round(price * 0.03) });
    rows.push({ date: listing.ModificationTimestamp, event: 'Price reduced', price: Math.round(price * 0.95), change: -Math.round(price * 0.02) });
  }
  return rows;
}

// ── main component ────────────────────────────────────────────────────────────
export default function PriceHistorySection({ listing, isVOWMember, onSignupClick }) {
  const history      = useMemo(() => buildHistory(listing), [listing]);
  const placeholder  = useMemo(() => buildPlaceholderRows(listing), [listing]);

  const dom        = listing.DaysOnMarket;
  const listDate   = fmtDate(listing.ModificationTimestamp);
  const hasEvents  = history.length > 0;
  const isClosed   = listing.StandardStatus === 'Closed';
  // Sold listing loaded via IDX token — ClosePrice/CloseDate are VOW-gated fields
  const missingCloseData = isClosed && !listing.ClosePrice;

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ padding:'14px 16px 0' }}>
        <div style={sh}>
          <i className="ti ti-chart-line" style={shI}/>
          Price history
        </div>
        <p style={{ fontSize:11, color:'rgba(255,255,255,.28)', margin:'5px 0 12px' }}>
          Track price changes over time
        </p>
      </div>

      {/* Table area */}
      <div style={{ position:'relative' }}>
        {/* Scrollable table wrapper for mobile */}
        {/* VOW member + sold listing with no close price from API */}
        {isVOWMember && missingCloseData ? (
          <div style={{ padding:'20px 16px', textAlign:'center' }}>
            <i className="ti ti-lock-open" style={{ fontSize:24, color:'rgba(255,255,255,.2)', display:'block', marginBottom:10 }}/>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:0, lineHeight:1.6 }}>
              Sold price data is not available for this listing.<br/>
              Contact your agent for full transaction details.
            </p>
          </div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              ...(isVOWMember ? {} : {
                filter: 'blur(4px)',
                opacity: 0.5,
                pointerEvents: 'none',
                userSelect: 'none',
              }),
            }}
          >
            <HistoryTable rows={isVOWMember ? (hasEvents ? history : placeholder) : placeholder}/>
          </div>
        )}

        {/* Signup wall overlay — non-members only */}
        {!isVOWMember && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(12,13,16,.92)',
            borderRadius: 0,
          }}>
            <div style={{
              background: '#161719', border: '1px solid rgba(0,180,168,.3)',
              borderRadius: 12, padding: '24px 22px', maxWidth: 280, width: '90%',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 7 }}>
                Unlock price history
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', margin: '0 0 18px', lineHeight: 1.55 }}>
                See full price changes, sold prices, and market trends
              </p>
              <button
                onClick={onSignupClick}
                style={{
                  width: '100%', minHeight: 44, borderRadius: 9, border: 'none',
                  background: '#00B4A8', color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
                }}
              >
                Sign up free
              </button>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                Already a member?{' '}
                <a
                  href="/login"
                  style={{ color: '#00B4A8', textDecoration: 'none' }}
                  onClick={e => { e.preventDefault(); onSignupClick(); }}
                >
                  Log in
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Always-visible listing info bar */}
      <div style={{
        margin: '0 16px 16px', padding: '10px 13px',
        background: 'rgba(0,180,168,.07)',
        borderLeft: '3px solid #00B4A8', borderRadius: '0 6px 6px 0',
        marginTop: 14,
      }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
          Listing started: <strong style={{ color: 'rgba(255,255,255,.8)' }}>{listDate}</strong>
          {dom != null && (
            <> · <strong style={{ color: 'rgba(255,255,255,.8)' }}>{dom}</strong> days on market</>
          )}
        </span>
      </div>
    </div>
  );
}
