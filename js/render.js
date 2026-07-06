// ============================================================
// Canvas renderer: starfield, hex board, procedural ships, FX.
// ============================================================

import { TRAITS, UNIT_BY_ID } from './data.js';
import { COLS, ROWS, ROW_H, cellXY } from './sim.js';

const SQ3 = Math.sqrt(3);

// ---------- ship silhouettes (nose points +x, unit radius ~1) ----------
const P = {
  dart: [[1, 0], [-0.6, 0.55], [-0.35, 0], [-0.6, -0.55]],
  spike: [[1.05, 0], [-0.15, 0.35], [-0.8, 0.7], [-0.55, 0], [-0.8, -0.7], [-0.15, -0.35]],
  needle: [[1.15, 0], [-0.25, 0.22], [-0.85, 0.5], [-0.65, 0], [-0.85, -0.5], [-0.25, -0.22]],
  brick: [[0.75, 0.45], [0.85, 0], [0.75, -0.45], [-0.7, -0.62], [-0.85, 0], [-0.7, 0.62]],
  ray: [[1, 0], [0.1, 0.72], [-0.7, 0.38], [-0.42, 0], [-0.7, -0.38], [0.1, -0.72]],
  wing: [[0.85, 0], [0.05, 0.82], [-0.55, 0.32], [-0.4, 0], [-0.55, -0.32], [0.05, -0.82]],
  crab: [[0.55, 0.3], [0.9, 0.72], [0.25, 0.55], [-0.6, 0.62], [-0.82, 0], [-0.6, -0.62], [0.25, -0.55], [0.9, -0.72], [0.55, -0.3], [0.72, 0]],
  cross: [[1, 0.16], [0.16, 0.16], [0.16, 0.72], [-0.16, 0.72], [-0.16, 0.16], [-1, 0.16], [-1, -0.16], [-0.16, -0.16], [-0.16, -0.72], [0.16, -0.72], [0.16, -0.16], [1, -0.16]],
  hawk: [[1, 0], [0.2, 0.32], [-0.15, 0.88], [-0.6, 0.38], [-0.8, 0], [-0.6, -0.38], [-0.15, -0.88], [0.2, -0.32]],
  bulk: [[0.95, 0.32], [0.95, -0.32], [0.3, -0.58], [-0.85, -0.72], [-0.95, 0], [-0.85, 0.72], [0.3, 0.58]],
  arrow: [[1.15, 0], [0.15, 0.5], [-0.8, 0.88], [-0.5, 0], [-0.8, -0.88], [0.15, -0.5]],
  mothership: [[1.05, 0], [0.5, 0.42], [-0.2, 0.55], [-0.85, 0.88], [-1, 0.3], [-1, -0.3], [-0.85, -0.88], [-0.2, -0.55], [0.5, -0.42]],
  drone: [[0.8, 0], [-0.5, 0.6], [-0.25, 0], [-0.5, -0.6]],
  husk: [[0.85, 0.12], [0.3, 0.52], [-0.5, 0.58], [-0.78, 0.1], [-0.62, -0.42], [0.1, -0.58]],
  twin: null, orb: null, saucer: null, disc: null, turret: null, // special-cased
};

function tracePoly(ctx, pts, s) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * s, pts[i][1] * s);
  ctx.closePath();
}

