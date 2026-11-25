// Sum up 25 November's world news in one image.
// Pure-TypeScript rasterizer + PNG encoder. Node 22 stdlib only, no network.
// Writes one 1024x1024 image to $MAKEFUN_OUTPUT_DIR/entry.png (default /output).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------- palette ----------
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [20, 33, 61];
const NAVY: RGB = [20, 33, 61];
const RED: RGB = [196, 38, 38];
const CARD: RGB = [255, 255, 255];
const BORDER: RGB = [216, 210, 196];
const SUB: RGB = [74, 85, 104];
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];

// ---------- canvas ----------
const px = new Uint8Array(W * H * 3);
function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPix(i, j, c);
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -dx; x <= dx; x++) setPix(cx + x, cy + y, c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = -ry; y <= ry; y++) {
    const dx = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    for (let x = -dx; x <= dx; x++) setPix(cx + x, cy + y, c);
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) setPix(x + a, y + b, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(Math.round(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) setPix(x, y, c);
    }
  }
}

// ---------- 5x7 bitmap font ----------
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x0a, 0x04, 0x04, 0x04, 0x0a, 0x11],
  Y: [0x11, 0x0a, 0x04, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
};
function charWidth(scale: number): number { return 6 * scale; }
function textWidth(s: string, scale: number): number {
  return s.length * charWidth(scale) - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if ((g[row] >> (4 - col)) & 1) {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += charWidth(scale);
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, scale) <= maxW) { cur = t; continue; }
    if (cur) lines.push(cur);
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- pictograms (drawn in white on the accent zone) ----------
function iconRocket(cx: number, cy: number, c: RGB): void {
  fillPoly([[cx, cy - 42], [cx - 13, cy - 8], [cx + 13, cy - 8]], c);
  fillRect(cx - 13, cy - 8, 26, 34, c);
  fillPoly([[cx - 13, cy - 4], [cx - 30, cy + 22], [cx - 13, cy + 14]], c);
  fillPoly([[cx + 13, cy - 4], [cx + 30, cy + 22], [cx + 13, cy + 14]], c);
  fillCircle(cx, cy + 6, 6, NAVY);
  fillPoly([[cx - 8, cy + 26], [cx + 8, cy + 26], [cx, cy + 44]], [255, 176, 32]);
  setPix(cx - 34, cy - 34, c); setPix(cx + 34, cy - 20, c); setPix(cx - 36, cy + 10, c);
}
function iconScales(cx: number, cy: number, c: RGB): void {
  line(cx, cy - 38, cx, cy + 34, c, 4);
  line(cx - 34, cy - 30, cx + 34, cy - 30, c, 4);
  fillCircle(cx, cy - 38, 5, c);
  line(cx - 34, cy - 30, cx - 44, cy - 2, c, 3);
  line(cx - 34, cy - 30, cx - 24, cy - 2, c, 3);
  fillPoly([[cx - 48, cy - 2], [cx - 20, cy - 2], [cx - 34, cy + 12]], c);
  line(cx + 34, cy - 30, cx + 44, cy - 2, c, 3);
  line(cx + 34, cy - 30, cx + 24, cy - 2, c, 3);
  fillPoly([[cx + 20, cy - 2], [cx + 48, cy - 2], [cx + 34, cy + 12]], c);
  fillRect(cx - 20, cy + 34, 40, 5, c);
}
function iconBurst(cx: number, cy: number, c: RGB): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 42 : 18;
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.round(r * Math.cos(a)), cy + Math.round(r * Math.sin(a))]);
  }
  fillPoly(pts, c);
  fillCircle(cx, cy, 12, NAVY);
}
function iconBoat(cx: number, cy: number, c: RGB): void {
  line(cx, cy - 34, cx, cy + 6, c, 4);
  fillPoly([[cx + 4, cy - 32], [cx + 4, cy + 2], [cx + 32, cy + 2]], c);
  fillPoly([[cx - 34, cy + 6], [cx + 34, cy + 6], [cx + 24, cy + 26], [cx - 24, cy + 26]], c);
  line(cx - 40, cy + 34, cx - 20, cy + 34, c, 3);
  line(cx - 8, cy + 34, cx + 12, cy + 34, c, 3);
  line(cx + 24, cy + 34, cx + 40, cy + 34, c, 3);
}
function iconHeli(cx: number, cy: number, c: RGB): void {
  line(cx - 44, cy - 34, cx + 44, cy - 34, c, 4);
  line(cx, cy - 34, cx, cy - 18, c, 4);
  fillEllipse(cx - 4, cy, 30, 20, c);
  fillPoly([[cx + 22, cy - 6], [cx + 46, cy - 2], [cx + 46, cy + 4], [cx + 22, cy + 6]], c);
  line(cx + 38, cy - 2, cx + 44, cy - 14, c, 3);
  line(cx - 26, cy + 24, cx + 18, cy + 24, c, 3);
  line(cx - 20, cy + 24, cx - 24, cy + 16, c, 3);
  line(cx + 12, cy + 24, cx + 8, cy + 16, c, 3);
  fillCircle(cx - 14, cy - 2, 6, NAVY);
}
function iconGlobe(cx: number, cy: number, c: RGB): void {
  fillCircle(cx, cy, 38, c);
  fillEllipse(cx, cy, 16, 38, NAVY);
  fillRect(cx - 38, cy - 3, 76, 6, NAVY);
  fillEllipse(cx, cy, 38, 14, NAVY);
  fillEllipse(cx, cy, 38, 12, c);
  fillRect(cx - 38, cy - 2, 76, 4, c);
}
function iconMedal(cx: number, cy: number, c: RGB): void {
  fillCircle(cx, cy - 12, 26, c);
  fillCircle(cx, cy - 12, 14, NAVY);
  line(cx - 10, cy + 10, cx - 24, cy + 40, c, 6);
  line(cx + 10, cy + 10, cx + 24, cy + 40, c, 6);
}
function iconFlame(cx: number, cy: number, c: RGB): void {
  fillPoly([[cx, cy - 42], [cx - 22, cy + 4], [cx - 8, cy + 4], [cx - 14, cy + 22], [cx + 14, cy + 22], [cx + 8, cy + 4], [cx + 22, cy + 4]], c);
  fillEllipse(cx, cy + 22, 24, 16, c);
}

