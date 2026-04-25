import React, { useState } from 'react';
import LDrawViewer from './LDrawViewer.jsx';

const CAMERA_MAP = {
  front: 'front',
  top: 'top',
  side: 'side',
};

/**
 * StepViewer — displays step-by-step build instructions.
 *
 * Props:
 *   instructions  { model, steps[] }  from /api/instructions
 */
export default function StepViewer({ instructions }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!instructions || !instructions.steps || instructions.steps.length === 0) {
    return <div className="step-viewer-empty">No steps available.</div>;
  }

  const { steps, model } = instructions;
  const totalSteps = steps.length;
  const step = steps[currentStep];

  // Pieces for the current step already include all cumulative pieces
  // with highlight: true for new ones and highlight: false for old ones
  const cumulativePieces = step.pieces || [];

  const newPieces = cumulativePieces.filter((p) => p.highlight === true);

  // Build piece tray summary
  const pieceTray = newPieces.reduce((acc, p) => {
    const key = p.description;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const cameraHint = CAMERA_MAP[step.camera_hint] || 'front';

  return (
    <div className="step-viewer">
      {/* Step card */}
      <div className="step-card">
        <div className="step-card-header">
          <span className="step-number">Step {step.step_number}</span>
          <span className="step-progress">{currentStep + 1} / {totalSteps}</span>
        </div>

        <p className="step-description">{step.description}</p>

        {/* 3D render of cumulative model with highlights */}
        <div className="step-render-wrap">
          <LDrawViewer
            pieces={cumulativePieces}
            interactive={false}
            cameraHint={cameraHint}
            height="280px"
            width="100%"
          />
          {/* Piece tray overlay */}
          {Object.keys(pieceTray).length > 0 && (
            <div className="piece-tray">
              <div className="piece-tray-label">Add this step:</div>
              <ul className="piece-tray-list">
                {Object.entries(pieceTray).map(([desc, count]) => (
                  <li key={desc} className="piece-tray-item">
                    <span className="piece-tray-count">{count}×</span>
                    <span className="piece-tray-desc">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="step-nav">
          <button
            className="btn btn-step-nav"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
          >
            ← Previous
          </button>

          {/* Step dots */}
          <div className="step-dots">
            {steps.map((_, idx) => (
              <button
                key={idx}
                className={`step-dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'done' : ''}`}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <button
            className="btn btn-step-nav"
            onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
            disabled={currentStep === totalSteps - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
