// ============================================================
// Game state: players, shared pool, economy, rounds, pairings.
// Pure logic — no DOM. ui.js drives it, bot.js plays the AI seats.
// ============================================================

import {
  UNITS, UNIT_BY_ID, CREEPS, CREEP_ROUNDS, isCreepRound, COMPONENTS, COMBINED,
  combineKey, POOL_COPIES, SHOP_ODDS, XP_TO_NEXT, MAX_LEVEL, REROLL_COST,
  XP_COST, XP_PER_BUY, XP_PER_ROUND, BENCH_SIZE, SHOP_SIZE, START_HP, START_GOLD,
  MAX_INTEREST, BOT_NAMES, TRAITS, sellValue,
} from './data.js';
import { Sim, mirrorSpec, COLS } from './sim.js';
import { botPlan, makePersonality } from './bot.js';

let OUID = 1;

export function makeOwnedUnit(defId) {
  return { uid: OUID++, defId, star: 1, items: [] };
}

export class Game {
  constructor() {
    this.round = 0;
    this.phase = 'planning'; // planning | combat | over
    this.pool = {};
    for (const u of UNITS) this.pool[u.id] = POOL_COPIES[u.cost];

    this.players = [];
    const human = this.makePlayer('You', true);
    this.players.push(human);
    for (const n of BOT_NAMES) this.players.push(this.makePlayer(n, false));
    this.human = human;

    for (const p of this.players) {
      if (!p.isHuman) p.personality = makePersonality();
      // everyone starts with a free 1-cost on the board
      const ones = UNITS.filter(u => u.cost === 1);
      const pick = ones[Math.floor(Math.random() * ones.length)];
      if (this.pool[pick.id] > 0) this.pool[pick.id]--;
      const unit = makeOwnedUnit(pick.id);
      p.board.set('5,3', unit);
    }

    this.placements = []; // eliminated players, first-eliminated first
    this.lastResults = [];
    this.startRound();
  }

  makePlayer(name, isHuman) {
    return {
      id: this.players ? this.players.length : 0,
      name, isHuman,
      hp: START_HP, gold: START_GOLD, level: 2, xp: 0,
      streak: 0, // + wins, - losses
      board: new Map(), // 'r,c' (r 4-7) -> owned unit
      bench: new Array(BENCH_SIZE).fill(null),
      items: [], // component/combined ids not yet equipped
      shop: new Array(SHOP_SIZE).fill(null),
      shopLock: false,
      alive: true,
      lastResult: null, // 'win' | 'loss' | 'draw'
      dmgDealtLast: 0,
    };
  }

  // ---------- pool / shop ----------
  rollTier(level) {
    const odds = SHOP_ODDS[Math.min(level, 9)];
    let r = Math.random() * 100;
    for (let t = 0; t < 5; t++) { r -= odds[t]; if (r < 0) return t + 1; }
    return 1;
  }

  drawUnit(level) {
    for (let tries = 0; tries < 24; tries++) {
      const tier = this.rollTier(level);
      const cands = UNITS.filter(u => u.cost === tier && this.pool[u.id] > 0);
      if (!cands.length) continue;
      const total = cands.reduce((s, u) => s + this.pool[u.id], 0);
      let r = Math.random() * total;
      for (const u of cands) { r -= this.pool[u.id]; if (r < 0) { this.pool[u.id]--; return u.id; } }
    }
    return null;
  }

  returnToPool(defId, copies = 1) { if (this.pool[defId] !== undefined) this.pool[defId] += copies; }

  rollShop(p) {
    for (const s of p.shop) if (s) this.returnToPool(s);
    for (let i = 0; i < SHOP_SIZE; i++) p.shop[i] = this.drawUnit(p.level);
  }

  reroll(p) {
    if (p.gold < REROLL_COST) return false;
    p.gold -= REROLL_COST;
    this.rollShop(p);
    return true;
  }

  // ---------- units ----------
  benchSpace(p) { return p.bench.findIndex(b => b === null); }

