/**
 * LDU (LDraw Unit) constants from the official LDraw spec.
 * 1 brick width/depth = 20 LDU
 * 1 brick height     = 24 LDU
 * 1 plate height     =  8 LDU
 * 1 stud diameter    = 12 LDU
 * 1 stud height      =  4 LDU
 */
export const LDU = {
  STUD_WIDTH: 20,
  BRICK_HEIGHT: 24,
  PLATE_HEIGHT: 8,
  STUD_DIAMETER: 12,
  STUD_HEIGHT: 4,
};

/**
 * System prompt preamble with LDU rules for Claude.
 * Both ideas and instructions prompts include this to ensure
 * bricks are placed at correct offsets without floating or clipping.
 */
export const LDU_SYSTEM_PROMPT = `
LDraw coordinate system rules (you MUST follow these exactly):
- 1 stud = 20 LDU wide and deep
- 1 brick height = 24 LDU (Y axis goes downward in LDraw; stacking bricks upward means decreasing Y)
- 1 plate height = 8 LDU
- 1 stud diameter = 12 LDU, 1 stud height = 4 LDU
- Rotation is degrees around the Y axis ONLY. Use ONLY 0, 90, 180, or 270.

Placement examples:
- Two 2x4 bricks side by side: first at x=0, second at x=40 (2 studs × 20 LDU)
- A brick stacked directly on top of another: y decreases by 24 (e.g. first at y=0, second at y=-24)
- A plate stacked on a brick: y decreases by 8 (e.g. brick at y=0, plate at y=-8)
- A 4x2 brick placed next to a 4x2 brick along Z: z=0 and z=40
- Never place bricks at fractional LDU positions. Use multiples of 20 for X/Z, multiples of 8/24 for Y.
`.trim();
