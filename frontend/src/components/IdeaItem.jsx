import React, { useState, useCallback } from 'react';
import LDrawViewer from './LDrawViewer.jsx';
import StepViewer from './StepViewer.jsx';
import { getInstructions } from '../api/client.js';

const CATEGORY_ICONS = {
  building: '🏠',
  vehicle: '🚗',
  animal: '🐾',
  spaceship: '🚀',
  furniture: '🪑',
  other: '⭐',
};

/* Maps category → tinted preview background class */
const CATEGORY_BG = {
  animal:    'idea-card-preview-cat-animals',
  animals:   'idea-card-preview-cat-animals',
  vehicle:   'idea-card-preview-cat-vehicles',
  vehicles:  'idea-card-preview-cat-vehicles',
  building:  'idea-card-preview-cat-buildings',
  buildings: 'idea-card-preview-cat-buildings',
  character: 'idea-card-preview-cat-characters',
  characters:'idea-card-preview-cat-characters',
  furniture: 'idea-card-preview-cat-furniture',
};

/* Category display label (capitalize + singularize for pill) */
function catLabel(cat) {
  if (!cat) return 'Other';
  const s = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  /* Remove trailing 's' for pill: "Buildings" → "Buildings" (keep plural, matches reference) */
  return s;
}

/* Color swatch for piece inventory — attempts to extract color from description string */
const LEGO_COLOR_HEX = {
  red:    '#E11B22',
  yellow: '#FAC80A',
  blue:   '#1B6FB8',
  green:  '#00923D',
  black:  '#0F0F10',
  white:  '#E8E8E8',
  gray:   '#9E9E9E',
  grey:   '#9E9E9E',
  brown:  '#7B4A2D',
  orange: '#F58220',
  tan:    '#D2B48C',
  purple: '#9B59B6',
};

function pieceSwatchColor(descStr) {
  const lower = descStr.toLowerCase();
  for (const [color, hex] of Object.entries(LEGO_COLOR_HEX)) {
    if (lower.includes(color)) return hex;
  }
  return '#CCCCCC';
}

/* Chevron icons as inline SVGs (no icon library available) */
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4l4 4 4-4" />
  </svg>
);
const ChevronUp = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 8l4-4 4 4" />
  </svg>
);

/**
 * IdeaItem — one idea card, collapsible.
 *
 * Props:
 *   idea   object  { title, short_description, difficulty_rating, category, pieces_used, preview_model }
 *   index  number  position in the list
 */
