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

Placement rules:
- Two 2x4 bricks side by side: first at x=0, second at x=40 (2 studs × 20 LDU)
- A brick stacked directly on top of another: y decreases by 24 (e.g. first at y=0, second at y=-24)
- A plate stacked on a brick: y decreases by 8 (e.g. brick at y=0, plate at y=-8)
- A 4x2 brick placed next to a 4x2 brick along Z: z=0 and z=40
- Never place bricks at fractional LDU positions. Use multiples of 20 for X/Z, multiples of 8/24 for Y.
- Long-axis orientation: bricks/plates have their longer dimension along X at rotation=0. Use rotation=90 to orient the long axis along Z instead.

Slope quirks (CRITICAL — slopes behave differently from bricks):
- Rotation is INVERTED from expectation: rotation=180 produces a forward-descending slope (high at the rear/body-connection end, low at the nose/front end). rotation=0 does the opposite. Always use rotation=180 for a hood that descends toward the front.
- Origin offset: 2x2 slopes have a -10 LDU origin offset along Z. The stud center of the target cell is NOT where you place the slope — subtract 10 LDU from the stud-center Z. Example: studs 9-10 have their center at z=80, so place the slope at z=70.

Wheel and axle placement (2x2 axle plate = "2x2 axle", part 4600.dat):
- At rotation=0 the axle pins extend along X (left/right). The two pin centers are at x = axle_x ± 22 LDU from the axle plate's center.
- Each wheel sits 5 LDU further out than the ±22 pin center (the pin tip protrudes): wheel_x = axle_x ± (22 + 5) = axle_x ± 27.
- Wheels sit 5 LDU below the axle plate's Y origin: wheel_y = axle_y + 5.
- Use rotation=90 on wheels so they stand upright like a coin (wheel plane faces along X).

Full worked example — car chassis (2x10 base, two axles, body bricks, sloped hood):
[
  {
    "comment": "2x10 gray plate — long axis runs along Z (rotation=90)",
    "description": "gray 2x10 plate",
    "x": 0, "y": -8, "z": 0, "rotation": 90
  },
  {
    "comment": "Axle 1 — stud center at z=-80 (studs 1-2 of the 2x10 plate), pins along X",
    "description": "gray 2x2 axle",
    "x": 0, "y": 0, "z": -80, "rotation": 0
  },
  {
    "comment": "Axle 1 right wheel: x = 0 + 22 (pin) + 5 (tip) = 27, y = 0 + 5 = 5",
    "description": "black wheel",
    "x": 27, "y": 5, "z": -80, "rotation": 90
  },
  {
    "comment": "Axle 1 left wheel: x = 0 - 22 (pin) - 5 (tip) = -27, y = 0 + 5 = 5",
    "description": "black wheel",
    "x": -27, "y": 5, "z": -80, "rotation": 90
  },
  {
    "comment": "Axle 2 — stud center at z=+80 (studs 9-10 of the 2x10 plate), pins along X",
    "description": "gray 2x2 axle",
    "x": 0, "y": 0, "z": 80, "rotation": 0
  },
  {
    "comment": "Axle 2 right wheel: x = 0 + 22 + 5 = 27, y = 0 + 5 = 5",
    "description": "black wheel",
    "x": 27, "y": 5, "z": 80, "rotation": 90
  },
  {
    "comment": "Axle 2 left wheel: x = 0 - 22 - 5 = -27, y = 0 + 5 = 5",
    "description": "black wheel",
    "x": -27, "y": 5, "z": 80, "rotation": 90
  },
  {
    "comment": "Body brick over studs 1-4 — long axis along Z requires rotation=90, stud center z=-60",
    "description": "red 2x4 brick",
    "x": 0, "y": -32, "z": -60, "rotation": 90
  },
  {
    "comment": "Body brick over studs 5-8 — same orientation, stud center z=20",
    "description": "red 2x4 brick",
    "x": 0, "y": -32, "z": 20, "rotation": 90
  },
  {
    "comment": "Hood slope over studs 9-10 — rotation=180 for forward-descending hood. Slope origin offset: stud center=80 minus 10 = z=70",
    "description": "gray 2x2 slope",
    "x": 0, "y": -32, "z": 70, "rotation": 180
  }
]
`.trim();
