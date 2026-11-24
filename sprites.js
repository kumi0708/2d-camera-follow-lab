// Procedural pixel-art characters and points of interest. (x, y) = feet position.
import { disc, shadow, hash } from './world.js';

/** dir: 0 down, 1 up, 2 left, 3 right */
export function drawHero(g, x, y, dir, t, moving, running) {
  const f = moving ? Math.floor(t * (running ? 13 : 8)) % 4 : 0;
  const bob = f === 1 || f === 3 ? 1 : 0;
  const P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  const side = dir >= 2;
  const s = dir === 2 ? -1 : 1;

  shadow(g, x, y, 10, 3, 0.32);

  // scarf tail streaming behind while running
  if (running && side) {
    const w = Math.floor(t * 16) % 2;
    P(-s * 5 - (s < 0 ? 0 : 2), -10 - bob + w, 3, 1, '#f2c14e');
    P(-s * 7 - (s < 0 ? 0 : 1), -9 - bob - w, 2, 1, '#e0a93a');
  }

  // legs
  const liftL = f === 1 ? 1 : 0, liftR = f === 3 ? 1 : 0;
  const swing = side && moving ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;
  P(-3 + swing, -4, 2, 3 - liftL, '#2d3a5c');
  P(1 - swing, -4, 2, 3 - liftR, '#2d3a5c');
  P(-3 + swing, -1 - liftL, 2, 1, '#3b2416');
  P(1 - swing, -1 - liftR, 2, 1, '#3b2416');

  const b = -bob;
  // arms
  const arm = moving ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;
  if (!side || dir === 3) P(-5, -9 + b + arm, 1, 4, '#b8382f');
  if (!side || dir === 2) P(4, -9 + b - arm, 1, 4, '#b8382f');
  if (!side || dir === 3) P(-5, -5 + b + arm, 1, 1, '#f4c9a0');
  if (!side || dir === 2) P(4, -5 + b - arm, 1, 1, '#f4c9a0');
  // tunic
  P(-4, -10 + b, 8, 6, '#c8423a');
  P(2, -10 + b, 2, 6, '#9c2f2a');
  P(-4, -10 + b, 1, 6, '#e0645a');
  P(-4, -5 + b, 8, 1, '#5a3418');
  if (dir === 0) P(-1, -5 + b, 2, 1, '#f2c14e');
  if (side) P(s > 0 ? -5 : 4, -9 + b + arm, 1, 4, '#b8382f');
  // scarf
  P(-4, -11 + b, 8, 1, '#f2c14e');
  if (dir === 1) P(-1, -10 + b, 2, 3, '#e0a93a');
  // head
  P(-4, -17 + b, 8, 6, '#f4c9a0');
  P(2, -17 + b, 2, 6, '#e3b088');
  // hair
  P(-4, -18 + b, 8, 2, '#4a2f1f');
  P(-3, -19 + b, 6, 1, '#4a2f1f');
  P(-2, -19 + b, 2, 1, '#6e4a33');
  if (dir === 0) {
    P(-4, -16 + b, 1, 3, '#4a2f1f'); P(3, -16 + b, 1, 3, '#4a2f1f');
    P(-2, -14 + b, 1, 2, '#1c1c2e'); P(1, -14 + b, 1, 2, '#1c1c2e');
    P(-3, -12 + b, 1, 1, '#e8907a'); P(2, -12 + b, 1, 1, '#e8907a');
  } else if (dir === 1) {
    P(-4, -16 + b, 8, 5, '#4a2f1f'); P(-2, -16 + b, 3, 1, '#6e4a33');
  } else {
    const back = s > 0 ? -4 : 1;
    P(back, -16 + b, 3, 4, '#4a2f1f');
    P(s > 0 ? 2 : -3, -14 + b, 1, 2, '#1c1c2e');
    P(s > 0 ? 1 : -2, -12 + b, 1, 1, '#e8907a');
  }
}