export default function IdeaItem({ idea, index }) {
  const [expanded, setExpanded] = useState(false);
  const [instructions, setInstructions] = useState(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [instructionsError, setInstructionsError] = useState(null);

  const handleExpand = useCallback(async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    // Fetch instructions the first time we expand
    if (willExpand && !instructions && !loadingInstructions) {
      setLoadingInstructions(true);
      setInstructionsError(null);
      try {
        const data = await getInstructions(idea);
        setInstructions(data);
      } catch (err) {
        setInstructionsError(err.message || 'Failed to load instructions');
      } finally {
        setLoadingInstructions(false);
      }
    }
  }, [expanded, instructions, loadingInstructions, idea]);

  const previewPieces = idea.preview_model?.pieces || [];
  const categoryIcon = CATEGORY_ICONS[idea.category] || '⭐';
  const catBgClass = CATEGORY_BG[idea.category?.toLowerCase()] || 'idea-card-preview-cat-other';

  // All pieces from the full model (for the expanded interactive 3D view)
  const allPieces =
    instructions?.steps?.length > 0
      ? instructions.steps[instructions.steps.length - 1].pieces || []
      : previewPieces.map((p) => ({ ...p, highlight: true }));

  /* Parse piece count from pieces_used total */
  const pieceCount = idea.pieces_used?.reduce((s, p) => {
    const m = (typeof p === 'string' ? p : '').match(/^(\d+)/);
    return s + (m ? parseInt(m[1], 10) : 1);
  }, 0) || (idea.pieces_used?.length ?? 0);

  return (
    <div className={`idea-item ${expanded ? 'expanded' : ''}`}>
      {/* ── Card header (preview on top, meta below) ── */}
      <div className="idea-header">
        {/* Preview area */}
        <div className={`idea-card-preview ${catBgClass}`}>
          {/* Category pill — top-left */}
          <span className="idea-cat-pill">{catLabel(idea.category || 'Other')}</span>

          {/* Piece count pill — top-right */}
          {pieceCount > 0 && (
            <span className="idea-count-pill">{pieceCount} pieces</span>
          )}

          {/* 3D preview render */}
          <div className="idea-preview-render">
            {previewPieces.length > 0 ? (
              <LDrawViewer
                pieces={previewPieces.map((p) => ({ ...p, highlight: true }))}
                interactive={false}
                cameraHint="front"
                height="200px"
                width="100%"
              />
            ) : (
              <div className="preview-placeholder">{categoryIcon}</div>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="idea-card-body">
          <div className="idea-meta">
            <div className="idea-title-row">
              {/* Hidden original elements — kept for semantics */}
              <span className="idea-category-icon">{categoryIcon}</span>
              <h3 className="idea-title">{idea.title}</h3>
            </div>
            <p className="idea-description">{idea.short_description}</p>
            {idea.pieces_used && idea.pieces_used.length > 0 && (
              <p className="idea-piece-count">{idea.pieces_used.length} piece type{idea.pieces_used.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Expand button ── */}
      <div className="idea-footer">
        <button
          className={`btn btn-expand ${expanded ? 'active' : ''}`}
          onClick={handleExpand}
          aria-expanded={expanded}
        >
          {expanded ? <><ChevronUp /> Collapse</> : <><ChevronDown /> See Instructions</>}
        </button>
      </div>

      {/* ── Expanded content (Screen B) ── */}
      {expanded && (
        <div className="idea-expanded">
          {/* Full interactive 3D model */}
          <section className="expanded-section">
            <h4 className="section-title">
              <span className="bp-eyebrow-dot" style={{ background: 'var(--bp-blue)' }} />
              Full Model
            </h4>
            {/* Mat + surface wrapper for viewer */}
            <div className="viewer-mat">
              <div className="viewer-surface">
                {/* Status pill */}
                <div className="viewer-status-pill">
                  <span className="viewer-status-dot" />
                  Interactive 3D · Drag to rotate
                </div>
                <LDrawViewer
                  pieces={allPieces.map((p) => ({ ...p, highlight: true }))}
                  interactive={true}
                  cameraHint="front"
                  height="380px"
                  width="100%"
                  className="full-model-viewer"
                />
              </div>
            </div>
            <p className="viewer-hint">Click and drag to rotate · Scroll to zoom</p>
          </section>

          {/* Piece inventory */}
          {idea.pieces_used && idea.pieces_used.length > 0 && (
            <section className="expanded-section">
              <h4 className="section-title">
                <span className="bp-eyebrow-dot" style={{ background: 'var(--bp-yellow)' }} />
                Piece Inventory
                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>
                  {pieceCount} pieces · {idea.pieces_used.length} type{idea.pieces_used.length !== 1 ? 's' : ''}
                </span>
              </h4>
              <ul className="piece-inventory">
                {idea.pieces_used.map((p, i) => {
                  const label = typeof p === 'string' ? p : `${p.count}× ${p.description}`;
                  /* Parse count and description from strings like "3x red 2x4 brick" */
                  const countMatch = label.match(/^(\d+)[x×]/i);
                  const count = countMatch ? parseInt(countMatch[1], 10) : 1;
                  const swatchColor = pieceSwatchColor(label);
                  /* Swatch width: rough size based on piece description */
                  let swatchW = 24;
                  if (/2x4/i.test(label)) swatchW = 32;
                  else if (/1x2/i.test(label)) swatchW = 20;
                  else if (/2x2/i.test(label)) swatchW = 22;
                  else if (/door|window/i.test(label)) swatchW = 26;
                  return (
                    <li key={i} className="piece-inventory-item">
                      <span className="piece-dot" />
                      <span
                        className="piece-swatch"
                        style={{ width: swatchW, background: swatchColor }}
                      />
                      <span className="piece-inv-name">{label.replace(/^\d+[x×]\s*/i, '')}</span>
                      <span className="piece-inv-count">×{count}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Step-by-step instructions */}
          <section className="expanded-section">
            <h4 className="section-title">
              <span className="bp-eyebrow-dot" style={{ background: 'var(--bp-green)' }} />
              Build Instructions
            </h4>
            {loadingInstructions && (
              <div className="instructions-loading">
                <div className="spinner" />
                <p>Generating step-by-step instructions…</p>
              </div>
            )}
            {instructionsError && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span> {instructionsError}
              </div>
            )}
            {instructions && !loadingInstructions && (
              <StepViewer instructions={instructions} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
