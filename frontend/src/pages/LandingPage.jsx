import React, { useRef, useCallback, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { uploadImage, scanImage, consolidatePieces, getIdeas, classifyAllCrops } from '../api/client.js';

/* ─── Brand tokens ─── */
const T = {
  red:    '#E11B22',
  yellow: '#FAC80A',
  blue:   '#1B6FB8',
  ink:    '#0F0F10',
  muted:  '#6B6B70',
  paper:  '#FAFAF7',
  white:  '#ffffff',
  line:   'rgba(0,0,0,0.06)',
};

const EASE = [0.22, 1, 0.36, 1];

/* ─── Pipeline toggle ───────────────────────────────────────────
   'scan'     → single Gemini call on the full image (fast, less precise)
   'classify' → Cloud Vision object localization + per-crop Gemini calls
                (slower but identifies each piece individually)
─────────────────────────────────────────────────────────────── */
const PIPELINE = 'scan'; // ← flip to 'scan' to use just gemini, classify has cloud vision and gemini

/* ─── Stage labels ─── */
const STAGES = { IDLE: 'idle', UPLOADING: 'uploading', SCANNING: 'scanning', CLASSIFYING: 'classifying', GENERATING: 'generating', ERROR: 'error' };
const STAGE_LABELS = {
  uploading:   'Analyzing your photo…',
  scanning:    'Identifying LEGO pieces…',
  classifying: 'Classifying each piece…',
  generating:  'Dreaming up build ideas…',
};

/* ══════════════════════════════════════════════════════════════
   SVG MOCKUPS
══════════════════════════════════════════════════════════════ */
function MockupScan() {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 130" width="100%" height="130" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* red 2x4 brick */}
      <rect x="20" y="50" width="80" height="36" rx="4" fill={T.red} />
      <circle cx="34" cy="44" r="7" fill={T.red} />
      <circle cx="58" cy="44" r="7" fill={T.red} />
      <circle cx="82" cy="44" r="7" fill={T.red} />
      {/* yellow 2x2 */}
      <rect x="80" y="70" width="50" height="28" rx="4" fill={T.yellow} />
      <circle cx="93" cy="65" r="6" fill={T.yellow} />
      <circle cx="113" cy="65" r="6" fill={T.yellow} />
      {/* blue 2x3 */}
      <rect x="120" y="40" width="70" height="36" rx="4" fill={T.blue} />
      <circle cx="133" cy="34" r="6" fill={T.blue} />
      <circle cx="153" cy="34" r="6" fill={T.blue} />
      <circle cx="173" cy="34" r="6" fill={T.blue} />
      {/* bounding box 1 */}
      <rect x="14" y="36" width="98" height="57" rx="3" stroke={T.blue} strokeWidth="1.5" strokeDasharray="5 3" fill="none" />
      {/* bounding box 2 */}
      <rect x="114" y="26" width="84" height="56" rx="3" stroke={T.blue} strokeWidth="1.5" strokeDasharray="5 3" fill="none" />
    </svg>
  );
}

