/**
 * Lookup table: natural-language description → LDraw part file ID.
 *
 * PARTS_LIBRARY_PATH must point to the PARENT of the parts/ and p/ folders.
 * LDrawLoader automatically searches the subfolders: parts/, p/, models/
 * so setting this to /ldraw/ covers both /ldraw/parts/ and /ldraw/p/.
 */
export const PARTS_LIBRARY_PATH = '/ldraw/';

export const PARTS_MAP = {
  // Bricks
  '1x1 brick': '3005.dat',
  '1x2 brick': '3004.dat',
  '1x3 brick': '3622.dat',
  '1x4 brick': '3010.dat',
  '1x6 brick': '3009.dat',
  '1x8 brick': '3008.dat',
  '1x10 brick': '6111.dat',
  '1x12 brick': '6112.dat',
  '1x16 brick': '2465.dat',
  '2x2 brick': '3003.dat',
  '2x3 brick': '3002.dat',
  '2x4 brick': '3001.dat',
  '2x6 brick': '2456.dat',
  '2x8 brick': '3007.dat',
  '2x10 brick': '3006.dat',
  '4x4 brick': '2356.dat',
  '4x6 brick': '2356.dat',

  // Plates
  '1x1 plate': '3024.dat',
  '1x2 plate': '3023.dat',
  '1x3 plate': '3623.dat',
  '1x4 plate': '3710.dat',
  '1x6 plate': '3666.dat',
  '1x8 plate': '3460.dat',
  '1x10 plate': '4477.dat',
  '1x12 plate': '60479.dat',
  '2x2 plate': '3022.dat',
  '2x3 plate': '3021.dat',
  '2x4 plate': '3020.dat',
  '2x6 plate': '3795.dat',
  '2x8 plate': '3034.dat',
  '2x10 plate': '3832.dat',
  '4x4 plate': '3031.dat',
  '4x6 plate': '3032.dat',
  '4x8 plate': '3035.dat',
  '6x8 plate': '3036.dat',
  '6x10 plate': '3033.dat',
  '6x12 plate': '3028.dat',

  // Slopes
  '1x2 slope': '3040.dat',
  '1x3 slope': '4286.dat',
  '1x4 slope': '3037.dat',
  '2x2 slope': '3039.dat',
  '2x3 slope': '3298.dat',
  '2x4 slope': '3037.dat',

  // Tiles (flat, no studs)
  '1x1 tile': '3070b.dat',
  '1x2 tile': '3069b.dat',
  '1x4 tile': '2431.dat',
  '1x6 tile': '6636.dat',
  '1x8 tile': '4162.dat',
  '2x2 tile': '3068b.dat',
  '2x4 tile': '87079.dat',

  // Round & Special
  '1x1 round brick': '3062b.dat',
  '1x1 round plate': '4073.dat',
  '2x2 round brick': '3941.dat',
  '2x2 round plate': '4150.dat',
  '2x2 corner brick': '2357.dat',
  '2x2 corner plate': '2420.dat',

  // Wheels, Tires & Axles
  'wheel small': '4624.dat',
  'wheel medium': '6014.dat',
  'wheel large': '2903.dat',
  'tire small': '3641.dat',
  'tire medium': '6015.dat',
  'tire large': '2904.dat',
  'wheel axle': '4600.dat',
  'axle': '4600.dat',
  '1x2 axle': '4600.dat',
  '1x4 axle': '4600.dat',
  '1x6 axle': '4600.dat',
  '1x8 axle': '4600.dat',
};

export const COLOR_CODES = {
  black: 0,
  blue: 1,
  green: 2,
  red: 4,
  brown: 6,
  'light gray': 7,
  'dark gray': 8,
  'light blue': 9,
  'bright green': 10,
  pink: 13,
  yellow: 14,
  white: 15,
  tan: 19,
  purple: 22,
  orange: 25,
  magenta: 26,
  lime: 27,
  gray: 71,
};

/**
 * Returns true when a description refers to a wheel/tire assembly.
 * In that case buildLdrString emits both the rim and tire at the same position.
 */
export function isWheelDescription(description) {
  if (!description) return false;
  return /wheel|tire|tyre/i.test(description);
}

/**
 * Strip color prefix from a cleaned (no-parentheses) lowercase description.
 * Handles multi-word colors like "dark gray", "light blue", "bright green".
 */
