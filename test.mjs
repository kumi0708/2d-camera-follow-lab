// Checks the article's numbers. Run: node test.mjs
import { Camera, DEFAULTS, MODES } from './camera.js';

const DT = 1 / 60;
let failed = 0;
const check = (name, ok, got) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${got !== undefined ? `  (got ${got})` : ''}`);
  if (!ok) failed++;
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;

function cam(mode, p = { x: 0, y: 0 }) {
  const c = new Camera();
  c.reset(p);
  c.setMode(mode, p);
  return c;
}

// Smooth: a 100 px jump is within 1 px after ~107 ticks.
{
  const c = cam('smooth');
  const p = { x: 100, y: 0 };
  let ticks = 0;
  while (Math.abs(p.x - c.x) >= 1) { c.update(DT, { p }); ticks++; }
  check('smooth: 100px jump within 1px', ticks === 107, `${ticks} ticks`);
}

// Rate 0 snaps instead of freezing.
{
  const c = cam('smooth');
  c.params.smooth.rate = 0;
  c.update(DT, { p: { x: 50, y: 20 } });
  check('smooth: rate 0 snaps', c.x === 50 && c.y === 20);
}

// Dead zone: holds inside the box, sits on the edge outside it.
{
  const c = cam('deadzone');
  c.update(DT, { p: { x: 20, y: 10 } });
  const held = c.x === 0 && c.y === 0;
  c.update(DT, { p: { x: 50, y: -30 } });
  check('deadzone: holds inside, rides edge outside', held && c.x === 28 && c.y === -12, `${c.x},${c.y}`);
}

// Rooms: 128 px slide over 33 ticks; no movement inside a room.
{
  const c = cam('rooms', { x: 64, y: 64 });
  c.update(DT, { p: { x: 64, y: 64 } });
  const start = c.x;
  c.update(DT, { p: { x: 100, y: 64 } });
  const still = c.x === start;
  let ticks = 0;
  do { c.update(DT, { p: { x: 140, y: 64 } }); ticks++; } while (c.x < 192 && ticks < 100);
  check('rooms: no movement inside a room', still);
  check('rooms: 128px slide takes 33 ticks', ticks === 33 && c.x - start === 128, `${ticks} ticks`);
}

// Look-ahead: 30.9 px after 1 s walking (any speed), ~1 px after 1 s at rest.
{
  for (const speed of [60, 150]) {
    const c = cam('lookahead');
    const p = { x: 0, y: 0 };
    for (let i = 0; i < 60; i++) { p.x += speed * DT; c.update(DT, { p }); }
    check(`lookahead: lead after 1s at ${speed}px/s`, near(c.x - p.x, 30.9, 0.05), (c.x - p.x).toFixed(2));
    for (let i = 0; i < 60; i++) c.update(DT, { p });
    check('lookahead: lead after 1s at rest', near(c.x - p.x, 1.0, 0.1), (c.x - p.x).toFixed(2));
  }
}

// POI: settled offsets 0 @60, 14.0 @40, 14.4 @24.
for (const [d, want] of [[60, 0], [40, 14.0], [24, 14.4]]) {
  const c = cam('poi');
  for (let i = 0; i < 600; i++) c.update(DT, { p: { x: 0, y: 0 }, pois: [{ x: d, y: 0 }] });
  check(`poi: settled offset at ${d}px`, near(c.x, want, 0.05), c.x.toFixed(2));
}

// Aim: fixed version gives 45 px for a cursor 100 px away; naive settles at ~0.82.
{
  const c = cam('aim');
  for (let i = 0; i < 600; i++) c.update(DT, { p: { x: 0, y: 0 }, cursorOffset: { x: 100, y: 0 } });
  check('aim: 100px cursor -> 45px', near(c.x, 45, 0.01), c.x.toFixed(2));
  const n = cam('aim');
  n.params.aim.naive = true;
  for (let i = 0; i < 600; i++) n.update(DT, { p: { x: 0, y: 0 }, cursorOffset: { x: 100, y: 0 } });
  check('aim (naive): settles at ~0.82 of screen offset (overshoots 45px)', near(n.x / 100, 0.818, 0.002), (n.x / 100).toFixed(3));
}

// Two targets: 100 apart -> 204 px view, camera halfway; 200 apart -> stops at 240.
for (const [d, want] of [[100, 204], [200, 240]]) {
  const c = cam('two');
  for (let i = 0; i < 600; i++) c.update(DT, { p: { x: 0, y: 0 }, q: { x: d, y: 0 } });
  check(`two: ${d}px apart -> view ${want}`, near(c.view, want, 0.01) && near(c.x, d / 2, 0.01), `${c.view.toFixed(1)}, cam ${c.x.toFixed(1)}`);
}

// Zero distances/shares reproduce the locked camera.
{
  const zero = {
    smooth: { rate: 0 }, deadzone: { halfX: 0, halfY: 0 }, lookahead: { lead: 0 },
    poi: { pull: 0, rate: 0 }, aim: { share: 0, rate: 0 }, rooms: null, two: null, locked: {},
  };
  for (const mode of MODES) {
    if (!zero[mode]) continue;
    const c = cam(mode);
    Object.assign(c.params[mode], zero[mode]);
    const p = { x: 0, y: 0 };
    let maxErr = 0;
    for (let i = 0; i < 300; i++) {
      p.x += Math.sin(i * 0.1) * 3; p.y += Math.cos(i * 0.07) * 2;
      c.update(DT, { p, pois: [{ x: 10, y: 10 }], cursorOffset: { x: 40, y: -20 } });
      maxErr = Math.max(maxErr, Math.abs(c.x - p.x), Math.abs(c.y - p.y));
    }
    check(`zero params match locked: ${mode}`, maxErr < 1e-9, maxErr);
  }
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
