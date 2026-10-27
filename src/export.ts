import { periodRequest, periodLabel, bucketLabel } from "./recap/periods";
import { prepareRecapRankings, throwIfAborted } from "./recap/exportArtwork";
import { drawRankings } from "./recap/drawRankings";
import type { Recap } from "./types";
import { safeRecap } from "./domain";
import { native, api } from "./api";
export async function checkPrivacy(recap: Recap, language: "en" | "es" = "en") {
  const current = await api.recap(periodRequest(recap.period)); // Flush native journal before checking privacy changes.
  if (
    (recap.privacyRevision ?? 0) !==
    ((await api.settings()).privacyRevision ?? 0)
  ) {
    throw new Error(
      language === "es"
        ? "La privacidad del historial cambió. Abre Tu resumen y genera un resumen nuevo antes de compartir."
        : "History privacy changed. Open Your Recap again and generate a new recap before sharing.",
    );
  }
  return current;
}
import { invoke } from "@tauri-apps/api/core";
export async function saveBlob(blob: Blob, name: string) {
  if (native) {
    return await invoke<boolean>("export_file", {
      name,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export function drawOrbit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#151719";
  ctx.fillRect(x, y, w, h);
  let a = 0.1,
    b = 0,
    c = 0;
  const points: [number, number][] = [];
  for (let i = 0; i < 9500; i++) {
    const dx = 10 * (b - a),
      dy = a * (28 - c) - b,
      dz = a * b - (8 * c) / 3;
    a += dx * 0.006;
    b += dy * 0.006;
    c += dz * 0.006;
    if (i > 500) points.push([a, c]);
  }
  ctx.strokeStyle = "#ff6816";
  ctx.lineWidth = Math.max(0.65, w / 950);
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  points.forEach(([a, c], i) => {
    const px = x + w * 0.5 + (a * w) / 45,
      py = y + h * 0.93 - (c * h) / 55;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  let n = parseInt(seed, 16) || 1;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 40; i++) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const px = x + (n / 4294967296) * w;
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const py = y + (n / 4294967296) * h;
    ctx.fillStyle = i % 5 === 0 ? "#ded4c1" : "#ff6816";
    ctx.fillRect(px, py, w / 230, h / 80);
  }
  ctx.restore();
}

export type CardFormat = "story" | "feed";
export const cardDimensions = (format: CardFormat) => ({
  width: 2160,
  height: format === "story" ? 3840 : 2700,
});

export async function renderRecapCard(
  recap: Recap,
  language: "en" | "es",
  format: CardFormat,
  signal?: AbortSignal,
): Promise<Blob> {
  await Promise.all([
    document.fonts.load('700 60px "Space Grotesk"'),
    document.fonts.load("500 28px Inter"),
  ]);
  const rankings = await prepareRecapRankings(recap, signal);
  throwIfAborted(signal);
  const dimensions = cardDimensions(format);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering unavailable");
  ctx.scale(2, 2);
  const h = dimensions.height / 2,
    story = format === "story",
    pad = 64,
    w = 952;
  const es = language === "es",
    safe = safeRecap(recap);
  const ink = "#17191a",
    muted = "#5d615f",
    paper = "#faf8f4",
    accent = "#ff6816";
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    maxWidth = w,
    color = ink,
    weight = 500,
  ) => {
    ctx.fillStyle = color;
    let font = size;
    ctx.font = `${weight} ${font}px ${weight === 700 ? '"Space Grotesk"' : "Inter"}, sans-serif`;
    while (
      ctx.measureText(value).width > maxWidth &&
      font > Math.max(24, size * 0.7)
    ) {
      font--;
      ctx.font = `${weight} ${font}px ${weight === 700 ? '"Space Grotesk"' : "Inter"}, sans-serif`;
    }
    const chars = Array.from(value);
    if (ctx.measureText(value).width > maxWidth) {
      while (
        chars.length &&
        ctx.measureText(chars.join("") + "…").width > maxWidth
      )
        chars.pop();
      value = chars.join("") + "…";
    }
    ctx.fillText(value, x, y);
  };
  const label = (value: string, y: number) => text(value, pad, y, 25, w, muted);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1080, h);
  const heroHeight = story ? 400 : 280;
  drawOrbit(ctx, 32, 32, 1016, heroHeight, recap.visualSeed);
  text(
    periodLabel(recap.period, language),
    pad,
    198,
    recap.period.kind === "year"
      ? 156
      : recap.period.kind === "month"
        ? 88
        : 48,
    w,
    paper,
    700,
  );
  text(es ? "EN SONIDO" : "IN SOUND", pad + 8, 251, 30, 600, paper);
  text(
    recap.completePeriod
      ? es
        ? "PERÍODO COMPLETO"
        : "COMPLETE PERIOD"
      : es
        ? "ESCUCHA REGISTRADA"
        : "RECORDED LISTENING",
    pad + 8,
    heroHeight - 10,
    22,
    850,
    paper,
  );
  const totalY = story ? 570 : 420;
  text(
    recap.listenedMs > 0 && recap.listenedMs < 60000
      ? "<1"
      : safe.minutesListened.toLocaleString(language),
    pad,
    totalY,
    story ? 132 : 100,
    w,
    ink,
    700,
  );
  label(es ? "MINUTOS ESCUCHADOS" : "MINUTES LISTENED", totalY + 48);
  text(
    `${safe.activeDays.toLocaleString(language)} ${es ? (safe.activeDays === 1 ? "día de escucha" : "días de escucha") : safe.activeDays === 1 ? "listening day" : "listening days"}  ·  ${safe.qualifiedPlays.toLocaleString(language)} ${es ? (safe.qualifiedPlays === 1 ? "reproducción" : "reproducciones") : safe.qualifiedPlays === 1 ? "qualified play" : "qualified plays"}`,
    pad,
    totalY + 97,
    27,
    w,
    muted,
  );
  const chartBottom = story ? 850 : 620;
  const max = Math.max(...recap.buckets.map((b) => b.listenedMs), 1),
    chartHeight = story ? 135 : 80;
  recap.buckets.forEach((bucket, i) => {
    const x = pad + i * (w / recap.buckets.length),
      cell = w / recap.buckets.length;
    ctx.fillStyle = bucket.observed ? accent : "#d5d6d0";
    const height =
      bucket.observed && bucket.listenedMs
        ? Math.max(3, (bucket.listenedMs / max) * chartHeight)
        : 2;
    ctx.fillRect(x + cell * 0.2, chartBottom - height, cell * 0.6, height);
    text(
      bucketLabel(recap, i, language).replace(/\.$/, "").toUpperCase(),
      x,
      chartBottom + 35,
      recap.period.kind === "month" ? 18 : 21,
      cell,
      muted,
    );
  });
  text(
    es ? "Gris: fechas sin cobertura" : "Gray: dates outside recorded history",
    pad,
    chartBottom + 75,
    22,
    w,
    muted,
  );
  drawRankings(ctx, rankings, language, story);
  const date = (value: string) =>
    new Intl.DateTimeFormat(language, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value + "T12:00:00Z"));
  text(
    `${date(safe.coverage.since)} — ${date(safe.coverage.through)}`,
    pad,
    h - 117,
    24,
    w,
    muted,
  );
  text(
    es
      ? "Solo escucha registrada en esta app."
      : "Only listening recorded by this app.",
    pad,
    h - 79,
    23,
    w,
    muted,
  );
  text(
    es ? "local. / TU MÚSICA. TU RESUMEN." : "local. / YOUR MUSIC. YOUR RECAP.",
    pad,
    h - 38,
    22,
    w,
    ink,
  );
  throwIfAborted(signal);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image export failed")),
      "image/png",
    ),
  );
}
