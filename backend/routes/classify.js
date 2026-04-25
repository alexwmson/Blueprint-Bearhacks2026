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

const CLASSIFY_PROMPT = `You are a LEGO piece identifier. Look at this image and determine if it shows a LEGO brick or plate.
If it is a LEGO piece, respond with ONLY a JSON object in this exact format: {"description": "color size type"}
Examples: {"description": "red 2x4 brick"}, {"description": "blue 1x2 plate"}, {"description": "yellow 2x2 brick"}
If the image does NOT show a LEGO piece, respond with ONLY: {"description": "none"}
Use common LEGO colors (red, blue, yellow, green, white, black, gray, orange, purple, brown, tan, dark blue, dark green, dark red, lime green, pink, dark gray, light blue, light gray).
Use sizes like 1x1, 1x2, 1x3, 1x4, 1x6, 1x8, 2x2, 2x3, 2x4, 2x6, 2x8, 4x4, 4x6, 4x8, 6x6, etc.
Use types: brick, plate, tile, slope, wedge, technic brick, round brick, round plate.
Respond with ONLY the JSON object, no other text.`;

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

    // Extract JSON from response (in case model adds extra text)
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      return res.json({ description: 'none' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ description: parsed.description || 'none' });
  } catch (err) {
    console.error('Classify error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