export function drawSlime(g, x, y, t, moving, faded) {
  const hop = moving ? Math.abs(Math.sin(t * 9)) : 0;
  const sq = moving ? Math.round(Math.cos(t * 18) * 1) : Math.round(Math.sin(t * 3) * 0.6);
  const lift = Math.round(hop * 3);
  const w = 11 + sq, h = 8 - sq;
  shadow(g, x, y, 11 - lift, 3, 0.3);
  g.globalAlpha = faded ? 0.55 : 1;
  const top = y - h - lift;
  for (let r = 0; r < h; r++) {
    const tt = (r + 0.5) / h;
    const hw = r < h * 0.55 ? Math.round((w / 2) * Math.sqrt(1 - ((1 - tt / 0.55) ** 2))) : Math.round(w / 2);
    g.fillStyle = r >= h - 2 ? '#2f9b78' : r < 2 ? '#8af0cc' : '#57d6b0';
    g.fillRect(Math.round(x - hw), top + r, hw * 2, 1);
  }
  g.fillStyle = '#e8fff6'; g.fillRect(Math.round(x - w / 2) + 2, top + 2, 2, 1); g.fillRect(Math.round(x - w / 2) + 2, top + 3, 1, 1);
  const blink = Math.sin(t * 1.7) > 0.97;
  g.fillStyle = '#123b31';
  g.fillRect(Math.round(x) - 3, top + Math.floor(h / 2), 1, blink ? 1 : 2);
  g.fillRect(Math.round(x) + 2, top + Math.floor(h / 2), 1, blink ? 1 : 2);
  g.fillStyle = '#ff8fab'; g.fillRect(Math.round(x) - 4, top + Math.floor(h / 2) + 2, 1, 1); g.fillRect(Math.round(x) + 3, top + Math.floor(h / 2) + 2, 1, 1);
  g.globalAlpha = 1;
}

const CRYSTAL = {
  cyan: ['#e6fdff', '#9cecf8', '#4fc7e2', '#2580a6', '#155a7c'],
  pink: ['#fff0fa', '#ffbde6', '#f07ac8', '#b04090', '#7a2a66'],
};

