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

    const [result] = await client.objectLocalization({
      image: { content: imageBuffer.toString('base64') },
    });

    const objects = result.localizedObjectAnnotations || [];

    console.log(`[Cloud Vision] Detected ${objects.length} object(s):`);
    objects.forEach((obj, i) => {
      console.log(`  [${i}] label="${obj.name}" score=${obj.score?.toFixed(3)}`);
    });

    // Get original image dimensions for cropping
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    const crops = await Promise.all(
      objects.map(async (obj) => {
        const vertices = obj.boundingPoly.normalizedVertices;
        const xs = vertices.map((v) => v.x);
        const ys = vertices.map((v) => v.y);
        const minX = Math.max(0, Math.min(...xs));
        const minY = Math.max(0, Math.min(...ys));
        const maxX = Math.min(1, Math.max(...xs));
        const maxY = Math.min(1, Math.max(...ys));

        const left = Math.floor(minX * imgWidth);
        const top = Math.floor(minY * imgHeight);
        const width = Math.max(1, Math.floor((maxX - minX) * imgWidth));
        const height = Math.max(1, Math.floor((maxY - minY) * imgHeight));

        const croppedBuffer = await sharp(imageBuffer)
          .extract({ left, top, width, height })
          .jpeg({ quality: 85 })
          .toBuffer();

        return {
          label: obj.name,
          score: obj.score,
          boundingBox: { minX, minY, maxX, maxY },
          croppedImageBase64: croppedBuffer.toString('base64'),
        };
      })
    );

    res.json({ crops });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
