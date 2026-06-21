import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ListingsPage from './pages/ListingsPage.jsx';
import ListingDetailPage from './pages/ListingDetailPage.jsx';
import MapPage from './pages/MapPage.jsx';
import MapSearchPage from './pages/MapSearchPage.jsx';

// Phase 3 stub — DeepCompare activates here
const DeepComparePage = () => (
  <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>
    DeepCompare — Phase 3
  </div>
);

// Phase 2 stub — AI chat activates here
const ChatPage = () => (
  <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>
    Chat — Phase 2
  </div>
);

export default function App() {
  return (
    <Routes>
      {/* Root = marketplace listings page — no separate agent homepage */}
      <Route path="/" element={<ListingsPage />} />
      <Route path="/listings" element={<Navigate to="/" replace />} />
      <Route path="/listing/:listingKey" element={<ListingDetailPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/mapsearch" element={<MapSearchPage />} />
      <Route path="/compare" element={<DeepComparePage />} />
      <Route path="/chat" element={<ChatPage />} />
      {/* Catch-all: redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}