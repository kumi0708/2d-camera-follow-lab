// Procedural pixel-art world. 1 canvas pixel = 1 world pixel.
export const ROOM = 128;
export const COLS = 6;
export const ROWS = 4;
export const W = ROOM * COLS;
export const H = ROOM * ROWS;

// M meadow, F flowers, T forest, S snow, L lake, R ruins, D desert
const BIOMES = ['MFFTSS', 'MLMRSS', 'DLMRRT', 'DDMMTT'];

export const POIS = [
  { x: 320, y: 62, kind: 'crystal', hue: 'cyan', name: '蒼の結晶' },
  { x: 452, y: 196, kind: 'chest', name: '遺跡の宝箱' },
  { x: 78, y: 330, kind: 'campfire', name: '焚き火' },
  { x: 676, y: 404, kind: 'portal', name: '転移門' },
  { x: 704, y: 92, kind: 'crystal', hue: 'pink', name: '雪の結晶' },
  { x: 336, y: 300, kind: 'statue', name: '古い石像' },
];

// ---------- noise ----------
export function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s) {
  return vnoise(x / 32, y / 32, s) * 0.55 + vnoise(x / 12, y / 12, s + 1) * 0.3 + vnoise(x / 5, y / 5, s + 2) * 0.15;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function biomeAt(x, y) {
  const wx = x + (fbm(x, y, 7) - 0.5) * 18;
  const wy = y + (fbm(x, y, 9) - 0.5) * 18;
  const c = clamp(Math.floor(wx / ROOM), 0, COLS - 1);
  const r = clamp(Math.floor(wy / ROOM), 0, ROWS - 1);
  return BIOMES[r][c];
}

const lakeD = (x, y) =>
  Math.hypot((x - 192) / 46, (y - 256) / 100) + (fbm(x, y, 3) - 0.5) * 0.35;
const iceD = (x, y) => Math.hypot((x - 690) / 34, (y - 196) / 22) + (fbm(x, y, 13) - 0.5) * 0.3;

const PAL = {
  M: ['#3f7d3a', '#4f9444', '#62a84f'].map(hex),
  F: ['#4a8a3f', '#5a9e48', '#6db354'].map(hex),
  L: ['#437f3b', '#539646', '#66aa52'].map(hex),
  T: ['#2a5a30', '#336836', '#3f773f'].map(hex),
  S: ['#c3d1df', '#d8e3ee', '#eef4fa'].map(hex),
  D: ['#c69f5b', '#d5b06a', '#e2c27c'].map(hex),
  R: ['#66656e', '#77767f', '#888790'].map(hex),
};
const C = Object.fromEntries(
  Object.entries({
    deep: '#1d4b86', mid: '#2a69ae', shallow: '#3c8dd4', foam: '#a5daf4', wave: '#5aa8e6',
    sand: '#d8c38c', sand2: '#c8b27c', mortar: '#4a4951',
    dirt0: '#93703f', dirt1: '#a6814f', dirt2: '#b69160', dirtEdge: '#6f6a36',
    snowPath0: '#a9b7c7', snowPath1: '#b9c6d4', snowEdge: '#c9d4e0',
    plank0: '#8f5f34', plank1: '#9c6a3b', plankSeam: '#5c3a1d', rail: '#4a2d16',
    ice0: '#b5dbef', ice1: '#cbe8f7', iceCrack: '#86bfdc', iceEdge: '#ecf8ff',
  }).map(([k, v]) => [k, hex(v)])
);

// ---------- pixel helpers (also used by sprites.js) ----------
export function disc(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}
export function shadow(g, cx, cy, w, h, a = 0.3) {
  g.fillStyle = `rgba(12,18,24,${a})`;
  for (let dy = 0; dy < h; dy++) {
    const t = (dy + 0.5) / h * 2 - 1;
    const hw = Math.round((w / 2) * Math.sqrt(1 - t * t));
    g.fillRect(Math.round(cx - hw), Math.round(cy - h / 2 + dy), hw * 2, 1);
  }
}

// ---------- decor ----------
function tree(g, x, y, r) {
  shadow(g, x + 2, y, 18, 5, 0.35);
  g.fillStyle = '#4a2f1b'; g.fillRect(x - 1, y - 7, 3, 7);
  g.fillStyle = '#6b4428'; g.fillRect(x - 1, y - 7, 1, 7);
  disc(g, x, y - 13, 8, '#1b4022');
  disc(g, x - 1, y - 14, 7, '#28592d');
  disc(g, x - 2, y - 16, 5, '#367339');
  disc(g, x - 3, y - 17, 2, '#4f9447');
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2, d = r() * 6;
    g.fillStyle = r() < 0.5 ? '#163a1e' : '#5da653';
    g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y - 14 + Math.sin(a) * d), 1, 1);
  }
}
function pine(g, x, y, snowy) {
  shadow(g, x + 2, y, 14, 4, 0.3);
  g.fillStyle = '#4a2f1b'; g.fillRect(x - 1, y - 4, 2, 4);
  for (let tier = 0; tier < 4; tier++) {
    const top = y - 8 - tier * 5;
    for (let row = 0; row < 6; row++) {
      const hw = Math.min(6 - tier, 1 + row);
      g.fillStyle = '#1e4a3b'; g.fillRect(x - hw, top + row, hw * 2, 1);
      g.fillStyle = '#2d6550'; g.fillRect(x - hw, top + row, Math.max(1, hw - 1), 1);
      if (snowy && row <= 1) { g.fillStyle = '#eef5fb'; g.fillRect(x - hw, top + row, hw * 2, 1); }
    }
  }
  if (snowy) { g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 29, 2, 1); }
}
function bush(g, x, y, r) {
  shadow(g, x + 1, y, 11, 3, 0.3);
  disc(g, x, y - 4, 4, '#2c6431');
  disc(g, x - 1, y - 5, 3, '#3c843f');
  disc(g, x - 2, y - 6, 1, '#5aa651');
  for (let i = 0; i < 3; i++) { g.fillStyle = '#d6424a'; g.fillRect(x - 2 + Math.floor(r() * 5), y - 6 + Math.floor(r() * 4), 1, 1); }
}
function rock(g, x, y, snow) {
  shadow(g, x + 1, y, 9, 3, 0.3);
  g.fillStyle = '#4f5159'; g.fillRect(x - 3, y - 3, 7, 3);
  g.fillStyle = '#70737c'; g.fillRect(x - 3, y - 4, 6, 3);
  g.fillStyle = '#9a9da6'; g.fillRect(x - 2, y - 4, 3, 1);
  if (snow) { g.fillStyle = '#f2f7fc'; g.fillRect(x - 3, y - 5, 6, 2); }
}
function flower(g, x, y, col) {
  g.fillStyle = '#2f6b2a'; g.fillRect(x, y - 1, 1, 2);
  g.fillStyle = col;
  g.fillRect(x - 1, y - 2, 1, 1); g.fillRect(x + 1, y - 2, 1, 1); g.fillRect(x, y - 3, 1, 1); g.fillRect(x, y - 1, 1, 1);
  g.fillStyle = '#ffe066'; g.fillRect(x, y - 2, 1, 1);
}
function tuft(g, x, y, dark, light) {
  g.fillStyle = dark; g.fillRect(x, y - 2, 1, 2); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1);
  g.fillStyle = light; g.fillRect(x, y - 3, 1, 1);
}
function mushroom(g, x, y) {
  g.fillStyle = '#efe6d4'; g.fillRect(x, y - 2, 1, 2);
  g.fillStyle = '#c4343b'; g.fillRect(x - 1, y - 4, 3, 2);
  g.fillStyle = '#ffffff'; g.fillRect(x, y - 4, 1, 1);
}
function pillar(g, x, y, h, r) {
  shadow(g, x + 2, y, 12, 4, 0.35);
  g.fillStyle = '#62616a'; g.fillRect(x - 3, y - h, 6, h);
  g.fillStyle = '#8f8e98'; g.fillRect(x - 3, y - h, 4, h);
  g.fillStyle = '#b3b2bb'; g.fillRect(x - 3, y - h, 1, h);
  g.fillStyle = '#7a7983'; g.fillRect(x - 4, y - 2, 8, 2);
  for (let i = 0; i < 4; i++) { g.fillStyle = '#4b4a52'; g.fillRect(x - 3 + Math.floor(r() * 6), y - h, 1, 1 + Math.floor(r() * 2)); }
  for (let i = 0; i < 5; i++) { g.fillStyle = r() < 0.5 ? '#4f8a3f' : '#3c6d31'; g.fillRect(x - 3 + Math.floor(r() * 6), y - Math.floor(r() * h), 1, 1); }
}
function rubble(g, x, y, r) {
  for (let i = 0; i < 4; i++) {
    g.fillStyle = r() < 0.5 ? '#8a8992' : '#5c5b63';
    g.fillRect(x + Math.floor(r() * 6) - 3, y - Math.floor(r() * 3), 2, 1);
  }
}
function cactus(g, x, y) {
  shadow(g, x + 2, y, 10, 3, 0.3);
  g.fillStyle = '#2b6b36'; g.fillRect(x - 1, y - 11, 3, 11);
  g.fillStyle = '#4a9a52'; g.fillRect(x - 1, y - 11, 2, 11);
  g.fillStyle = '#6cbc6c'; g.fillRect(x - 1, y - 11, 1, 10);
  g.fillStyle = '#3f8f4a';
  g.fillRect(x - 3, y - 7, 2, 1); g.fillRect(x - 4, y - 10, 1, 4);
  g.fillRect(x + 2, y - 5, 2, 1); g.fillRect(x + 3, y - 8, 1, 4);
  g.fillStyle = '#f0e6c8'; g.fillRect(x, y - 12, 1, 1);
}
function bones(g, x, y) {
  g.fillStyle = '#e9e2cf'; g.fillRect(x - 2, y - 1, 5, 1); g.fillRect(x - 3, y - 2, 1, 1); g.fillRect(x + 3, y - 2, 1, 1);
  g.fillRect(x - 3, y, 1, 1); g.fillRect(x + 3, y, 1, 1);
}
function reed(g, x, y, r) {
  const h = 3 + Math.floor(r() * 4);
  g.fillStyle = '#4f7a2f'; g.fillRect(x, y - h, 1, h);
  g.fillStyle = '#7a4a22'; g.fillRect(x, y - h - 2, 1, 2);
}
function lily(g, x, y, r) {
  disc(g, x, y, 2, '#3d8b3a');
  g.fillStyle = '#2b6cb2'; g.fillRect(x, y - 2, 1, 2);
  if (r() < 0.4) { g.fillStyle = '#f7a8c9'; g.fillRect(x - 1, y - 1, 2, 1); g.fillStyle = '#fff'; g.fillRect(x - 1, y - 2, 1, 1); }
}

