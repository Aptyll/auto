// ============================================================
// Combat simulation — continuous movement over a hex field.
// Coordinates are in "hex units": x = col + (row%2)*0.5, y = row*0.87
// Field: 7 cols x 8 rows. Team 0 = bottom (rows 4-7), team 1 = top (rows 0-3).
// Pure logic: no DOM. Renderer reads unit positions + event stream.
// ============================================================

import { TRAIT_FX, TRAITS, MINIONS, STAR_MULT, UNIT_BY_ID, applyItem } from './data.js';

export const COLS = 7, ROWS = 8;
export const ROW_H = 0.87;
export const TICK = 1 / 30;
export const MAX_TIME = 75;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cellXY(r, c) {
  return { x: c + (r % 2 ? 0.5 : 0) + 0.5, y: r * ROW_H + 0.5 };
}

let UIDC = 1;

class SimUnit {
  constructor(spec, sim) {
    // spec: {def, star, items[], r, c, team, hpMult?, adMult?, srcUid?}
    this.uid = UIDC++;
    this.def = spec.def;
    this.star = spec.star || 1;
    this.team = spec.team;
    this.items = spec.items || [];
    this.srcUid = spec.srcUid || null; // link back to owned unit (player damage calc)
    this.summoned = !!spec.summoned;

    const p = cellXY(spec.r, spec.c);
    this.x = p.x; this.y = p.y;
    this.homeX = p.x; this.homeY = p.y;

    const sm = STAR_MULT[this.star];
    const st = {
      adMult: 1, asMult: 1, hpFlat: 0, ap: 1, ls: 0, armor: this.def.armor || 0,
      manaMult: 1, crit: 0, rangeB: 0, addTrait: null, startMana: 0, shieldPct: 0,
    };
    for (const it of this.items) applyItem(st, it);
    this.itemStats = st;

    this.maxHp = Math.round((this.def.hp * sm * (spec.hpMult || 1)) + st.hpFlat);
    this.hp = this.maxHp;
    this.baseAd = this.def.ad * sm * (spec.adMult || 1);
    this.baseAs = this.def.as;
    this.adMult = st.adMult;
    this.asMult = st.asMult;
    this.ap = st.ap;
    this.ls = st.ls;
    this.armor = st.armor;
    this.crit = st.crit;
    this.critMult = 2;
    this.manaMult = st.manaMult;
    this.range = this.def.range;
    this.speed = this.def.speed || 1.7;
    this.manaMax = this.def.mana || 999;
    this.mana = 0;
    this.shield = 0;
    this.stunT = 0;
    this.atkCd = 0.2 + (sim ? sim.rng() * 0.4 : 0);
    this.buffs = []; // {t, as?, ad?, ls?, crit?}
    this.alive = true;
    this.target = null;
    this.facing = this.team === 0 ? -Math.PI / 2 : Math.PI / 2;
    this.moving = false;

    this.traits = [...(this.def.traits || [])];
    if (st.addTrait && !this.traits.includes(st.addTrait)) this.traits.push(st.addTrait);
  }

  get ad() {
    let m = this.adMult;
    for (const b of this.buffs) if (b.ad) m += b.ad / 100;
    return this.baseAd * m;
  }
  get as() {
    let m = this.asMult;
    for (const b of this.buffs) if (b.as) m += b.as / 100;
    return Math.min(4, this.baseAs * m);
  }
  get lifesteal() {
    let v = this.ls;
    for (const b of this.buffs) if (b.ls) v += b.ls;
    return v;
  }
  get critCh() {
    let v = this.crit;
    for (const b of this.buffs) if (b.crit) v += b.crit;
    return v;
  }
}

export class Sim {
  // teamA/teamB: arrays of spawn specs (team set by caller: 0 bottom, 1 top)
  constructor(teamA, teamB, { seed = 1, traitsA = null, traitsB = null } = {}) {
    this.rng = mulberry32(seed);
    this.t = 0;
    this.done = false;
    this.winner = -1; // 0, 1, or 2 = draw
    this.units = [];
    this.projectiles = [];
    this.events = [];
    for (const s of teamA) this.units.push(new SimUnit(s, this));
    for (const s of teamB) this.units.push(new SimUnit(s, this));
    this.activeTraits = [traitsA || {}, traitsB || {}];
    this.applyStartTraits(0);
    this.applyStartTraits(1);
  }

