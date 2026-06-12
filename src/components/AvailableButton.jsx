// src/components/AvailableButton.jsx
// "Is It Available?" button — self-contained Phase 1/2 toggle.
//
// Phase 1 (VITE_CHAT_MODE=passive): opens a pre-filled WhatsApp message to Anirudha.
// Phase 2 (VITE_CHAT_MODE=ai):     posts to /api/chat → Make.com → Claude API.
//
// To activate Phase 2: change VITE_CHAT_MODE to "ai" in Vercel environment variables.
// Zero code changes needed — just an env var flip.

import React, { useState } from 'react';
import { formatAddress, formatPrice } from '../utils/format.js';

// Config flag: "passive" | "ai"
const CHAT_MODE = import.meta.env.VITE_CHAT_MODE || 'passive';

// Anirudha's WhatsApp number (international format, no spaces/dashes)
const WHATSAPP_NUMBER = '16478035288'; // 1 = Canada country code

/**
 * Build the pre-filled WhatsApp deep link.
 */
function buildWhatsAppURL(listing) {
  const address = listing.UnparsedAddress || `${listing.StreetNumber} ${listing.StreetName}`;
  const price   = listing.ListPrice ? formatPrice(listing.ListPrice) : '';
  const mlsNum  = listing.ListingId || listing.ListingKey || '';

  const message = encodeURIComponent(
    `Hi Anirudha, I found a listing on Propedia.ca and I'm interested.\n\n` +
    `📍 ${address}\n` +
    `💰 ${price}\n` +
    `🏷️ MLS# ${mlsNum}\n\n` +
    `Is it still available? I'd love to schedule a showing.`
  );

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

/**
 * AvailableButton
 *
 * Props:
 *   listing {object}  — the RESO listing object
 *   className {string} — optional extra class
 *   compact {boolean}  — smaller variant for list view
 */
export default function AvailableButton({ listing, className = '', compact = false }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiError, setAiError]     = useState(null);

  // ── Phase 1: Passive WhatsApp ────────────────────────────────────────────
  if (CHAT_MODE !== 'ai') {
    return (
      <a
        href={buildWhatsAppURL(listing)}
        target="_blank"
        rel="noopener noreferrer"
        className={`available-btn ${className}`}
        style={compact ? { height: '36px', fontSize: '12px' } : {}}
        onClick={e => e.stopPropagation()} // prevent card navigation
        aria-label={`Ask if ${listing.UnparsedAddress} is available via WhatsApp`}
      >
        <span>💬</span>
        {compact ? 'Is It Available?' : 'Is It Available?'}
      </a>
    );
  }

  // ── Phase 2: AI chat (activated when VITE_CHAT_MODE=ai) ─────────────────
  const handleAIChat = async (e) => {
    e.stopPropagation();
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: {
            listingKey:   listing.ListingKey,
            address:      formatAddress(listing),
            price:        listing.ListPrice,
            beds:         listing.BedroomsTotal,
            baths:        listing.BathroomsTotalInteger,
            propertyType: listing.PropertySubType,
            mlsNumber:    listing.ListingId,
          },
          message: 'Is this property still available?',
        }),
      });

      if (!res.ok) throw new Error('Chat unavailable right now');
      setAiOpen(true);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <button
        className={`available-btn ${className}`}
        onClick={handleAIChat}
        disabled={aiLoading}
        style={compact ? { height: '36px', fontSize: '12px' } : {}}
        aria-label="Chat with AI about this listing"
      >
        {aiLoading ? (
          <>
            <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
            Checking...
          </>
        ) : (
          <>
            <span>🤖</span>
            Ask About This Property
          </>
        )}
      </button>

      {aiError && (
        <p style={{ fontSize: '11px', color: 'var(--red)', marginTop: '4px', textAlign: 'center' }}>
          {aiError} —{' '}
          <a href={buildWhatsAppURL(listing)} target="_blank" rel="noopener noreferrer"
             style={{ color: 'var(--teal)', textDecoration: 'underline' }}>
            WhatsApp instead
          </a>
        </p>
      )}

      {/* TODO Phase 2: render AI chat widget when aiOpen === true */}
    </>
  );
}
