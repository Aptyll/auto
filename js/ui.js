// ============================================================
// UI: DOM panels (shop, traits, opponents, overlays) + canvas
// touch input (drag units, tap for info, item equipping).
// ============================================================

import {
  UNIT_BY_ID, TRAITS, ITEM_BY_ID, COMPONENTS, REROLL_COST, XP_COST, XP_TO_NEXT,
  MAX_LEVEL, isCreepRound, sellValue, abilityText,
} from './data.js';
import { Renderer, drawShip, itemColor } from './render.js';
import { TICK } from './sim.js';

const $ = s => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.canvas = $('#cv');
    this.r = new Renderer(this.canvas);
    this.drag = null; // {unit, x, y, from}
    this.hoverCell = null;
    this.equipItemId = null;
    this.combat = null; // {sim, matches, summaries, acc, speed}
    this.resultTimer = 0;
    this.infoUnit = null;

    window.addEventListener('resize', () => this.r.resize());
    this.bindInput();
    this.bindButtons();
    this.renderAll();
  }

  // ================= DOM rendering =================
  renderAll() {
    this.renderTop();
    this.renderOpponents();
    this.renderShop();
    this.renderTraits();
    this.renderItems();
  }

  renderTop() {
    const g = this.game, p = g.human;
    $('#roundLbl').textContent = `${isCreepRound(g.round) ? '☠ ' : ''}Round ${g.round}`;
    $('#stageLbl').textContent = `Stage ${g.stage()}`;
    $('#hpLbl').textContent = p.hp;
    $('#hpFill').style.width = `${Math.max(0, p.hp)}%`;
    $('#goldLbl').textContent = p.gold;
    $('#lvlLbl').textContent = `Lv ${p.level}`;
    $('#xpLbl').textContent = p.level >= MAX_LEVEL ? 'MAX' : `${p.xp}/${XP_TO_NEXT[p.level]}`;
    $('#boardCount').textContent = `${g.boardCount(p)}/${g.boardCap(p)}`;
    const st = p.streak;
    $('#streakLbl').textContent = st > 1 ? `🔥${st}` : st < -1 ? `❄${-st}` : '';
  }

  renderOpponents() {
    const g = this.game;
    const wrap = $('#opps');
    wrap.innerHTML = '';
    const sorted = [...g.players].sort((a, b) => b.hp - a.hp || b.alive - a.alive);
    for (const p of sorted) {
      const d = document.createElement('div');
      d.className = 'opp' + (p.alive ? '' : ' dead') + (p.isHuman ? ' me' : '');
      if (this.combat && this.combat.vs === p) d.classList.add('vs');
      d.innerHTML = `<div class="opp-name">${p.isHuman ? 'YOU' : p.name.split(' ')[0].slice(0, 7)}</div>
        <div class="opp-hp"><i style="width:${Math.max(0, p.hp)}%"></i></div>
        <div class="opp-val">${p.alive ? p.hp : '☠'}</div>`;
      wrap.appendChild(d);
    }
  }

  renderShop() {
    const g = this.game, p = g.human;
    const wrap = $('#shopCards');
    wrap.innerHTML = '';
    p.shop.forEach((defId, i) => {
      const card = document.createElement('div');
      if (!defId) {
        card.className = 'card empty';
        wrap.appendChild(card);
        return;
      }
      const def = UNIT_BY_ID[defId];
      card.className = `card cost${def.cost}`;
      const canBuy = p.gold >= def.cost && g.phase === 'planning';
      if (!canBuy) card.classList.add('dim');
      const owned = g.allUnits(p).filter(u => u.defId === defId && u.star === 1).length;
      if (owned >= 2) card.classList.add('combines');
      const cv = document.createElement('canvas');
      cv.className = 'card-ship';
      card.innerHTML = `
        <div class="card-traits">${def.traits.map(t => `<span style="color:${TRAITS[t].color}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join('')}</div>
        <div class="card-name">${def.name}</div>
        <div class="card-cost">${def.cost}g</div>
        ${owned > 0 ? `<div class="card-owned">${owned >= 2 ? '▲ MERGES!' : `owned ${owned}/3`}</div>` : ''}`;
      card.prepend(cv);
      requestAnimationFrame(() => {
        const dpr = Math.min(2, devicePixelRatio || 1);
        const w = cv.clientWidth || 60, h = cv.clientHeight || 44;
        cv.width = w * dpr; cv.height = h * dpr;
        const cx = cv.getContext('2d');
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawShip(cx, def, 1, Math.min(w, h) * 0.36, { x: w / 2, y: h / 2, facing: -Math.PI / 2 });
      });
      card.addEventListener('click', () => {
        if (g.phase !== 'planning') return;
        if (g.buyUnit(p, i)) {
          this.renderAll();
          this.celebrateUpgrades();
        } else {
          this.toast(p.gold < def.cost ? 'Not enough gold' : 'Bench is full');
        }
      });
      wrap.appendChild(card);
    });
  }

  renderTraits() {
    const g = this.game, p = g.human;
    const act = g.activeTraits(p);
    const wrap = $('#traits');
    wrap.innerHTML = '';
    const entries = Object.entries(act).sort((a, b) => (b[1].tier - a[1].tier) || (b[1].count - a[1].count));
    for (const [key, { count, tier }] of entries) {
      const tr = TRAITS[key];
      const chip = document.createElement('div');
      chip.className = 'trait-chip' + (tier > 0 ? ` on t${tier}` : '');
      const next = tr.thresholds.find(t => t > count) ?? tr.thresholds[tr.thresholds.length - 1];
      chip.innerHTML = `<span class="tr-icon" style="color:${tr.color}">${tr.icon}</span><b>${count}</b><span class="tr-next">/${tier >= tr.thresholds.length ? count : next}</span>`;
      chip.addEventListener('click', () => this.showTraitInfo(key, count, tier));
      wrap.appendChild(chip);
    }
  }

  renderItems() {
    const g = this.game, p = g.human;
    const wrap = $('#itemBar');
    wrap.innerHTML = '';
    p.items.forEach((id, idx) => {
      const it = ITEM_BY_ID[id];
      const d = document.createElement('div');
      d.className = 'item-chip' + (this.equipItemId === idx ? ' sel' : '');
      d.style.borderColor = it.color;
      d.innerHTML = `<span style="color:${it.color}">${it.icon}</span>`;
      d.addEventListener('click', () => {
        if (this.equipItemId === idx) { this.equipItemId = null; }
        else {
          this.equipItemId = idx;
          this.toast(`${it.name}: ${it.desc} — tap one of your ships to equip`, 2600);
        }
        this.renderItems();
      });
      wrap.appendChild(d);
    });
    wrap.style.display = p.items.length ? 'flex' : 'none';
  }

  showTraitInfo(key, count, tier) {
    const tr = TRAITS[key];
    const rows = tr.thresholds.map((th, i) =>
      `<div class="ti-row ${tier === i + 1 ? 'on' : ''}"><b>(${th})</b> ${tr.tiers[i]}</div>`).join('');
    this.popup(`
      <h3 style="color:${tr.color}">${tr.icon} ${tr.name} <small>(${count} fielded)</small></h3>
      <p>${tr.desc}</p>${rows}`);
  }

  showUnitInfo(unit) {
    const g = this.game, p = g.human;
    const def = UNIT_BY_ID[unit.defId];
    const items = unit.items.map(id => {
      const it = ITEM_BY_ID[id];
      return `<span class="ui-item" style="border-color:${it.color}">${it.icon} ${it.name}</span>`;
    }).join('') || '<i>none</i>';
    const canSell = g.phase === 'planning';
    this.popup(`
      <h3>${def.name} <span class="stars s${unit.star}">${'★'.repeat(unit.star)}</span></h3>
      <div class="ui-traits">${def.traits.map(t => `<span style="color:${TRAITS[t].color}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join(' ')}</div>
      <div class="ui-stats">
        <span>Hull ${Math.round(def.hp * [1, 1, 1.8, 3.24][unit.star])}</span>
        <span>Dmg ${Math.round(def.ad * [1, 1, 1.8, 3.24][unit.star])}</span>
        <span>Spd ${def.as}/s</span>
        <span>Rng ${def.range}</span>
      </div>
      <p class="ui-ab"><b>${def.ability ? def.ability.name : ''}</b> — ${abilityText(def, unit.star)}</p>
      <div class="ui-items">Items: ${items}</div>
      ${canSell ? `<button id="sellBtn" class="btn danger">Sell for ${sellValue(unit)}g</button>` : ''}`);
    if (canSell) {
      $('#sellBtn').addEventListener('click', () => {
        g.sellUnit(p, unit);
        this.closePopup();
        this.renderAll();
      });
    }
  }

  // Toast + gold burst wherever a unit just star-upgraded
  celebrateUpgrades() {
    const p = this.game.human;
    if (!p.upgradeLog || !p.upgradeLog.length) return;
    for (const up of p.upgradeLog) {
      const def = UNIT_BY_ID[up.defId];
      this.toast(`⭐ ${def.name} merged into ${'★'.repeat(up.star)}!`, 2400);
      const key = this.game.findBoardKey(p, up.unit);
      let pos = null;
      if (key) { const [r, c] = key.split(',').map(Number); pos = this.r.hexCenter(r, c); }
      else { const bi = p.bench.indexOf(up.unit); if (bi !== -1) pos = this.r.benchCenter(bi); }
      if (pos) {
        for (let i = 0; i < 3; i++) {
          this.r.fx.push({ k: 'ring', x: pos.x, y: pos.y, t: 0.35 + i * 0.12, max: this.r.hexW * (0.5 + i * 0.3), col: 'rgba(255,209,102,0.9)' });
        }
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
          this.r.fx.push({ k: 'spark', x: pos.x, y: pos.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.6, col: '#ffd166', r: 2 });
        }
      }
    }
    p.upgradeLog.length = 0;
  }

  popup(html) {
    $('#popupBody').innerHTML = html;
    $('#popup').classList.add('show');
  }
  closePopup() { $('#popup').classList.remove('show'); this.infoUnit = null; }

  toast(msg, dur = 1500) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), dur);
  }

  // ================= buttons =================
  bindButtons() {
    $('#rerollBtn').addEventListener('click', () => {
      const g = this.game;
      if (g.phase !== 'planning') return;
      if (g.reroll(g.human)) this.renderAll();
      else this.toast('Not enough gold');
    });
    $('#xpBtn').addEventListener('click', () => {
      const g = this.game;
      if (g.phase !== 'planning') return;
      if (g.buyXP(g.human)) this.renderAll();
      else this.toast(g.human.level >= MAX_LEVEL ? 'Max level' : 'Not enough gold');
    });
    $('#lockBtn').addEventListener('click', () => {
      const g = this.game;
      g.human.shopLock = !g.human.shopLock;
      $('#lockBtn').classList.toggle('on', g.human.shopLock);
    });
    $('#fightBtn').addEventListener('click', () => this.startCombat());
    $('#speedBtn').addEventListener('click', () => {
      if (!this.combat) return;
      this.combat.speed = this.combat.speed >= 3 ? 1 : this.combat.speed + 1;
      $('#speedBtn').textContent = `▶▶ ${this.combat.speed}x`;
    });
    $('#popupClose').addEventListener('click', () => this.closePopup());
    $('#popup').addEventListener('click', e => { if (e.target === $('#popup')) this.closePopup(); });
  }

  // ================= combat =================
  startCombat() {
    const g = this.game;
    if (g.phase !== 'planning') return;
    if (g.boardCount(g.human) === 0) { this.toast('Place at least one ship!'); return; }
    g.phase = 'combat';
    this.closePopup();
    this.equipItemId = null;

    const matches = g.buildMatches();
    const humanMatch = matches.find(m => m.a.isHuman || (m.b === g.human && !m.ghost));
    const others = matches.filter(m => m !== humanMatch);

    // human always plays from bottom (team 0)
    if (humanMatch && humanMatch.b === g.human && !humanMatch.ghost) {
      const tmp = humanMatch.a; humanMatch.a = humanMatch.b; humanMatch.b = tmp;
    }
    const sim = g.makeSim(humanMatch, (Math.random() * 1e9) | 0);
    this.combat = {
      sim, humanMatch, others, acc: 0, speed: 1,
      vs: humanMatch.creep ? null : humanMatch.b,
      resolved: false,
    };
    $('#shopPanel').classList.add('combat');
    $('#fightBtn').style.display = 'none';
    $('#speedBtn').style.display = '';
    $('#speedBtn').textContent = '▶▶ 1x';
    $('#vsLbl').textContent = humanMatch.creep ? 'vs Space Pirates ☠' :
      `vs ${humanMatch.b.name}${humanMatch.ghost ? ' (ghost)' : ''}`;
    this.renderOpponents();
  }

  finishCombat() {
    const g = this.game;
    const c = this.combat;
    const res = c.sim.result();
    const summaries = [g.applyMatch(c.humanMatch, res), ...g.runBackgroundMatches(c.others)];

    // result banner
    const won = res.winner === 0;
    const drew = res.winner === 2;
    const banner = $('#resultBanner');
    banner.className = 'show ' + (drew ? 'draw' : won ? 'win' : 'loss');
    banner.innerHTML = drew ? 'DRAW' : won ?
      `VICTORY${c.humanMatch.creep && res.winner === 0 ? ' — loot recovered!' : ''}` :
      `DEFEAT <small>-${g.survivorDamage(res.survivors1)} hp</small>`;

    g.endRound();

    setTimeout(() => {
      banner.className = '';
      this.combat = null;
      $('#shopPanel').classList.remove('combat');
      $('#fightBtn').style.display = '';
      $('#speedBtn').style.display = 'none';
      $('#vsLbl').textContent = '';
      if (g.phase === 'over') this.showGameOver();
      else {
        const inc = g.human.lastIncome;
        if (inc) this.toast(`+${inc.total}g (base ${inc.base} · interest ${inc.interest} · streak ${inc.streak}${inc.win ? ' · win 1' : ''})`, 2200);
      }
      this.renderAll();
    }, 1800);
  }

  showGameOver() {
    const g = this.game;
    const place = g.humanPlacement();
    const win = place === 1;
    this.popup(`
      <h3 style="text-align:center;font-size:26px">${win ? '🏆 VICTORY' : `#${place}`}</h3>
      <p style="text-align:center">${win ? 'Your armada rules the sector!' : `Eliminated in round ${g.round}. ${place <= 4 ? 'Top 4 — solid flight.' : 'The void claims another fleet.'}`}</p>
      <button class="btn primary" id="restartBtn" style="width:100%">PLAY AGAIN</button>`);
    $('#restartBtn').addEventListener('click', () => location.reload());
  }

  // ================= canvas input =================
  bindInput() {
    const cv = this.canvas;
    cv.style.touchAction = 'none';

    cv.addEventListener('pointerdown', e => {
      if (this.game.phase !== 'planning') return;
      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const hit = this.unitAt(x, y);
      if (!hit) return;

      // equip mode: tap a ship to give it the selected item
      if (this.equipItemId !== null) {
        const p = this.game.human;
        const itemId = p.items[this.equipItemId];
        if (itemId !== undefined && this.game.equipItem(p, hit.unit, itemId)) {
          this.equipItemId = null;
          this.toast('Equipped!');
          this.renderAll();
        } else {
          this.toast('Cannot equip (3 item max)');
          this.equipItemId = null;
          this.renderItems();
        }
        return;
      }

      try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      this.drag = { unit: hit.unit, from: hit.from, x, y, sx: x, sy: y, moved: false };
    });

    cv.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const rect = cv.getBoundingClientRect();
      this.drag.x = e.clientX - rect.left;
      this.drag.y = e.clientY - rect.top;
      if (Math.hypot(this.drag.x - this.drag.sx, this.drag.y - this.drag.sy) > 8) this.drag.moved = true;
      const cell = this.r.pxToCell(this.drag.x, this.drag.y);
      this.hoverCell = cell && cell.r >= 4 ? cell : null;
      $('#sellZone').classList.toggle('show', this.drag.moved);
      $('#sellZone').textContent = `⬇ SELL ${UNIT_BY_ID[this.drag.unit.defId].name} for ${sellValue(this.drag.unit)}g ⬇`;
      const overSell = e.clientY > window.innerHeight - 120;
      $('#sellZone').classList.toggle('hot', overSell);
    });

    const endDrag = e => {
      if (!this.drag) return;
      const g = this.game, p = g.human;
      const d = this.drag;
      this.drag = null;
      this.hoverCell = null;
      $('#sellZone').classList.remove('show', 'hot');

      if (!d.moved) { // tap = info
        this.showUnitInfo(d.unit);
        return;
      }
      // sell?
      if (e.clientY > window.innerHeight - 120) {
        g.sellUnit(p, d.unit);
        this.toast(`Sold for ${sellValue(d.unit)}g`);
        this.renderAll();
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const cell = this.r.pxToCell(x, y);
      const bench = this.r.pxToBench(x, y);
      if (cell && cell.r >= 4) {
        if (!g.placeUnit(p, d.unit, cell.r, cell.c)) this.toast(`Board limit ${g.boardCap(p)} — level up!`);
      } else if (bench !== -1) {
        const occupant = p.bench[bench];
        const fromKey = g.findBoardKey(p, d.unit);
        if (!occupant) {
          if (fromKey) { p.board.delete(fromKey); p.bench[bench] = d.unit; }
          else { const bi = p.bench.indexOf(d.unit); if (bi !== -1) { p.bench[bi] = null; p.bench[bench] = d.unit; } }
        } else if (occupant !== d.unit && fromKey) {
          // swap board unit with bench unit
          p.board.set(fromKey, occupant);
          p.bench[bench] = d.unit;
        }
      }
      g.combineAll(p); // safety net: any 3 coexisting copies merge now
      this.renderAll();
      this.celebrateUpgrades();
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', () => {
      this.drag = null; this.hoverCell = null;
      $('#sellZone').classList.remove('show', 'hot');
    });
  }

  unitAt(x, y) {
    const g = this.game, p = g.human;
    // board
    for (const [key, unit] of p.board) {
      const [r, c] = key.split(',').map(Number);
      const pos = this.r.hexCenter(r, c);
      if (Math.hypot(x - pos.x, y - pos.y) < this.r.hexW * 0.5) return { unit, from: 'board' };
    }
    // bench
    for (let i = 0; i < p.bench.length; i++) {
      if (!p.bench[i]) continue;
      const pos = this.r.benchCenter(i);
      if (Math.hypot(x - pos.x, y - pos.y) < this.r.benchSlot * 0.5) return { unit: p.bench[i], from: 'bench' };
    }
    return null;
  }

  // ================= frame =================
  frame(dt) {
    const g = this.game, r = this.r;
    r.t += dt;
    r.stepFx(dt);

    // advance combat sim
    if (this.combat && !this.combat.resolved) {
      const c = this.combat;
      c.acc += dt * c.speed;
      let steps = 0;
      while (c.acc >= TICK && steps < 12) {
        c.sim.tick();
        r.pushEvents(c.sim.events);
        c.acc -= TICK;
        steps++;
        if (c.sim.done) break;
      }
      if (c.sim.done) {
        c.resolved = true;
        this.finishCombat();
      }
    }

    // ---- draw ----
    const ctx = r.ctx;
    ctx.save();
    if (r.shake > 0) ctx.translate((Math.random() - 0.5) * r.shake, (Math.random() - 0.5) * r.shake);
    r.drawBackground();
    const planning = g.phase === 'planning';
    r.drawGrid(planning, this.hoverCell);

    if (this.combat) {
      const sim = this.combat.sim;
      const units = [...sim.units].sort((a, b) => a.y - b.y);
      for (const u of units) if (u.alive) r.drawSimUnit(u);
      r.drawProjectiles(sim.projectiles);
    } else {
      const p = g.human;
      for (const [key, unit] of p.board) {
        if (this.drag && this.drag.unit === unit) continue;
        const [rr, cc] = key.split(',').map(Number);
        const pos = r.hexCenter(rr, cc);
        r.drawOwnedUnit(unit, pos.x, pos.y, r.hexW * 0.36);
      }
    }

    r.drawBench(g.human.bench, this.drag ? this.drag.unit : null);

    // drag ghost
    if (this.drag && this.drag.moved) {
      r.drawOwnedUnit(this.drag.unit, this.drag.x, this.drag.y - 24, r.hexW * 0.42, 0.85);
    }

    r.drawFx();
    ctx.restore();
  }
}
