import express from 'express';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const router = express.Router();

let elevenlabsClient;
function getElevenLabsClient() {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('Missing ELEVENLABS_API_KEY');
  }
  if (!elevenlabsClient) {
    elevenlabsClient = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }
  return elevenlabsClient;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

router.post('/', async (req, res) => {
  try {
    const { text, voiceId, modelId } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const client = getElevenLabsClient();
    const selectedVoiceId = voiceId || 'JBFqnCBsd6RMkjVDRZzb';
    const selectedModelId = modelId || 'eleven_multilingual_v2';

    const audioStream = await client.textToSpeech.convert(selectedVoiceId, {
      text: text.trim(),
      modelId: selectedModelId,
      outputFormat: 'mp3_44100_128',
    });

    const audioBuffer = await streamToBuffer(audioStream);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: err.message || 'TTS generation failed' });
  }
});

export default router;