  applyStartTraits(team) {
    const act = this.activeTraits[team];
    const mine = () => this.units.filter(u => u.team === team && u.alive);
    for (const [key, tier] of Object.entries(act)) {
      if (!tier) continue;
      const fx = TRAIT_FX[key];
      if (key === 'vanguard') {
        for (const u of mine()) if (u.traits.includes('vanguard')) u.armor += fx.armor[tier];
      } else if (key === 'raider') {
        for (const u of mine()) if (u.traits.includes('raider')) { u.ls += fx.ls[tier]; u.asMult += fx.as[tier]; }
      } else if (key === 'sniper') {
        for (const u of mine()) if (u.traits.includes('sniper')) { u.range += fx.range[tier]; u.crit += fx.crit[tier]; }
      } else if (key === 'void') {
        for (const u of mine()) if (u.traits.includes('void')) { u.ap += fx.ap[tier]; u.mana += fx.mana[tier]; }
      } else if (key === 'engineer') {
        for (const u of mine()) { u.shield += Math.round(u.maxHp * fx.shield[tier]); }
      } else if (key === 'swarm') {
        for (const u of mine()) if (u.traits.includes('swarm')) u.asMult += fx.as[tier];
        const n = fx.drones[tier];
        const anchor = mine()[0];
        if (anchor) {
          const stage = Math.max(1, this.stageHint || 1);
          for (let i = 0; i < n; i++) {
            this.spawnMinion('drone', team, anchor.x + (this.rng() - 0.5) * 2, anchor.y + (this.rng() - 0.5),
              { hp: 300 + stage * 90, ad: 30 + stage * 9 });
          }
        }
      }
    }
  }

  spawnMinion(kind, team, x, y, { hp, ad }) {
    const base = MINIONS[kind];
    const u = new SimUnit({ def: base, star: 1, team, r: 0, c: 0, summoned: true }, this);
    u.x = Math.max(0.4, Math.min(COLS + 0.1, x));
    u.y = Math.max(0.4, Math.min((ROWS - 1) * ROW_H + 0.6, y));
    u.maxHp = Math.round(hp); u.hp = u.maxHp;
    u.baseAd = ad;
    this.units.push(u);
    this.events.push({ type: 'spawn', x: u.x, y: u.y, team });
    return u;
  }

  alive(team) { return this.units.filter(u => u.alive && u.team === team); }

