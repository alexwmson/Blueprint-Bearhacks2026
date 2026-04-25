import React, { useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion, AnimatePresence } from 'motion/react';
import { Upload, Camera } from 'lucide-react';
import { uploadImage, classifyAllCrops, consolidatePieces, getIdeas } from '../api/client.js';

/* ─── Brand tokens ─────────────────────────────── */
const T = {
  red:    '#E11B22',
  yellow: '#FAC80A',
  blue:   '#1B6FB8',
  ink:    '#0F0F10',
  muted:  '#6B6B70',
  paper:  '#FAFAF7',
  line:   'rgba(0,0,0,0.06)',
  white:  '#ffffff',
};

/* ─── Motion constants ──────────────────────────── */
const EASE = [0.22, 1, 0.36, 1];

/* ─── Logo mark SVG ─────────────────────────────── */
function BrickMark({ size = 28 }) {
  const h = Math.round(size * 20 / 28);
  const studR = Math.round(size * 7 / 28);
  const studY = -Math.round(size * 4 / 28);
  return (
    <svg
      aria-hidden="true"
      width={size} height={h + Math.abs(studY)}
      viewBox={`0 0 ${size} ${h + Math.abs(studY)}`}
      style={{ overflow: 'visible', flexShrink: 0 }}
    >
      <rect x={0} y={Math.abs(studY)} width={size} height={h} rx={3} fill={T.red} />
      <circle cx={4 + studR} cy={studY + Math.abs(studY)} r={studR} fill={T.red} />
      <circle cx={17 + studR} cy={studY + Math.abs(studY)} r={studR} fill={T.red} />
    </svg>
  );
}

/* ─── Card 1 mockup: Scan bricks ────────────────── */
function ScanMockup() {
  return (
    <svg aria-hidden="true" width="100%" height="140" viewBox="0 0 220 140" style={{ display:'block' }}>
      {/* red 2x4 brick */}
      <rect x="20" y="60" width="80" height="40" rx="4" fill={T.red} />
      <circle cx="38" cy="56" r="8" fill={T.red} />
      <circle cx="62" cy="56" r="8" fill={T.red} />
      <circle cx="86" cy="56" r="8" fill={T.red} />
      {/* yellow 2x2 brick */}
      <rect x="75" y="82" width="50" height="30" rx="4" fill={T.yellow} />
      <circle cx="91" cy="78" r="7" fill={T.yellow} />
      <circle cx="110" cy="78" r="7" fill={T.yellow} />
      {/* blue 2x3 brick */}
      <rect x="130" y="45" width="68" height="38" rx="4" fill={T.blue} />
      <circle cx="148" cy="41" r="8" fill={T.blue} />
      <circle cx="172" cy="41" r="8" fill={T.blue} />
      <circle cx="196" cy="41" r="8" fill={T.blue} />
      {/* bounding box 1 */}
      <rect x="14" y="42" width="94" height="64" rx="3" fill="none" stroke={T.blue} strokeWidth="1.5" strokeDasharray="5 3" />
      {/* bounding box 2 */}
      <rect x="122" y="32" width="86" height="58" rx="3" fill="none" stroke={T.blue} strokeWidth="1.5" strokeDasharray="5 3" />
    </svg>
  );
}

