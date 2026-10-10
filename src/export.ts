import type { Recap } from "./types";
import { safeRecap, localMidnight } from "./domain";
import { native, api } from "./api";
export async function checkPrivacy(recap: Recap, language: "en" | "es" = "en") {
  const current = await api.recap(recap.year); // Flush native journal before checking privacy changes.
  if (
    (recap.privacyRevision ?? 0) !==
    ((await api.settings()).privacyRevision ?? 0)
  ) {
    throw new Error(
      language === "es"
        ? "La privacidad del historial cambió. Abre Tu año y genera un resumen nuevo antes de compartir."
        : "History privacy changed. Open Your Year again and generate a new recap before sharing.",
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
): Promise<Blob> {
  await Promise.all([
    document.fonts.load('700 60px "Space Grotesk"'),
    document.fonts.load("500 28px Inter"),
  ]);
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
  const heroHeight = story ? 560 : 300;
  drawOrbit(ctx, 32, 32, 1016, heroHeight, recap.visualSeed);
  text(String(recap.year), pad, 198, 156, 600, paper, 700);
  text(es ? "EN SONIDO" : "IN SOUND", pad + 8, 251, 30, 600, paper);
  text(
    recap.completeYear
      ? es
        ? "AÑO COMPLETO"
        : "COMPLETE YEAR"
      : es
        ? "ESCUCHA REGISTRADA"
        : "RECORDED LISTENING",
    pad + 8,
    heroHeight - 10,
    22,
    850,
    paper,
  );
  const totalY = heroHeight + (story ? 205 : 160);
  text(
    recap.listenedMs > 0 && recap.listenedMs < 60000
      ? "<1"
      : safe.minutesListened.toLocaleString(language),
    pad,
    totalY,
    story ? 152 : 130,
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
  const chartBottom = totalY + (story ? 325 : 225);
  const max = Math.max(...recap.months, 1),
    chartHeight = story ? 135 : 95;
  recap.months.forEach((ms, i) => {
    const observed =
      Date.parse(recap.coveredFrom) <
        localMidnight(recap.year, i + 1, 1, recap.timeZone) &&
      Date.parse(recap.coveredThrough) >=
        localMidnight(recap.year, i, 1, recap.timeZone);
    const x = pad + i * (w / 12);
    ctx.fillStyle = observed ? accent : "#d5d6d0";
    const height = observed && ms ? Math.max(3, (ms / max) * chartHeight) : 2;
    ctx.fillRect(x + 13, chartBottom - height, 36, height);
    text(
      new Intl.DateTimeFormat(language, { month: "short", timeZone: "UTC" })
        .format(new Date(Date.UTC(2000, i, 1)))
        .replace(/\.$/, "")
        .toUpperCase(),
      x + 5,
      chartBottom + 35,
      21,
      76,
      muted,
    );
  });
  text(
    es ? "Gris: meses sin cobertura" : "Gray: months outside recorded history",
    pad,
    chartBottom + 75,
    22,
    w,
    muted,
  );
  const highlightsY = chartBottom + 115;
  ctx.strokeStyle = "#caccc5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, highlightsY);
  ctx.lineTo(1016, highlightsY);
  ctx.stroke();
  const gap = story ? 155 : 125;
  const highlight = (
    heading: string,
    value: string,
    detail: string,
    i: number,
  ) => {
    const y = highlightsY + 50 + gap * i;
    label(heading, y);
    text(value, pad, y + 53, story ? 53 : 45, w, ink, 700);
    if (detail) text(detail, pad, y + 87, 23, w, muted);
  };
  const empty = es
    ? "Aún sin reproducciones calificadas"
    : "No qualified plays yet";
  highlight(
    es ? "01 / ARTISTA PRINCIPAL" : "01 / TOP ARTIST",
    recap.topArtist?.name ?? empty,
    recap.topArtist
      ? `${recap.topArtist.plays} ${es ? "reproducciones" : "plays"}`
      : "",
    0,
  );
  highlight(
    es ? "02 / CANCIÓN PRINCIPAL" : "02 / TOP TRACK",
    recap.topTracks[0]?.track.title ?? empty,
    recap.topTracks[0]?.track.artist ?? "",
    1,
  );
  highlight(
    es ? "03 / ÁLBUM PRINCIPAL" : "03 / TOP ALBUM",
    recap.topAlbum?.name ?? (es ? "Sin álbum registrado" : "No album recorded"),
    recap.topAlbum?.artist ?? "",
    2,
  );
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
    es ? "local. / TU MÚSICA. TU AÑO." : "local. / YOUR MUSIC. YOUR YEAR.",
    pad,
    h - 38,
    22,
    w,
    ink,
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image export failed")),
      "image/png",
    ),
  );
}
