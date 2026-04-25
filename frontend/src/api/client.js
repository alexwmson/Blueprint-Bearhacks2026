const BASE_URL = '/api';

/**
 * Upload an image to Cloud Vision for object localization.
 * Returns { crops: [{ label, score, boundingBox, croppedImageBase64 }] }
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

/**
 * Classify a single cropped image using Gemini Vision.
 * Returns { description: "red 2x4 brick" } or { description: "none" }
 */
export async function classifyPiece(croppedImageBase64) {
  const res = await fetch(`${BASE_URL}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ croppedImageBase64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Classify failed');
  }
  return res.json();
}

/**
 * Classify all crops in parallel using Promise.all.
 * Filters out descriptions of "none".
 * Returns { descriptions: string[], errorCount: number }
 */
export async function classifyAllCrops(crops, onProgress) {
  let completed = 0;
  let errorCount = 0;
  const rawResults = await Promise.all(
    crops.map(async (crop) => {
      try {
        const result = await classifyPiece(crop.croppedImageBase64);
        completed++;
        if (onProgress) onProgress(completed, crops.length);
        return result.description;
      } catch (err) {
        console.error('Classify error for crop:', err.message);
        errorCount++;
        completed++;
        if (onProgress) onProgress(completed, crops.length);
        return 'none';
      }
    })
  );
  return {
    descriptions: rawResults.filter((d) => d && d !== 'none'),
    errorCount,
  };
}

/**
 * Consolidate raw descriptions into a piece inventory string array.
 * e.g. ["red 2x4 brick", "red 2x4 brick", "blue 1x2 plate"]
 *   -> ["2x red 2x4 brick", "1x blue 1x2 plate"]
 */
export function consolidatePieces(descriptions) {
  const counts = {};
  for (const desc of descriptions) {
    counts[desc] = (counts[desc] || 0) + 1;
  }
  return Object.entries(counts).map(([desc, count]) => `${count}x ${desc}`);
}

/**
 * Get 4-5 build ideas from Claude given a list of pieces.
 * Returns { ideas: [...] }
 */
export async function getIdeas(pieces) {
  const res = await fetch(`${BASE_URL}/ideas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pieces }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Ideas fetch failed');
  }
  return res.json();
}

/**
 * Get step-by-step instructions for a single idea from Claude.
 * Returns { model: {...}, steps: [...] }
 */
export async function getInstructions(idea) {
  const res = await fetch(`${BASE_URL}/instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Instructions fetch failed');
  }
  return res.json();
}
