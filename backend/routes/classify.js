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

const CLASSIFY_PROMPT = `You are an expert LEGO piece identifier. This image shows a cropped region from a photo of loose LEGO bricks. The crop may contain ONE piece or MULTIPLE pieces if the bounding box captured more than one.

List EVERY LEGO piece visible in this crop. Output ONLY a JSON object in this exact format:
{"pieces": ["color size type", "color size type", ...]}

If the crop contains no LEGO pieces at all, output: {"pieces": []}

Examples:
{"pieces": ["red 2x4 brick"]}
{"pieces": ["blue 1x2 plate", "yellow 2x2 brick"]}
{"pieces": ["gray 2x2 axle"]}
{"pieces": ["black wheel"]}
{"pieces": []}

Colors: red, blue, yellow, green, white, black, gray, orange, purple, brown, tan, dark blue, dark green, lime, pink, light gray, dark gray
Sizes: 1x1, 1x2, 1x3, 1x4, 1x6, 1x8, 2x2, 2x3, 2x4, 2x6, 2x8, 4x4, 4x6
Types: brick, plate, tile, slope, axle, wheel, round brick, round plate

Important notes:
- Axles look almost identical to plates but have two small protruding pins/knubs on opposite sides — call it a "2x2 axle"
- Slopes have one visibly angled/sloped face — call it a "slope"
- Wheels are round like a coin or tire — call it a "wheel"
- If a piece is partially cut off but identifiable, include it
- Give your best guess for ambiguous pieces rather than omitting them
- Respond with ONLY the JSON object. No explanation, no markdown, no extra text.`;

router.post('/', async (req, res) => {
  try {
    const { croppedImageBase64 } = req.body;
    if (!croppedImageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      CLASSIFY_PROMPT,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: croppedImageBase64,
        },
      },
    ]);

    const text = result.response.text().trim();

    // Strip markdown fences if present, then extract JSON
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Classify] No JSON in response:', text.slice(0, 100));
      return res.json({ pieces: [] });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn('[Classify] JSON parse failed:', jsonMatch[0]);
      return res.json({ pieces: [] });
    }

    const pieces = Array.isArray(parsed.pieces) ? parsed.pieces.filter(Boolean) : [];
    console.log(`[Classify] → [${pieces.join(', ')}]`);
    res.json({ pieces });
  } catch (err) {
    console.error('[Classify] error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
