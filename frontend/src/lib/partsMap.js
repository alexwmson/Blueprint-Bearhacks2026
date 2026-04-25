/**
 * Lookup table mirrored from backend/lib/partsMap.js for frontend use.
 * Single configurable path — update PARTS_LIBRARY_PATH when actual .dat files are present.
 */
export const PARTS_LIBRARY_PATH = '/ldraw/parts/';

export const PARTS_MAP = {
  '1x1 brick': '3005.dat',
  '1x2 brick': '3004.dat',
  '1x3 brick': '3622.dat',
  '1x4 brick': '3010.dat',
  '1x6 brick': '3009.dat',
  '1x8 brick': '3008.dat',
  '2x2 brick': '3003.dat',
  '2x3 brick': '3002.dat',
  '2x4 brick': '3001.dat',
  '2x6 brick': '2456.dat',
  '2x8 brick': '3007.dat',
  '4x4 brick': '2356.dat',
  '1x1 plate': '3024.dat',
  '1x2 plate': '3023.dat',
  '1x3 plate': '3623.dat',
  '1x4 plate': '3710.dat',
  '1x6 plate': '3666.dat',
  '1x8 plate': '3460.dat',
  '2x2 plate': '3022.dat',
  '2x3 plate': '3021.dat',
  '2x4 plate': '3020.dat',
  '2x6 plate': '3795.dat',
  '2x8 plate': '3034.dat',
  '4x4 plate': '3031.dat',
  '4x6 plate': '3032.dat',
  '4x8 plate': '3035.dat',
  '6x6 plate': '3958.dat',
  '1x1 tile': '3070b.dat',
  '1x2 tile': '3069b.dat',
  '2x2 tile': '3068b.dat',
  '2x4 tile': '87079.dat',
  '1x1 slope': '3040b.dat',
  '1x2 slope': '3040b.dat',
  '2x2 slope': '3039.dat',
  '2x3 slope': '3038.dat',
  '2x4 slope': '3037.dat',
  '1x3 slope': '4286.dat',
  '1x1 round brick': '3062b.dat',
  '2x2 round brick': '6143.dat',
  '1x1 round plate': '4073.dat',
  '2x2 round plate': '4032a.dat',
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
 * Resolve a description like "red 2x4 brick" to an LDraw part filename.
 */
export function resolvePartId(description) {
  if (!description || description === 'none') return null;
  const lower = description.toLowerCase().trim();
  if (PARTS_MAP[lower]) return PARTS_MAP[lower];
  const colorless = lower
    .replace(
      /^(red|blue|yellow|green|white|black|gray|grey|orange|purple|brown|tan|pink|lime|dark\s+\w+|light\s+\w+)\s+/,
      ''
    )
    .trim();
  if (PARTS_MAP[colorless]) return PARTS_MAP[colorless];
  const partialKey = Object.keys(PARTS_MAP).find(
    (k) => colorless.includes(k) || k.includes(colorless)
  );
  return partialKey ? PARTS_MAP[partialKey] : null;
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
 * where the 3x3 matrix is a rotation matrix. For Y-axis rotation by angle degrees:
 *   [cos, 0, sin, 0, 1, 0, -sin, 0, cos]
 */
export function buildLdrString(pieces) {
  const lines = ['0 BrickVision Model', '0 Name: model.ldr', '0 Author: BrickVision'];

  for (const piece of pieces) {
    const partId = resolvePartId(piece.description);
    if (!partId) continue;

    const colorCode = resolveColorCode(piece.description);
    const x = piece.x ?? 0;
    const y = piece.y ?? 0;
    const z = piece.z ?? 0;
    const rotDeg = piece.rotation ?? 0;
    const rotRad = (rotDeg * Math.PI) / 180;
    const cosR = Math.round(Math.cos(rotRad) * 1000) / 1000;
    const sinR = Math.round(Math.sin(rotRad) * 1000) / 1000;

    // Row-major rotation matrix around Y axis
    // [cosR 0 sinR]   [0 1 0]   [-sinR 0 cosR]
    const a = cosR, b = 0, c = sinR;
    const d = 0,    e = 1, f = 0;
    const g = -sinR, h = 0, i = cosR;

    lines.push(`1 ${colorCode} ${x} ${y} ${z} ${a} ${b} ${c} ${d} ${e} ${f} ${g} ${h} ${i} ${partId}`);
  }

  return lines.join('\r\n');
}
