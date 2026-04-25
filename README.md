# BrickVision

> Turn your pile of LEGO bricks into creative builds — powered by AI.

Made at **BearHacks 2026**.

---

## What it does

1. **Photograph** your LEGO pieces (or upload an image)
2. **Google Cloud Vision** detects each brick via object localization
3. **Gemini Vision** classifies every crop into a structured piece description (e.g. "red 2x4 brick") — all in parallel
4. **Claude** suggests 4–5 buildable ideas using exactly those pieces, with correct 3D coordinates
5. **Step-by-step 3D instructions** rendered with Three.js + LDrawLoader, with new pieces highlighted each step

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| 3D Rendering | Three.js + LDrawLoader |
| Backend | Node.js + Express |
| Vision | Google Cloud Vision (object localization) |
| Brick ID | Gemini Vision (`gemini-1.5-flash`) |
| Build ideas | Claude (`claude-opus-4-5`) |
| Image processing | Sharp (cropping) |

---

## Prerequisites

- Node.js ≥ 18
- Google Cloud project with Vision API enabled
- A Google service account JSON key file
- Gemini API key
- Anthropic API key

---

## Setup

### 1. Install dependencies

```bash
# From project root
npm install --workspaces
```

### 2. Configure backend environment

Copy `.env` template and fill in your keys:

```bash
cp backend/.env backend/.env.local
```

Edit `backend/.env`:

```
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key
PORT=3001
```

Place your Google service account JSON at `backend/google-credentials.json`.

### 3. LDraw parts library (optional but recommended)

The 3D viewer uses LDraw part files. Without them, a colored-box fallback is shown.

1. Download the official LDraw parts library from https://www.ldraw.org/parts/latest-parts.html
2. Extract into `frontend/public/ldraw/parts/`

The path is configured in one place: `frontend/src/lib/partsMap.js` → `PARTS_LIBRARY_PATH`.

### 4. Run development servers

```bash
# Terminal 1 — backend
npm run dev --workspace=backend

# Terminal 2 — frontend
npm run dev --workspace=frontend
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001

---

## Project structure

```
Bearhacks2026/
├── backend/
│   ├── server.js               Express entry point
│   ├── routes/
│   │   ├── upload.js           POST /api/upload  — Cloud Vision
│   │   ├── classify.js         POST /api/classify — Gemini Vision
│   │   ├── ideas.js            POST /api/ideas   — Claude
│   │   └── instructions.js     POST /api/instructions — Claude
│   └── lib/
│       ├── partsMap.js         description → LDraw ID lookup + color codes
│       └── ldrawUtils.js       LDU constants + Claude prompt preamble
├── frontend/
│   ├── public/ldraw/parts/     LDraw .dat files go here
│   └── src/
│       ├── App.jsx
│       ├── api/client.js       All API call wrappers
│       ├── lib/partsMap.js     Frontend mirror of parts lookup
│       ├── pages/
│       │   ├── LandingPage.jsx Upload + progress flow
│       │   └── MainPage.jsx    Idea cards grid
│       └── components/
│           ├── LDrawViewer.jsx  Three.js renderer (reusable)
│           ├── IdeaItem.jsx     Collapsible idea card
│           └── StepViewer.jsx   Step-by-step instruction viewer
└── README.md
```

---

## LDU coordinate system

All Claude prompts are given these exact rules so pieces snap together correctly:

| Measurement | LDU value |
|---|---|
| 1 stud width/depth | 20 LDU |
| 1 brick height | 24 LDU |
| 1 plate height | 8 LDU |
| 1 stud diameter | 12 LDU |
| 1 stud height | 4 LDU |

Examples:
- Two 2×4 bricks side by side: `x=0` and `x=40`
- Brick stacked on another: `y=-24` (Y decreases upward)
- Plate stacked on a brick: `y=-8`
