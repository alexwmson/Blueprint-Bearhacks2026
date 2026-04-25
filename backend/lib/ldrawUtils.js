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

SLOPE ORIENTATION (critical — always get this right):
- rotation=0:   slope descends toward +Z (high/solid back wall faces -Z, low edge faces +Z)
- rotation=180: slope descends toward -Z (high/solid back wall faces +Z, low edge faces -Z)
- rotation=90:  slope descends toward +X
- rotation=270: slope descends toward -X
- To make a peaked roof (^ shape) along the Z axis:
    front piece: z=0,  rotation=180  (rises going toward -Z)
    back piece:  z=20, rotation=0    (rises going toward +Z)
    both pieces at the same x and y — their high walls meet at the ridge
- To make a peaked roof along the X axis: use rotation=270 and rotation=90 at adjacent x positions

WHEEL AND AXLE PLACEMENT (critical — always get this right):
- The axle plate (2x2 plate with axle) has two wheel pins that stick out 22 LDU from its center.
- Pin direction depends on the axle plate's rotation:
    rotation=0 or 180: pins stick out along X → wheels at x = axle_x ± 22
    rotation=90 or 270: pins stick out along Z → wheels at x = axle_x, z = axle_z ± 22
- The pins sit 5 LDU below the axle plate's Y origin, so: wheel_y = axle_plate_y + 5
- Always place EXACTLY ONE wheel piece per pin (the renderer adds the tire automatically).
- Never place a wheel at the same position as the axle plate center.
- Example — axle plate at x=0, y=0, z=0, rotation=0:
    right wheel: x=22,  y=5, z=0
    left wheel:  x=-22, y=5, z=0
- Example — axle plate at x=0, y=-24, z=0, rotation=90:
    right wheel: x=0, y=-19, z=-22
    left wheel:  x=0, y=-19, z=22
`.trim();
