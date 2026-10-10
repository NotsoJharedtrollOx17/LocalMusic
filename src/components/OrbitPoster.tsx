import { useEffect, useRef } from "react";
import { drawOrbit } from "../export";

export function OrbitPoster({
  year,
  seed,
  label,
}: {
  year: number;
  seed: string;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext("2d")!;
    c.width = 1000;
    c.height = 480;
    drawOrbit(ctx, 0, 0, 1000, 480, seed);
  }, [seed]);
  return (
    <div className="orbit-poster">
      <canvas ref={ref} aria-hidden="true" />
      <div>
        <strong>{year}</strong>
        <span>{label}</span>
      </div>
      <small>LOCAL MUSIC / YOUR YEAR</small>
    </div>
  );
}
