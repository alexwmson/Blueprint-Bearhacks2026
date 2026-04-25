import React, { useState, useCallback } from 'react';
import LDrawViewer from './LDrawViewer.jsx';
import StepViewer from './StepViewer.jsx';
import { getInstructions } from '../api/client.js';

const DIFFICULTY_LABELS = ['', 'Easy', 'Easy', 'Medium', 'Hard', 'Expert'];
const DIFFICULTY_COLORS = ['', '#4ade80', '#4ade80', '#facc15', '#fb923c', '#f87171'];
const CATEGORY_ICONS = {
  building: '🏠',
  vehicle: '🚗',
  animal: '🐾',
  spaceship: '🚀',
  furniture: '🪑',
  other: '⭐',
};

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
  const difficultyLabel = DIFFICULTY_LABELS[idea.difficulty_rating] || 'Medium';
  const difficultyColor = DIFFICULTY_COLORS[idea.difficulty_rating] || '#facc15';
  const categoryIcon = CATEGORY_ICONS[idea.category] || '⭐';

  // All pieces from the full model (for the expanded interactive view)
  const allPieces =
    instructions?.steps?.length > 0
      ? instructions.steps[instructions.steps.length - 1].pieces || []
      : previewPieces.map((p) => ({ ...p, highlight: true }));

  return (
    <div className={`idea-item ${expanded ? 'expanded' : ''}`}>
      {/* ── Collapsed header ── */}
      <div className="idea-header">
        <div className="idea-meta">
          <div className="idea-title-row">
            <span className="idea-category-icon">{categoryIcon}</span>
            <h3 className="idea-title">{idea.title}</h3>
            <span
              className="difficulty-badge"
              style={{ '--badge-color': difficultyColor }}
            >
              {difficultyLabel}
            </span>
          </div>
          <p className="idea-description">{idea.short_description}</p>
          {idea.pieces_used && idea.pieces_used.length > 0 && (
            <p className="idea-piece-count">{idea.pieces_used.length} piece type{idea.pieces_used.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Preview render */}
        <div className="idea-preview-render">
          {previewPieces.length > 0 ? (
            <LDrawViewer
              pieces={previewPieces.map((p) => ({ ...p, highlight: true }))}
              interactive={false}
              cameraHint="front"
              height="140px"
              width="180px"
            />
          ) : (
            <div className="preview-placeholder">{categoryIcon}</div>
          )}
        </div>
      </div>

      {/* ── Expand button ── */}
      <div className="idea-footer">
        <button
          className={`btn btn-expand ${expanded ? 'active' : ''}`}
          onClick={handleExpand}
          aria-expanded={expanded}
        >
          {expanded ? '▲ Collapse' : '▼ See Instructions'}
        </button>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="idea-expanded">
          {/* Full interactive 3D model */}
          <section className="expanded-section">
            <h4 className="section-title">Full Model</h4>
            <LDrawViewer
              pieces={allPieces.map((p) => ({ ...p, highlight: true }))}
              interactive={true}
              cameraHint="front"
              height="380px"
              width="100%"
              className="full-model-viewer"
            />
            <p className="viewer-hint">Click and drag to rotate · Scroll to zoom</p>
          </section>

          {/* Piece inventory */}
          {idea.pieces_used && idea.pieces_used.length > 0 && (
            <section className="expanded-section">
              <h4 className="section-title">Pieces Needed</h4>
              <ul className="piece-inventory">
                {idea.pieces_used.map((p, i) => {
                  // p is e.g. "3x red 2x4 brick" or an object
                  const label = typeof p === 'string' ? p : `${p.count}× ${p.description}`;
                  return (
                    <li key={i} className="piece-inventory-item">
                      <span className="piece-dot" />
                      {label}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Step-by-step instructions */}
          <section className="expanded-section">
            <h4 className="section-title">Build Instructions</h4>
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