  buyUnit(p, idx) {
    const defId = p.shop[idx];
    if (!defId) return false;
    const def = UNIT_BY_ID[defId];
    if (p.gold < def.cost) return false;
    // allow buy with full bench only if it completes a combine
    const slot = this.benchSpace(p);
    if (slot === -1 && !this.wouldCombine(p, defId)) return false;
    p.gold -= def.cost;
    p.shop[idx] = null;
    const unit = makeOwnedUnit(defId);
    if (slot !== -1) p.bench[slot] = unit; else p.benchOverflow = unit;
    this.tryCombine(p, defId);
    if (p.benchOverflow) { // combine didn't consume it (shouldn't happen) — refund
      this.returnToPool(defId); p.gold += def.cost; p.benchOverflow = null;
    }
    return true;
  }

  wouldCombine(p, defId) {
    const count = this.allUnits(p).filter(u => u.defId === defId && u.star === 1).length;
    return count >= 2;
  }

  allUnits(p) {
    const arr = [...p.board.values(), ...p.bench.filter(Boolean)];
    if (p.benchOverflow) arr.push(p.benchOverflow);
    return arr;
  }

  tryCombine(p, defId) {
    for (let star = 1; star <= 2; star++) {
      const copies = this.allUnits(p).filter(u => u.defId === defId && u.star === star);
      if (copies.length >= 3) {
        // keep the copy that's on board if any, absorb items (max 3)
        let keeper = copies.find(u => this.findBoardKey(p, u)) || copies[0];
        const rest = copies.filter(u => u !== keeper).slice(0, 2);
        for (const r of rest) {
          for (const it of r.items) if (keeper.items.length < 3) keeper.items.push(it);
          this.removeOwned(p, r);
        }
        keeper.star = star + 1;
        (p.upgradeLog || (p.upgradeLog = [])).push({ defId, star: star + 1, unit: keeper });
        this.tryCombine(p, defId); // chain 2* -> 3*
        return;
      }
    }
  }

  // Defensive sweep: merge any def that somehow has 3+ copies lying around
  combineAll(p) {
    const ids = new Set(this.allUnits(p).map(u => u.defId));
    for (const id of ids) this.tryCombine(p, id);
  }

  findBoardKey(p, unit) {
    for (const [k, v] of p.board) if (v === unit) return k;
    return null;
  }

  removeOwned(p, unit) {
    const k = this.findBoardKey(p, unit);
    if (k) { p.board.delete(k); return; }
    const bi = p.bench.indexOf(unit);
    if (bi !== -1) { p.bench[bi] = null; return; }
    if (p.benchOverflow === unit) p.benchOverflow = null;
  }

  sellUnit(p, unit) {
    const v = sellValue(unit);
    p.gold += v;
    for (const it of unit.items) p.items.push(it); // items return to inventory
    this.returnToPool(unit.defId, Math.pow(3, unit.star - 1));
    this.removeOwned(p, unit);
    return v;
  }

  buyXP(p) {
    if (p.gold < XP_COST || p.level >= MAX_LEVEL) return false;
    p.gold -= XP_COST;
    this.addXP(p, XP_PER_BUY);
    return true;
  }

