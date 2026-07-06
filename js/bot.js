// ============================================================
// Bot players — each has a personality (preferred traits,
// economy greed) and plays a full planning turn per round.
// ============================================================

import { UNIT_BY_ID, TRAIT_KEYS, XP_COST, REROLL_COST, MAX_LEVEL, COMPONENTS } from './data.js';

export function makePersonality() {
  const shuffled = [...TRAIT_KEYS].sort(() => Math.random() - 0.5);
  return {
    prefTraits: [shuffled[0], shuffled[1]],
    greed: 0.35 + Math.random() * 0.5, // how hard it holds gold for interest
    rollHappy: Math.random() < 0.45, // rolls down more aggressively
  };
}

const LEVEL_CURVE = { 1: 2, 2: 2, 3: 3, 4: 4, 5: 4, 6: 5, 7: 5, 8: 6, 9: 6, 10: 7, 12: 7, 14: 8, 18: 8, 22: 9 };

function desiredLevel(round) {
  let lvl = 2;
  for (const [r, l] of Object.entries(LEVEL_CURVE)) if (round >= +r) lvl = Math.max(lvl, l);
  return lvl;
}

function unitScore(game, bot, defId) {
  const def = UNIT_BY_ID[defId];
  const pers = bot.personality;
  let s = def.cost * 1.2;
  // upgrade potential: copies already owned
  const owned = game.allUnits(bot).filter(u => u.defId === defId && u.star < 3).length;
  s += owned * 4;
  for (const t of def.traits) if (pers.prefTraits.includes(t)) s += 2.5;
  return s;
}

function ownedScore(game, bot, unit) {
  const def = UNIT_BY_ID[unit.defId];
  let s = def.cost * unit.star * unit.star + unit.items.length * 2;
  for (const t of def.traits) if (bot.personality.prefTraits.includes(t)) s += 1.5;
  return s;
}

function buyFromShop(game, bot) {
  let bought = true;
  while (bought) {
    bought = false;
    // best affordable shop unit
    let bestIdx = -1, bestScore = 2.0;
    for (let i = 0; i < bot.shop.length; i++) {
      const id = bot.shop[i];
      if (!id) continue;
      const def = UNIT_BY_ID[id];
      if (def.cost > bot.gold) continue;
      if (game.benchSpace(bot) === -1 && !game.wouldCombine(bot, id)) continue;
      const sc = unitScore(game, bot, id);
      if (sc > bestScore) { bestScore = sc; bestIdx = i; }
    }
    if (bestIdx !== -1) bought = game.buyUnit(bot, bestIdx);
  }
}

function sellChaff(game, bot) {
  // keep bench lean: sell weakest bench units when bench nearly full
  const benchUnits = bot.bench.filter(Boolean);
  if (benchUnits.length < 7) return;
  const sorted = benchUnits.sort((a, b) => ownedScore(game, bot, a) - ownedScore(game, bot, b));
  for (let i = 0; i < 2 && i < sorted.length; i++) {
    const u = sorted[i];
    // don't sell pairs (potential upgrades)
    const copies = game.allUnits(bot).filter(x => x.defId === u.defId && x.star === u.star).length;
    if (copies >= 2 || u.star > 1) continue;
    game.sellUnit(bot, u);
  }
}

function positionBoard(game, bot) {
  // choose strongest units up to cap
  const cap = game.boardCap(bot);
  const all = game.allUnits(bot).sort((a, b) => ownedScore(game, bot, b) - ownedScore(game, bot, a));
  const picked = [];
  const seen = new Set();
  for (const u of all) {
    if (picked.length >= cap) break;
    // avoid fielding duplicate 1-star copies of same unit if a better option exists
    const dupKey = u.defId + ':' + u.star;
    if (seen.has(dupKey) && all.length > cap) continue;
    seen.add(dupKey);
    picked.push(u);
  }
  for (const u of all) { if (picked.length >= cap) break; if (!picked.includes(u)) picked.push(u); }

  // clear board -> bench everything (directly, bypass bench size by rebuilding)
  const oldBoard = [...bot.board.values()];
  bot.board.clear();
  const benchPool = [...bot.bench.filter(Boolean), ...oldBoard];
  bot.bench.fill(null);
  let bi = 0;
  for (const u of benchPool) if (!picked.includes(u) && bi < bot.bench.length) bot.bench[bi++] = u;

  const cols = [3, 2, 4, 1, 5, 0, 6];
  const front = picked.filter(u => UNIT_BY_ID[u.defId].range <= 1);
  const mid = picked.filter(u => { const r = UNIT_BY_ID[u.defId].range; return r === 2 || r === 3; });
  const back = picked.filter(u => UNIT_BY_ID[u.defId].range >= 4);
  const placeRow = (units, r) => {
    let ci = 0;
    for (const u of units) {
      while (ci < cols.length && bot.board.has(`${r},${cols[ci]}`)) ci++;
      if (ci >= cols.length) { // overflow to next row up/down
        for (let rr = 4; rr <= 7; rr++) {
          for (const c of cols) {
            if (!bot.board.has(`${rr},${c}`)) { bot.board.set(`${rr},${c}`, u); return; }
          }
        }
        return;
      }
      bot.board.set(`${r},${cols[ci]}`, u);
      ci++;
    }
  };
  placeRow(front, 4);
  placeRow(mid, 6);
  placeRow(back, 7);
}

function equipItems(game, bot) {
  if (!bot.items.length) return;
  const fielded = [...bot.board.values()].sort((a, b) => ownedScore(game, bot, b) - ownedScore(game, bot, a));
  for (const unit of fielded) {
    while (bot.items.length) {
      const before = bot.items.length;
      // prefer combining on units that already hold a component
      const it = bot.items[0];
      if (!game.equipItem(bot, unit, it)) break;
      if (bot.items.length >= before) break;
    }
    if (!bot.items.length) break;
  }
}

export function botPlan(game, bot) {
  const pers = bot.personality;
  const round = game.round;

  // 1. level toward the curve
  const want = desiredLevel(round);
  const reserve = Math.round(10 + pers.greed * 30 * Math.min(1, round / 8));
  const hpPressure = bot.hp < 30; // dump gold when about to die
  let guardXp = 8;
  while (guardXp-- > 0 && bot.level < Math.min(want, MAX_LEVEL) &&
         (bot.gold - XP_COST >= (hpPressure ? 0 : reserve * 0.5) || bot.gold > 54)) {
    if (!game.buyXP(bot)) break;
  }

  // 2. buy from current shop
  buyFromShop(game, bot);

  // 3. roll if flush (or desperate)
  const rollFloor = hpPressure ? 2 : (pers.rollHappy && round > 8 ? Math.max(10, reserve - 10) : reserve);
  let guard = 12;
  while (guard-- > 0 && bot.gold >= rollFloor + REROLL_COST && game.benchSpace(bot) !== -1) {
    if (!game.reroll(bot)) break;
    buyFromShop(game, bot);
  }

  sellChaff(game, bot);
  positionBoard(game, bot);
  equipItems(game, bot);
}