/* ─── Card 2 mockup: Pick an idea ───────────────── */
function IdeaMockup() {
  return (
    <svg aria-hidden="true" width="100%" height="140" viewBox="0 0 220 140" style={{ display:'block' }}>
      {/* left card rotated -4deg */}
      <g transform="translate(38,70) rotate(-4) translate(-38,-70)">
        <rect x="14" y="28" width="50" height="68" rx="5" fill="white" stroke={T.line} strokeWidth="1" />
        <rect x="18" y="32" width="42" height="34" rx="3" fill={T.yellow} />
        <rect x="18" y="72" width="30" height="5" rx="2" fill="#ddd" />
        <rect x="18" y="82" width="22" height="5" rx="2" fill="#eee" />
      </g>
      {/* right card rotated 4deg */}
      <g transform="translate(182,70) rotate(4) translate(-182,-70)">
        <rect x="156" y="28" width="50" height="68" rx="5" fill="white" stroke={T.line} strokeWidth="1" />
        <rect x="160" y="32" width="42" height="34" rx="3" fill={T.blue} />
        <rect x="160" y="72" width="30" height="5" rx="2" fill="#ddd" />
        <rect x="160" y="82" width="22" height="5" rx="2" fill="#eee" />
      </g>
      {/* middle card selected */}
      <rect x="83" y="22" width="54" height="76" rx="5" fill="white" stroke={T.ink} strokeWidth="1.5" />
      <rect x="88" y="27" width="44" height="38" rx="3" fill={T.red} />
      <rect x="88" y="71" width="32" height="5" rx="2" fill="#ccc" />
      <rect x="88" y="81" width="24" height="5" rx="2" fill="#e0e0e0" />
    </svg>
  );
}

/* ─── Card 3 mockup: Follow the build ───────────── */
function InstructionMockup() {
  return (
    <svg aria-hidden="true" width="100%" height="140" viewBox="0 0 220 140" style={{ display:'block' }}>
      <rect x="28" y="16" width="164" height="108" rx="5" fill="white" stroke={T.ink} strokeWidth="2" />
      {/* step circle */}
      <circle cx="50" cy="37" r="11" fill={T.yellow} />
      <text x="50" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill={T.ink}>3</text>
      {/* progress badge */}
      <rect x="164" y="28" width="22" height="14" rx="3" fill="white" stroke={T.line} strokeWidth="1" />
      <text x="175" y="39" textAnchor="middle" fontSize="8" fill={T.muted}>3/8</text>
      {/* brick row */}
      {/* brick 1 — red, placed, dimmed */}
      <rect x="48" y="72" width="28" height="18" rx="3" fill={T.red} fillOpacity="0.35" />
      {/* brick 2 — blue, placed, dimmed */}
      <rect x="84" y="72" width="28" height="18" rx="3" fill={T.blue} fillOpacity="0.35" />
      {/* brick 3 — yellow, active, full opacity + outline */}
      <rect x="120" y="72" width="28" height="18" rx="3" fill={T.yellow} />
      <rect x="120" y="72" width="28" height="18" rx="3" fill="none" stroke={T.ink} strokeWidth="1.5" />
      {/* brick 4 — red, next, dimmed */}
      <rect x="156" y="72" width="20" height="18" rx="3" fill={T.red} fillOpacity="0.35" />
    </svg>
  );
}

/* ─── How-it-works card ─────────────────────────── */
function HowCard({ step, title, body, mockup, delay, reduced }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: reduced ? 0 : 0.6, ease: EASE, delay: reduced ? 0 : delay }}
      style={{
        background: T.white,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 24,
        position: 'relative',
      }}
    >
      {/* Step badge */}
      <div style={{
        position: 'absolute',
        top: -10,
        left: 24,
        background: T.ink,
        color: T.white,
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        letterSpacing: '0.05em',
      }}>{step}</div>

      {/* Mini mockup */}
      <div style={{
        height: 140,
        background: T.paper,
        borderRadius: 8,
        marginBottom: 18,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {mockup}
      </div>

      <p style={{ fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 6, letterSpacing: '-0.01em' }}>{title}</p>
      <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>{body}</p>
    </motion.div>
  );
}

