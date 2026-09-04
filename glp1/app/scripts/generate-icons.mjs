// Génère les icônes PNG de la PWA sans dépendance externe.
// Motif : la courbe de poids qui descend, en blanc sur le cobalt de la charte.
// Relancer avec :  node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(OUT, { recursive: true });

const COBALT = [0x27, 0x43, 0xc4];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filtre "none"
    for (let x = 0; x < size; x++) {
      const p = rgb(x, y);
      raw[row + 1 + x * 3] = p[0];
      raw[row + 2 + x * 3] = p[1];
      raw[row + 3 + x * 3] = p[2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// distance d'un point à un segment
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// La courbe : une descente qui s'aplatit, comme une vraie perte de poids.
function curvePoints(size, inset) {
  const x0 = size * inset, x1 = size * (1 - inset);
  const y0 = size * (0.5 - (0.5 - inset) * 0.72), y1 = size * (0.5 + (0.5 - inset) * 0.72);
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const s = t * t * (3 - 2 * t); // smoothstep : la descente s'installe puis s'aplatit
    pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * s]);
  }
  return pts;
}

function draw(size, inset) {
  const pts = curvePoints(size, inset);
  const half = size * 0.055;
  return (x, y) => {
    let d = Infinity;
    for (let i = 1; i < pts.length; i++) {
      d = Math.min(d, distSeg(x + 0.5, y + 0.5, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
      if (d <= half - 1) break;
    }
    const a = Math.max(0, Math.min(1, half + 0.5 - d));
    if (a <= 0) return COBALT;
    return [
      Math.round(COBALT[0] + (WHITE[0] - COBALT[0]) * a),
      Math.round(COBALT[1] + (WHITE[1] - COBALT[1]) * a),
      Math.round(COBALT[2] + (WHITE[2] - COBALT[2]) * a),
    ];
  };
}

const files = [
  ["icon-192.png", 192, 0.2],
  ["icon-512.png", 512, 0.2],
  // maskable : plus de marge, la zone sûre est un cercle de 80 %
  ["icon-maskable-512.png", 512, 0.29],
  ["apple-touch-icon.png", 180, 0.2],
];

for (const [name, size, inset] of files) {
  writeFileSync(join(OUT, name), png(size, draw(size, inset)));
  console.log("écrit", name, size + "px");
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#2743C4"/>
  <path d="M13 13 C 30 13, 44 28, 51 51" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
</svg>
`;
writeFileSync(join(OUT, "favicon.svg"), svg);
console.log("écrit favicon.svg");
