import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import IdeaItem from '../components/IdeaItem.jsx';

export default function MainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ideas = [], pieces = [] } = location.state || {};

  if (!ideas || ideas.length === 0) {
    return (
      <div className="main-root empty-state">
        <div className="empty-content">
          <div className="empty-icon">🧱</div>
          <h2>No ideas found</h2>
          <p>It looks like we lost the results. Try scanning your pieces again.</p>
          <button className="btn btn-back" onClick={() => navigate('/')}>
            ← Back to Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-root">
      {/* Top bar */}
      <header className="main-header">
        <button className="btn btn-back" onClick={() => navigate('/')}>
          ← New Scan
        </button>
        <div className="main-header-center">
          <span className="logo-brick">🧱</span>
          <span className="logo-text">BrickVision</span>
        </div>
        <div className="main-header-right" />
      </header>

      {/* Piece summary banner */}
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

      {/* Ideas list */}
      <main className="ideas-container">
        <h2 className="ideas-heading">
          {ideas.length} Build {ideas.length === 1 ? 'Idea' : 'Ideas'} for You
        </h2>
        <p className="ideas-subheading">
          Tap "See Instructions" on any idea to get step-by-step 3D building instructions.
        </p>

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
