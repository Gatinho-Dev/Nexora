// Gera ícones PNG do Nexora a partir da marca vetorial (retângulo arredondado
// + glifo "N"), sem dependências externas. Rodado manualmente via node.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── PNG writer mínimo (RGBA, sem filtros) ──────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixels /* Uint8Array RGBA */) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    Buffer.from(
      pixels.buffer,
      y * size * 4,
      size * 4
    ).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Desenho da marca (viewBox 256×256) ─────────────────────────
const BG = [17, 19, 26]; // #11131A
const FG = [115, 131, 255]; // #7383FF
const R = 64; // raio do retângulo
const GLYPH_BOX = { x0: 34, x1: 222, y0: 44, y1: 212 }; // hastes
const STEM_W = 52;
const A = { x: 60, y: 46 };
const B = { x: 196, y: 210 };
const DIAG_HALF = 25;

function insideRoundedRect(px, py, size) {
  const s = size / 256;
  const x = px / s;
  const y = py / s;
  if (x < 0 || y < 0 || x > 256 || y > 256) return false;
  const cx = Math.max(R, Math.min(256 - R, x));
  const cy = Math.max(R, Math.min(256 - R, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
}
function insideGlyph(px, py, size) {
  const s = size / 256;
  const x = px / s;
  const y = py / s;
  // Hastes esquerda/direita (cantos levemente arredondados p/ suavizar)
  const r = 14;
  const stem = (x0, x1) => {
    const nx = Math.max(x0 + r, Math.min(x1 - r, x));
    const ny = Math.max(GLYPH_BOX.y0 + r, Math.min(GLYPH_BOX.y1 - r, y));
    return (x - nx) ** 2 + (y - ny) ** 2 <= r * r ||
      (x >= x0 && x <= x1 && y >= GLYPH_BOX.y0 && y <= GLYPH_BOX.y1);
  };
  if (stem(GLYPH_BOX.x0, GLYPH_BOX.x0 + STEM_W)) return true;
  if (stem(GLYPH_BOX.x1 - STEM_W, GLYPH_BOX.x1)) return true;
  // Diagonal (banda entre A e B)
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const len2 = abx * abx + aby * aby;
  const t = Math.max(0, Math.min(1, ((x - A.x) * abx + (y - A.y) * aby) / len2));
  const dx = x - (A.x + t * abx);
  const dy = y - (A.y + t * aby);
  return dx * dx + dy * dy <= DIAG_HALF * DIAG_HALF;
}

function renderIcon(size) {
  const px = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let x = 0; x < size; x++) {
      const i = (py * size + x) * 4;
      if (!insideRoundedRect(x + 0.5, py + 0.5, size)) continue; // transparente
      const c = insideGlyph(x + 0.5, py + 0.5, size) ? FG : BG;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  return png(size, px);
}

mkdirSync(join(root, "public", "icons"), { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(root, "public", "icons", `icon-${size}.png`), renderIcon(size));
  console.log(`icon-${size}.png OK`);
}