/* ─── CTA Button ─────────────────────────────────── */
function CTAButton({ bg, ring, label, icon: Icon, ariaLabel, onClick, reduced }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={ariaLabel}
      whileHover={reduced ? {} : { scale: 1.03 }}
      whileTap={reduced ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '13px 28px',
        borderRadius: 999,
        border: 'none',
        background: bg,
        color: T.white,
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        outline: 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${ring}`; }}
      onBlur={(e)  => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function LandingPage({ onUpload }) {
  const navigate    = useNavigate();
  const fileRef     = useRef(null);
  const cameraRef   = useRef(null);
  const heroRef     = useRef(null);
  const reduced     = useReducedMotion();
  const { scrollY } = useScroll();

  // Header scroll effect
  const headerBg     = useTransform(scrollY, [0, 100], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)']);
  const headerBorder = useTransform(scrollY, [0, 100], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)']);

  // ── inject Google Font ──
  useEffect(() => {
    const id = 'blueprint-font';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // ── file handling ──
  const processImage = useCallback(async (file, mode) => {
    if (onUpload) { onUpload(mode); return; }
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const { crops } = await uploadImage(file);
      if (!crops?.length) return;
      const { descriptions } = await classifyAllCrops(crops, () => {});
      const pieces = consolidatePieces(descriptions);
      const ideasData = await getIdeas(pieces);
      navigate('/ideas', { state: { ideas: ideasData.ideas, pieces } });
    } catch (err) {
      console.error(err);
    }
  }, [navigate, onUpload]);

  const handleFile = (file, mode) => {
    if (!file) return;
    processImage(file, mode);
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── headline words for stagger ──
  const line1 = 'Turn your bricks into'.split(' ');
  const line2 = ['anything'];
  const line3 = 'you can'.split(' ');
  const line4 = ['imagine'];
  const allWords = [
    ...line1.map(w => ({ w, color: T.ink,   nl: false })),
    { w: '\n',     color: T.ink, nl: true  },
    ...line2.map(w => ({ w, color: T.red,   nl: false })),
    ...line3.map(w => ({ w, color: T.ink,   nl: false })),
    { w: '\n',     color: T.ink, nl: true  },
    ...line4.map(w => ({ w, color: T.blue,  nl: false })),
  ];

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const childVariant = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.6, ease: EASE } },
  };
  const wordVariants = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0 },
  };

  return (
    <div style={{
      background: T.paper,
      minHeight: '100vh',
      fontFamily: "'Inter Tight', system-ui, sans-serif",
      color: T.ink,
    }}>

      {/* ── 1. Brand stripe ── */}
      <div style={{ display: 'flex', height: 4, width: '100%' }}>
        <div style={{ flex: 1, background: T.red }} />
        <div style={{ flex: 1, background: T.yellow }} />
        <div style={{ flex: 1, background: T.blue }} />
      </div>

      {/* ── 2. Header ── */}
      <motion.header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          backgroundColor: headerBg,
          borderBottom: '0.5px solid',
          borderBottomColor: headerBorder,
          padding: '18px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '100%',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <BrickMark size={28} />
          <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', color: T.ink }}>
            Blueprint
          </span>
        </div>

        {/* Nav link */}
        <a
          href="#how-it-works"
          style={{ fontSize: 14, color: T.muted, textDecoration: 'none' }}
          onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}
        >
          How it works
        </a>
      </motion.header>

      {/* ── 3. Hero ── */}
      <section ref={heroRef} style={{ padding: '110px 32px 80px', textAlign: 'center' }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {/* Headline with per-word stagger */}
          <motion.h1
            variants={childVariant}
            style={{
              fontSize: 62,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.035em',
              maxWidth: 780,
              margin: '0 auto',
            }}
          >
            <motion.span
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
              }}
              style={{ display: 'inline' }}
            >
              {allWords.map((item, i) =>
                item.nl ? (
                  <br key={i} />
                ) : (
                  <motion.span
                    key={i}
                    variants={wordVariants}
                    transition={{ duration: reduced ? 0 : 0.5, ease: EASE }}
                    style={{ color: item.color, display: 'inline-block', marginRight: '0.25em' }}
                  >
                    {item.w}
                  </motion.span>
                )
              )}
            </motion.span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={childVariant}
            style={{
              fontSize: 17,
              color: T.muted,
              maxWidth: 520,
              marginTop: 24,
              lineHeight: 1.55,
            }}
          >
            Scan your LEGO collection and get custom build sets with step-by-step instructions — no set required.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={childVariant}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 38, flexWrap: 'wrap' }}
          >
            <CTAButton
              bg={T.red}
              ring={T.red}
              label="Upload photo"
              icon={Upload}
              ariaLabel="Upload a photo of your LEGO bricks"
              reduced={reduced}
              onClick={() => fileRef.current?.click()}
            />
            <CTAButton
              bg={T.blue}
              ring={T.blue}
              label="Take photo"
              icon={Camera}
              ariaLabel="Take a photo of your LEGO bricks"
              reduced={reduced}
              onClick={() => cameraRef.current?.click()}
            />
            <input ref={fileRef}   type="file" accept="image/*"                    style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0], 'upload')} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0], 'camera')} />
          </motion.div>

          {/* Color dots */}
          <motion.div
            variants={childVariant}
            style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 48 }}
          >
            {[T.red, T.yellow, T.blue].map((c) => (
              <div key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c, opacity: 0.5 }} />
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── 4. Divider ── */}
      <div style={{ height: 1, background: T.line, margin: '0 32px' }} />

      {/* ── 5. How it works ── */}
      <section
        id="how-it-works"
        style={{ padding: '70px 32px 80px', scrollMarginTop: 80, maxWidth: 1200, margin: '0 auto' }}
      >
        <p style={{
          fontSize: 12,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: T.muted,
          fontWeight: 500,
          textAlign: 'center',
          marginBottom: 14,
        }}>How it works</p>

        <h2 style={{
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: T.ink,
          maxWidth: 560,
          lineHeight: 1.15,
          textAlign: 'center',
          margin: '0 auto',
        }}>
          From a pile of bricks to a finished build in three steps.
        </h2>

        {/* Cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          marginTop: 48,
        }}>
          <HowCard
            step="01"
            title="Scan your bricks"
            body="Snap a photo of your loose bricks. Our vision models detect every piece — color, size, shape."
            mockup={<ScanMockup />}
            delay={0}
            reduced={reduced}
          />
          <HowCard
            step="02"
            title="Pick an idea"
            body="Claude generates custom build ideas using only the pieces you actually own. Pick your favorite."
            mockup={<IdeaMockup />}
            delay={0.05}
            reduced={reduced}
          />
          <HowCard
            step="03"
            title="Follow the build"
            body="Real LEGO-style instructions, step by step. New pieces glow so you always know what to place next."
            mockup={<InstructionMockup />}
            delay={0.1}
            reduced={reduced}
          />
        </div>
      </section>

      {/* ── 6. Closing CTA ── */}
      <section style={{
        background: T.white,
        borderTop: `1px solid ${T.line}`,
        padding: '60px 32px 50px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: T.ink,
          marginBottom: 24,
        }}>Ready? Scan your bricks.</h2>

        {/* Rainbow-bordered Get Started button */}
        <motion.div
          whileHover={reduced ? {} : { scale: 1.03 }}
          whileTap={reduced ? {} : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{ display: 'inline-block' }}
        >
          <div style={{
            padding: 3,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${T.red} 0%, ${T.red} 33%, ${T.yellow} 33%, ${T.yellow} 66%, ${T.blue} 66%, ${T.blue} 100%)`,
          }}>
            <button
              aria-label="Get started — scroll to top"
              onClick={() => heroRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 32px',
                borderRadius: 999,
                border: 'none',
                background: T.white,
                color: T.ink,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'Inter Tight', system-ui, sans-serif",
              }}
            >
              Get started →
            </button>
          </div>
        </motion.div>

        {/* Footer row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 40,
          fontSize: 12,
          color: '#9A9A9E',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {/* Left: mini brick + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg aria-hidden="true" width="16" height="12" viewBox="0 0 16 12">
              <rect x="0" y="3" width="16" height="9" rx="2" fill={T.red} />
              <circle cx="4"  cy="3" r="3" fill={T.red} />
              <circle cx="12" cy="3" r="3" fill={T.red} />
            </svg>
            Blueprint · 2025
          </div>
          <span>Made for Bearhacks</span>
        </div>
      </section>
    </div>
  );
}