  nearestEnemy(u) {
    let best = null, bd = 1e9;
    for (const e of this.units) {
      if (!e.alive || e.team === u.team) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  lowestEnemy(u) {
    let best = null, bh = 1e9;
    for (const e of this.units) {
      if (!e.alive || e.team === u.team) continue;
      if (e.hp < bh) { bh = e.hp; best = e; }
    }
    return best;
  }

  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  tick() {
    if (this.done) return;
    const dt = TICK;
    this.t += dt;
    this.events.length = 0;

    // sudden-death pressure
    const decay = this.t > 45 ? (this.t - 45) * 0.004 : 0;

    for (const u of this.units) {
      if (!u.alive) continue;
      if (decay) this.damage(null, u, u.maxHp * decay * dt, 'true', { silent: true });
      if (!u.alive) continue;

      // buffs expire
      for (let i = u.buffs.length - 1; i >= 0; i--) { u.buffs[i].t -= dt; if (u.buffs[i].t <= 0) u.buffs.splice(i, 1); }
      if (u.stunT > 0) { u.stunT -= dt; continue; }

      if (!u.target || !u.target.alive) u.target = this.nearestEnemy(u);
      const tgt = u.target;
      if (!tgt) continue;

      const d = this.dist(u, tgt);
      const rangePx = u.range * 1.05 + 0.35;
      u.moving = false;

      if (d > rangePx && u.speed > 0) {
        // move toward target with simple separation
        let dx = (tgt.x - u.x) / d, dy = (tgt.y - u.y) / d;
        for (const o of this.units) {
          if (o === u || !o.alive) continue;
          const od = Math.hypot(o.x - u.x, o.y - u.y);
          if (od < 0.62 && od > 0.0001) {
            dx += (u.x - o.x) / od * 0.7;
            dy += (u.y - o.y) / od * 0.7;
          }
        }
        const m = Math.hypot(dx, dy) || 1;
        u.x += dx / m * u.speed * dt;
        u.y += dy / m * u.speed * dt;
        u.x = Math.max(0.35, Math.min(COLS + 0.15, u.x));
        u.y = Math.max(0.35, Math.min((ROWS - 1) * ROW_H + 0.65, u.y));
        u.facing = Math.atan2(dy / m, dx / m);
        u.moving = true;
        u.atkCd = Math.max(u.atkCd, 0.12);
      } else {
        u.facing = Math.atan2(tgt.y - u.y, tgt.x - u.x);
        u.atkCd -= dt;
        if (u.atkCd <= 0) {
          u.atkCd = 1 / u.as;
          this.attack(u, tgt);
        }
      }

      // cast when full
      if (u.mana >= u.manaMax && u.def.ability && u.stunT <= 0) {
        u.mana = 0;
        this.cast(u);
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const tx = p.tgt.alive ? p.tgt.x : p.lx, ty = p.tgt.alive ? p.tgt.y : p.ly;
      p.lx = tx; p.ly = ty;
      const d = Math.hypot(tx - p.x, ty - p.y);
      const step = p.speed * dt;
      if (d <= step) {
        this.projectiles.splice(i, 1);
        if (p.tgt.alive) this.projHit(p);
      } else {
        p.x += (tx - p.x) / d * step;
        p.y += (ty - p.y) / d * step;
      }
    }

    // end conditions
    const a0 = this.alive(0).length, a1 = this.alive(1).length;
    if (a0 === 0 || a1 === 0) {
      this.done = true;
      this.winner = a0 === 0 && a1 === 0 ? 2 : (a1 === 0 ? 0 : 1);
    } else if (this.t >= MAX_TIME) {
      this.done = true;
      const hpSum = t => this.alive(t).reduce((s, u) => s + u.hp / u.maxHp, 0);
      const h0 = hpSum(0), h1 = hpSum(1);
      this.winner = Math.abs(h0 - h1) < 0.01 ? 2 : (h0 > h1 ? 0 : 1);
    }
  }

  attack(u, tgt) {
    const crit = this.rng() < u.critCh;
    let dmg = u.ad * (crit ? u.critMult : 1);
    if (u.range <= 1) {
      this.events.push({ type: 'melee', from: u.uid, x: tgt.x, y: tgt.y });
      this.damage(u, tgt, dmg, 'phys', { crit });
    } else {
      this.projectiles.push({
        x: u.x, y: u.y, lx: tgt.x, ly: tgt.y, tgt, src: u, dmg, crit,
        speed: 9, kind: 'shot', color: null, team: u.team,
      });
      this.events.push({ type: 'shoot', from: u.uid });
    }
    u.mana = Math.min(u.manaMax, u.mana + 10 * (1 + (u.manaMult - 1)));
  }

  projHit(p) {
    this.damage(p.src, p.tgt, p.dmg, 'phys', { crit: p.crit });
  }

  damage(src, tgt, amount, kind, { crit = false, silent = false } = {}) {
    if (!tgt.alive) return 0;
    let amt = amount;
    if (kind === 'phys') amt *= 1 - Math.min(80, tgt.armor) / 100;
    else if (kind === 'magic') amt *= 1 - Math.min(80, tgt.armor * 0.4) / 100;
    amt = Math.max(1, Math.round(amt));

    let absorbed = 0;
    if (tgt.shield > 0) {
      absorbed = Math.min(tgt.shield, amt);
      tgt.shield -= absorbed;
    }
    const hpLoss = amt - absorbed;
    tgt.hp -= hpLoss;

    // energy from taking hits
    if (tgt.manaMax < 999) tgt.mana = Math.min(tgt.manaMax, tgt.mana + Math.min(12, amt / tgt.maxHp * 60));

    if (src && src.alive && kind === 'phys' && src.lifesteal > 0) {
      src.hp = Math.min(src.maxHp, src.hp + amt * src.lifesteal);
    }
    if (!silent) this.events.push({ type: 'dmg', x: tgt.x, y: tgt.y, amt, kind, crit });

    if (tgt.hp <= 0) {
      tgt.alive = false;
      tgt.hp = 0;
      this.events.push({ type: 'death', x: tgt.x, y: tgt.y, uid: tgt.uid, shape: tgt.def.shape });
    }
    return amt;
  }

  heal(u, amt) {
    u.hp = Math.min(u.maxHp, u.hp + amt);
    this.events.push({ type: 'heal', x: u.x, y: u.y, amt: Math.round(amt) });
  }

  cast(u) {
    const s = u.star - 1;
    const val = v => Array.isArray(v) ? v[s] : v;
    this.events.push({ type: 'cast', uid: u.uid, x: u.x, y: u.y, name: u.def.ability.name });

    for (const e of u.def.ability.effects) {
      const dmg = e.dmg ? val(e.dmg) * u.ap : 0;
      switch (e.type) {
        case 'nuke': {
          const t = u.target && u.target.alive ? u.target : this.nearestEnemy(u);
          if (t) {
            this.events.push({ type: 'zap', x1: u.x, y1: u.y, x2: t.x, y2: t.y, color: '#c06fe8' });
            this.damage(u, t, dmg, 'magic');
          }
          break;
        }
        case 'aoe': case 'aoeSelf': {
          const cx = e.type === 'aoeSelf' ? u : (u.target && u.target.alive ? u.target : this.nearestEnemy(u));
          if (cx) {
            this.events.push({ type: 'boom', x: cx.x, y: cx.y, r: e.r });
            for (const en of this.units) {
              if (!en.alive || en.team === u.team) continue;
              if (Math.hypot(en.x - cx.x, en.y - cx.y) <= e.r) this.damage(u, en, dmg, 'magic');
            }
          }
          break;
        }
        case 'line': {
          const t = u.target && u.target.alive ? u.target : this.nearestEnemy(u);
          if (t) {
            const ang = Math.atan2(t.y - u.y, t.x - u.x);
            const ex = u.x + Math.cos(ang) * e.len, ey = u.y + Math.sin(ang) * e.len;
            this.events.push({ type: 'beam', x1: u.x, y1: u.y, x2: ex, y2: ey });
            for (const en of this.units) {
              if (!en.alive || en.team === u.team) continue;
              // distance from point to segment
              const t2 = Math.max(0, Math.min(1, ((en.x - u.x) * (ex - u.x) + (en.y - u.y) * (ey - u.y)) / (e.len * e.len)));
              const px = u.x + (ex - u.x) * t2, py = u.y + (ey - u.y) * t2;
              if (Math.hypot(en.x - px, en.y - py) <= e.w) this.damage(u, en, dmg, 'magic');
            }
          }
          break;
        }
        case 'chain': {
          let t = u.target && u.target.alive ? u.target : this.nearestEnemy(u);
          const hit = new Set();
          let d = dmg;
          let from = u;
          for (let i = 0; i < val(e.n) && t; i++) {
            hit.add(t.uid);
            this.events.push({ type: 'zap', x1: from.x, y1: from.y, x2: t.x, y2: t.y, color: '#8ad0ff' });
            this.damage(u, t, d, 'magic');
            d *= e.decay;
            from = t;
            let nb = null, nd = 1e9;
            for (const en of this.units) {
              if (!en.alive || en.team === u.team || hit.has(en.uid)) continue;
              const dd = Math.hypot(en.x - from.x, en.y - from.y);
              if (dd < nd && dd < 3.2) { nd = dd; nb = en; }
            }
            t = nb;
          }
          break;
        }
        case 'heal': {
          let best = null, br = 2;
          for (const al of this.alive(u.team)) {
            const r = al.hp / al.maxHp;
            if (r < br) { br = r; best = al; }
          }
          if (best) {
            this.events.push({ type: 'zap', x1: u.x, y1: u.y, x2: best.x, y2: best.y, color: '#7dd87d' });
            this.heal(best, val(e.amt) * u.ap);
          }
          break;
        }
        case 'healSelf': this.heal(u, val(e.amt) * u.ap); break;
        case 'shieldSelf':
          u.shield += Math.round(val(e.amt) * u.ap);
          this.events.push({ type: 'shieldfx', x: u.x, y: u.y });
          break;
        case 'shieldTeam': {
          const allies = this.alive(u.team).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, e.n);
          for (const al of allies) {
            al.shield += Math.round(val(e.amt) * u.ap);
            this.events.push({ type: 'shieldfx', x: al.x, y: al.y });
          }
          break;
        }
        case 'buff':
          u.buffs.push({ t: e.dur, as: e.as ? val(e.as) : 0, ad: e.ad ? val(e.ad) : 0, ls: e.ls || 0, crit: e.crit || 0 });
          this.events.push({ type: 'bufffx', uid: u.uid });
          break;
        case 'rally': {
          for (const al of this.alive(u.team)) {
            if (al.traits.includes(e.trait)) al.buffs.push({ t: e.dur, as: val(e.as) });
          }
          break;
        }
        case 'summon': {
          const n = val(e.count);
          for (let i = 0; i < n; i++) {
            this.spawnMinion(e.kind, u.team,
              u.x + (this.rng() - 0.5) * 1.6, u.y + (this.rng() - 0.5) * 1.2,
              { hp: val(e.hp) * (u.ap > 1 ? (1 + (u.ap - 1) * 0.5) : 1), ad: val(e.ad) });
          }
          break;
        }
        case 'stun': {
          const t = u.target && u.target.alive ? u.target : this.nearestEnemy(u);
          if (t) {
            t.stunT = Math.max(t.stunT, e.dur);
            this.events.push({ type: 'stunfx', x: t.x, y: t.y });
            this.damage(u, t, dmg, 'magic');
          }
          break;
        }
        case 'execute': {
          const t = this.lowestEnemy(u);
          if (t) {
            const mult = t.hp / t.maxHp < e.below ? e.mult : 1;
            this.events.push({ type: 'zap', x1: u.x, y1: u.y, x2: t.x, y2: t.y, color: '#f0b83d' });
            this.damage(u, t, dmg * mult, 'magic', { crit: mult > 1 });
          }
          break;
        }
        case 'blink': {
          const t = this.lowestEnemy(u);
          if (t) {
            this.events.push({ type: 'blinkfx', x1: u.x, y1: u.y, x2: t.x, y2: t.y });
            const ang = this.rng() * Math.PI * 2;
            u.x = Math.max(0.35, Math.min(COLS + 0.15, t.x + Math.cos(ang) * 0.7));
            u.y = Math.max(0.35, Math.min((ROWS - 1) * ROW_H + 0.65, t.y + Math.sin(ang) * 0.7));
            u.target = t;
            if (e.shield) u.shield += Math.round(val(e.shield));
            this.damage(u, t, dmg, 'magic');
          }
          break;
        }
      }
    }
  }

  // Run whole fight instantly (background bot battles)
  runToEnd() {
    let guard = Math.ceil(MAX_TIME / TICK) + 10;
    while (!this.done && guard-- > 0) this.tick();
    if (!this.done) { this.done = true; this.winner = 2; }
    return this.result();
  }

  result() {
    const surv = t => this.alive(t).filter(u => !u.summoned);
    return { winner: this.winner, survivors0: surv(0), survivors1: surv(1), time: this.t };
  }
}

// Helper: player-board (rows 4-7) spec -> mirrored top-side spec rows 0-3
export function mirrorSpec(spec) {
  return { ...spec, r: 7 - spec.r, c: COLS - 1 - spec.c };
}
