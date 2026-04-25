import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import IdeaItem from '../components/IdeaItem.jsx';

/* Derive unique color names from piece description strings */
const LEGO_COLOR_HEX = {
  red:    '#E11B22',
  yellow: '#FAC80A',
  blue:   '#1B6FB8',
  green:  '#00923D',
  black:  '#0F0F10',
  white:  '#F0F0F0',
  gray:   '#9E9E9E',
  grey:   '#9E9E9E',
  brown:  '#7B4A2D',
  orange: '#F58220',
  tan:    '#D2B48C',
  purple: '#9B59B6',
};

function extractColors(pieces) {
  const found = [];
  const seen = new Set();
  pieces.forEach((p) => {
    const lower = (typeof p === 'string' ? p : '').toLowerCase();
    Object.keys(LEGO_COLOR_HEX).forEach((color) => {
      if (lower.includes(color) && !seen.has(color)) {
        seen.add(color);
        found.push({ name: color, hex: LEGO_COLOR_HEX[color] });
      }
    });
  });
  return found;
}

/* Derive total piece count by summing numeric prefixes in piece strings */
function totalPieceCount(pieces) {
  return pieces.reduce((sum, p) => {
    const m = (typeof p === 'string' ? p : '').match(/^(\d+)/);
    return sum + (m ? parseInt(m[1], 10) : 1);
  }, 0);
}

/* Derive category counts from ideas */
function categoryCounts(ideas) {
  const map = {};
  ideas.forEach((idea) => {
    const cat = idea.category || 'other';
    /* Normalize: "vehicle" → "vehicles", "building" → "buildings", etc. */
    const label = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase() + (cat.endsWith('s') ? '' : 's');
    map[label] = (map[label] || 0) + 1;
  });
  return map;
}

/* Chevron SVG */
const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2L4 7l5 5" />
  </svg>
);

export default function MainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ideas = [], pieces = [] } = location.state || {};

  if (!ideas || ideas.length === 0) {
    return (
      <div className="main-root empty-state">
        {/* Brand stripe */}
        <div className="bp-brand-stripe" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="empty-content">
          <div className="empty-icon">🧱</div>
          <h2>No ideas found</h2>
          <p>It looks like we lost the results. Try scanning your pieces again.</p>
          <button className="btn btn-back" onClick={() => navigate('/')}>
            <ChevronLeft /> New scan
          </button>
        </div>
      </div>
    );
  }

  const colors = extractColors(pieces);
  const total = totalPieceCount(pieces) || pieces.length;
  const catMap = categoryCounts(ideas);
  const categories = Object.entries(catMap);

  return (
    <div className="main-root">
      {/* Brand stripe */}
      <div className="bp-brand-stripe" aria-hidden="true">
        <span /><span /><span />
      </div>

      {/* Header */}
      <header className="main-header">
        <button className="btn btn-back" onClick={() => navigate('/')}>
          <ChevronLeft /> New scan
        </button>
        <div className="main-header-center">
          <span className="logo-brick">🧱</span>
          <span className="logo-text">Blueprint</span>
        </div>
        <div className="main-header-right" />
      </header>

      {/* Pieces banner — hidden via CSS; data shown in inventory strip */}
      {pieces.length > 0 && (
        <div className="pieces-banner">
          <span className="pieces-banner-label">Your pieces:</span>
          <div className="pieces-banner-chips">
            {pieces.map((p, i) => (
              <span key={i} className="piece-chip">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Ideas gallery */}
      <main className="ideas-container">
        {/* Eyebrow */}
        <div className="bp-eyebrow">
          <span className="bp-eyebrow-dot" style={{ background: 'var(--bp-red)' }} />
          Your Collection
        </div>

        {/* Title */}
        <h2 className="ideas-heading">
          Here's what you can{' '}
          <span className="italic-accent" style={{ color: 'var(--bp-red)' }}>build.</span>
        </h2>

        {/* Description */}
        <p className="ideas-subheading">
          Based on the {total} piece{total !== 1 ? 's' : ''} we found
          {colors.length > 0 ? ` across ${colors.length} color${colors.length !== 1 ? 's' : ''}` : ''}.
          {' '}Pick one to see the full 3D model and step-by-step instructions.
        </p>

        {/* Inventory strip */}
        <div className="inventory-strip">
          <div className="inventory-section">
            <span className="inventory-eyebrow">Total Pieces</span>
            <span className="inventory-value">{total}</span>
          </div>
          <div className="inventory-section">
            <span className="inventory-eyebrow">Colors</span>
            {colors.length > 0 ? (
              <div className="color-swatches">
                {colors.map((c) => (
                  <span
                    key={c.name}
                    className="color-swatch"
                    style={{ background: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            ) : (
              <span className="inventory-value">—</span>
            )}
          </div>
          <div className="inventory-section">
            <span className="inventory-eyebrow">Ideas Generated</span>
            <span className="inventory-value">{ideas.length}</span>
          </div>
        </div>

        {/* Filter pills — visual only; TODO: requires logic change — out of scope */}
        <div className="filter-pills">
          <span className="filter-pill active">
            All <span className="filter-pill-count">{ideas.length}</span>
          </span>
          {categories.map(([cat, count]) => (
            <span key={cat} className="filter-pill">
              {cat} <span className="filter-pill-count">{count}</span>
            </span>
          ))}
        </div>

        {/* Ideas grid */}
        <div className="ideas-list">
          {ideas.map((idea, index) => (
            <IdeaItem key={index} idea={idea} index={index} />
          ))}
        </div>
      </main>

      <footer className="main-footer">
        <p>Made with ❤️ at BearHacks 2026</p>
      </footer>
    </div>
  );
}
