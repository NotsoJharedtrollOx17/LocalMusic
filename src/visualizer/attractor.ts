/** Origin of Symmetry (Abraham Jhared Flores Azcona, 2022), MIT.
 * Preserve its Euler trajectory and rectangle projection; no p5 runtime needed.
 * See docs/visualizer-refinements.md for attribution and adaptation boundaries.
 */
export function originTrajectory() {
  const points = new Float32Array(8000 * 3);
  let x = 0.11,
    y = 1,
    z = 1;
  for (let i = 0; i < 8000; i++) {
    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = z;
    const dx = 10 * (y - x),
      dy = x * (28 - z) - y,
      dz = x * y - (8 / 3) * z;
    x += dx / 60;
    y += dy / 60;
    z += dz / 60;
  }
  return points;
}

/** Smooth deterministic spatial variation; an inexpensive substitute for p5 noise. */
export function spatialNoise(value: number) {
  return (
    0.5 + 0.25 * Math.sin(value * 0.37 + 2.022) + 0.25 * Math.sin(value * 0.13)
  );
}
