import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { LDU_SYSTEM_PROMPT } from '../lib/ldrawUtils.js';

const router = express.Router();

let claude;
function getClaude() {
  if (!claude) {
    claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return claude;
}

const IDEAS_SCHEMA = `{
  "ideas": [
    {
      "title": "string",
      "short_description": "string (1-2 sentences)",
      "difficulty_rating": "integer 1-5",
      "category": "string (building|vehicle|animal|spaceship|furniture|other)",
      "pieces_used": ["string array of piece descriptions with counts, e.g. '3x red 2x4 brick'"],
      "preview_model": {
        "pieces": [
          { "description": "string", "x": "integer LDU", "y": "integer LDU", "z": "integer LDU", "rotation": "0|90|180|270" }
        ]
      }
    }
  ]
}`;

router.post('/', async (req, res) => {
  try {
    const { pieces } = req.body;
    if (!pieces || !Array.isArray(pieces) || pieces.length === 0) {
      return res.status(400).json({ error: 'No pieces provided' });
    }

    const pieceList = pieces.join(', ');
    const client = getClaude();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are a creative LEGO building expert for children.
${LDU_SYSTEM_PROMPT}

Your task is to suggest 4-5 buildable LEGO ideas using ONLY the pieces provided.
Each idea MUST be buildable using only the listed pieces — do not use more pieces than available.
For preview_model, include 5-12 pieces that give a recognizable preview of the structure.
Keep preview_model small but representative. Place pieces at correct LDU coordinates.
Respond ONLY with valid JSON matching this schema exactly. No markdown, no prose, no code fences:
${IDEAS_SCHEMA}`,
      messages: [
        {
          role: 'user',
          content: `I have these LEGO pieces: ${pieceList}

Suggest 4-5 creative things I can build with exactly these pieces. Be creative — think animals, vehicles, buildings, furniture, spaceships, etc.
Make sure the preview_model uses correct LDU coordinates so pieces fit together properly.`,
        },
      ],
    });

    const text = message.content[0].text.trim();

    // Strip markdown fences if Claude adds them despite instructions
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('Claude ideas JSON parse error:', parseErr);
      console.error('Raw response:', text);
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Ideas error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