  addXP(p, amt) {
    if (p.level >= MAX_LEVEL) return;
    p.xp += amt;
    while (p.level < MAX_LEVEL && p.xp >= XP_TO_NEXT[p.level]) {
      p.xp -= XP_TO_NEXT[p.level];
      p.level++;
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
  }

  boardCount(p) { return p.board.size; }
  boardCap(p) { return p.level; }

  placeUnit(p, unit, r, c) {
    if (r < 4 || r > 7 || c < 0 || c > 6) return false;
    const key = `${r},${c}`;
    const occupant = p.board.get(key) || null;
    const fromKey = this.findBoardKey(p, unit);
    const fromBench = p.bench.indexOf(unit);
    if (!fromKey && fromBench === -1) return false;
    if (!fromKey && !occupant && this.boardCount(p) >= this.boardCap(p)) return false;

    if (fromKey) p.board.delete(fromKey);
    else p.bench[fromBench] = null;

    if (occupant && occupant !== unit) {
      if (fromKey) p.board.set(fromKey, occupant);
      else p.bench[fromBench] = occupant;
    }
    p.board.set(key, unit);
    return true;
  }

  benchUnit(p, unit, slot = -1) {
    const fromKey = this.findBoardKey(p, unit);
    if (!fromKey) return false;
    let idx = slot;
    if (idx === -1 || p.bench[idx]) idx = this.benchSpace(p);
    if (idx === -1) return false;
    p.board.delete(fromKey);
    p.bench[idx] = unit;
    return true;
  }

  // ---------- items ----------
  equipItem(p, unit, itemId) {
    const inv = p.items.indexOf(itemId);
    if (inv === -1) return false;
    const isComponent = !!COMPONENTS[itemId];
    if (isComponent) {
      // combine with an existing component on the unit?
      const compIdx = unit.items.findIndex(i => COMPONENTS[i]);
      if (compIdx !== -1) {
        const combo = COMBINED[combineKey(unit.items[compIdx], itemId)];
        unit.items[compIdx] = combo.id;
        p.items.splice(inv, 1);
        return true;
      }
    }
    if (unit.items.length >= 3) return false;
    unit.items.push(itemId);
    p.items.splice(inv, 1);
    return true;
  }

  randomComponent() {
    const keys = Object.keys(COMPONENTS);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  // ---------- traits ----------
  activeTraits(p) {
    const uniq = new Map(); // defId -> traits
    for (const u of p.board.values()) {
      const def = UNIT_BY_ID[u.defId];
      const traits = [...def.traits];
      for (const it of u.items) if (it === 'voidprism' && !traits.includes('void')) traits.push('void');
      if (!uniq.has(u.defId)) uniq.set(u.defId, traits);
      else {
        const ex = uniq.get(u.defId);
        for (const t of traits) if (!ex.includes(t)) ex.push(t);
      }
    }
    const counts = {};
    for (const traits of uniq.values()) for (const t of traits) counts[t] = (counts[t] || 0) + 1;
    const active = {};
    for (const [key, n] of Object.entries(counts)) {
      const th = TRAITS[key].thresholds;
      let tier = 0;
      for (let i = 0; i < th.length; i++) if (n >= th[i]) tier = i + 1;
      active[key] = { count: n, tier };
    }
    return active;
  }

  activeTraitTiers(p) {
    const a = this.activeTraits(p);
    const out = {};
    for (const [k, v] of Object.entries(a)) out[k] = v.tier;
    return out;
  }

  // ---------- round flow ----------
  startRound() {
    this.round++;
    this.phase = 'planning';
    this.lastResults = [];
    for (const p of this.players) {
      if (!p.alive) continue;
      if (!p.shopLock || p.shop.every(s => !s)) this.rollShop(p);
      p.shopLock = false;
    }
    // bots take their planning turn immediately
    for (const p of this.players) {
      if (p.alive && !p.isHuman) botPlan(this, p);
    }
  }

  stage() { return Math.floor((this.round - 1) / 6) + 1; }

  creepSpecs() {
    const list = CREEP_ROUNDS[this.round] || CREEP_ROUNDS[1];
    const cols = [3, 2, 4, 1, 5, 0, 6];
    return list.map((cr, i) => {
      const def = CREEPS[cr.d];
      return {
        def, star: 1, items: [], team: 1,
        r: def.range > 1 ? 1 : 2, c: cols[i % cols.length],
        hpMult: cr.m, adMult: cr.m,
      };
    });
  }

  teamSpec(p, team) {
    const specs = [];
    for (const [key, u] of p.board) {
      const [r, c] = key.split(',').map(Number);
      const def = UNIT_BY_ID[u.defId];
      let spec = { def, star: u.star, items: [...u.items], team, r, c, srcUid: u.uid };
      if (team === 1) spec = mirrorSpec(spec);
      specs.push(spec);
    }
    return specs;
  }

  // Build all matches for this round. Human match first in the list.
  buildMatches() {
    const alive = this.players.filter(p => p.alive);
    const matches = [];
    if (isCreepRound(this.round)) {
      for (const p of alive) {
        matches.push({ a: p, b: null, creep: true });
      }
    } else {
      const shuffled = [...alive].sort(() => Math.random() - 0.5);
      while (shuffled.length >= 2) {
        matches.push({ a: shuffled.pop(), b: shuffled.pop() });
      }
      if (shuffled.length === 1) {
        const solo = shuffled.pop();
        const others = alive.filter(p => p !== solo);
        const ghost = others[Math.floor(Math.random() * others.length)];
        matches.push({ a: solo, b: ghost, ghost: true });
      }
    }
    matches.sort((m) => (m.a.isHuman || (m.b && m.b.isHuman && !m.ghost)) ? -1 : 1);
    return matches;
  }

  makeSim(match, seed) {
    const specA = this.teamSpec(match.a, 0);
    const traitsA = this.activeTraitTiers(match.a);
    let specB, traitsB;
    if (match.creep) {
      specB = this.creepSpecs();
      traitsB = {};
    } else {
      specB = this.teamSpec(match.b, 1);
      traitsB = this.activeTraitTiers(match.b);
    }
    const sim = new Sim(specA, specB, { seed, traitsA, traitsB });
    sim.stageHint = this.stage();
    return sim;
  }

  survivorDamage(survivors) {
    let d = 2 + this.stage();
    for (const u of survivors) {
      d += (u.def.cost || 1) * u.star;
    }
    return d;
  }

  // Apply one finished match. Returns summary for UI.
  applyMatch(match, res) {
    const { a, b } = match;
    const summary = { a: a.name, b: match.creep ? 'Space Pirates' : b.name, ghost: !!match.ghost, creep: !!match.creep };

    const applyTo = (p, won, drew, dmg) => {
      if (!p) return;
      if (drew) { p.lastResult = 'draw'; p.streak = 0; p.hp -= Math.ceil(dmg / 2); }
      else if (won) { p.lastResult = 'win'; p.streak = p.streak >= 0 ? p.streak + 1 : 1; }
      else { p.lastResult = 'loss'; p.streak = p.streak <= 0 ? p.streak - 1 : -1; p.hp -= dmg; }
      p.hp = Math.max(0, p.hp);
    };

    if (match.creep) {
      const won = res.winner === 0;
      const dmg = won ? 0 : 2 + this.stage() * 2;
      applyTo(a, won, res.winner === 2, dmg);
      if (won) {
        a.gold += 1;
        a.items.push(this.randomComponent());
        summary.loot = true;
      }
      summary.winner = won ? a.name : 'Space Pirates';
    } else {
      const aWon = res.winner === 0, drew = res.winner === 2;
      const dmgToA = this.survivorDamage(res.survivors1);
      const dmgToB = this.survivorDamage(res.survivors0);
      applyTo(a, aWon, drew, dmgToA);
      if (!match.ghost) applyTo(b, !aWon, drew, dmgToB);
      summary.winner = drew ? null : (aWon ? a.name : b.name);
      summary.dmg = drew ? 0 : (aWon ? dmgToB : dmgToA);
    }
    return summary;
  }

  // Run all background (non-human) matches instantly
  runBackgroundMatches(matches) {
    const summaries = [];
    for (const m of matches) {
      const sim = this.makeSim(m, (Math.random() * 1e9) | 0);
      const res = sim.runToEnd();
      summaries.push(this.applyMatch(m, res));
    }
    return summaries;
  }

  incomeFor(p) {
    const base = Math.min(5, 2 + this.round);
    const interest = Math.min(MAX_INTEREST, Math.floor(p.gold / 10));
    const streak = Math.abs(p.streak);
    const streakGold = streak >= 6 ? 3 : streak >= 4 ? 2 : streak >= 2 ? 1 : 0;
    const win = p.lastResult === 'win' ? 1 : 0;
    return { base, interest, streak: streakGold, win, total: base + interest + streakGold + win };
  }

  // After all matches applied: income, xp, eliminations, next round
  endRound() {
    for (const p of this.players) {
      if (!p.alive) continue;
      const inc = this.incomeFor(p);
      p.gold += inc.total;
      p.lastIncome = inc;
      this.addXP(p, XP_PER_ROUND);
    }
    // eliminations
    for (const p of this.players) {
      if (p.alive && p.hp <= 0) {
        p.alive = false;
        this.placements.push(p);
        // return units to pool
        for (const u of this.allUnits(p)) this.returnToPool(u.defId, Math.pow(3, u.star - 1));
        p.board.clear();
        p.bench.fill(null);
        for (const s of p.shop) if (s) this.returnToPool(s);
        p.shop.fill(null);
      }
    }
    const alive = this.players.filter(p => p.alive);
    if (!this.human.alive || alive.length <= 1) {
      this.phase = 'over';
      return;
    }
    this.startRound();
  }

  humanPlacement() {
    if (this.human.alive) return 1; // last one standing (or game ongoing)
    const idx = this.placements.indexOf(this.human);
    return this.players.length - idx;
  }
}
