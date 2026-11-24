// Generates the README charts from the real camera code.
// Run: node scripts/make-figures.mjs  ->  docs/figures/{ja,en}/*.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { Camera, smoothstep } from '../camera.js';

const OUT = new URL('../docs/figures/', import.meta.url);
const DT = 1 / 60;

// Dark chart surface so the figures read the same in GitHub's light and dark themes.
const C = {
  surface: '#1a1a19', border: '#2e2e2b', text: '#f0efec', text2: '#c3c2b7', muted: '#8f8e86', grid: '#2f2f2c',
  s1: '#3987e5', s2: '#d95926', s3: '#199e70',
};
const FONT = `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', 'Segoe UI', sans-serif`;

// ---------------- tiny SVG chart helper ----------------
function chart({ title, subtitle, xLabel, yLabel, x, y, series, bands = [], vlines = [], hlines = [], notes = [], legend = true }) {
  const W = 760, H = 400, L = 70, R = 24, T = 100, B = 52;
  const pw = W - L - R, ph = H - T - B;
  const sx = (v) => L + ((v - x.min) / (x.max - x.min)) * pw;
  const sy = (v) => T + ph - ((v - y.min) / (y.max - y.min)) * ph;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">`);
  o.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${C.surface}" stroke="${C.border}"/>`);
  o.push(`<text x="24" y="32" fill="${C.text}" font-size="17" font-weight="700">${esc(title)}</text>`);
  if (subtitle) o.push(`<text x="24" y="54" fill="${C.text2}" font-size="12.5">${esc(subtitle)}</text>`);
  // bands
  for (const b of bands) {
    if (b.y0 !== undefined) {
      o.push(`<rect x="${L}" y="${sy(b.y1)}" width="${pw}" height="${sy(b.y0) - sy(b.y1)}" fill="${b.color}" opacity="${b.opacity ?? 0.12}"/>`);
    } else if (b.x0 !== undefined) {
      o.push(`<rect x="${sx(b.x0)}" y="${T}" width="${sx(b.x1) - sx(b.x0)}" height="${ph}" fill="${b.color}" opacity="${b.opacity ?? 0.1}"/>`);
      if (b.label) o.push(`<text x="${(sx(b.x0) + sx(b.x1)) / 2}" y="${T + 14}" fill="${C.muted}" font-size="11" text-anchor="middle">${esc(b.label)}</text>`);
    } else if (b.path) {
      const pts = b.path.map(([a, lo]) => `${sx(a).toFixed(1)},${sy(lo).toFixed(1)}`);
      const top = b.pathTop.map(([a, hi]) => `${sx(a).toFixed(1)},${sy(hi).toFixed(1)}`).reverse();
      o.push(`<polygon points="${pts.concat(top).join(' ')}" fill="${b.color}" opacity="${b.opacity ?? 0.16}"/>`);
    }
  }
  // grid + ticks
  for (const t of y.ticks) {
    o.push(`<line x1="${L}" x2="${L + pw}" y1="${sy(t)}" y2="${sy(t)}" stroke="${C.grid}" stroke-width="1"/>`);
    o.push(`<text x="${L - 8}" y="${sy(t) + 4}" fill="${C.muted}" font-size="11" text-anchor="end">${t}</text>`);
  }
  for (const t of x.ticks) o.push(`<text x="${sx(t)}" y="${T + ph + 18}" fill="${C.muted}" font-size="11" text-anchor="middle">${t}</text>`);
  o.push(`<line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}" stroke="${C.muted}" stroke-width="1"/>`);
  o.push(`<text x="${L + pw}" y="${H - 14}" fill="${C.text2}" font-size="12" text-anchor="end">${esc(xLabel)}</text>`);
  o.push(`<text transform="translate(20 ${T + ph / 2}) rotate(-90)" fill="${C.text2}" font-size="12" text-anchor="middle">${esc(yLabel)}</text>`);
  for (const v of vlines) {
    o.push(`<line x1="${sx(v.x)}" x2="${sx(v.x)}" y1="${T}" y2="${T + ph}" stroke="${C.muted}" stroke-dasharray="4 4" stroke-width="1"/>`);
    if (v.label) o.push(`<text x="${sx(v.x) + 4}" y="${T + ph - 6}" fill="${C.muted}" font-size="11">${esc(v.label)}</text>`);
  }
  for (const h of hlines) {
    o.push(`<line x1="${L}" x2="${L + pw}" y1="${sy(h.y)}" y2="${sy(h.y)}" stroke="${C.muted}" stroke-dasharray="4 4" stroke-width="1"/>`);
    if (h.label) o.push(`<text x="${L + 6}" y="${sy(h.y) - 5}" fill="${C.muted}" font-size="11">${esc(h.label)}</text>`);
  }
  // series
  for (const s of series) {
    const d = s.points.map(([a, b], i) => `${i ? 'L' : 'M'}${sx(a).toFixed(1)},${sy(b).toFixed(1)}`).join('');
    o.push(`<path d="${d}" fill="none" stroke="${C.surface}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`);
    o.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2.25}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`);
    if (s.label) {
      const [a, b] = s.labelAt ?? s.points[s.points.length - 1];
      o.push(`<text x="${sx(a) + (s.labelDx ?? 6)}" y="${sy(b) + (s.labelDy ?? 4)}" fill="${C.text}" font-size="12" text-anchor="${s.labelAnchor ?? 'start'}">${esc(s.label)}</text>`);
    }
  }
  // notes: point + text
  for (const n of notes) {
    if (n.dot) o.push(`<circle cx="${sx(n.x)}" cy="${sy(n.y)}" r="4.5" fill="${n.color ?? C.text}" stroke="${C.surface}" stroke-width="2"/>`);
    if (n.bracket) {
      const [y0, y1] = n.bracket;
      const bx = sx(n.x);
      o.push(`<path d="M${bx - 5},${sy(y0)}H${bx}V${sy(y1)}H${bx - 5}" fill="none" stroke="${C.text2}" stroke-width="1.5"/>`);
    }
    o.push(`<text x="${sx(n.x) + (n.dx ?? 8)}" y="${sy(n.y) + (n.dy ?? -8)}" fill="${C.text}" font-size="12" font-weight="600" text-anchor="${n.anchor ?? 'start'}">${esc(n.text)}</text>`);
  }
  // legend: its own row under the subtitle, left-aligned
  if (legend) {
    const textW = (str) => [...str].reduce((w, ch) => w + (/[^\x00-\x7f]/.test(ch) ? 12 : 6.7), 0);
    let lx = 24;
    for (const s of series.filter((s) => s.legend !== false)) {
      o.push(`<line x1="${lx}" x2="${lx + 16}" y1="76" y2="76" stroke="${s.color}" stroke-width="${s.width && s.width > 4 ? 8 : 3}" stroke-linecap="round"${s.width && s.width > 4 ? ' opacity="0.45"' : ''}${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`);
      o.push(`<text x="${lx + 22}" y="80" fill="${C.text2}" font-size="12">${esc(s.name)}</text>`);
      lx += 22 + textW(s.name) + 20;
    }
  }
  o.push('</svg>');
  return o.join('\n');
}

// ---------------- simulations ----------------
function simulate(mode, steps, script, setup) {
  const cam = new Camera();
  const p = { x: 0, y: 0 };
  setup?.(cam, p);
  cam.reset(p);
  cam.setMode(mode, p);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i * DT;
    const input = script(t, p, cam) || {};
    cam.update(DT, { p, ...input });
    out.push({ t, px: p.x, cx: cam.x, view: cam.view });
  }
  return out;
}
const ticks = (a, b, s) => { const r = []; for (let v = a; v <= b + 1e-9; v += s) r.push(+v.toFixed(3)); return r; };

const L10N = {
  ja: {
    time: '時間（秒）', pos: '横位置 x（px）', player: 'プレイヤー', camera: 'カメラ',
    ease: ['フレームレートに依存しないイージング', '残っている差の割合。「毎フレーム10%詰める」lerp は fps で速さが変わるが、指数イージングは変わらない',
      'lerp 0.1 @60fps', 'lerp 0.1 @144fps', '指数 rate 2.6（30 / 60 / 144fps で同一）', '残りの差（%）', '半減期 0.27秒'],
    smooth: ['スムーズ：一定速度だと v/rate だけ遅れる', '60px/s で 2 秒歩いて止まる。rate 2.6/秒', '遅れ ≈ 23px（60 ÷ 2.6）', '止まる'],
    dead: ['デッドゾーン：箱の中では動かない', '±15px の小刻みな往復のあと右へ歩く。帯はカメラから ±22px の箱', '箱（±22px）', '箱の中：カメラは不動', '縁に押されて追従'],
    rooms: ['部屋ごと：部屋の中では固定、境界で 0.55 秒スライド', '60px/s で右へ歩き続ける。点線は部屋の境界（128px ごと）', '境界', 'smoothstep でスライド'],
    look: ['先読み：進む方向へ 32px 先行', '右へ 1.5 秒歩く → 1 秒止まる → 左へ 1.5 秒歩く', '+32px 先行', 'リードが 0 に戻る', '反転：−32px 側へ'],
    poi: ['注目点：距離によるずれの大きさ', '注目点までの距離ごとの、落ち着いたときのカメラのずれ（pull 0.6）', '注目点までの距離（px）', 'カメラのずれ（px）', 'ずれ', '重み 1', 'smoothstep', '重み 0', '最大 16.8px（31px）', '14.0px（40px）'],
    aim: ['エイム：画面オフセットを使う理由', 'マウスを止めたときに落ち着くカメラのずれ（エイム比率 0.45）', 'カーソルの画面中央からの距離（px）', 'カメラのずれ（px）', '正しい実装（画面オフセット）', '素朴な実装（ワールド座標）', '45px', '82px（0.45 ÷ 0.55 倍）'],
    two: ['2ターゲット：距離とビューの大きさ', '必要なビュー = 2人の距離 + 余白 104px を 128〜240px に収める', '2人の距離（px）', 'ビューの一辺（px）', 'クランプあり', 'クランプなし', '最小 128px', '上限 240px', '204px（100px 離れ）'],
  },
  en: {
    time: 'time (s)', pos: 'x position (px)', player: 'player', camera: 'camera',
    ease: ['Frame-rate independent easing', 'Share of the gap left. A "close 10% per frame" lerp changes speed with fps; the exponential ease does not',
      'lerp 0.1 @60fps', 'lerp 0.1 @144fps', 'exp rate 2.6 (same at 30 / 60 / 144fps)', 'gap left (%)', 'half-life 0.27 s'],
    smooth: ['Smooth: at constant speed it lags by v/rate', 'Walk at 60 px/s for 2 s, then stop. rate 2.6/s', 'lag ≈ 23 px (60 ÷ 2.6)', 'stop'],
    dead: ['Dead zone: the camera holds inside the box', 'Small ±15 px wiggle, then walk right. The band is the ±22 px box around the camera', 'box (±22 px)', 'inside the box: camera holds', 'pushed by the edge'],
    rooms: ['Room by room: fixed inside a room, 0.55 s slide at the border', 'Walk right at 60 px/s. Dashed lines are room borders (every 128 px)', 'border', 'smoothstep slide'],
    look: ['Look-ahead: lead 32 px in the direction of travel', 'Walk right 1.5 s → stop 1 s → walk left 1.5 s', '+32 px lead', 'lead returns to 0', 'flip: to −32 px'],
    poi: ['Points of interest: offset by distance', 'Settled camera offset for each distance to the point (pull 0.6)', 'distance to the point (px)', 'camera offset (px)', 'offset', 'weight 1', 'smoothstep', 'weight 0', 'peak 16.8 px (at 31 px)', '14.0 px (at 40 px)'],
    aim: ['Aim: why the screen offset is used', 'Camera offset a still mouse settles at (aim share 0.45)', "cursor's distance from screen centre (px)", 'camera offset (px)', 'correct (screen offset)', 'naive (world position)', '45 px', '82 px (0.45 ÷ 0.55)'],
    two: ['Two targets: distance and view size', 'View needed = distance between the two + 104 px padding, kept within 128–240 px', 'distance between the two (px)', 'view size (px)', 'clamped', 'unclamped', 'min 128 px', 'cap 240 px', '204 px (100 px apart)'],
  },
};

function figures(T) {
  const F = {};
  // 1. easing
  {
    const lerpPts = (fps) => { const pts = []; let g = 100; for (let t = 0; t <= 2.0001; t += 1 / fps) { pts.push([t, g]); g *= 0.9; } return pts; };
    const expPts = []; for (let t = 0; t <= 2.0001; t += 1 / 60) expPts.push([t, 100 * Math.exp(-2.6 * t)]);
    const hl = Math.LN2 / 2.6;
    F.ease = chart({
      title: T.ease[0], subtitle: T.ease[1], xLabel: T.time, yLabel: T.ease[5],
      x: { min: 0, max: 2, ticks: ticks(0, 2, 0.5) }, y: { min: 0, max: 100, ticks: ticks(0, 100, 25) },
      series: [
        { name: T.ease[2], color: C.s1, points: lerpPts(60) },
        { name: T.ease[3], color: C.s2, points: lerpPts(144) },
        { name: T.ease[4], color: C.s3, points: expPts, width: 3 },
      ],
      notes: [{ x: hl, y: 50, dot: true, color: C.s3, text: T.ease[6], dx: 10, dy: -6 }],
    });
  }
  // 2. smooth
  {
    const d = simulate('smooth', 240, (t, p) => { if (t > 0.25 && t <= 2.25) p.x += 60 * DT; });
    const at = d.find((s) => s.t >= 2.2);
    F.smooth = chart({
      title: T.smooth[0], subtitle: T.smooth[1], xLabel: T.time, yLabel: T.pos,
      x: { min: 0, max: 4, ticks: ticks(0, 4, 0.5) }, y: { min: -10, max: 130, ticks: [0, 40, 80, 120] },
      series: [
        { name: T.player, color: C.s1, points: d.map((s) => [s.t, s.px]) },
        { name: T.camera, color: C.s2, points: d.map((s) => [s.t, s.cx]) },
      ],
      vlines: [{ x: 2.25, label: T.smooth[3] }],
      notes: [{ x: at.t, y: (at.px + at.cx) / 2, bracket: [at.cx, at.px], text: T.smooth[2], dx: -10, dy: 4, anchor: 'end' }],
    });
  }
  // 3. dead zone
  {
    const d = simulate('deadzone', 210, (t, p) => {
      if (t < 1.6) p.x = 15 * Math.sin(t * 2 * Math.PI * 1.2);
      else if (t < 3.2) p.x += 60 * DT;
    });
    F.dead = chart({
      title: T.dead[0], subtitle: T.dead[1], xLabel: T.time, yLabel: T.pos,
      x: { min: 0, max: 3.5, ticks: ticks(0, 3.5, 0.5) }, y: { min: -30, max: 110, ticks: [-20, 0, 20, 40, 60, 80, 100] },
      bands: [{ path: d.map((s) => [s.t, s.cx - 22]), pathTop: d.map((s) => [s.t, s.cx + 22]), color: C.s3, opacity: 0.2 }],
      series: [
        { name: T.player, color: C.s1, points: d.map((s) => [s.t, s.px]) },
        { name: T.camera, color: C.s2, points: d.map((s) => [s.t, s.cx]) },
        { name: T.dead[2], color: C.s3, points: [], legend: true, width: 8 },
      ],
      notes: [
        { x: 0.8, y: 27, text: T.dead[3], dx: 0, dy: 0, anchor: 'middle' },
        { x: 2.7, y: 30, text: T.dead[4], dx: 0, dy: 0, anchor: 'middle' },
      ],
    });
  }
  // 4. rooms
  {
    const d = simulate('rooms', 330, (t, p) => { p.x += 60 * DT; }, (cam, p) => { p.x = 64; });
    F.rooms = chart({
      title: T.rooms[0], subtitle: T.rooms[1], xLabel: T.time, yLabel: T.pos,
      x: { min: 0, max: 5.5, ticks: ticks(0, 5.5, 0.5) }, y: { min: 40, max: 420, ticks: [64, 128, 192, 256, 320, 384] },
      hlines: [{ y: 128, label: T.rooms[2] }, { y: 256 }, { y: 384 }],
      series: [
        { name: T.player, color: C.s1, points: d.map((s) => [s.t, s.px]) },
        { name: T.camera, color: C.s2, points: d.map((s) => [s.t, s.cx]) },
      ],
      notes: [{ x: 1.4, y: 128, dot: false, text: T.rooms[3], dx: 8, dy: 30 }],
    });
  }
  // 5. look-ahead
  {
    const d = simulate('lookahead', 270, (t, p) => {
      if (t < 1.5) p.x += 60 * DT;
      else if (t >= 2.5 && t < 4.0) p.x -= 60 * DT;
    });
    const a = d.find((s) => s.t >= 1.45), b = d.find((s) => s.t >= 2.45), c = d.find((s) => s.t >= 3.95);
    F.look = chart({
      title: T.look[0], subtitle: T.look[1], xLabel: T.time, yLabel: T.pos,
      x: { min: 0, max: 4.5, ticks: ticks(0, 4.5, 0.5) }, y: { min: -50, max: 140, ticks: [-40, 0, 40, 80, 120] },
      series: [
        { name: T.player, color: C.s1, points: d.map((s) => [s.t, s.px]) },
        { name: T.camera, color: C.s2, points: d.map((s) => [s.t, s.cx]) },
      ],
      notes: [
        { x: a.t, y: a.cx, dot: true, color: C.s2, text: T.look[2], dx: -8, dy: -10, anchor: 'end' },
        { x: b.t, y: b.cx, dot: true, color: C.s2, text: T.look[3], dx: 0, dy: -14, anchor: 'middle' },
        { x: c.t, y: c.cx, dot: true, color: C.s2, text: T.look[4], dx: -10, dy: 4, anchor: 'end' },
      ],
    });
  }
  // 6. POI offset vs distance
  {
    const pts = []; for (let dd = 0; dd <= 80; dd += 0.5) pts.push([dd, dd * smoothstep(60, 24, dd) * 0.6]);
    F.poi = chart({
      title: T.poi[0], subtitle: T.poi[1], xLabel: T.poi[2], yLabel: T.poi[3],
      x: { min: 0, max: 80, ticks: ticks(0, 80, 10) }, y: { min: 0, max: 20, ticks: [0, 5, 10, 15, 20] },
      bands: [{ x0: 0, x1: 24, color: C.s3, opacity: 0.14, label: T.poi[5] }, { x0: 24, x1: 60, color: C.s3, opacity: 0.06, label: T.poi[6] }, { x0: 60, x1: 80, color: C.s3, opacity: 0, label: T.poi[7] }],
      series: [{ name: T.poi[4], color: C.s2, points: pts }],
      legend: false,
      notes: [
        { x: 31.5, y: 16.78, dot: true, color: C.s2, text: T.poi[8], dx: 8, dy: -8 },
        { x: 40, y: 13.99, dot: true, color: C.s2, text: T.poi[9], dx: 10, dy: 4 },
      ],
    });
  }
  // 7. aim: correct vs naive, measured by simulation
  {
    const settle = (naive, off) => {
      const d = simulate('aim', 600, () => ({ cursorOffset: { x: off, y: 0 } }), (cam) => { cam.params.aim.naive = naive; });
      return d[d.length - 1].cx;
    };
    const good = [], bad = [];
    for (let off = 0; off <= 120; off += 10) { good.push([off, settle(false, off)]); bad.push([off, settle(true, off)]); }
    F.aim = chart({
      title: T.aim[0], subtitle: T.aim[1], xLabel: T.aim[2], yLabel: T.aim[3],
      x: { min: 0, max: 120, ticks: ticks(0, 120, 20) }, y: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] },
      series: [
        { name: T.aim[4], color: C.s1, points: good },
        { name: T.aim[5], color: C.s2, points: bad, dash: '7 5' },
      ],
      notes: [
        { x: 100, y: settle(false, 100), dot: true, color: C.s1, text: T.aim[6], dx: 8, dy: 16 },
        { x: 100, y: settle(true, 100), dot: true, color: C.s2, text: T.aim[7], dx: -8, dy: -10, anchor: 'end' },
      ],
    });
  }
  // 8. two targets
  {
    const clamped = [], raw = [];
    for (let dd = 0; dd <= 250; dd += 2) { raw.push([dd, dd + 104]); clamped.push([dd, Math.max(128, Math.min(240, dd + 104))]); }
    F.two = chart({
      title: T.two[0], subtitle: T.two[1], xLabel: T.two[2], yLabel: T.two[3],
      x: { min: 0, max: 250, ticks: ticks(0, 250, 50) }, y: { min: 80, max: 360, ticks: [100, 150, 200, 250, 300, 350] },
      hlines: [{ y: 128, label: T.two[6] }, { y: 240, label: T.two[7] }],
      series: [
        { name: T.two[5], color: C.s1, points: raw, dash: '7 5' },
        { name: T.two[4], color: C.s2, points: clamped, width: 3 },
      ],
      notes: [{ x: 100, y: 204, dot: true, color: C.s2, text: T.two[8], dx: 10, dy: 16 }],
    });
  }
  return F;
}

for (const lang of ['ja', 'en']) {
  const dir = new URL(`${lang}/`, OUT);
  mkdirSync(dir, { recursive: true });
  const F = figures(L10N[lang]);
  for (const [name, svg] of Object.entries(F)) writeFileSync(new URL(`${name}.svg`, dir), svg);
  console.log(lang, Object.keys(F).join(', '));
}
