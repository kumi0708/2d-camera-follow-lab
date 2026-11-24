import { Camera, VIEW, DEFAULTS, MODES } from './camera.js';
import { buildWorld, createAmbient, POIS, ROOM, W, H } from './world.js';
import { drawHero, drawSlime, drawPoi, drawPoiGlow } from './sprites.js';

const STEP = 1 / 60;
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const SIZE = canvas.width;

const world = buildWorld();
const ambient = createAmbient(world);
const cam = new Camera();

const START = { x: 64, y: 76 };
const player = { x: START.x, y: START.y, dir: 0, moving: false, running: false, animT: 0 };
const buddy = { x: 104, y: 100, target: null, moving: false, t: 0, stuck: 0 };
const particles = [];
const state = { mode: 'smooth', debug: true, snap: true, autoBuddy: true, t: 0, tick: 0 };
const mouse = { x: SIZE / 2, y: SIZE / 2, inside: false };
const keys = new Set();
const graph = [];

const MODE_INFO = {
  locked: { name: 'ロック', icon: '⌖', desc: 'カメラ = プレイヤー位置。基準となる最もシンプルな追従。' },
  smooth: { name: 'スムーズ', icon: '〰', desc: 'cam += (p − cam)·(1 − e^(−rate·dt))。フレームレートに依存しない指数イージング。' },
  deadzone: { name: 'デッドゾーン', icon: '▢', desc: '箱の中では動かず、箱から出たら縁に沿って押される。小刻みな動きで画面が揺れない。' },
  rooms: { name: '部屋ごと', icon: '▦', desc: '128px の部屋単位で固定。境界を越えると smoothstep で 0.55 秒スライド。' },
  lookahead: { name: '先読み', icon: '➜', desc: '移動「方向」だけを見て前方へリード。歩きでも走りでも同じ距離。' },
  poi: { name: '注目点', icon: '✦', desc: '近くの見どころへ smoothstep の重みで引き寄せる。結晶・宝箱・焚き火などに近づいてみて。' },
  aim: { name: 'エイム', icon: '◎', desc: 'マウスの方向へずらす。ワールド座標ではなく画面オフセットを使うのが正解。' },
  two: { name: '2ターゲット', icon: '⇔', desc: '相棒スライムとの中点を追い、距離に応じてズームアウト。離れすぎたら切り離す。' },
};

const PARAM_SPECS = {
  locked: [],
  smooth: [['rate', '追従レート', 0, 12, 0.1, '/秒']],
  deadzone: [['halfX', '横の半幅', 0, 60, 1, 'px'], ['halfY', '縦の半幅', 0, 60, 1, 'px']],
  rooms: [['slideTime', 'スライド時間', 0, 2, 0.05, '秒']],
  lookahead: [['lead', 'リード距離', 0, 60, 1, 'px'], ['rate', 'リードのレート', 0, 12, 0.1, '/秒']],
  poi: [['pull', '引き寄せ', 0, 1, 0.05, ''], ['far', '影響開始距離', 24, 120, 1, 'px'], ['near', '最大になる距離', 0, 60, 1, 'px'], ['rate', '追従レート', 0, 12, 0.1, '/秒']],
  aim: [['share', 'エイム比率', 0, 1, 0.01, ''], ['rate', '追従レート', 0, 20, 0.5, '/秒'], ['naive', '素朴な実装（落とし穴を体験）', 'bool']],
  two: [['padding', '余白', 0, 200, 1, 'px'], ['minView', '最小ビュー', 64, 256, 1, 'px'], ['maxView', '最大ビュー', 128, 400, 1, 'px'], ['moveRate', '移動レート', 0, 12, 0.1, '/秒'], ['zoomRate', 'ズームレート', 0, 12, 0.1, '/秒'], ['cutoff', '切り離し距離', 100, 800, 10, 'px']],
};

// ---------------- UI ----------------
const $ = (s) => document.querySelector(s);
const modesEl = $('#modes');
MODES.forEach((m, i) => {
  const b = document.createElement('button');
  b.className = 'mode';
  b.dataset.mode = m;
  b.innerHTML = `<span class="key">${i + 1}</span><span class="icon">${MODE_INFO[m].icon}</span><span class="label">${MODE_INFO[m].name}</span>`;
  b.onclick = () => setMode(m);
  modesEl.appendChild(b);
});

