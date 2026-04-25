/**
 * Single configurable path to the LDraw parts library.
 * Must point to the PARENT of parts/ and p/ so LDrawLoader can find both.
 */
export const PARTS_LIBRARY_PATH = '/ldraw/';

/**
 * Curated lookup table: natural-language piece description → LDraw part file ID.
 * Keys are lowercase, color-stripped. Match is done by extracting the size+type
 * portion of a description like "red 2x4 brick" → "2x4 brick".
 */
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

  // Wheels & Tires
  'wheel small': '4624.dat',
  'wheel medium': '6014.dat',
  'wheel large': '2903.dat',
  'tire small': '3641.dat',
  'tire medium': '6015.dat',
  'tire large': '2904.dat',
  'wheel rim small': '4624.dat',
  'wheel axle': '4600.dat',
  'axle': '4600.dat',
  '1x2 axle': '4600.dat',
  '1x4 axle': '4600.dat',
  '1x6 axle': '4600.dat',
  '1x8 axle': '4600.dat',

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
};

/**
 * Resolve a natural-language piece description to its LDraw part ID.
 * Strips color prefix before lookup.
 * Returns null when no match can be found.
 *
 * @param {string} description  e.g. "red 2x4 brick"
 * @returns {string|null}       e.g. "3001.dat"
 */
export function resolvePartId(description) {
  if (!description || description === 'none') return null;

  // Strip parenthetical annotations Claude sometimes appends, e.g. "(rover base)"
  const cleaned = description.replace(/\s*\(.*?\)/g, '').trim();

  // Normalize any wheel/tire to the canonical small wheel key
  if (/wheel|tire|tyre/i.test(cleaned)) return PARTS_MAP['wheel small'];

  const lower = cleaned.toLowerCase().trim();

  if (PARTS_MAP[lower]) return PARTS_MAP[lower];

  // Strip leading color word(s) and retry
  const colorless = lower
    .replace(
      /^(red|blue|yellow|green|white|black|gray|grey|orange|purple|brown|tan|pink|lime|dark\s+\w+|light\s+\w+)\s+/,
      ''
    )
    .trim();

  if (PARTS_MAP[colorless]) return PARTS_MAP[colorless];

  // Partial match — find first key that contains the colorless description
  const partialKey = Object.keys(PARTS_MAP).find(
    (k) => colorless.includes(k) || k.includes(colorless)
  );
  if (partialKey) return PARTS_MAP[partialKey];

  return null;
}

/**
 * Map LDraw color name/description to an LDraw color code integer.
 * Codes from LDConfig.ldr.
 */
export const COLOR_CODES = {
  black: 0,
  blue: 1,
  green: 2,
  'dark turquoise': 3,
  red: 4,
  'dark pink': 5,
  brown: 6,
  'light gray': 7,
  'dark gray': 8,
  'light blue': 9,
  'bright green': 10,
  'light turquoise': 11,
  salmon: 12,
  pink: 13,
  yellow: 14,
  white: 15,
  'light green': 17,
  'light yellow': 18,
  tan: 19,
  'light violet': 20,
  purple: 22,
  'dark blue violet': 23,
  orange: 25,
  magenta: 26,
  lime: 27,
  'dark tan': 28,
  'bright pink': 29,
  'medium lavender': 30,
  lavender: 31,
  gray: 71,
};

/**
 * Extract the color code from a description like "red 2x4 brick".
 * Returns 4 (red) as a default fallback.
 */
export function resolveColorCode(description) {
  if (!description) return 4;
  const lower = description.toLowerCase();
  for (const [colorName, code] of Object.entries(COLOR_CODES)) {
    if (lower.startsWith(colorName) || lower.includes(` ${colorName} `)) {
      return code;
    }
  }
  return 4;
}