export function drawPoi(g, p, t) {
  const { x, y } = p;
  const P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  if (p.kind === 'crystal') {
    const bob = Math.round(Math.sin(t * 2 + x) * 2);
    const c = CRYSTAL[p.hue];
    shadow(g, x, y, 10 - bob, 3, 0.25);
    // stone base
    P(-5, -2, 10, 2, '#6d6f78'); P(-4, -3, 8, 1, '#8d8f98'); P(-5, -1, 10, 1, '#4f5159');
    const widths = [1, 3, 5, 7, 7, 7, 7, 5, 5, 3, 1];
    const top = -18 - bob;
    widths.forEach((w, r) => {
      const hw = (w - 1) / 2;
      for (let i = -hw; i <= hw; i++) {
        const col = i < -1 ? c[1] : i < 0 ? c[2] : i === 0 ? (r < 5 ? c[0] : c[2]) : i < 2 ? c[3] : c[4];
        P(i, top + r, 1, 1, col);
      }
    });
    if (Math.sin(t * 3 + x) > 0.8) P(-1, top + 3, 1, 1, '#ffffff');
  } else if (p.kind === 'chest') {
    const open = 0;
    shadow(g, x, y, 16, 4, 0.35);
    P(-7, -9 - open, 14, 4, '#a06a34'); P(-7, -10 - open, 14, 1, '#7a4c22'); P(-6, -9 - open, 12, 1, '#c08447');
    P(-7, -5, 14, 5, '#8a5a2b'); P(-7, -1, 14, 1, '#5e3a1a');
    P(-5, -10, 2, 10, '#f2c14e'); P(3, -10, 2, 10, '#f2c14e');
    P(-5, -10, 1, 10, '#ffe08a'); P(3, -10, 1, 10, '#ffe08a');
    P(-1, -7, 2, 3, '#ffe08a'); P(-1, -5, 2, 1, '#8a5a1a');
    const gl = (Math.floor(t * 2) % 5);
    if (gl === 0) { P(-6 + Math.floor(hash(Math.floor(t * 2), 0, 3) * 12), -9, 1, 1, '#ffffff'); }
  } else if (p.kind === 'campfire') {
    shadow(g, x, y, 16, 4, 0.3);
    for (const [dx, dy] of [[-7, -1], [-5, -3], [-2, -4], [2, -4], [5, -3], [6, -1], [-4, 0], [3, 0]]) {
      P(dx, dy, 2, 2, '#6d6f78'); P(dx, dy, 1, 1, '#9a9da6');
    }
    P(-5, -2, 10, 2, '#5b3a21'); P(-3, -3, 6, 1, '#7a4c2a');
    const fr = Math.floor(t * 12);
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const base = Math.round((1 - r / rows) * 4);
      const jit = Math.round((hash(fr, r, 7) - 0.5) * 2);
      const hw = Math.max(0, base + (r > 2 ? jit : 0));
      const yy = -3 - r;
      if (hw <= 0 && r > 6) continue;
      P(-hw + jit * (r > 4 ? 1 : 0), yy, hw * 2 + 1, 1, '#e8452c');
      if (hw > 1) P(-hw + 1, yy, hw * 2 - 1, 1, '#ff9a2e');
      if (hw > 2) P(-hw + 2, yy, hw * 2 - 3, 1, '#ffe066');
    }
  } else if (p.kind === 'portal') {
    shadow(g, x, y, 22, 5, 0.35);
    P(-11, -26, 4, 26, '#5e5d66'); P(7, -26, 4, 26, '#5e5d66');
    P(-11, -26, 1, 26, '#8f8e98'); P(7, -26, 1, 26, '#8f8e98');
    P(-12, -28, 24, 3, '#77767f'); P(-12, -28, 24, 1, '#a3a2ab');
    for (let r = 0; r < 23; r++) {
      const tt = (r - 11) / 11.5;
      const hw = Math.round(6.5 * Math.sqrt(Math.max(0, 1 - tt * tt)));
      P(-hw, -25 + r, hw * 2, 1, '#2a0f4a');
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + t * 1.6;
      const rr = 2 + ((i * 7) % 5);
      const px = Math.round(Math.cos(a) * rr * 1.1), py = Math.round(Math.sin(a) * rr * 2);
      const b = (Math.sin(a * 3 - t * 4) + 1) / 2;
      P(px, -14 + py, 1, 1, b > 0.6 ? '#f0d1ff' : b > 0.3 ? '#b67cff' : '#7b3fe0');
    }
  } else if (p.kind === 'statue') {
    shadow(g, x, y, 16, 4, 0.35);
    P(-7, -5, 14, 5, '#77767f'); P(-7, -5, 14, 1, '#a3a2ab'); P(-7, -1, 14, 1, '#55545c');
    P(-3, -17, 6, 12, '#8f8e98'); P(-3, -17, 2, 12, '#b3b2bb'); P(2, -17, 1, 12, '#66656e');
    P(-4, -14, 1, 6, '#8f8e98'); P(3, -14, 1, 6, '#66656e');
    disc(g, x, y - 20, 3, '#8f8e98'); P(-2, -22, 2, 2, '#b3b2bb');
    P(-1, -20, 1, 1, '#55545c'); P(1, -20, 1, 1, '#55545c');
    for (const [dx, dy] of [[-3, -8], [-2, -6], [2, -10], [-6, -3], [4, -2], [3, -16]]) P(dx, dy, 1, 1, '#4f8a3f');
  }
}

const GLOW = {
  crystal: (p) => (p.hue === 'pink' ? [255, 140, 210] : [110, 230, 255]),
  chest: () => [255, 210, 110],
  campfire: () => [255, 140, 50],
  portal: () => [170, 100, 255],
  statue: () => null,
};

export function drawPoiGlow(g, p, t) {
  const rgb = GLOW[p.kind](p);
  if (!rgb) return;
  let r = 24, a = 0.28, cy = p.y - 10;
  if (p.kind === 'campfire') { r = 44 + Math.sin(t * 17) * 2 + Math.sin(t * 7) * 3; a = 0.42; cy = p.y - 6; }
  if (p.kind === 'crystal') { a = 0.28 + Math.sin(t * 2 + p.x) * 0.08; cy = p.y - 12; }
  if (p.kind === 'portal') { r = 30; a = 0.3 + Math.sin(t * 3) * 0.06; cy = p.y - 14; }
  if (p.kind === 'chest') { r = 18; a = 0.16; cy = p.y - 6; }
  const gr = g.createRadialGradient(p.x, cy, 0, p.x, cy, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(0.5, `rgba(${rgb},${a * 0.35})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(p.x - r, cy - r, r * 2, r * 2);
}
