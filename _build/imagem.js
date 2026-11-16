// Lê largura e altura de WebP, PNG e JPEG sem dependências, para o <img> do artigo sair com
// width/height (evita salto de layout).
import { readFileSync } from 'node:fs';

export function dimensoes(arquivo) {
  let b;
  try { b = readFileSync(arquivo); } catch { return null; }
  try {
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const tipo = b.toString('ascii', 12, 16);
      if (tipo === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (tipo === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (tipo === 'VP8L') {
        const v = b.readUInt32LE(21);
        return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
      }
    }
    if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i += 1; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
          return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { return null; }
  return null;
}
