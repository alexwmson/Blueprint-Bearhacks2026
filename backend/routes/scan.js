import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

let genAI;
function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

const SCAN_PROMPT = `You are an expert LEGO piece identifier. Look carefully at this image and identify every individual LEGO brick, plate, tile, or slope you can see.

For each piece you identify, note:
- Its color (use standard LEGO colors: red, blue, yellow, green, white, black, gray, orange, purple, brown, tan, dark blue, dark green, dark red, lime green, pink, dark gray, light blue, light gray)
- Its size (studs wide × studs deep, e.g. 2x4, 1x2, 4x4)
- Its type (brick, plate, tile, slope, wedge, round brick, round plate)

Respond ONLY with a JSON object in this exact format:
{
  "pieces": [
    "red 2x4 brick",
    "blue 1x2 plate",
    "yellow 2x2 brick"
  ]
}

Rules:
- List EVERY piece you can see, including duplicates (if you see 3 red 2x4 bricks, list "red 2x4 brick" three times)
- If a piece is partially obscured but identifiable, include it
- If something is NOT a LEGO piece, do not include it
- If you cannot see any LEGO pieces at all, respond with: {"pieces": []}
- Respond ONLY with the JSON object. No other text, no markdown, no explanation.`;

router.post('/', async (req, res) => {
  try {
    const { imageBase64, labels } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    console.log('[Scan] Cloud Vision labels:', labels?.map((l) => l.description).join(', ') || 'none');

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      SCAN_PROMPT,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      },
    ]);

    const text = result.response.text().trim();
    console.log('[Scan] Gemini raw response:', text.slice(0, 300));

    // Strip markdown fences if present
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('[Scan] JSON parse failed, raw:', text);
      return res.status(500).json({ error: 'Failed to parse Gemini response', raw: text });
    }

    const pieces = parsed.pieces || [];
    console.log(`[Scan] Identified ${pieces.length} piece(s):`, pieces.slice(0, 10).join(', '));

    res.json({ pieces });
  } catch (err) {
    console.error('[Scan] error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
