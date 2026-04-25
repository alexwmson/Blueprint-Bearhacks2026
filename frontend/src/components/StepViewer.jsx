import React, { useEffect, useRef, useState } from 'react';
import LDrawViewer from './LDrawViewer.jsx';
import { textToSpeech } from '../api/client.js';

const CAMERA_MAP = {
  front: 'front',
  top: 'top',
  side: 'side',
};

/* Camera hint → human-readable label */
const CAMERA_LABEL = {
  front: 'Front view',
  top:   'Top view',
  side:  'Side view',
};

/* Chevron icons as inline SVGs */
const ChevronLeft = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 2.5L4 6.5l4.5 4" />
  </svg>
);
const ChevronRight = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 2.5L9 6.5l-4.5 4" />
  </svg>
);
const MicIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 1 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

/**
 * StepViewer — displays step-by-step build instructions.
 *
 * Props:
 *   instructions  { model, steps[] }  from /api/instructions
 */
export default function StepViewer({ instructions }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [readError, setReadError] = useState('');
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

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
  const viewLabel = CAMERA_LABEL[cameraHint] || 'Front view';
  const hasNewPieces = newPieces.length > 0;

  const stopAudioPlayback = useRef(() => {});
  stopAudioPlayback.current = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopAudioPlayback.current();
    };
  }, []);

  useEffect(() => {
    stopAudioPlayback.current();
    setIsReading(false);
    setReadError('');
  }, [currentStep]);

  const handleReadStep = async () => {
    if (isPlaying || isReading) {
      stopAudioPlayback.current();
      setIsReading(false);
      return;
    }

    const spokenText = [step.description, step.sub_description]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ');

    if (!spokenText) return;

    try {
      setReadError('');
      setIsReading(true);

      const audioUrl = await textToSpeech(spokenText);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audioUrlRef.current = audioUrl;

      audio.onended = () => {
        stopAudioPlayback.current();
      };
      audio.onerror = () => {
        stopAudioPlayback.current();
        setReadError('Could not play step audio.');
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setReadError(err.message || 'Could not read this step right now.');
    } finally {
      setIsReading(false);
    }
  };

  /* How many future steps to preview (collapsed) */
  const PREVIEW_FUTURE = 1;
  const futureStart = currentStep + 1;
  const futureEnd = Math.min(futureStart + PREVIEW_FUTURE, totalSteps);
  const futureSteps = steps.slice(futureStart, futureEnd);
  const remainingAfter = totalSteps - futureEnd;

  return (
    <div className="step-viewer">
      {/* Section heading row */}
      <div className="step-section-header-row">
        <h4 className="step-section-heading">Step-by-step</h4>
      </div>

      {/* Active step card */}
      <div className="step-card">
        {/* Header */}
        <div className="step-card-header">
          <div className="step-header-left">
            <div className="step-badge">{step.step_number}</div>
            <div className="step-header-text">
              <div className="step-title-bp">{step.description}</div>
              <div className="step-caption-bp">{step.sub_description || ''}</div>
            </div>
          </div>
          <div className="step-progress-wrap">
            <span className="step-progress">Step {currentStep + 1} / {totalSteps}</span>
            <div className="step-audio-controls">
              <button
                type="button"
                className={`btn-step-audio ${isPlaying ? 'playing' : ''}`}
                onClick={handleReadStep}
                disabled={isReading}
                aria-label={isPlaying ? 'Stop reading step aloud' : 'Read step aloud'}
              >
                <MicIcon />
                {isReading ? 'Loading...' : isPlaying ? 'Stop' : 'Read aloud'}
              </button>
              {readError && <span className="step-audio-error">{readError}</span>}
            </div>
          </div>
        </div>

        {/* Hidden old elements (kept intact, hidden by CSS) */}
        <span className="step-number">Step {step.step_number}</span>
        <p className="step-description">{step.description}</p>

        {/* 3D render + piece tray — flex row */}
        <div className="step-render-wrap">
          {/* Scene preview wrapper */}
          <div className="step-scene-preview">
            {/* Camera hint pill */}
            <span className="step-view-pill">{viewLabel}</span>

            {/* New pieces outlined pill */}
            {hasNewPieces && (
              <span className="step-new-pill">New pieces outlined</span>
            )}

            <LDrawViewer
              pieces={cumulativePieces}
              interactive={false}
              cameraHint={cameraHint}
              height="280px"
              width="100%"
            />
          </div>

          {/* Piece tray */}
          {Object.keys(pieceTray).length > 0 && (
            <div className="piece-tray">
              <div className="piece-tray-label">This Step</div>
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
      </div>

      {/* Future step previews (collapsed shell) */}
      {futureSteps.map((fStep, fi) => (
        <div key={fStep.step_number} className="step-card future-step">
          <div className="step-card-header">
            <div className="step-header-left">
              <div className="step-badge future">{fStep.step_number}</div>
              <div className="step-header-text">
                <div className="step-title-bp">{fStep.description}</div>
              </div>
            </div>
            <span className="step-progress">Step {futureStart + fi + 1} / {totalSteps}</span>
          </div>
          {/* Hidden old elements */}
          <span className="step-number">Step {fStep.step_number}</span>
          <p className="step-description">{fStep.description}</p>
          {/* No render body for future steps */}
          <div className="step-render-wrap" />
        </div>
      ))}

      {/* "X more steps below" placeholder */}
      {remainingAfter > 0 && (
        <div className="steps-more-placeholder">
          {remainingAfter} more step{remainingAfter !== 1 ? 's' : ''} below
        </div>
      )}

      {/* Navigation footer */}
      <div className="step-nav">
        <button
          className="btn btn-step-nav"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
        >
          <ChevronLeft /> Previous
        </button>

        {/* Step dashes */}
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
          Next step <ChevronRight />
        </button>
      </div>
    </div>
  );
}
