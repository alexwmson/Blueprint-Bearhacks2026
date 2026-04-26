import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { ImageAnnotatorClient } from '@google-cloud/vision';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Cap how many crops we send to Gemini to avoid rate-limit issues
const MAX_CROPS = 25;

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
    const imageContent = imageBuffer.toString('base64');

    // Run label detection + object localization in parallel
    const [labelResult, localizationResult] = await Promise.all([
      client.labelDetection({ image: { content: imageContent } }),
      client.objectLocalization({ image: { content: imageContent } }),
    ]);

    const labels = (labelResult[0].labelAnnotations || []).map((l) => ({
      description: l.description,
      score: l.score,
    }));

    const rawObjects = (localizationResult[0].localizedObjectAnnotations || []);
    const objects = rawObjects.map((o) => ({
      name: o.name,
      score: o.score,
      vertices: o.boundingPoly?.normalizedVertices || [],
    }));

    console.log(`[Cloud Vision] Labels: ${labels.length}, Objects detected: ${objects.length}`);
    objects.forEach((o) => console.log(`  object="${o.name}" score=${o.score?.toFixed(3)}`));

    // Crop each detected object from the original buffer for the classify pipeline.
    // Use the original (un-resized) buffer for maximum crop quality.
    const { width: imgW, height: imgH } = await sharp(imageBuffer).metadata();

    const cropObjects = objects
      .filter((o) => o.score > 0.35 && o.vertices.length >= 2)
      .slice(0, MAX_CROPS);

    const crops = (
      await Promise.all(
        cropObjects.map(async (obj) => {
          try {
            const xs = obj.vertices.map((v) => v.x ?? 0);
            const ys = obj.vertices.map((v) => v.y ?? 0);

            // Add 3% padding around the bounding box
            const pad = 0.03;
            const left   = Math.floor(Math.max(0, Math.min(...xs) - pad) * imgW);
            const top    = Math.floor(Math.max(0, Math.min(...ys) - pad) * imgH);
            const right  = Math.ceil( Math.min(1, Math.max(...xs) + pad) * imgW);
            const bottom = Math.ceil( Math.min(1, Math.max(...ys) + pad) * imgH);
            const w = Math.max(8, right - left);
            const h = Math.max(8, bottom - top);

            const buf = await sharp(imageBuffer)
              .extract({ left, top, width: w, height: h })
              .resize({ width: 256, withoutEnlargement: true })
              .jpeg({ quality: 82 })
              .toBuffer();

            return buf.toString('base64');
          } catch (cropErr) {
            console.warn('[Upload] Crop failed for object:', obj.name, cropErr.message);
            return null;
          }
        }),
      )
    ).filter(Boolean);

    console.log(`[Upload] Produced ${crops.length} crop(s) for classify pipeline`);

    // Resize full image for the Gemini scan pipeline
    const resizedBuffer = await sharp(imageBuffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    res.json({
      labels,
      objects,
      crops,
      imageBase64: resizedBuffer.toString('base64'),
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