// ---------- build ----------
export function buildWorld() {
  const N = W * H;
  const water = new Uint8Array(N); // 1 = lake (blocked)
  const ice = new Uint8Array(N);
  const depth = new Float32Array(N);
  const path = new Uint8Array(N); // 1 core, 2 edge, 3 bridge, 4 rail
  const waterPoints = [];

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ld = lakeD(x, y);
      if (ld < 1) { water[i] = 1; depth[i] = 1 - ld; }
      else depth[i] = -ld;
      if (iceD(x, y) < 1) ice[i] = 1;
    }

  // Paths: wobbly lines between rooms. Crossing the lake makes a bridge.
  const lines = [
    [0, 192, W, 192], [0, 320, W, 320],
    [64, 0, 64, H], [448, 0, 448, H], [320, 62, 320, 192], [676, 320, 676, 404], [704, 92, 704, 192],
  ];
  lines.forEach(([x0, y0, x1, y1], li) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    for (let s = 0; s <= len; s++) {
      // keep bridges straight across the lake
      const onLake = horiz && x0 + (x1 - x0) * (s / len) > 130 && x0 + (x1 - x0) * (s / len) < 254;
      const wob = onLake ? 0 : (vnoise(s / 40, li * 7, 31) - 0.5) * 18 * Math.min(1, s / 20, (len - s) / 20);
      const px = x0 + (x1 - x0) * (s / len) + nx * wob;
      const py = y0 + (y1 - y0) * (s / len) + ny * wob;
      for (let dy = -6; dy <= 6; dy++)
        for (let dx = -6; dx <= 6; dx++) {
          const x = Math.round(px + dx), y = Math.round(py + dy);
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x, r = Math.hypot(dx, dy);
          const wet = water[i] || depth[i] > -1.12;
          if (r <= 4.5) {
            if (wet && horiz) path[i] = 3;
            else if (path[i] !== 3 && path[i] !== 1) path[i] = 1;
          } else if (r <= 6 && path[i] === 0) {
            path[i] = wet && horiz ? 4 : 2;
          }
        }
    }
  });
  for (let i = 0; i < N; i++) if (path[i] === 3 || path[i] === 4) water[i] = path[i] === 4 && water[i] ? 1 : 0;

  // Ground colour pass
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const dith = (x, y) => ((x & 1) ^ (y & 1)) * 0.04 - 0.02;

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = biomeAt(x, y);
      const n = fbm(x, y, 1) + (hash(x, y, 2) - 0.5) * 0.1 + dith(x, y);
      let col;
      const m = path[i];
      if (m === 3) {
        col = x % 4 === 0 ? C.plankSeam : hash(x >> 2, 0, 5) > 0.5 ? C.plank0 : C.plank1;
      } else if (m === 4) {
        col = C.rail;
      } else if (water[i]) {
        const dp = depth[i];
        col = dp > 0.55 ? C.deep : dp > 0.25 ? C.mid : dp > 0.07 ? C.shallow : C.foam;
        if (dp > 0.07 && Math.sin((x + y * 0.5) * 0.45 + fbm(x, y, 17) * 9) > 0.93) col = C.wave;
        if (hash(x, y, 40) < 0.004 && dp > 0.1) waterPoints.push({ x, y, ph: hash(x, y, 41) * 6.28 });
      } else if (ice[i]) {
        const id = iceD(x, y);
        col = id > 0.88 ? C.iceEdge : Math.abs(fbm(x, y, 21) - 0.5) < 0.012 ? C.iceCrack : n > 0.5 ? C.ice1 : C.ice0;
      } else if (m === 1 || m === 2) {
        if (b === 'S') col = m === 2 ? C.snowEdge : n > 0.5 ? C.snowPath1 : C.snowPath0;
        else col = m === 2 ? C.dirtEdge : n > 0.58 ? C.dirt2 : n > 0.42 ? C.dirt1 : C.dirt0;
      } else if (depth[i] > -1.12) {
        col = n > 0.5 ? C.sand : C.sand2;
      } else if (b === 'R') {
        const ry = Math.floor(y / 6), off = (ry & 1) * 4;
        const bx = Math.floor((x + off) / 8), lx = (x + off) % 8, ly = y % 6;
        const bid = hash(bx, ry, 11);
        if (bid < 0.13) col = PAL.M[n > 0.5 ? 1 : 0];
        else if (lx === 0 || ly === 0) col = C.mortar;
        else {
          const k = clamp(Math.floor(bid * 3 + (hash(x, y, 12) - 0.5) * 0.6), 0, 2);
          col = PAL.R[ly === 1 ? 2 : k];
        }
      } else {
        let v = n;
        if (b === 'D') v += Math.sin(x * 0.12 + y * 0.05 + fbm(x, y, 19) * 10) * 0.12;
        col = PAL[b][v < 0.42 ? 0 : v < 0.6 ? 1 : 2];
      }
      const o = i * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);

  // Decor
  const r = rng(1234);
  const items = [];
  const big = [];
  const free = (x, y, rad = 0, minGap = 0) => {
    if (x < 4 || y < 6 || x >= W - 4 || y >= H - 2) return false;
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) {
        const xx = clamp(x + dx, 0, W - 1), yy = clamp(y + dy, 0, H - 1), i = yy * W + xx;
        if (path[i] || water[i] || ice[i] || depth[i] > -1.15) return false;
      }
    for (const p of POIS) if (Math.hypot(p.x - x, p.y - y) < 22) return false;
    if (Math.hypot(x - 64, y - 72) < 16) return false;
    for (const b of big) if (Math.hypot(b.x - x, b.y - y) < minGap) return false;
    return true;
  };
  const scatter = (b, x0, y0, n, rad, gap, fn, isBig) => {
    for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) {
      const x = Math.floor(x0 + r() * ROOM), y = Math.floor(y0 + r() * ROOM);
      if (biomeAt(x, y) !== b || !free(x, y, rad, gap)) continue;
      if (isBig) big.push({ x, y });
      items.push({ y, draw: () => fn(x, y) });
      k++;
    }
  };
  const FLOWERS = ['#f25f5c', '#ffe066', '#ffffff', '#b388ff', '#ff9ad5'];
  for (let ry = 0; ry < ROWS; ry++)
    for (let rx = 0; rx < COLS; rx++) {
      const b = BIOMES[ry][rx], x0 = rx * ROOM, y0 = ry * ROOM;
      const grassT = (n) => scatter(b, x0, y0, n, 0, 0, (x, y) => tuft(g, x, y, '#2f6b2e', '#7cc15f'));
      if (b === 'M' || b === 'L') {
        grassT(45);
        scatter(b, x0, y0, 5, 2, 10, (x, y) => rock(g, x, y, false), true);
        scatter(b, x0, y0, 4, 3, 14, (x, y) => bush(g, x, y, r), true);
        scatter(b, x0, y0, 14, 0, 0, (x, y) => flower(g, x, y, FLOWERS[Math.floor(r() * 5)]));
        scatter(b, x0, y0, 2, 4, 18, (x, y) => tree(g, x, y, r), true);
      } else if (b === 'F') {
        grassT(30);
        scatter(b, x0, y0, 170, 0, 0, (x, y) => flower(g, x, y, FLOWERS[Math.floor(r() * 5)]));
        scatter(b, x0, y0, 3, 4, 18, (x, y) => tree(g, x, y, r), true);
        scatter(b, x0, y0, 3, 3, 12, (x, y) => bush(g, x, y, r), true);
      } else if (b === 'T') {
        scatter(b, x0, y0, 15, 4, 16, (x, y) => tree(g, x, y, r), true);
        scatter(b, x0, y0, 4, 3, 12, (x, y) => pine(g, x, y, false), true);
        scatter(b, x0, y0, 10, 0, 0, (x, y) => mushroom(g, x, y));
        scatter(b, x0, y0, 30, 0, 0, (x, y) => tuft(g, x, y, '#1f4a24', '#4f8f45'));
      } else if (b === 'S') {
        scatter(b, x0, y0, 9, 3, 14, (x, y) => pine(g, x, y, true), true);
        scatter(b, x0, y0, 4, 2, 10, (x, y) => rock(g, x, y, true), true);
        scatter(b, x0, y0, 40, 0, 0, (x, y) => { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); });
        scatter(b, x0, y0, 10, 0, 0, (x, y) => tuft(g, x, y, '#8fa6b8', '#b6c7d6'));
      } else if (b === 'R') {
        scatter(b, x0, y0, 5, 3, 16, (x, y) => pillar(g, x, y, 8 + Math.floor(r() * 10), r), true);
        scatter(b, x0, y0, 14, 0, 0, (x, y) => rubble(g, x, y, r));
        scatter(b, x0, y0, 14, 0, 0, (x, y) => tuft(g, x, y, '#3c6d31', '#6aa652'));
      } else if (b === 'D') {
        scatter(b, x0, y0, 6, 3, 14, (x, y) => cactus(g, x, y), true);
        scatter(b, x0, y0, 5, 2, 10, (x, y) => rock(g, x, y, false), true);
        scatter(b, x0, y0, 3, 0, 0, (x, y) => bones(g, x, y));
        scatter(b, x0, y0, 12, 0, 0, (x, y) => tuft(g, x, y, '#8f8a3c', '#c2b65a'));
      }
    }
  // Reeds on the shore, lily pads on the water
  for (let k = 0; k < 900 && items.length < 2000; k++) {
    const x = Math.floor(130 + r() * 124), y = Math.floor(140 + r() * 232);
    const i = y * W + x;
    if (!path[i] && !water[i] && depth[i] > -1.2 && depth[i] < -1.03 && r() < 0.35) items.push({ y, draw: () => reed(g, x, y, r) });
    else if (water[i] && depth[i] > 0.15 && depth[i] < 0.7 && r() < 0.03 && !path[i]) items.push({ y: y - 100, draw: () => lily(g, x, y, r) });
  }
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());

  return {
    canvas,
    W, H,
    waterPoints,
    biomeAt,
    blocked: (x, y) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return true;
      return water[yi * W + xi] === 1;
    },
  };
}