function buildParams() {
  const el = $('#params');
  el.innerHTML = '';
  const specs = PARAM_SPECS[state.mode];
  if (!specs.length) el.innerHTML = '<p class="muted">調整パラメータはありません。</p>';
  for (const [key, label, min, max, step, unit] of specs) {
    const row = document.createElement('label');
    if (min === 'bool') {
      row.className = 'toggle';
      row.innerHTML = `<input type="checkbox" ${cam.params[state.mode][key] ? 'checked' : ''}><span>${label}</span>`;
      row.querySelector('input').onchange = (e) => { cam.params[state.mode][key] = e.target.checked; e.target.blur(); };
    } else {
      row.className = 'param';
      const v = cam.params[state.mode][key];
      row.innerHTML = `<div class="ptop"><span>${label}</span><b>${fmt(v, step)}${unit}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${v}">`;
      const out = row.querySelector('b');
      const input = row.querySelector('input');
      input.oninput = () => { cam.params[state.mode][key] = +input.value; out.textContent = fmt(+input.value, step) + unit; };
      input.onchange = () => input.blur();
    }
    el.appendChild(row);
  }
}
const fmt = (v, step) => (step < 1 ? v.toFixed(step < 0.1 ? 2 : step < 1 ? (String(step).split('.')[1] || '').length : 0) : String(v));

function setMode(m) {
  state.mode = m;
  cam.setMode(m, player);
  document.querySelectorAll('.mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  $('#mode-desc').textContent = MODE_INFO[m].desc;
  $('#hud-mode').innerHTML = `<span class="chip-icon">${MODE_INFO[m].icon}</span>${MODES.indexOf(m) + 1} · ${MODE_INFO[m].name}`;
  canvas.classList.toggle('aiming', m === 'aim');
  buildParams();
}

$('#reset-params').onclick = () => { cam.params[state.mode] = structuredClone(DEFAULTS[state.mode]); buildParams(); };
const bindToggle = (id, key) => {
  const el = $(id);
  el.checked = state[key];
  el.onchange = () => { state[key] = el.checked; el.blur(); };
  return el;
};
const debugToggle = bindToggle('#opt-debug', 'debug');
const snapToggle = bindToggle('#opt-snap', 'snap');
bindToggle('#opt-buddy', 'autoBuddy');

function resetAll() {
  Object.assign(player, { x: START.x, y: START.y, dir: 0 });
  Object.assign(buddy, { x: 104, y: 100, target: null });
  cam.reset(player);
  cam.setMode(state.mode, player);
  particles.length = 0;
}

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (/^Digit[1-8]$/.test(e.code)) setMode(MODES[+e.code.slice(5) - 1]);
  if (e.code === 'KeyR') resetAll();
  if (e.code === 'KeyG') { state.debug = !state.debug; debugToggle.checked = state.debug; }
  if (e.code === 'KeyP') { state.snap = !state.snap; snapToggle.checked = state.snap; }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) * SIZE) / r.width;
  mouse.y = ((e.clientY - r.top) * SIZE) / r.height;
  mouse.inside = true;
});
canvas.addEventListener('mouseleave', () => (mouse.inside = false));

// ---------------- simulation ----------------
const axis = (a, b) => (keys.has(a[0]) || keys.has(a[1]) ? 1 : 0) - (keys.has(b[0]) || keys.has(b[1]) ? 1 : 0);

function move(e, dx, dy) {
  const nx = Math.max(6, Math.min(W - 6, e.x + dx));
  if (!world.blocked(nx, e.y)) e.x = nx; else e.stuck = (e.stuck || 0) + 1;
  const ny = Math.max(14, Math.min(H - 3, e.y + dy));
  if (!world.blocked(e.x, ny)) e.y = ny; else e.stuck = (e.stuck || 0) + 1;
}

function spawn(x, y, o) {
  particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.6, size: 1, color: '#fff', glow: false, grav: 0, ...o });
}

function pickBuddyTarget() {
  for (let i = 0; i < 40; i++) {
    const far = Math.random() < 0.25;
    const x = far ? Math.random() * W : player.x + (Math.random() - 0.5) * 220;
    const y = far ? Math.random() * H : player.y + (Math.random() - 0.5) * 220;
    if (x > 8 && y > 16 && x < W - 8 && y < H - 4 && !world.blocked(x, y)) return { x, y };
  }
  return { x: player.x, y: player.y };
}

