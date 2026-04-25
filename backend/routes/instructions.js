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

const INSTRUCTIONS_SCHEMA = `{
  "model": {
    "name": "string",
    "description": "string",
    "total_steps": "integer",
    "pieces_used": [
      { "description": "string", "count": "integer" }
    ]
  },
  "steps": [
    {
      "step_number": "integer",
      "description": "string (what to do this step)",
      "pieces": [
        {
          "description": "string",
          "x": "integer LDU",
          "y": "integer LDU",
          "z": "integer LDU",
          "rotation": "0|90|180|270",
          "highlight": "boolean — true for pieces ADDED in this step, false for pieces from previous steps"
        }
      ],
      "camera_hint": "front|top|side"
    }
  ]
}`;

router.post('/', async (req, res) => {
  try {
    const { idea } = req.body;
    if (!idea) {
      return res.status(400).json({ error: 'No idea provided' });
    }

    const client = getClaude();

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      system: `You are a LEGO building instruction designer. Create clear, step-by-step building instructions.
${LDU_SYSTEM_PROMPT}

CRITICAL HIGHLIGHT RULE:
- Each step's "pieces" array must include ALL pieces placed so far (cumulative), not just the new ones.
- For pieces added in the CURRENT step: set "highlight": true
- For pieces placed in PREVIOUS steps: set "highlight": false
- This allows the renderer to dim old pieces and highlight new ones, exactly like real LEGO instructions.

Keep steps small and manageable — 1-4 new pieces per step is ideal for learners.
Make step descriptions friendly and clear for children.
Choose camera_hint based on what angle best shows the new pieces being added.
Respond ONLY with valid JSON matching this schema exactly. No markdown, no prose, no code fences:
${INSTRUCTIONS_SCHEMA}`,
      messages: [
        {
          role: 'user',
          content: `Create step-by-step building instructions for this LEGO idea:

Title: ${idea.title}
Description: ${idea.short_description}
Pieces available: ${idea.pieces_used ? idea.pieces_used.join(', ') : 'as listed in preview_model'}
Preview model pieces: ${JSON.stringify(idea.preview_model?.pieces || [])}

Generate detailed step-by-step instructions. Each step should accumulate pieces (include all pieces placed so far).
New pieces in each step get highlight: true. Previous pieces get highlight: false.
Use correct LDU coordinates so pieces snap together perfectly.`,
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('Claude instructions JSON parse error:', parseErr);
      console.error('Raw response:', text);
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Instructions error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
