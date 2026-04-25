import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadImage, classifyAllCrops, consolidatePieces, getIdeas } from '../api/client.js';

const STAGES = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  CLASSIFYING: 'classifying',
  GENERATING: 'generating',
  ERROR: 'error',
};

const STAGE_LABELS = {
  uploading: 'Detecting LEGO pieces in your photo…',
  classifying: 'Identifying each brick…',
  generating: 'Dreaming up build ideas…',
};

export default function LandingPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [stage, setStage] = useState(STAGES.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const processImage = useCallback(
    async (file) => {
      setError(null);
      try {
        // Step 1: Upload → Cloud Vision object localization
        setStage(STAGES.UPLOADING);
        const { crops } = await uploadImage(file);

        if (!crops || crops.length === 0) {
          setError('No LEGO pieces were detected in the image. Try a clearer photo with good lighting.');
          setStage(STAGES.ERROR);
          return;
        }

        // Step 2: Classify each crop with Gemini Vision (parallel)
        setStage(STAGES.CLASSIFYING);
        setProgress({ current: 0, total: crops.length });

        const { descriptions, errorCount } = await classifyAllCrops(crops, (done, total) => {
          setProgress({ current: done, total });
        });

        const pieces = consolidatePieces(descriptions);

        if (pieces.length === 0) {
          if (errorCount === crops.length) {
            setError(`The AI classifier ran into an error on all ${crops.length} detected objects. Check the backend logs for details.`);
          } else {
            setError("We couldn't recognize any LEGO pieces. Try a photo with better lighting or a different angle.");
          }
          setStage(STAGES.ERROR);
          return;
        }

        // Step 3: Get ideas from Claude
        setStage(STAGES.GENERATING);
        const ideasData = await getIdeas(pieces);

        navigate('/ideas', { state: { ideas: ideasData.ideas, pieces } });
      } catch (err) {
        console.error(err);
        setError(err.message || 'Something went wrong. Please try again.');
        setStage(STAGES.ERROR);
      }
    },
    [navigate]
  );

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      setStage(STAGES.ERROR);
      return;
    }
    processImage(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const isLoading = stage !== STAGES.IDLE && stage !== STAGES.ERROR;

  return (
    <div className="landing-root">
      <header className="landing-header">
        <div className="logo">
          <span className="logo-brick">🧱</span>
          <span className="logo-text">BrickVision</span>
        </div>
        <p className="logo-tagline">Turn your LEGO pile into a masterpiece</p>
      </header>

      <main className="landing-main">
        {!isLoading ? (
          <>
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''} ${stage === STAGES.ERROR ? 'error-zone' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              aria-label="Upload LEGO image"
            >
              <div className="drop-zone-icon">📸</div>
              <p className="drop-zone-title">Drop a photo here</p>
              <p className="drop-zone-subtitle">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            <div className="action-divider">
              <span>or</span>
            </div>

            <button
              className="btn btn-camera"
              onClick={() => cameraInputRef.current?.click()}
            >
              <span className="btn-icon">📷</span> Take a Photo
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {stage === STAGES.ERROR && error && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span> {error}
              </div>
            )}

            <div className="how-it-works">
              <h3>How it works</h3>
              <ol>
                <li>📦 Dump your LEGO pieces on a flat surface</li>
                <li>📸 Take a clear photo from above</li>
                <li>🤖 AI identifies every brick</li>
                <li>✨ Get creative build ideas with 3D instructions</li>
              </ol>
            </div>
          </>
        ) : (
          <div className="loading-panel">
            <div className="spinner" aria-label="Loading" />
            <p className="loading-label">{STAGE_LABELS[stage]}</p>
            {stage === STAGES.CLASSIFYING && progress.total > 0 && (
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
                <span className="progress-text">
                  {progress.current} / {progress.total} pieces
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="landing-footer">
        <p>Made with ❤️ at BearHacks 2026</p>
      </footer>
    </div>
  );
}