// ---------- ambient life ----------
export function createAmbient(world) {
  const r = rng(99);
  const rooms = (ch) => {
    const out = [];
    BIOMES.forEach((row, ry) => [...row].forEach((b, rx) => b === ch && out.push({ x: rx * ROOM, y: ry * ROOM })));
    return out;
  };
  const fireflies = [];
  for (const room of rooms('T')) for (let i = 0; i < 14; i++)
    fireflies.push({ hx: room.x + 10 + r() * 108, hy: room.y + 10 + r() * 108, ph: r() * 100 });
  const snowRooms = rooms('S');
  const sx0 = Math.min(...snowRooms.map((s) => s.x)), sy0 = Math.min(...snowRooms.map((s) => s.y));
  const sx1 = Math.max(...snowRooms.map((s) => s.x)) + ROOM, sy1 = Math.max(...snowRooms.map((s) => s.y)) + ROOM;
  const flakes = Array.from({ length: 90 }, () => ({ x: sx0 + r() * (sx1 - sx0), y: sy0 + r() * (sy1 - sy0), ph: r() * 6, v: 8 + r() * 10 }));
  const clouds = Array.from({ length: 5 }, (_, i) => ({ x: r() * W, y: 40 + i * 100 + r() * 40, s: 30 + r() * 30, v: 4 + r() * 4 }));
  const leaves = Array.from({ length: 24 }, () => ({ x: r() * W, y: r() * H, ph: r() * 6, v: 6 + r() * 8 }));

  return {
    update(dt, t) {
      for (const f of flakes) {
        f.y += f.v * dt; f.x += Math.sin(t * 1.3 + f.ph) * 6 * dt;
        if (f.y > sy1) { f.y = sy0; f.x = sx0 + Math.random() * (sx1 - sx0); }
      }
      for (const c of clouds) { c.x += c.v * dt; if (c.x - c.s * 3 > W) c.x = -c.s * 3; }
      for (const l of leaves) {
        l.x += (l.v + Math.sin(t + l.ph) * 6) * dt; l.y += Math.cos(t * 0.8 + l.ph) * 4 * dt + 3 * dt;
        if (l.x > W) l.x = 0; if (l.y > H) l.y = 0;
      }
    },
    drawGround(g, t) {
      for (const p of world.waterPoints) {
        const s = Math.sin(t * 2.2 + p.ph);
        if (s > 0.6) { g.fillStyle = s > 0.9 ? '#ffffff' : '#bfe6ff'; g.fillRect(p.x, p.y, s > 0.9 ? 2 : 1, 1); }
      }
    },
    drawAir(g, t) {
      for (const f of flakes) {
        if (world.biomeAt(f.x, f.y) !== 'S') continue;
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      }
      for (const l of leaves) {
        const b = world.biomeAt(l.x, l.y);
        if (b === 'S' || b === 'D') continue;
        g.fillStyle = Math.sin(t * 4 + l.ph) > 0 ? '#e9a23b' : '#c9652c';
        g.fillRect(Math.round(l.x), Math.round(l.y), Math.sin(t * 4 + l.ph) > 0 ? 2 : 1, 1);
      }
    },
    drawGlow(g, t) {
      for (const f of fireflies) {
        const x = f.hx + Math.sin(t * 0.5 + f.ph) * 18 + Math.sin(t * 1.3 + f.ph * 2) * 6;
        const y = f.hy + Math.cos(t * 0.4 + f.ph) * 14 + Math.sin(t * 1.7 + f.ph) * 5;
        const a = 0.35 + 0.35 * Math.sin(t * 3 + f.ph * 5);
        if (a <= 0.05) continue;
        const gr = g.createRadialGradient(x, y, 0, x, y, 6);
        gr.addColorStop(0, `rgba(220,255,140,${a})`); gr.addColorStop(1, 'rgba(220,255,140,0)');
        g.fillStyle = gr; g.fillRect(x - 6, y - 6, 12, 12);
        g.fillStyle = `rgba(255,255,220,${Math.min(1, a * 2)})`; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    },
    drawClouds(g) {
      for (const c of clouds) {
        for (const [ox, oy, k] of [[0, 0, 1], [c.s * 0.9, c.s * 0.2, 0.8], [-c.s * 0.8, c.s * 0.25, 0.7]]) {
          const x = c.x + ox, y = c.y + oy, rr = c.s * k * 1.4;
          const gr = g.createRadialGradient(x, y, 0, x, y, rr);
          gr.addColorStop(0, 'rgba(10,25,45,0.13)'); gr.addColorStop(1, 'rgba(10,25,45,0)');
          g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
      }
    },
  };
}
