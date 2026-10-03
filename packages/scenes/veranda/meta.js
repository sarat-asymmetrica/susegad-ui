// Veranda: what the scene is called, what it shows, and how to ask for it.

export const meta = {
  id: 'veranda',
  title: 'The veranda',
  word: 'Veranda',
  gloss: 'A working title. Goan houses say balcão for the built-in seats at the front, which this veranda has.',
  caption:
    'A Goan veranda seen from a seat on it, looking along the pillars toward the garden. Four laterite pillars stand on the right with a balcão seat between them, a teak door and a shuttered window sit in the lime-washed wall on the left, and a brass lamp hangs from the rafters under the roof. Past the hedge are a mango tree and the paddy. The late sun slips under the eave and the pillars lay their shadows across the floor. The depth of every pixel is exact, because the drawing and its depth map are made from the same solids.',
  alt: 'A drawing of a Goan veranda: laterite pillars and a built-in seat on the right, a teak door and a shuttered window on the left, a brass lamp hanging from the roof, and a garden and paddy beyond',
  keys: 'Move your hand, or the arrow keys, left and right to move the sun across the garden. Enter or Space puts it back.',
  W: 1200,
  H: 800,
  seed: 1,
  stillTime: 0,
  tier: 'local',
  credit: 'Laterite pillars, balcão seats, Mangalore tiles and teak doors are everyday Goa; nothing here is any one house.',
  techniques: ['model', 'fields', 'texture', 'wobble', 'hatch', 'physics', 'interaction', 'colour', 'fallback'],
  prompt:
    'Draw a Goan veranda seen from a seat on it, looking along its length toward the garden, in ink and wash on paper, on a canvas with no image files. Do not draw it flat: describe it as a short list of solids in metres (a floor, a lime-washed wall with a teak door and a shuttered window, four square laterite pillars with a balcão seat between them, the underside of a sloping roof with rafters, a beam, a hanging brass lamp, then a hedge, a mango tree and the paddy) and look at them through one perspective camera with the eye on the horizon. Write one ray caster that finds the nearest solid for any point of the picture, and build everything from it. Trace a grid of rays once, a slice at a time, into a buffer of distance, solid and normal. Make the depth map from that buffer, one byte a pixel, white near, linear in inverse distance between one and ten units, sky zero, so it is exact and needs no depth model, and write a second map with the sky in green and the lamp in blue. Paint the wash from the same buffer: each solid’s pigment lit by the sky and by a low sun, shifted a pixel or two by slow noise so the colour drifts from the line, and laid over paper with multiply. Cast the shadows by tracing from each surface toward the sun on a small grid that you blur, so the pillars lay their shadows across the floor and up the wall. Ink the solids’ edges as hand lines that run a little past each corner, keeping only the parts the buffer says are visible, add the laterite courses, the floor joints, the rafters and the louvres as lighter lines, and hatch where the light is away. Hang the lamp on its chain apart from the rest so it can swing. In warm, the lamp sways and a little dust drifts in the light. In playful, the pointer moves the sun across the garden and the shadows sweep the floor. In a dark theme, make it dusk with the lamp lit. Quiet is a hairline drawing of the same edges with nothing moving.',
  map: [
    ['a short list of solids in metres', 'model', 'SOLIDS in world.js: boxes, planes, cylinders and ellipsoids in metres, scaled to scene units at 0.4 a metre and seen from an eye 1.15 m above the floor by the camera <sg-depth-photo> rests on (fov 50 degrees, 3:2). It runs in Node and is tested there.'],
    ['one ray caster that finds the nearest solid', 'model', 'trace(u, v) returns the forward distance, the solid and its normal; each solid’s box on the picture keeps a ray to the few solids it could hit. gbuffer() traces 600 x 400 rays, sliced across frames.'],
    ['one byte a pixel, white near, linear in inverse distance between one and ten units', 'fields', 'depthMap() encodes the buffer through zToDepth(), the encoding <sg-depth-photo> reads (Z_NEAR and Z_FAR from stage3d.core.js); layersMap() writes the second map. A test reads known points and a blurred map has to fail it.'],
    ['shifted a pixel or two by slow noise', 'wobble', 'paintWash() warps the small wash image by slow noise (three pixels at 600 x 400) so the colour drifts from the line, and pools it ten percent darker where two solids meet.'],
    ['laid over paper with multiply', 'texture', 'compose() draws paper(), then the wash with multiply, then the shadows with multiply, then the ink, so the paper’s tooth shows through the pigment.'],
    ['Cast the shadows by tracing from each surface toward the sun', 'physics', 'shadows() marches the same solids toward the sun from every pixel of a 300 x 200 grid and blurs the mask; playful’s hand changes the sun and only then is it traced again.'],
    ['hand lines that run a little past each corner', 'wobble', 'Each visible run of a box edge goes through ink() with 3.5 px of overshoot at both ends and a fainter second pass at half the width.'],
    ['hatch where the light is away', 'hatch', 'Sixty thousand random picture points, a stroke kept where the pixel is dark: upright on walls, slanting on the floor, one Path2D per opacity.'],
    ['Hang the lamp on its chain apart from the rest', 'physics', 'lampSwing() is two slow beats, drawLamp() rotates the chain and lantern about the roof, and withoutLamp() takes the lamp out of the buffer the still is painted from, so nothing stays behind it.'],
    ['the pointer moves the sun across the garden', 'interaction', 'In playful the hand’s place across the drawing becomes the sun’s azimuth through sunAt(); Enter or Space puts it back.'],
    ['make it dusk with the lamp lit', 'colour', 'The dark theme sets mood to dusk: the sky is indigo to apricot, the sun is off, and washAt() adds a point light at the lamp.'],
    ['Quiet is a hairline drawing of the same edges', 'fallback', 'In quiet and under reduced motion the painter runs in hair mode: paper and the visible edges only, and the model returns no swing and no dust.'],
  ],
};
