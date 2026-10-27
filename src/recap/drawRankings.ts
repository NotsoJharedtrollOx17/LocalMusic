import { en, es } from "../i18n";
import type { ExportRankingGroup } from "./exportArtwork";

export function drawRankings(
  ctx: CanvasRenderingContext2D,
  groups: ExportRankingGroup[],
  language: "en" | "es",
  story: boolean,
) {
  const t = language === "es" ? es : en;
  const ink = "#17191a",
    muted = "#5d615f",
    accent = "#c84b08";
  const line = (
    value: string,
    x: number,
    y: number,
    size: number,
    width: number,
    weight = 500,
    color = ink,
    maxLines = 1,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${weight === 700 ? '"Space Grotesk"' : "Inter"}, sans-serif`;
    const words = value.trim().split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? current + " " + word : word;
      if (ctx.measureText(next).width <= width || !current) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    const visible = lines.slice(0, maxLines);
    visible.forEach((value, i) => {
      const chars = Array.from(value);
      const truncated = lines.length > maxLines && i === maxLines - 1;
      while (
        chars.length &&
        ctx.measureText(chars.join("") + (truncated ? "\u2026" : "")).width >
          width
      )
        chars.pop();
      const clipped = chars.length < Array.from(value).length;
      if (clipped && !truncated) {
        while (
          chars.length &&
          ctx.measureText(chars.join("") + "\u2026").width > width
        )
          chars.pop();
      }
      ctx.fillText(
        chars.join("") + (truncated || clipped ? "\u2026" : ""),
        x,
        y + i * size * 1.2,
      );
    });
    return Math.max(0, visible.length - 1) * size * 1.2;
  };
  const cover = (
    image: HTMLImageElement,
    x: number,
    y: number,
    size: number,
  ) => {
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 6);
    ctx.clip();
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      x,
      y,
      size,
      size,
    );
    ctx.restore();
  };
  groups.forEach((group, category) => {
    const x = 64 + category * 325;
    const dividerY = story ? 1120 : 725;
    const y = dividerY + 46;
    const width = 302;
    ctx.strokeStyle = "#caccc5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, dividerY);
    ctx.lineTo(x + width, dividerY);
    ctx.stroke();
    line(t[group.titleKey], x, y, 24, width, 700);
    if (!group.items.length) {
      line(t.noPlays, x, y + 50, 22, width, 500, muted, 2);
      return;
    }
    let itemY = y + 26;
    group.items.forEach((item, rank) => {
      const itemX = x;
      const size = [80, 64, 52][rank];
      const titleSize = [27, 24, 22][rank];
      let textX = itemX,
        textY = itemY + titleSize;
      let available = 302;
      if (item.image) {
        cover(item.image, itemX, itemY, size);
        textX += size + 12;
        available -= size + 12;
      }
      const titleHeight = line(
        `${rank + 1}. ${item.name}`,
        textX,
        textY,
        titleSize,
        available,
        rank ? 500 : 700,
        ink,
        2,
      );
      let detailY = textY + titleHeight + 23;
      if (item.detail) {
        const detailSize = 18;
        detailY +=
          line(
            item.detail,
            textX,
            detailY,
            detailSize,
            available,
            500,
            muted,
            2,
          ) + 23;
      }
      line(
        `${item.plays.toLocaleString(language)} ${t.plays}`,
        textX,
        detailY,
        18,
        available,
        500,
        accent,
      );
      const textBottom = detailY + 4;
      const artworkBottom = itemY + (item.image ? size : 0);
      itemY = Math.max(textBottom, artworkBottom) + 18;
    });
  });
}