function MockupPick() {
  const card = (x, rotate, selected) => (
    <g transform={`translate(${x},0) rotate(${rotate},50,55)`}>
      <rect x="0" y="0" width="100" height="90" rx="8"
        fill={T.white}
        stroke={selected ? T.ink : T.line}
        strokeWidth={selected ? 1.5 : 1}
        style={{ filter: selected ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' : 'none' }}
      />
      <rect x="8" y="8" width="84" height="52" rx="4" fill={selected ? T.red : x < 40 ? T.yellow : T.blue} opacity={selected ? 1 : 0.7} />
      <rect x="8" y="68" width="55" height="5" rx="2" fill={T.line} />
      <rect x="8" y="78" width="38" height="5" rx="2" fill={T.line} />
    </g>
  );
  return (
    <svg aria-hidden="true" viewBox="0 0 220 130" width="100%" height="130" fill="none" xmlns="http://www.w3.org/2000/svg">
      {card(10, -4, false)}
      {card(60, 0, true)}
      {card(112, 4, false)}
    </svg>
  );
}

function MockupFollow() {
  const pieces = [
    { x: 20,  color: T.red,    dim: true  },
    { x: 58,  color: T.blue,   dim: true  },
    { x: 96,  color: T.yellow, dim: false },
    { x: 134, color: T.red,    dim: true  },
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 220 130" width="100%" height="130" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* card outline */}
      <rect x="10" y="10" width="200" height="110" rx="8" fill={T.white} stroke={T.ink} strokeWidth="2" />
      {/* step badge */}
      <circle cx="30" cy="30" r="13" fill={T.yellow} />
      <text x="30" y="35" textAnchor="middle" fontSize="11" fontWeight="700" fill={T.ink}>3</text>
      {/* progress */}
      <rect x="163" y="21" width="38" height="18" rx="4" fill={T.white} stroke={T.line} strokeWidth="1" />
      <text x="182" y="33" textAnchor="middle" fontSize="9" fill={T.muted} fontWeight="500">3 / 8</text>
      {/* piece row */}
      {pieces.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y="68" width="30" height="22" rx="3"
            fill={p.color} opacity={p.dim ? 0.4 : 1}
          />
          {!p.dim && (
            <rect x={p.x} y="68" width="30" height="22" rx="3"
              fill="none" stroke={T.ink} strokeWidth="1.5"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

/* ─── Upload / Camera icons ─── */
function IconUpload() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/* ─── Spinner ─── */
function Spinner() {
  return (
    <div style={{ width: 40, height: 40, border: `3px solid ${T.line}`, borderTopColor: T.ink, borderRadius: '50%', animation: 'bp-spin 0.8s linear infinite' }} />
  );
}

/* ══════════════════════════════════════════════════════════════
   HEADLINE animated word-by-word
══════════════════════════════════════════════════════════════ */
const HEADLINE_WORDS = [
  { text: 'Turn',     color: null },
  { text: 'your',    color: null },
  { text: 'bricks',  color: null },
  { text: 'into',    color: null },
  { text: '\n',      color: null },  // line break
  { text: 'anything',color: T.red  },
  { text: 'you',     color: null },
  { text: 'can',     color: null },
  { text: '\n',      color: null },
  { text: 'imagine', color: T.blue },
];

function AnimatedHeadline({ reduced }) {
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.08, delayChildren: reduced ? 0 : 0.3 } },
  };
  const word = {
    hidden: { opacity: 0, y: reduced ? 0 : 18 },
    show:   { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.5, ease: EASE } },
  };

  return (
    <motion.h1
      variants={container}
      initial="hidden"
      animate="show"
      style={{
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        fontSize: 'clamp(42px, 8vw, 62px)',
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: '-0.035em',
        color: T.ink,
        maxWidth: 780,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {HEADLINE_WORDS.map((w, i) => {
        if (w.text === '\n') return <br key={i} />;
        return (
          <React.Fragment key={i}>
            <motion.span
              variants={word}
              style={{ display: 'inline-block', color: w.color || T.ink }}
            >
              {w.text}
            </motion.span>
            {' '}
          </React.Fragment>
        );
      })}
    </motion.h1>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate   = useNavigate();
  const fileRef    = useRef(null);
  const cameraRef  = useRef(null);
  const howRef     = useRef(null);
  const headerRef  = useRef(null);

  const [stage, setStage]  = useState(STAGES.IDLE);
  const [error, setError]  = useState(null);

  const reduced = useReducedMotion();

  /* Scroll-based header transparency */
  const { scrollY } = useScroll();
  const headerBg     = useTransform(scrollY, [0, 100], ['rgba(250,250,247,0)', 'rgba(250,250,247,0.92)']);
  const headerBorder = useTransform(scrollY, [0, 100], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)']);

  /* ── Upload pipeline ── */
  const processImage = useCallback(async (file) => {
    setError(null);
    try {
      setStage(STAGES.UPLOADING);
      const { labels, imageBase64, crops = [] } = await uploadImage(file);

      let pieces;

      if (PIPELINE === 'classify') {
        // ── Classify pipeline: per-crop Gemini calls ──
        if (crops.length === 0) {
          setError("We couldn't detect any LEGO pieces in the photo. Try a clearer photo from above with good lighting.");
          setStage(STAGES.ERROR);
          return;
        }

        setStage(STAGES.CLASSIFYING);
        console.log(`[Classify pipeline] ${crops.length} crop(s) to classify`);

        const { descriptions, errorCount } = await classifyAllCrops(
          crops.map((b64) => ({ croppedImageBase64: b64 })),
        );

        if (errorCount > 0) {
          console.warn(`[Classify pipeline] ${errorCount} classification(s) failed`);
        }

        if (!descriptions || descriptions.length === 0) {
          setError("We couldn't identify any LEGO pieces. Try a clearer photo from above with good lighting.");
          setStage(STAGES.ERROR);
          return;
        }

        pieces = consolidatePieces(descriptions);
      } else {
        // ── Scan pipeline: single Gemini call on the full image ──
        setStage(STAGES.SCANNING);
        const { pieces: rawPieces } = await scanImage(imageBase64, labels);

        if (!rawPieces || rawPieces.length === 0) {
          setError("We couldn't identify any LEGO pieces. Try a clearer photo from above with good lighting.");
          setStage(STAGES.ERROR);
          return;
        }

        pieces = consolidatePieces(rawPieces);
      }

      setStage(STAGES.GENERATING);
      const ideasData = await getIdeas(pieces);
      navigate('/ideas', { state: { ideas: ideasData.ideas, pieces } });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
      setStage(STAGES.ERROR);
    }
  }, [navigate]);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      setStage(STAGES.ERROR);
      return;
    }
    processImage(file);
  };

  const scrollToHow = (e) => {
    e.preventDefault();
    howRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isLoading = stage !== STAGES.IDLE && stage !== STAGES.ERROR;

  /* shared animation props */
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: reduced ? 0 : 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.6, ease: EASE, delay: reduced ? 0 : delay },
  });

  const cardVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 30 },
    show:   (i) => ({ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.6, ease: EASE, delay: reduced ? 0 : i * 0.05 } }),
  };

  /* ── Spring for buttons ── */
  const btnSpring = { type: 'spring', stiffness: 400, damping: 20 };

  /* ── Card data ── */
  const HOW_CARDS = [
    {
      badge: '01',
      mockup: <MockupScan />,
      title: 'Scan your bricks',
      body: 'Snap a photo of your loose bricks. Our vision models detect every piece and its color, size, and shape.',
    },
    {
      badge: '02',
      mockup: <MockupPick />,
      title: 'Pick an idea',
      body: 'Claude generates custom build ideas using only the pieces you actually own. Pick your favorite.',
    },
    {
      badge: '03',
      mockup: <MockupFollow />,
      title: 'Follow the build',
      body: 'Real LEGO-style instructions, step by step. New pieces glow so you always know what to place next.',
    },
  ];

  return (
    <>
      {/* ── Google Fonts + keyframes ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap');
        @keyframes bp-spin { to { transform: rotate(360deg); } }
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: ${T.paper}; margin: 0; }
        #bp-root { font-family: 'Inter Tight', system-ui, sans-serif; background: ${T.paper}; min-height: 100vh; }
        .bp-btn-focus-red:focus-visible  { outline: 2px solid ${T.red};  outline-offset: 3px; }
        .bp-btn-focus-blue:focus-visible { outline: 2px solid ${T.blue}; outline-offset: 3px; }
        .bp-btn-focus-ink:focus-visible  { outline: 2px solid ${T.ink};  outline-offset: 3px; }
      `}</style>

      <div id="bp-root">
        {/* ── 1. Top brand stripe ── */}
        <div aria-hidden="true" style={{ display: 'flex', height: 4, width: '100%' }}>
          <div style={{ flex: 1, background: T.red }} />
          <div style={{ flex: 1, background: T.yellow }} />
          <div style={{ flex: 1, background: T.blue }} />
        </div>

        {/* ── 2. Header ── */}
        <motion.header
          ref={headerRef}
          style={{
            position: 'sticky', top: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 32px',
            backgroundColor: headerBg,
            borderBottom: '0.5px solid',
            borderBottomColor: headerBorder,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/images/image.png"
              alt="Blueprint logo"
              style={{ width: 28, height: 28, objectFit: 'contain' }}
            />
            <span style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', color: T.ink }}>
              Blueprint
            </span>
          </div>
          <a
            href="#how-it-works"
            onClick={scrollToHow}
            style={{ fontSize: 14, color: T.muted, textDecoration: 'none', cursor: 'pointer' }}
          >
            How it works
          </a>
        </motion.header>

        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* ── 3. Hero ── */}
          <section style={{ padding: '110px 32px 90px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {isLoading ? (
              /* Loading state */
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '40px 0' }}
              >
                <Spinner />
                <p style={{ fontFamily: "'Inter Tight', system-ui", fontSize: 17, color: T.muted }}>
                  {STAGE_LABELS[stage]}
                </p>
              </motion.div>
            ) : (
              <>
                {/* Headline */}
                <AnimatedHeadline reduced={reduced} />

                {/* Subhead */}
                <motion.p {...fadeUp(0.5)} style={{ fontSize: 17, color: T.muted, maxWidth: 520, marginTop: 24, lineHeight: 1.55, textAlign: 'center' }}>
                  Scan your LEGO collection and get custom build sets with step-by-step instructions, no sets required.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div {...fadeUp(0.62)} style={{ display: 'flex', gap: 12, marginTop: 38, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <motion.button
                    className="bp-btn-focus-red"
                    whileHover={{ scale: reduced ? 1 : 1.03 }}
                    whileTap={{ scale: reduced ? 1 : 0.97 }}
                    transition={btnSpring}
                    onClick={() => fileRef.current?.click()}
                    aria-label="Upload a photo of your LEGO bricks"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: T.red, color: T.white,
                      border: 'none', borderRadius: 999,
                      padding: '13px 28px', fontSize: 15, fontWeight: 600,
                      fontFamily: "'Inter Tight', system-ui",
                      cursor: 'pointer', lineHeight: 1,
                    }}
                  >
                    <IconUpload /> Upload photo
                  </motion.button>

                  <motion.button
                    className="bp-btn-focus-blue"
                    whileHover={{ scale: reduced ? 1 : 1.03 }}
                    whileTap={{ scale: reduced ? 1 : 0.97 }}
                    transition={btnSpring}
                    onClick={() => cameraRef.current?.click()}
                    aria-label="Take a photo of your LEGO bricks"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: T.blue, color: T.white,
                      border: 'none', borderRadius: 999,
                      padding: '13px 28px', fontSize: 15, fontWeight: 600,
                      fontFamily: "'Inter Tight', system-ui",
                      cursor: 'pointer', lineHeight: 1,
                    }}
                  >
                    <IconCamera /> Take photo
                  </motion.button>
                </motion.div>

                {/* Error banner */}
                {stage === STAGES.ERROR && error && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 20, padding: '10px 18px', background: 'rgba(225,27,34,0.08)', border: `1px solid rgba(225,27,34,0.2)`, borderRadius: 8, color: T.red, fontSize: 14 }}
                  >
                    ⚠️ {error}
                  </motion.div>
                )}

                {/* Color dots */}
                <motion.div {...fadeUp(0.74)} aria-hidden="true" style={{ display: 'flex', gap: 8, marginTop: 48 }}>
                  {[T.red, T.yellow, T.blue].map((c) => (
                    <div key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c, opacity: 0.5 }} />
                  ))}
                </motion.div>
              </>
            )}
          </section>

          {/* Hidden file inputs */}
          <input ref={fileRef}   type="file" accept="image/*"               style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

          {/* ── 4. Section divider ── */}
          <div style={{ height: 1, background: T.line, margin: '0 32px' }} />

          {/* ── 5. How it works ── */}
          <section
            id="how-it-works"
            ref={howRef}
            style={{ padding: '70px 32px 80px', scrollMarginTop: 80, textAlign: 'center' }}
          >
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: reduced ? 0 : 0.5, ease: EASE }}
              style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: T.muted, fontWeight: 500, marginBottom: 14 }}
            >
              HOW IT WORKS
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: reduced ? 0 : 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: reduced ? 0 : 0.55, ease: EASE, delay: reduced ? 0 : 0.1 }}
              style={{
                fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', color: T.ink,
                maxWidth: 560, margin: '0 auto', lineHeight: 1.15,
                fontFamily: "'Inter Tight', system-ui",
              }}
            >
              From a pile of bricks to a finished build in three steps.
            </motion.h2>

            {/* Cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
              marginTop: 48,
              textAlign: 'left',
            }}>
              {HOW_CARDS.map((card, i) => (
                <motion.div
                  key={card.badge}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-100px' }}
                  style={{
                    position: 'relative',
                    background: T.white,
                    border: `1px solid ${T.line}`,
                    borderRadius: 14,
                    padding: 24,
                  }}
                >
                  {/* Step badge */}
                  <div style={{
                    position: 'absolute', top: -10, left: 24,
                    background: T.ink, color: T.white,
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 999,
                    fontFamily: "'Inter Tight', system-ui",
                  }}>
                    {card.badge}
                  </div>

                  {/* Mockup area */}
                  <div style={{
                    height: 140, background: T.paper, borderRadius: 8,
                    marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {card.mockup}
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 6, letterSpacing: '-0.01em', fontFamily: "'Inter Tight', system-ui" }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, margin: 0 }}>
                    {card.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>

        </div>{/* /maxWidth wrapper */}

        {/* ── 6. Closing CTA ── */}
        <section style={{
          background: T.white,
          borderTop: `1px solid ${T.line}`,
          padding: '60px 32px 50px',
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <motion.h2
            initial={{ opacity: 0, y: reduced ? 0 : 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}
            style={{
              fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: T.ink,
              marginBottom: 24, fontFamily: "'Inter Tight', system-ui",
            }}
          >
            Ready? Scan your bricks.
          </motion.h2>

          {/* Rainbow border button */}
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: reduced ? 0 : 0.55, ease: EASE, delay: reduced ? 0 : 0.1 }}
          >
            <motion.button
              className="bp-btn-focus-ink"
              whileHover={{ scale: reduced ? 1 : 1.03 }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
              transition={btnSpring}
              onClick={scrollToTop}
              aria-label="Get started scroll to top"
              style={{
                padding: 3,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #E11B22 0% 33%, #FAC80A 33% 66%, #1B6FB8 66% 100%)',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-block',
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: T.white,
                padding: '13px 32px',
                borderRadius: 999,
                fontSize: 15, fontWeight: 600, color: T.ink,
                fontFamily: "'Inter Tight', system-ui",
              }}>
                Get started →
              </span>
            </motion.button>
          </motion.div>

          {/* Footer row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', maxWidth: 1200, marginTop: 40,
            fontSize: 12, color: '#9A9A9E',
            fontFamily: "'Inter Tight', system-ui",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/images/image.png" alt="Blueprint logo" style={{ width: 16, height: 12, objectFit: 'contain' }} />
              Blueprint · 2025
            </div>
            <span>Made for Bearhacks</span>
          </div>
        </section>

      </div>{/* /bp-root */}
    </>
  );
}
