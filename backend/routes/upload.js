import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { ImageAnnotatorClient } from '@google-cloud/vision';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

let visionClient;
function getVisionClient() {
  if (!visionClient) {
    visionClient = new ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return visionClient;
}

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const imageBuffer = req.file.buffer;
    const client = getVisionClient();

    const [result] = await client.labelDetection({
      image: { content: imageBuffer.toString('base64') },
    });

    const labels = (result.labelAnnotations || []).map((l) => ({
      description: l.description,
      score: l.score,
    }));

    console.log(`[Cloud Vision] Label detection returned ${labels.length} label(s):`);
    labels.forEach((l) => console.log(`  label="${l.description}" score=${l.score?.toFixed(3)}`));

    // Resize to a reasonable size before sending to Gemini to keep payload small
    const resizedBuffer = await sharp(imageBuffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    res.json({
      labels,
      imageBase64: resizedBuffer.toString('base64'),
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

