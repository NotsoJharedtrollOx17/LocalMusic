/** Round before choosing a sign, so zero never appears as +0.0 or -0.0. */
export function formatGain(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded === 0 ? "0.0" : rounded.toFixed(1)} dB`;
}