function stripColor(lower) {
  return lower
    .replace(
      /^(dark\s+\w+|light\s+\w+|bright\s+\w+|medium\s+\w+|reddish\s+\w+|red|blue|yellow|green|white|black|gray|grey|orange|purple|brown|tan|pink|lime)\s+/,
      ''
    )
    .trim();
}

/**
 * Resolve a description like "red 2x4 brick" to an LDraw part filename.
 */
export function resolvePartId(description) {
  if (!description || description === 'none') return null;

  // Strip parenthetical annotations Claude sometimes appends, e.g. "(rover base)"
  const cleaned = description.replace(/\s*\(.*?\)/g, '').trim();

  // Axles: map any axle description to the Technic Pin before generic lookup
  if (/\baxle\b/i.test(cleaned)) return PARTS_MAP['axle'];

  const lower = cleaned.toLowerCase().trim();
  if (PARTS_MAP[lower]) return PARTS_MAP[lower];

  const colorless = stripColor(lower);
  if (PARTS_MAP[colorless]) return PARTS_MAP[colorless];

  // Partial match — prefer the key that fully contains the colorless string
  // (avoids matching "1x2 plate" when looking for "1x2 brick" etc.)
  const exactContains = Object.keys(PARTS_MAP).find((k) => colorless === k);
  if (exactContains) return PARTS_MAP[exactContains];

  const partialKey = Object.keys(PARTS_MAP).find(
    (k) => colorless.includes(k) || k.includes(colorless)
  );
  if (partialKey) return PARTS_MAP[partialKey];

  console.warn(`[partsMap] No LDraw ID found for: "${description}" (colorless: "${colorless}")`);
  return null;
}

/**
 * Resolve a description to an LDraw integer color code.
 */
export function resolveColorCode(description) {
  if (!description) return 4;
  const lower = description.toLowerCase();
  for (const [name, code] of Object.entries(COLOR_CODES)) {
    if (lower.startsWith(name + ' ') || lower === name) return code;
  }
  return 4;
}

/**
 * Build an LDraw (.ldr) string from an array of piece descriptors.
 * Each piece: { description, x, y, z, rotation, highlight? }
 *
 * LDraw line type 1 format:
 *   1 <color> <x> <y> <z> <a> <b> <c> <d> <e> <f> <g> <h> <i> <file>
 * The 3x3 matrix is a rotation matrix. For Y-axis rotation by angle degrees:
 *   [cos, 0, sin, 0, 1, 0, -sin, 0, cos]
 */
export function buildLdrString(pieces) {
  const lines = ['0 BrickVision Model', '0 Name: model.ldr', '0 Author: BrickVision'];
  let included = 0;

  for (const piece of pieces) {
    const colorCode = resolveColorCode(piece.description);
    const x = piece.x ?? 0;
    const y = piece.y ?? 0;
    const z = piece.z ?? 0;
    const rotDeg = piece.rotation ?? 0;
    const rotRad = (rotDeg * Math.PI) / 180;
    const cosR = Math.round(Math.cos(rotRad) * 1000) / 1000;
    const sinR = Math.round(Math.sin(rotRad) * 1000) / 1000;

    // Row-major rotation matrix around Y axis
    const a = cosR,  b = 0, c = sinR;
    const d = 0,     e = 1, f = 0;
    const g = -sinR, h = 0, i = cosR;
    const mat = `${a} ${b} ${c} ${d} ${e} ${f} ${g} ${h} ${i}`;

    if (isWheelDescription(piece.description)) {
      // Always render a wheel as rim (small wheel) + tire (small tire) together.
      lines.push(`1 ${colorCode} ${x} ${y} ${z} ${mat} ${PARTS_MAP['wheel small']}`);
      lines.push(`1 ${colorCode} ${x} ${y} ${z} ${mat} ${PARTS_MAP['tire small']}`);
      included++;
      continue;
    }

    const partId = resolvePartId(piece.description);
    if (!partId) continue;

    lines.push(`1 ${colorCode} ${x} ${y} ${z} ${mat} ${partId}`);
    included++;
  }

  console.log(`[buildLdrString] ${included}/${pieces.length} pieces resolved to LDraw IDs`);
  return lines.join('\r\n');
}