export function drawShip(ctx, def, star, size, opts = {}) {
  const { facing = -Math.PI / 2, moving = false, t = 0, alpha = 1, teamGlow = null } = opts;
  const prim = def.traits && def.traits.length ? TRAITS[def.traits[0]].color : (def.shape === 'husk' || def.id?.startsWith('creep') ? '#9a7550' : '#9aa5b5');
  const acc = def.traits && def.traits.length > 1 ? TRAITS[def.traits[1]].color : '#dfe6f0';
  const s = size * (1 + (star - 1) * 0.14);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(opts.x || 0, opts.y || 0);

  if (teamGlow) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = teamGlow;
    ctx.fill();
  }

  ctx.rotate(facing);

  // thruster
  if (moving) {
    const fl = s * (0.7 + 0.35 * Math.sin(t * 40));
    const g = ctx.createLinearGradient(-s, 0, -s - fl, 0);
    g.addColorStop(0, 'rgba(140,200,255,0.9)');
    g.addColorStop(1, 'rgba(140,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.22);
    ctx.lineTo(-s * 0.55 - fl, 0);
    ctx.lineTo(-s * 0.55, -s * 0.22);
    ctx.closePath();
    ctx.fill();
  }

  const shape = def.shape;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.strokeStyle = 'rgba(8,12,24,0.85)';

  const fillBody = (path) => {
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, shade(prim, 30));
    g.addColorStop(1, shade(prim, -25));
    ctx.fillStyle = g;
    path();
    ctx.fill();
    ctx.stroke();
  };

  if (shape === 'orb') {
    fillBody(() => { ctx.beginPath(); ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2); });
    ctx.fillStyle = acc;
    ctx.beginPath(); ctx.arc(s * 0.25, 0, s * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = acc; ctx.lineWidth = s * 0.09;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.9, -0.6 + t, 0.6 + t); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.9, Math.PI - 0.6 + t, Math.PI + 0.6 + t); ctx.stroke();
  } else if (shape === 'saucer' || shape === 'disc') {
    fillBody(() => { ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2); });
    ctx.fillStyle = shade(acc, 10);
    ctx.beginPath(); ctx.ellipse(s * 0.15, 0, s * 0.42, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    if (shape === 'saucer') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.45, s * 0.08, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (shape === 'twin') {
    for (const off of [-0.34, 0.34]) {
      fillBody(() => tracePoly(ctx, [[0.95, off], [-0.55, off + 0.32], [-0.35, off], [-0.55, off - 0.32]], s));
    }
    ctx.fillStyle = acc;
    ctx.fillRect(-s * 0.3, -s * 0.36, s * 0.42, s * 0.72);
  } else if (shape === 'turret') {
    fillBody(() => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const m = i ? 'lineTo' : 'moveTo'; ctx[m](Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7); } ctx.closePath(); });
    ctx.fillStyle = acc;
    ctx.fillRect(0, -s * 0.12, s * 1.1, s * 0.24);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill();
  } else {
    const pts = P[shape] || P.dart;
    fillBody(() => tracePoly(ctx, pts, s));
    // accent stripe
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(-s * 0.25, s * 0.18);
    ctx.lineTo(-s * 0.12, 0);
    ctx.lineTo(-s * 0.25, -s * 0.18);
    ctx.closePath();
    ctx.fill();
    // cockpit
    ctx.fillStyle = 'rgba(220,245,255,0.9)';
    ctx.beginPath(); ctx.arc(s * 0.32, 0, s * 0.14, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

const STAR_COLORS = [null, '#b8c4d4', '#8ad0ff', '#ffd166'];

// ============================================================
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = [];
    this.stars = [];
    this.t = 0;
    this.shake = 0;
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.6 + 0.4, tw: Math.random() * 6 });
    }
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = h;

    const benchPad = 10;
    let hexW = Math.min(w / 7.75, (h - benchPad - 26) / (7.35 + 1.3));
    this.hexW = hexW;
    this.hexS = hexW / SQ3; // hex corner radius
    this.hexH = this.hexS * 2;
    this.vs = this.hexH * 0.75;
    this.K = this.vs / ROW_H; // sim-y -> px
    const fieldW = hexW * 7.5;
    this.fieldX = (w - fieldW) / 2 + hexW * 0.0;
    this.fieldH = ROWS * ROW_H * this.K + 6;
    this.benchSlot = Math.min(hexW * 1.06, (w - 16) / 9);
    const totalH = this.fieldH + 8 + this.benchSlot * 1.02;
    this.fieldY = Math.max(14, (h - totalH) / 2);
    this.benchY = this.fieldY + this.fieldH + 8;
    this.benchX = (w - this.benchSlot * 9) / 2;
  }

  simToPx(x, y) {
    return { x: this.fieldX + x * this.hexW, y: this.fieldY + y * this.K };
  }
  hexCenter(r, c) {
    const p = cellXY(r, c);
    return this.simToPx(p.x, p.y);
  }
  // inverse: px -> nearest cell
  pxToCell(px, py) {
    let best = null, bd = 1e9;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = this.hexCenter(r, c);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < bd) { bd = d; best = { r, c }; }
    }
    return bd < this.hexW * 0.62 ? best : null;
  }
  pxToBench(px, py) {
    if (py < this.benchY - 4 || py > this.benchY + this.benchSlot + 8) return -1;
    const i = Math.floor((px - this.benchX) / this.benchSlot);
    return i >= 0 && i < 9 ? i : -1;
  }
  benchCenter(i) {
    return { x: this.benchX + (i + 0.5) * this.benchSlot, y: this.benchY + this.benchSlot * 0.52 };
  }

  hexPath(cx, cy, s) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const m = i ? 'lineTo' : 'moveTo';
      ctx[m](cx + Math.cos(a) * s, cy + Math.sin(a) * s);
    }
    ctx.closePath();
  }

  // ---------- FX ----------
  pushEvents(events, dmgNumbers = true) {
    for (const e of events) {
      switch (e.type) {
        case 'dmg':
          if (dmgNumbers && (e.amt >= 30 || e.crit)) {
            const p = this.simToPx(e.x, e.y);
            this.fx.push({ k: 'float', x: p.x + (Math.random() - 0.5) * 14, y: p.y - 10, vy: -34, t: 0.9, txt: Math.round(e.amt), col: e.crit ? '#ffd166' : (e.kind === 'magic' ? '#c792ea' : '#ffffff'), big: e.crit });
          }
          break;
        case 'heal': {
          const p = this.simToPx(e.x, e.y);
          this.fx.push({ k: 'float', x: p.x, y: p.y - 8, vy: -28, t: 0.9, txt: '+' + e.amt, col: '#7dd87d' });
          break;
        }
        case 'death': {
          const p = this.simToPx(e.x, e.y);
          this.shake = Math.min(8, this.shake + 3);
          for (let i = 0; i < 16; i++) {
            const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 110;
            this.fx.push({ k: 'spark', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.5 + Math.random() * 0.4, col: ['#ffd166', '#ff8c5c', '#fff'][i % 3], r: 1.5 + Math.random() * 2.5 });
          }
          this.fx.push({ k: 'ring', x: p.x, y: p.y, t: 0.35, max: this.hexW * 0.9, col: 'rgba(255,180,100,0.8)' });
          break;
        }
        case 'boom': {
          const p = this.simToPx(e.x, e.y);
          this.shake = Math.min(10, this.shake + 4);
          this.fx.push({ k: 'ring', x: p.x, y: p.y, t: 0.4, max: e.r * this.hexW, col: 'rgba(255,140,80,0.9)' });
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
            this.fx.push({ k: 'spark', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.4, col: '#ff9e5c', r: 2 });
          }
          break;
        }
        case 'beam': {
          const a = this.simToPx(e.x1, e.y1), b = this.simToPx(e.x2, e.y2);
          this.fx.push({ k: 'beam', x1: a.x, y1: a.y, x2: b.x, y2: b.y, t: 0.3, col: '#c06fe8' });
          break;
        }
        case 'zap': {
          const a = this.simToPx(e.x1, e.y1), b = this.simToPx(e.x2, e.y2);
          this.fx.push({ k: 'zap', x1: a.x, y1: a.y, x2: b.x, y2: b.y, t: 0.22, col: e.color || '#8ad0ff' });
          break;
        }
        case 'shieldfx': {
          const p = this.simToPx(e.x, e.y);
          this.fx.push({ k: 'ring', x: p.x, y: p.y, t: 0.35, max: this.hexW * 0.6, col: 'rgba(140,220,255,0.9)' });
          break;
        }
        case 'stunfx': {
          const p = this.simToPx(e.x, e.y);
          this.fx.push({ k: 'float', x: p.x, y: p.y - 16, vy: -14, t: 0.8, txt: '✦stun✦', col: '#ffd166' });
          break;
        }
        case 'blinkfx': {
          const a = this.simToPx(e.x1, e.y1), b = this.simToPx(e.x2, e.y2);
          this.fx.push({ k: 'ring', x: a.x, y: a.y, t: 0.3, max: this.hexW * 0.5, col: 'rgba(192,111,232,0.9)' });
          this.fx.push({ k: 'ring', x: b.x, y: b.y, t: 0.3, max: this.hexW * 0.5, col: 'rgba(192,111,232,0.9)' });
          break;
        }
        case 'cast': {
          const p = this.simToPx(e.x, e.y);
          this.fx.push({ k: 'ring', x: p.x, y: p.y, t: 0.3, max: this.hexW * 0.55, col: 'rgba(255,255,255,0.7)' });
          break;
        }
        case 'spawn': {
          const p = this.simToPx(e.x, e.y);
          this.fx.push({ k: 'ring', x: p.x, y: p.y, t: 0.3, max: this.hexW * 0.4, col: 'rgba(166,232,69,0.8)' });
          break;
        }
      }
    }
  }

  stepFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t -= dt;
      if (f.k === 'float') { f.y += f.vy * dt; }
      if (f.k === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; }
      if (f.t <= 0) this.fx.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 24);
  }

  drawFx() {
    const ctx = this.ctx;
    for (const f of this.fx) {
      ctx.save();
      if (f.k === 'float') {
        ctx.globalAlpha = Math.min(1, f.t * 2.2);
        ctx.font = `${f.big ? 'bold 15px' : 'bold 12px'} system-ui`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,18,0.8)';
        ctx.strokeText(f.txt, f.x, f.y);
        ctx.fillStyle = f.col;
        ctx.fillText(f.txt, f.x, f.y);
      } else if (f.k === 'spark') {
        ctx.globalAlpha = Math.min(1, f.t * 2.5);
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'ring') {
        const p = 1 - f.t / 0.4;
        ctx.globalAlpha = Math.max(0, f.t * 2.5);
        ctx.strokeStyle = f.col; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, f.max * Math.min(1, p + 0.2)), 0, Math.PI * 2); ctx.stroke();
      } else if (f.k === 'beam') {
        ctx.globalAlpha = Math.min(1, f.t * 4);
        ctx.strokeStyle = f.col; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      } else if (f.k === 'zap') {
        ctx.globalAlpha = Math.min(1, f.t * 5);
        ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        const segs = 4;
        for (let s = 1; s <= segs; s++) {
          const tt = s / segs;
          const mx = f.x1 + (f.x2 - f.x1) * tt + (s < segs ? (Math.random() - 0.5) * 10 : 0);
          const my = f.y1 + (f.y2 - f.y1) * tt + (s < segs ? (Math.random() - 0.5) * 10 : 0);
          ctx.lineTo(mx, my);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------- main draws ----------
  drawBackground() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#0b1026');
    g.addColorStop(0.55, '#0a0e20');
    g.addColorStop(1, '#0e1428');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    for (const s of this.stars) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(this.t * 0.8 + s.tw));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = '#cdd8ee';
      ctx.fillRect(s.x * this.W, (s.y * this.H + this.t * 3) % this.H, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  drawGrid(planning, hoverCell) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.hexCenter(r, c);
        const mine = r >= 4;
        this.hexPath(p.x, p.y, this.hexS * 0.94);
        if (planning) {
          ctx.fillStyle = mine ? 'rgba(80,130,220,0.10)' : 'rgba(255,90,80,0.045)';
          ctx.strokeStyle = mine ? 'rgba(110,160,255,0.35)' : 'rgba(255,110,100,0.10)';
        } else {
          ctx.fillStyle = 'rgba(90,120,200,0.05)';
          ctx.strokeStyle = 'rgba(120,150,230,0.13)';
        }
        if (hoverCell && hoverCell.r === r && hoverCell.c === c && mine) {
          ctx.fillStyle = 'rgba(120,220,180,0.30)';
          ctx.strokeStyle = 'rgba(140,255,200,0.9)';
        }
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    if (planning) {
      const mid = this.simToPx(COLS / 2, 3.5 * ROW_H + 0.44);
      ctx.fillStyle = 'rgba(150,170,210,0.35)';
      ctx.font = '600 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('— ENEMY TERRITORY —', this.W / 2, this.fieldY + 8);
    }
  }

  drawBench(bench, dragUnit) {
    const ctx = this.ctx;
    for (let i = 0; i < 9; i++) {
      const x = this.benchX + i * this.benchSlot, y = this.benchY;
      ctx.beginPath();
      const rr = 7;
      ctx.roundRect(x + 2, y, this.benchSlot - 4, this.benchSlot * 1.02, rr);
      ctx.fillStyle = 'rgba(70,100,170,0.13)';
      ctx.strokeStyle = 'rgba(110,150,230,0.3)';
      ctx.lineWidth = 1;
      ctx.fill(); ctx.stroke();
      const u = bench[i];
      if (u && u !== dragUnit) {
        const c = this.benchCenter(i);
        this.drawOwnedUnit(u, c.x, c.y, this.benchSlot * 0.34);
      }
    }
  }

  drawOwnedUnit(u, x, y, size, alpha = 1) {
    const def = UNIT_BY_ID[u.defId];
    drawShip(this.ctx, def, u.star, size, { x, y, t: this.t, alpha });
    this.drawStars(u.star, x, y - size * 1.35, alpha);
    this.drawItemPips(u.items, x, y + size * 1.15);
  }

  drawStars(star, x, y, alpha = 1) {
    if (star < 1) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${star === 3 ? 'bold ' : ''}9px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = STAR_COLORS[star];
    if (star === 3) {
      ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 6;
    }
    ctx.fillText('★'.repeat(star), x, y);
    ctx.restore();
  }

  drawItemPips(items, x, y) {
    if (!items || !items.length) return;
    const ctx = this.ctx;
    const w = 7;
    let sx = x - (items.length - 1) * w / 2;
    for (const it of items) {
      ctx.beginPath();
      ctx.arc(sx, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = itemColor(it);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      sx += w;
    }
  }

  drawBar(x, y, w, h, pct, col, bg = 'rgba(10,14,28,0.85)') {
    const ctx = this.ctx;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  drawSimUnit(u) {
    const ctx = this.ctx;
    const p = this.simToPx(u.x, u.y);
    const size = this.hexW * (0.30 + Math.min(0.13, (u.def.cost || 1) * 0.022));
    const glow = u.team === 0 ? 'rgba(90,180,255,0.12)' : 'rgba(255,90,80,0.12)';
    drawShip(ctx, u.def, u.star, size, { x: p.x, y: p.y, facing: u.facing, moving: u.moving, t: this.t, teamGlow: glow });

    // bars
    const bw = this.hexW * 0.72, bh = 3.5;
    const bx = p.x - bw / 2, by = p.y - size - 10;
    this.drawBar(bx, by, bw, bh, u.hp / u.maxHp, u.team === 0 ? '#5cd68a' : '#ff6b5c');
    if (u.shield > 0) {
      const sp = Math.min(1, u.shield / u.maxHp);
      ctx.fillStyle = 'rgba(200,235,255,0.95)';
      ctx.fillRect(bx, by - 2, bw * sp, 2);
    }
    if (u.manaMax < 999 && u.def.ability) {
      this.drawBar(bx, by + bh + 1, bw, 2.4, u.mana / u.manaMax, '#6fa8ff');
    }
    this.drawStars(u.star, p.x, by - 4);
    if (u.stunT > 0) {
      ctx.font = '10px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('✦', p.x + Math.sin(this.t * 10) * 6, p.y - size - 20);
    }
  }

  drawProjectiles(projs) {
    const ctx = this.ctx;
    for (const pr of projs) {
      const p = this.simToPx(pr.x, pr.y);
      const col = pr.team === 0 ? '#8ad0ff' : '#ff9e8a';
      ctx.save();
      const ang = Math.atan2(pr.ly - pr.y, pr.lx - pr.x);
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function itemColor(id) {
  const { COMPONENTS, ITEM_BY_ID } = itemColorCache;
  return (ITEM_BY_ID[id] && ITEM_BY_ID[id].color) || '#fff';
}
import { COMPONENTS as _C, ITEM_BY_ID as _I } from './data.js';
const itemColorCache = { COMPONENTS: _C, ITEM_BY_ID: _I };
