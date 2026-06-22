import React from 'react';

const SIZES = { small: 32, medium: 40, large: 64 };

export default function Logo({ size = 'small', style = {} }) {
  const px = typeof size === 'number' ? size : (SIZES[size] ?? 32);
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-label="Propedia"
    >
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#00D4C8" />
          <stop offset="100%" stopColor="#007A72" />
        </linearGradient>
        {/* clip just the inner area */}
        <clipPath id="pc">
          <rect x="4" y="4" width="56" height="56" rx="12" />
        </clipPath>
      </defs>

      {/* Background tile */}
      <rect x="4" y="4" width="56" height="56" rx="12" fill="#0F1113" />

      {/* Circuit traces — subtle grid */}
      <g stroke="rgba(0,180,168,.18)" strokeWidth="1" fill="none" clipPath="url(#pc)">
        {/* Horizontal lines */}
        <line x1="4"  y1="22" x2="26" y2="22" />
        <line x1="38" y1="22" x2="60" y2="22" />
        <line x1="4"  y1="42" x2="20" y2="42" />
        <line x1="44" y1="42" x2="60" y2="42" />
        {/* Vertical lines */}
        <line x1="20" y1="4"  x2="20" y2="22" />
        <line x1="44" y1="4"  x2="44" y2="22" />
        <line x1="20" y1="42" x2="20" y2="60" />
        <line x1="44" y1="42" x2="44" y2="60" />
      </g>

      {/* Circuit nodes */}
      <g fill="rgba(0,180,168,.32)">
        <circle cx="20" cy="22" r="2.2" />
        <circle cx="44" cy="22" r="2.2" />
        <circle cx="20" cy="42" r="2.2" />
        <circle cx="44" cy="42" r="2.2" />
      </g>

      {/* The "P" letterform */}
      {/*
        P: vertical stem from top-left, then rounded bowl top-right.
        Stem: x=18, y=14 → y=50 (width 6)
        Bowl: from (24,14) arcs right to (24,32) with a rounded cap
      */}
      <path
        d="M18 14 h6 a12 12 0 0 1 0 24 h-6 Z
           M18 14 v36"
        fill="none"
        stroke="url(#pg)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Active dot — teal circle bottom-right corner */}
      <circle cx="52" cy="52" r="4" fill="#00B4A8" />
    </svg>
  );
}
