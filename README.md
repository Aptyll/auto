# Nebula Tactics 🚀

A mobile-first, sci-fi **auto-battler** in plain HTML5 Canvas + vanilla JS. Build a fleet of
spaceships between rounds, then watch it fight automatically. All the skill is in the
decisions between combats — shopping, positioning, economy, and traits.

## Play

Serve the folder with any static server and open it on a phone (or a narrow browser window):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

No build step, no dependencies.

## How it works

- **8-player lobby** — you vs 7 AI commanders, each running their own economy, board,
  and personality (preferred traits, greed, roll-happiness). Last commander standing wins.
- **Shared shop** — all 8 players draw from one shared unit pool
  (18/15/12/9/6 copies per cost tier), with shop odds that shift as you level.
- **30 ships, 5 cost tiers** (8× 1g, 7× 2g, 6× 3g, 5× 4g, 4× 5g), each drawn procedurally
  as a vector silhouette colored by its traits.
- **6 traits** — every ship has two. Field enough unique ships of a trait to unlock bonuses:
  - ▲ **Vanguard** (2/4/6) — armor
  - ⚔ **Raider** (2/4/6) — lifesteal + attack speed
  - ✦ **Swarm** (3/6) — free combat drones at battle start + attack speed
  - ◎ **Sniper** (2/4) — +1 range and crit chance
  - ◈ **Void** (2/4) — ability power + starting energy
  - ⚙ **Engineer** (2/4/6) — whole-team shields
- **Star-ups** — three copies of a ship merge into a 2★ (and three 2★ into a gold 3★)
  with 1.8× hull/damage per star. Hitting a 3★ carry is the power fantasy.
- **Economy** — income = base + interest (1 per 10g, max 5) + win/loss streak gold + win bonus.
  Reroll 2g, buy XP 4g, board size = level.
- **Health as a resource** — lose a fight and you take damage per surviving enemy ship.
  Losing on purpose to bank streak gold is a legitimate strategy.
- **Items** — PvE pirate rounds (1, 2, 5, 9, 13, …) drop components (Laser Core, Flux Coil,
  Nano Plate, Plasma Cell). Two components on one ship merge into a completed item —
  including the **Void Prism**, which grants the wearer the Void trait.
- **Combat** — real-time simulated fights on a 7×8 hex field. Ships move, shoot, build
  energy, and cast unique abilities (beams, chain lightning, summons, blinks, executes…).
  Your fight renders live (1–3× speed); the other matches resolve instantly in the background.

## Controls (touch-first)

- **Tap** a shop card to buy.
- **Drag** ships between bench and board; drag onto the shop panel to sell.
- **Tap** a ship for stats / ability / sell; tap a trait chip for its tiers.
- **Tap** an item, then a ship, to equip it.

## Code layout

| File | Purpose |
|---|---|
| `js/data.js` | Units, traits, items, creeps, economy constants |
| `js/sim.js` | Deterministic combat simulation (pure logic, no DOM) |
| `js/game.js` | Players, shared pool, shop, star-ups, rounds, pairings |
| `js/bot.js` | AI commander decision-making |
| `js/render.js` | Canvas renderer: hex grid, procedural ships, effects |
| `js/ui.js` | DOM panels, touch input, phase orchestration |
| `js/main.js` | Boot + frame loop |

`sim.js`, `game.js`, `bot.js`, and `data.js` are DOM-free and run headless under Node for testing.
