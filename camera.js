// 2D camera follow modes — "every mode is a goal plus an ease".
// Pixel values assume a 128x128 px view; scale them with your view size.

export const VIEW = 128;

export const DEFAULTS = {
  locked: {},
  smooth: { rate: 2.6 },
  deadzone: { halfX: 22, halfY: 18 },
  rooms: { roomW: 128, roomH: 128, slideTime: 0.55 },
  lookahead: { lead: 32, rate: 3.4 },
  poi: { far: 60, near: 24, pull: 0.6, rate: 3.5 },
  aim: { share: 0.45, rate: 8, naive: false },
  two: { padding: 104, minView: 128, maxView: 240, moveRate: 4.5, zoomRate: 3.5, cutoff: 400 },
};

export const MODES = Object.keys(DEFAULTS);

/** Frame-rate independent ease factor. rate <= 0 snaps instead of freezing. */
export const ease = (rate, dt) => (rate <= 0 ? 1 : 1 - Math.exp(-rate * dt));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** smoothstep(e0, e1, x): 0 at e0, 1 at e1 (works with e0 > e1). */
export const smoothstep = (e0, e1, x) => {
  if (e0 === e1) return x >= e1 ? 1 : 0;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export class Camera {
  constructor() {
    this.mode = 'locked';
    this.params = structuredClone(DEFAULTS);
    this.reset({ x: 0, y: 0 });
  }

  /** Snap to the player and clear per-mode state. */
  reset(p) {
    this.x = p.x;
    this.y = p.y;
    this.view = VIEW;
    this.goal = { x: p.x, y: p.y };
    this.clearModeState(p);
  }

  clearModeState(p) {
    this.lead = { x: 0, y: 0 };
    this.lastP = { x: p.x, y: p.y };
    this.roomFrom = null;
    this.roomTo = null;
    this.roomT = 0;
    this.secondActive = false;
  }

  /** Switch mode without a jump: the camera keeps its position and eases from there. */
  setMode(mode, p) {
    this.mode = mode;
    this.clearModeState(p);
    if (mode !== 'two') this.view = VIEW;
  }

  get zoom() {
    return VIEW / this.view;
  }

  /**
   * Run after the player has moved in this step.
   * input: { p, q, pois, cursorOffset } — cursorOffset is the cursor's offset
   * from the screen centre, in world px.
   */
  update(dt, input) {
    const { p } = input;
    const k = this.params[this.mode];

    switch (this.mode) {
      case 'locked':
        this.goal = { x: p.x, y: p.y };
        this.x = p.x;
        this.y = p.y;
        break;

      case 'smooth':
        this.goal = { x: p.x, y: p.y };
        this.easeTo(this.goal, k.rate, dt);
        break;

      case 'deadzone':
        this.x = clamp(this.x, p.x - k.halfX, p.x + k.halfX);
        this.y = clamp(this.y, p.y - k.halfY, p.y + k.halfY);
        this.goal = { x: this.x, y: this.y };
        break;

      case 'rooms': {
        const c = {
          x: Math.floor(p.x / k.roomW) * k.roomW + k.roomW / 2,
          y: Math.floor(p.y / k.roomH) * k.roomH + k.roomH / 2,
        };
        if (!this.roomTo) {
          // First tick: snap to the starting room.
          this.roomFrom = c;
          this.roomTo = c;
          this.roomT = k.slideTime;
        } else if (c.x !== this.roomTo.x || c.y !== this.roomTo.y) {
          this.roomFrom = { x: this.x, y: this.y };
          this.roomTo = c;
          this.roomT = 0;
        }
        this.roomT += dt;
        const s = k.slideTime <= 0 ? 1 : smoothstep(0, 1, Math.min(this.roomT / k.slideTime, 1));
        this.x = this.roomFrom.x + (this.roomTo.x - this.roomFrom.x) * s;
        this.y = this.roomFrom.y + (this.roomTo.y - this.roomFrom.y) * s;
        this.goal = { ...this.roomTo };
        break;
      }

      case 'lookahead': {
        const mx = p.x - this.lastP.x;
        const my = p.y - this.lastP.y;
        this.lastP = { x: p.x, y: p.y };
        const len = Math.hypot(mx, my);
        // Direction only: walking and running get the same lead.
        const g = len > 1e-6 ? { x: (mx / len) * k.lead, y: (my / len) * k.lead } : { x: 0, y: 0 };
        const f = ease(k.rate, dt);
        this.lead.x += (g.x - this.lead.x) * f;
        this.lead.y += (g.y - this.lead.y) * f;
        this.goal = { x: p.x + g.x, y: p.y + g.y };
        this.x = p.x + this.lead.x;
        this.y = p.y + this.lead.y;
        break;
      }

      case 'poi': {
        const g = { x: p.x, y: p.y };
        for (const o of input.pois || []) {
          const w = smoothstep(k.far, k.near, Math.hypot(o.x - p.x, o.y - p.y));
          g.x += (o.x - p.x) * w * k.pull;
          g.y += (o.y - p.y) * w * k.pull;
        }
        this.goal = g;
        this.easeTo(g, k.rate, dt);
        break;
      }

      case 'aim': {
        const off = input.cursorOffset || { x: 0, y: 0 };
        let g;
        if (k.naive) {
          // Pitfall: the cursor's world position moves with the camera,
          // so a still mouse settles short (~0.82 of the screen offset).
          const cw = { x: this.x + off.x, y: this.y + off.y };
          g = { x: p.x + (cw.x - p.x) * k.share, y: p.y + (cw.y - p.y) * k.share };
        } else {
          // Fix: aim from the cursor's screen offset, not its world position.
          g = { x: p.x + off.x * k.share, y: p.y + off.y * k.share };
        }
        this.goal = g;
        this.easeTo(g, k.rate, dt);
        break;
      }

      case 'two': {
        const q = input.q;
        const dist = q ? Math.hypot(q.x - p.x, q.y - p.y) : Infinity;
        // Drop a second target that wanders too far, or the view grows without limit.
        this.secondActive = dist <= k.cutoff;
        let target, need;
        if (this.secondActive) {
          target = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
          need = clamp(Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) + k.padding, k.minView, k.maxView);
        } else {
          target = { x: p.x, y: p.y };
          need = k.minView;
        }
        this.view += (need - this.view) * ease(k.zoomRate, dt);
        this.goal = target;
        this.easeTo(target, k.moveRate, dt);
        break;
      }
    }
  }

  easeTo(g, rate, dt) {
    const f = ease(rate, dt);
    this.x += (g.x - this.x) * f;
    this.y += (g.y - this.y) * f;
  }
}