function tick(dt) {
  state.t += dt;
  state.tick++;

  // player
  let ix = axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
  let iy = axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const len = Math.hypot(ix, iy);
  player.moving = len > 0;
  player.running = run && player.moving;
  if (len) {
    ix /= len; iy /= len;
    const sp = run ? 150 : 60;
    move(player, ix * sp * dt, iy * sp * dt);
    player.dir = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 2 : 3) : iy < 0 ? 1 : 0;
    player.animT += dt;
    if (state.tick % (run ? 4 : 12) === 0) {
      const b = world.biomeAt(player.x, player.y);
      const col = b === 'S' ? '#ffffff' : b === 'D' ? '#e9d29a' : '#d8c8a8';
      spawn(player.x + (Math.random() - 0.5) * 4, player.y - 1, { vx: -ix * 10 + (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 6, max: 0.45, size: run ? 2 : 1, color: col });
    }
  }

  // buddy (IJKL, or auto-wander)
  const bx = axis(['KeyL', 'KeyL'], ['KeyJ', 'KeyJ']);
  const by = axis(['KeyK', 'KeyK'], ['KeyI', 'KeyI']);
  buddy.t += dt;
  if (bx || by) {
    const l = Math.hypot(bx, by);
    move(buddy, (bx / l) * 80 * dt, (by / l) * 80 * dt);
    buddy.moving = true;
    buddy.target = null;
  } else if (state.autoBuddy) {
    if (!buddy.target || Math.hypot(buddy.target.x - buddy.x, buddy.target.y - buddy.y) < 4 || buddy.stuck > 20) {
      buddy.target = pickBuddyTarget();
      buddy.stuck = 0;
      buddy.rest = 0.5 + Math.random() * 1.5;
    }
    if (buddy.rest > 0) { buddy.rest -= dt; buddy.moving = false; }
    else {
      const dx = buddy.target.x - buddy.x, dy = buddy.target.y - buddy.y, l = Math.hypot(dx, dy);
      move(buddy, (dx / l) * 55 * dt, (dy / l) * 55 * dt);
      buddy.moving = true;
    }
  } else buddy.moving = false;

  // camera — after everyone has moved this step
  const scale = SIZE / cam.view;
  const cursorOffset = mouse.inside ? { x: (mouse.x - SIZE / 2) / scale, y: (mouse.y - SIZE / 2) / scale } : { x: 0, y: 0 };
  cam.update(dt, { p: player, q: buddy, pois: POIS, cursorOffset });
  state.cursorOffset = cursorOffset;

  // POI effects
  for (const p of POIS) {
    if (p.kind === 'campfire' && Math.random() < 0.35)
      spawn(p.x + (Math.random() - 0.5) * 5, p.y - 8, { vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 14, max: 0.9 + Math.random() * 0.6, color: Math.random() < 0.5 ? '#ffb347' : '#ff6b3d', glow: true });
    if (p.kind === 'crystal' && Math.random() < 0.08)
      spawn(p.x + (Math.random() - 0.5) * 16, p.y - 6 - Math.random() * 16, { vy: -6, max: 1.2, color: p.hue === 'pink' ? '#ffd1f0' : '#d8fbff', glow: true });
    if (p.kind === 'portal' && Math.random() < 0.3) {
      const a = Math.random() * Math.PI * 2;
      spawn(p.x + Math.cos(a) * 10, p.y - 14 + Math.sin(a) * 16, { vx: -Math.cos(a) * 6, vy: -Math.sin(a) * 8, max: 1, color: '#d6b3ff', glow: true });
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= 0.98;
    if (q.life >= q.max) particles.splice(i, 1);
  }
  ambient.update(dt, state.t);

  graph.push({ x: cam.x - player.x, y: cam.y - player.y });
  if (graph.length > 300) graph.shift();
}

// ---------------- render ----------------
const vignette = (() => {
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(5,8,20,0.55)');
  return g;
})();

function render() {
  const t = state.t;
  const scale = SIZE / cam.view;
  const cx = state.snap ? Math.round(cam.x) : cam.x;
  const cy = state.snap ? Math.round(cam.y) : cam.y;
  const sn = (v) => (state.snap ? Math.round(v) : v);
  const toS = (wx, wy) => [(wx - cx) * scale + SIZE / 2, (wy - cy) * scale + SIZE / 2];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#070a12';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, SIZE / 2 - cx * scale, SIZE / 2 - cy * scale);

  // world edge
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(-4, -4, W + 8, H + 8);
  ctx.drawImage(world.canvas, 0, 0);
  ambient.drawGround(ctx, t);

  // y-sorted entities
  const ents = [
    ...POIS.map((p) => ({ y: p.y, draw: () => drawPoi(ctx, p, t) })),
    { y: player.y, draw: () => drawHero(ctx, sn(player.x), sn(player.y), player.dir, player.animT, player.moving, player.running) },
    { y: buddy.y, draw: () => drawSlime(ctx, sn(buddy.x), sn(buddy.y), buddy.t, buddy.moving, state.mode === 'two' && !cam.secondActive) },
  ];
  ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

  for (const q of particles) {
    if (q.glow) continue;
    ctx.globalAlpha = 1 - q.life / q.max;
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ambient.drawAir(ctx, t);
  ambient.drawClouds(ctx);

  // light
  ctx.globalCompositeOperation = 'lighter';
  for (const p of POIS) drawPoiGlow(ctx, p, t);
  ambient.drawGlow(ctx, t);
  for (const q of particles) {
    if (!q.glow) continue;
    const a = 1 - q.life / q.max;
    ctx.fillStyle = q.color;
    ctx.globalAlpha = a;
    ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    ctx.globalAlpha = a * 0.25;
    ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // POI labels
  ctx.font = '600 12px "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const p of POIS) {
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d > 70) continue;
    const a = Math.min(1, (70 - d) / 20);
    const [sx, sy] = toS(p.x, p.y - 34);
    ctx.globalAlpha = a;
    const w = ctx.measureText(p.name).width + 16;
    ctx.fillStyle = 'rgba(10,14,28,0.75)';
    roundRect(sx - w / 2, sy - 11, w, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText(p.name, sx, sy + 3);
  }
  ctx.globalAlpha = 1;

  if (state.debug) drawDebug(toS, scale);
  if (state.mode === 'aim' && mouse.inside) drawReticle(mouse.x, mouse.y);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawReticle(x, y) {
  ctx.strokeStyle = '#ff9f1c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  for (const [a, b, c, d] of [[x - 16, y, x - 5, y], [x + 5, y, x + 16, y], [x, y - 16, x, y - 5], [x, y + 5, x, y + 16]]) { ctx.moveTo(a, b); ctx.lineTo(c, d); }
  ctx.stroke();
  ctx.fillStyle = '#ff9f1c';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function drawDebug(toS, scale) {
  const m = state.mode;
  const k = cam.params[m];
  ctx.lineWidth = 1.5;
  const [px, py] = toS(player.x, player.y);
  const [ccx, ccy] = toS(cam.x, cam.y);
  const [gx, gy] = toS(cam.goal.x, cam.goal.y);
  const dashed = (on) => ctx.setLineDash(on ? [6, 5] : []);

  if (m === 'deadzone') {
    ctx.strokeStyle = 'rgba(76,201,240,0.95)';
    ctx.fillStyle = 'rgba(76,201,240,0.08)';
    dashed(true);
    ctx.strokeRect(ccx - k.halfX * scale, ccy - k.halfY * scale, k.halfX * 2 * scale, k.halfY * 2 * scale);
    ctx.fillRect(ccx - k.halfX * scale, ccy - k.halfY * scale, k.halfX * 2 * scale, k.halfY * 2 * scale);
    dashed(false);
  }
  if (m === 'rooms') {
    ctx.strokeStyle = 'rgba(167,139,250,0.7)';
    dashed(true);
    ctx.beginPath();
    for (let x = 0; x <= W; x += ROOM) { const [sx] = toS(x, 0); ctx.moveTo(sx, 0); ctx.lineTo(sx, SIZE); }
    for (let y = 0; y <= H; y += ROOM) { const [, sy] = toS(0, y); ctx.moveTo(0, sy); ctx.lineTo(SIZE, sy); }
    ctx.stroke();
    dashed(false);
  }
  if (m === 'lookahead') {
    arrow(px, py - 8 * scale, px + cam.lead.x * scale, py - 8 * scale + cam.lead.y * scale, '#f72585');
  }
  if (m === 'poi') {
    for (const p of POIS) {
      const [sx, sy] = toS(p.x, p.y);
      ctx.strokeStyle = 'rgba(128,237,153,0.35)'; dashed(true);
      ctx.beginPath(); ctx.arc(sx, sy, k.far * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(128,237,153,0.8)'; dashed(false);
      ctx.beginPath(); ctx.arc(sx, sy, k.near * scale, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (m === 'aim' && mouse.inside) {
    ctx.strokeStyle = 'rgba(255,159,28,0.5)'; dashed(true);
    ctx.beginPath(); ctx.moveTo(px, py - 8 * scale); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); dashed(false);
  }
  if (m === 'two') {
    const [bx, by] = toS(buddy.x, buddy.y);
    ctx.strokeStyle = cam.secondActive ? 'rgba(76,201,240,0.8)' : 'rgba(255,90,90,0.8)';
    dashed(!cam.secondActive);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
    dashed(false);
    if (!cam.secondActive) {
      ctx.fillStyle = '#ff6b6b'; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('離れすぎ — 切り離し中', (px + bx) / 2, (py + by) / 2 - 8);
    }
  }

  // goal + camera centre
  if (m !== 'locked') {
    ctx.strokeStyle = 'rgba(255,209,102,0.6)'; dashed(true);
    ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(gx, gy); ctx.stroke(); dashed(false);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(gx, gy, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.moveTo(ccx - 10, ccy); ctx.lineTo(ccx + 10, ccy); ctx.moveTo(ccx, ccy - 10); ctx.lineTo(ccx, ccy + 10);
  ctx.stroke();
}

function arrow(x0, y0, x1, y1, col) {
  const l = Math.hypot(x1 - x0, y1 - y0);
  if (l < 3) return;
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * 8, y1 - Math.sin(a) * 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.5) * 12, y1 - Math.sin(a - 0.5) * 12);
  ctx.lineTo(x1 - Math.cos(a + 0.5) * 12, y1 - Math.sin(a + 0.5) * 12);
  ctx.fill();
  ctx.lineWidth = 1.5;
}

// minimap
const mini = $('#minimap');
const mg = mini.getContext('2d');
const MS = mini.width / W;
function drawMinimap() {
  mg.imageSmoothingEnabled = true;
  mg.drawImage(world.canvas, 0, 0, mini.width, mini.height);
  mg.fillStyle = 'rgba(5,8,20,0.25)';
  mg.fillRect(0, 0, mini.width, mini.height);
  const v = cam.view;
  mg.strokeStyle = '#ffffff'; mg.lineWidth = 1.5;
  mg.strokeRect((cam.x - v / 2) * MS, (cam.y - v / 2) * MS, v * MS, v * MS);
  for (const p of POIS) { mg.fillStyle = '#ffd166'; mg.fillRect(p.x * MS - 1.5, p.y * MS - 1.5, 3, 3); }
  mg.fillStyle = '#57d6b0'; mg.beginPath(); mg.arc(buddy.x * MS, buddy.y * MS, 2.5, 0, 7); mg.fill();
  mg.fillStyle = '#ff5d5d'; mg.beginPath(); mg.arc(player.x * MS, player.y * MS, 3, 0, 7); mg.fill();
}

// offset graph
const gc = $('#graph');
const gg = gc.getContext('2d');
function drawGraph() {
  const w = gc.width, h = gc.height, R = 64;
  gg.clearRect(0, 0, w, h);
  gg.strokeStyle = 'rgba(255,255,255,0.08)';
  gg.beginPath();
  for (const v of [-32, 0, 32]) { const y = h / 2 - (v / R) * (h / 2); gg.moveTo(0, y); gg.lineTo(w, y); }
  gg.stroke();
  for (const [key, col] of [['x', '#4cc9f0'], ['y', '#f72585']]) {
    gg.strokeStyle = col; gg.lineWidth = 2; gg.beginPath();
    graph.forEach((s, i) => {
      const x = (i / 299) * w, y = h / 2 - (Math.max(-R, Math.min(R, s[key])) / R) * (h / 2 - 2);
      i ? gg.lineTo(x, y) : gg.moveTo(x, y);
    });
    gg.stroke();
  }
}

// HUD
const hudStats = $('#hud-stats');
let fps = 60, last = performance.now(), acc = 0, hudT = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05;
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }
  render();
  drawMinimap();
  drawGraph();
  hudT += dt;
  if (hudT > 0.1) {
    hudT = 0;
    const off = Math.hypot(cam.x - player.x, cam.y - player.y);
    hudStats.innerHTML =
      `<span>cam <b>${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}</b></span>` +
      `<span>ずれ <b>${off.toFixed(1)}px</b></span>` +
      `<span>view <b>${cam.view.toFixed(0)}px</b> ×${cam.zoom.toFixed(2)}</span>` +
      `<span><b>${fps.toFixed(0)}</b> fps</span>`;
  }
  requestAnimationFrame(frame);
}

// handle for poking at the lab from the devtools console
window.lab = { cam, player, buddy, state, setMode, teleport: (x, y) => { player.x = x; player.y = y; cam.reset(player); cam.setMode(state.mode, player); } };

cam.reset(player);
setMode(state.mode);
requestAnimationFrame(frame);
