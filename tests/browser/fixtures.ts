export function wav(seconds = 40) {
  const rate = 16000,
    n = rate * seconds,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.sin((i / rate) * 220 * Math.PI * 2) * 2000, 44 + i * 2);
  return b;
}

export function taggedWav(title: string, marker: number, seconds = 1) {
  const base = wav(seconds);
  base.writeInt16LE(marker, 44);
  const chunk = (kind: string, value: string) => {
    const bytes = Buffer.from(value + "\0");
    const part = Buffer.alloc(8 + bytes.length + (bytes.length % 2));
    part.write(kind, 0);
    part.writeUInt32LE(bytes.length, 4);
    bytes.copy(part, 8);
    return part;
  };
  const info = Buffer.concat([
    Buffer.from("INFO"),
    chunk("IART", "Fixture Artist"),
    chunk("IPRD", "Fixture Album"),
    chunk("INAM", title),
  ]);
  const header = Buffer.alloc(8);
  header.write("LIST", 0);
  header.writeUInt32LE(info.length, 4);
  const result = Buffer.concat([base, header, info]);
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}

export function numberedWav(
  title: string,
  trackNumber: number,
  discNumber: number,
  marker: number,
) {
  const base = taggedWav(title, marker, 40);
  const frames = Buffer.concat(
    [
      ["TIT2", title],
      ["TPE1", "Fixture Artist"],
      ["TALB", "Fixture Album"],
      ["TRCK", String(trackNumber) + "/12"],
      ["TPOS", String(discNumber) + "/2"],
      ["TYER", "2001"],
    ].map(([name, value]) => {
      const body = Buffer.concat([Buffer.from([0]), Buffer.from(value)]);
      const header = Buffer.alloc(10);
      header.write(name);
      header.writeUInt32BE(body.length, 4);
      return Buffer.concat([header, body]);
    }),
  );
  const id3 = Buffer.alloc(10);
  id3.write("ID3");
  id3[3] = 3;
  for (let i = 0; i < 4; i++)
    id3[6 + i] = (frames.length >>> (7 * (3 - i))) & 127;
  const content = Buffer.concat([id3, frames]);
  const chunk = Buffer.alloc(8);
  chunk.write("id3 ");
  chunk.writeUInt32LE(content.length, 4);
  const result = Buffer.concat([
    base,
    chunk,
    content,
    Buffer.alloc(content.length % 2),
  ]);
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}
