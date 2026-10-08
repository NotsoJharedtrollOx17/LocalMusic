import type { Recap } from "./types";
import { safeRecap } from "./domain";
import { native, api } from "./api";
async function checkPrivacy(recap: Recap) {
  await api.recap(recap.year); // Flush native journal before checking privacy changes.
  if (
    (recap.privacyRevision ?? 0) !==
    ((await api.settings()).privacyRevision ?? 0)
  ) {
    throw new Error(
      "History privacy changed. Open Your Year again and generate a new recap before sharing.",
    );
  }
}
import { invoke } from "@tauri-apps/api/core";
export async function saveBlob(blob: Blob, name: string) {
  if (native) {
    await invoke("export_file", {
      name,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
export async function exportCard(recap: Recap, language: "en" | "es") {
  await checkPrivacy(recap);
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#faf8f4";
  ctx.fillRect(0, 0, 1080, 1920);
  drawOrbit(ctx, 48, 48, 984, 650, recap.visualSeed);
  ctx.fillStyle = "#faf8f4";
  ctx.font = '700 180px "Space Grotesk", sans-serif';
  ctx.fillText(String(recap.year), 88, 245);
  ctx.font = "500 29px Inter, sans-serif";
  ctx.fillText(language === "es" ? "EN SONIDO" : "IN SOUND", 98, 300);
  ctx.fillStyle = "#171717";
  ctx.font = '700 170px "Space Grotesk", sans-serif';
  ctx.fillText(
    Math.round(recap.listenedMs / 60000).toLocaleString(language),
    48,
    930,
  );
  ctx.font = "600 27px Inter, sans-serif";
  ctx.fillText(
    language === "es" ? "MINUTOS ESCUCHADOS" : "MINUTES LISTENED",
    56,
    984,
  );
  ctx.fillStyle = "#6a6a65";
  ctx.font = "24px Inter, sans-serif";
  const safe = safeRecap(recap);
  ctx.fillText(
    (language === "es" ? "Desde " : "Since ") +
      safe.coverage.since +
      " · " +
      safe.coverage.through,
    56,
    1036,
  );
  const max = Math.max(...recap.months, 1);
  recap.months.forEach((ms, i) => {
    ctx.fillStyle = "#ff6816";
    ctx.fillRect(
      60 + i * 80,
      1260 - (ms / max) * 140,
      30,
      Math.max(1, (ms / max) * 140),
    );
    ctx.fillStyle = "#6a6a65";
    ctx.font = "19px Inter,sans-serif";
    ctx.fillText(
      new Intl.DateTimeFormat(language, { month: "short", timeZone: "UTC" })
        .format(new Date(Date.UTC(2000, i, 1)))
        .toUpperCase(),
      50 + i * 80,
      1297,
    );
  });
  ctx.strokeStyle = "#cbc9c2";
  ctx.beginPath();
  ctx.moveTo(48, 1360);
  ctx.lineTo(1032, 1360);
  ctx.stroke();
  ctx.font = "24px Inter,sans-serif";
  ctx.fillStyle = "#6a6a65";
  ctx.fillText(
    language === "es" ? "ARTISTA PRINCIPAL" : "TOP ARTIST",
    56,
    1432,
  );
  ctx.fillText(language === "es" ? "CANCIÓN PRINCIPAL" : "TOP TRACK", 56, 1598);
  ctx.fillStyle = "#171717";
  ctx.font = '700 59px "Space Grotesk",sans-serif';
  const fit = (text: string, y: number) => {
    let size = 59;
    while (ctx.measureText(text).width > 960 && size > 25) {
      size--;
      ctx.font = "700 " + size + 'px "Space Grotesk",sans-serif';
    }
    const letters = Array.from(text);
    while (ctx.measureText(letters.join("")).width > 960 && letters.length) {
      letters.pop();
    }
    if (letters.length < Array.from(text).length) {
      while (
        ctx.measureText(letters.join("") + "…").width > 960 &&
        letters.length
      )
        letters.pop();
      text = letters.join("") + "…";
    }
    ctx.fillText(text, 56, y);
    ctx.font = '700 59px "Space Grotesk",sans-serif';
  };
  fit(
    recap.topArtist?.name ||
      (language === "es" ? "Aún sin datos" : "Still taking shape"),
    1510,
  );
  fit(
    recap.topTracks[0]?.track.title ||
      (language === "es" ? "Aún sin datos" : "Still taking shape"),
    1676,
  );
  ctx.fillStyle = "#6a6a65";
  ctx.font = "22px Inter,sans-serif";
  ctx.fillText(
    language === "es" ? "TU MÚSICA. TU AÑO." : "YOUR MUSIC. YOUR YEAR.",
    56,
    1830,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Card export failed"))),
      "image/png",
    ),
  );
  await saveBlob(blob, "your-year-" + recap.year + ".png");
}
export async function exportJson(recap: Recap) {
  await checkPrivacy(recap);
  await saveBlob(
    new Blob([JSON.stringify(safeRecap(recap), null, 2)], {
      type: "application/json",
    }),
    "your-year-" + recap.year + ".json",
  );
}