// ---------- stories: verified 25 November 2026 ----------
type Story = { kicker: string; title: string; sub: string; accent: RGB; icon: string };
const STORIES: Story[] = [
  { kicker: "SPACE", title: "SHENZHOU-24 LIFTS OFF", sub: "China launches crew to Tiangong; first Pakistani astronaut aboard", accent: [13, 110, 140], icon: "rocket" },
  { kicker: "TECH TRIAL", title: "HUAWEI FOUND GUILTY", sub: "US jury convicts on 10 of 12 counts: trade secrets, bank fraud", accent: [178, 34, 34], icon: "scales" },
  { kicker: "UKRAINE WAR", title: "PUTIN WARNS OF REPRISAL", sub: "Russia vows retaliation as Ukraine strikes oil refineries", accent: [214, 110, 20], icon: "flame" },
  { kicker: "GAZA", title: "ISRAEL STRIKE KILLS HAMAS SECURITY CHIEF", sub: "Naim Abu Nakhla killed in a strike on Gaza City", accent: [90, 60, 140], icon: "burst" },
  { kicker: "MIGRATION", title: "175 MIGRANTS MISSING AT SEA", sub: "Boat from Senegal vanishes en route to Europe", accent: [20, 90, 120], icon: "boat" },
  { kicker: "TURKIYE", title: "HELICOPTER CRASH KILLS FIVE", sub: "Turkish military helicopter down on a training flight", accent: [120, 40, 40], icon: "heli" },
  { kicker: "PACIFIC", title: "AUSTRALIA-SOLOMONS SECURITY PACT", sub: "Canberra becomes defence partner of choice", accent: [30, 120, 70], icon: "globe" },
  { kicker: "AUSTRALIA", title: "APOLOGY TO LGBTQ VETERANS", sub: "Australia apologises for decades of discrimination", accent: [150, 80, 160], icon: "medal" },
];

// ---------- draw ----------
fillRect(0, 0, W, H, PAPER);
// header
fillRect(0, 0, W, 150, NAVY);
fillRect(0, 144, W, 6, RED);
drawTextCentered(W / 2, 26, "25 NOVEMBER 2026", 7, WHITE);
drawTextCentered(W / 2, 96, "WEDNESDAY - THE WORLD IN ONE IMAGE", 3, [200, 210, 225]);

const GX = 24, GY = 166, COLW = 480, ROWH = 187, GAP = 16;
const ICONS: Record<string, (cx: number, cy: number, c: RGB) => void> = {
  rocket: iconRocket, scales: iconScales, burst: iconBurst, boat: iconBoat,
  heli: iconHeli, globe: iconGlobe, medal: iconMedal, flame: iconFlame,
};
for (let i = 0; i < STORIES.length; i++) {
  const s = STORIES[i];
  const col = i % 2, row = Math.floor(i / 2);
  const x = GX + col * (COLW + GAP);
  const y = GY + row * (ROWH + GAP);
  fillRect(x, y, COLW, ROWH, CARD);
  fillRect(x, y, COLW, ROWH, BORDER); // placeholder, redrawn below as border only
  fillRect(x + 2, y + 2, COLW - 4, ROWH - 4, CARD);
  // icon zone
  fillRect(x + 2, y + 2, 108, ROWH - 4, s.accent);
  ICONS[s.icon](x + 56, y + Math.floor(ROWH / 2), WHITE);
  // text zone
  const tx = x + 126;
  const tw = COLW - 126 - 18;
  drawText(tx, y + 18, s.kicker, 2, s.accent);
  const titleLines = wrapText(s.title, tw, 3);
  let ty = y + 46;
  for (const ln of titleLines) { drawText(tx, ty, ln, 3, INK); ty += 24; }
  const subLines = wrapText(s.sub, tw, 2);
  ty += 4;
  for (const ln of subLines) { drawText(tx, ty, ln, 2, SUB); ty += 16; }
}
// footer
drawTextCentered(W / 2, 990, "REPORTED 25 NOVEMBER 2026 - SOURCES: REUTERS, AP, WIRE SERVICES", 2, SUB);

// ---------- PNG encode ----------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, encodePNG());
chmodSync(outPath, 0o644);
