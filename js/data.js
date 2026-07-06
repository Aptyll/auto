// ============================================================
// NEBULA TACTICS — game data: traits, units, items, creeps
// ============================================================

export const TRAITS = {
  vanguard: {
    name: 'Vanguard', color: '#6f9fe8', icon: '▲',
    thresholds: [2, 4, 6],
    desc: 'Vanguard ships gain armor.',
    tiers: ['+20 Armor', '+38 Armor', '+60 Armor'],
  },
  raider: {
    name: 'Raider', color: '#ff5c47', icon: '⚔',
    thresholds: [2, 4, 6],
    desc: 'Raiders gain lifesteal and attack speed.',
    tiers: ['15% lifesteal, +12% AS', '30% lifesteal, +25% AS', '50% lifesteal, +45% AS'],
  },
  swarm: {
    name: 'Swarm', color: '#a6e845', icon: '✦',
    thresholds: [3, 6],
    desc: 'Launch combat drones at battle start; Swarm ships attack faster.',
    tiers: ['2 drones, Swarm +20% AS', '5 drones, Swarm +50% AS'],
  },
  sniper: {
    name: 'Sniper', color: '#f0b83d', icon: '◎',
    thresholds: [2, 4],
    desc: 'Snipers gain +1 range and a chance to crit for 200%.',
    tiers: ['+1 range, 25% crit', '+1 range, 55% crit'],
  },
  void: {
    name: 'Void', color: '#c06fe8', icon: '◈',
    thresholds: [2, 4],
    desc: 'Void ships amplify ability damage and start with bonus energy.',
    tiers: ['+35% ability power, +20 energy', '+85% ability power, +40 energy'],
  },
  engineer: {
    name: 'Engineer', color: '#3fd6c8', icon: '⚙',
    thresholds: [2, 4, 6],
    desc: 'All allied ships begin combat with a shield (% of max hull).',
    tiers: ['10% shield', '18% shield', '30% shield'],
  },
};

export const TRAIT_KEYS = Object.keys(TRAITS);

// Trait effect numbers, indexed by active tier (0 = inactive)
export const TRAIT_FX = {
  vanguard: { armor: [0, 20, 38, 60] },
  raider: { ls: [0, 0.15, 0.30, 0.50], as: [0, 0.12, 0.25, 0.45] },
  swarm: { drones: [0, 2, 5], as: [0, 0.20, 0.50] },
  sniper: { range: [0, 1, 1], crit: [0, 0.25, 0.55] },
  void: { ap: [0, 0.35, 0.85], mana: [0, 20, 40] },
  engineer: { shield: [0, 0.10, 0.18, 0.30] },
};

// Star multipliers for hp / ad
export const STAR_MULT = [1, 1, 1.8, 3.24];

// ---------------------------------------------------------------
// Ability effect types (all abilities are a list of effects):
//   nuke      {dmg[]}                 magic dmg to current target
//   aoe       {dmg[], r}              magic dmg around target
//   aoeSelf   {dmg[], r}              magic dmg around self
//   line      {dmg[], len, w}         beam through target
//   chain     {dmg[], n[], decay}     bouncing zap
//   heal      {amt[]}                 heal lowest-hull ally
//   healSelf  {amt[]}
//   shieldSelf{amt[]}
//   shieldTeam{amt[], n}              shield n lowest-hull allies
//   buff      {as?[], ad?[], ls?, crit?, dur}  self buff
//   summon    {count[], kind, hp[], ad[]}      spawn drones/turrets
//   stun      {dmg[], dur}            magic dmg + stun target
//   execute   {dmg[], mult, below}    bonus dmg vs low targets
//   blink     {dmg[], shield?[]}      teleport to lowest-hull enemy + hit it
// ---------------------------------------------------------------

export const UNITS = [
  // ---------- 1-COST ----------
  { id: 'scoutwasp', name: 'Scout Wasp', cost: 1, traits: ['swarm', 'raider'], shape: 'dart',
    range: 1, hp: 560, ad: 52, as: 0.75, mana: 60, armor: 5, speed: 2.0,
    ability: { name: 'Afterburner', text: 'Gains {0}% attack speed for 4s.',
      vals: e => [e[0].as], effects: [{ type: 'buff', as: [45, 60, 85], dur: 4 }] } },

  { id: 'pike', name: 'Pike Corvette', cost: 1, traits: ['vanguard', 'raider'], shape: 'spike',
    range: 1, hp: 720, ad: 55, as: 0.6, mana: 70, armor: 20, speed: 1.7,
    ability: { name: 'Ram Shield', text: 'Shields itself for {0}.',
      vals: e => [e[0].amt], effects: [{ type: 'shieldSelf', amt: [260, 420, 700] }] } },

  { id: 'welder', name: 'Welder Drone', cost: 1, traits: ['engineer', 'swarm'], shape: 'orb',
    range: 3, hp: 500, ad: 40, as: 0.7, mana: 60, armor: 0, speed: 1.7,
    ability: { name: 'Repair Beam', text: 'Repairs the most damaged ally for {0}.',
      vals: e => [e[0].amt], effects: [{ type: 'heal', amt: [300, 480, 800] }] } },

  { id: 'railcutter', name: 'Rail Cutter', cost: 1, traits: ['sniper', 'raider'], shape: 'needle',
    range: 4, hp: 480, ad: 56, as: 0.7, mana: 70, armor: 0, speed: 1.7,
    ability: { name: 'Rail Shot', text: 'Blasts its target for {0} damage.',
      vals: e => [e[0].dmg], effects: [{ type: 'nuke', dmg: [310, 500, 850] }] } },

  { id: 'bulwark', name: 'Bulwark Pod', cost: 1, traits: ['vanguard', 'engineer'], shape: 'brick',
    range: 1, hp: 820, ad: 45, as: 0.55, mana: 80, armor: 25, speed: 1.6,
    ability: { name: 'Shockwave', text: 'Deals {0} damage to nearby enemies.',
      vals: e => [e[0].dmg], effects: [{ type: 'aoeSelf', dmg: [210, 340, 580], r: 1.6 }] } },

  { id: 'voidmote', name: 'Void Mote', cost: 1, traits: ['void', 'swarm'], shape: 'orb',
    range: 3, hp: 470, ad: 42, as: 0.75, mana: 60, armor: 0, speed: 1.7,
    ability: { name: 'Void Bolt', text: 'Strikes its target for {0} damage.',
      vals: e => [e[0].dmg], effects: [{ type: 'nuke', dmg: [330, 540, 900] }] } },

  { id: 'flakskiff', name: 'Flak Skiff', cost: 1, traits: ['sniper', 'engineer'], shape: 'twin',
    range: 3, hp: 510, ad: 46, as: 0.7, mana: 80, armor: 0, speed: 1.7,
    ability: { name: 'Flak Burst', text: 'Deals {0} damage around its target.',
      vals: e => [e[0].dmg], effects: [{ type: 'aoe', dmg: [230, 370, 620], r: 1.3 }] } },

  { id: 'riftskater', name: 'Rift Skater', cost: 1, traits: ['void', 'raider'], shape: 'ray',
    range: 1, hp: 530, ad: 60, as: 0.8, mana: 90, armor: 0, speed: 2.2,
    ability: { name: 'Phase Dash', text: 'Warps to the weakest enemy and hits it for {0}.',
      vals: e => [e[0].dmg], effects: [{ type: 'blink', dmg: [260, 420, 720] }] } },

  // ---------- 2-COST ----------
  { id: 'hornet', name: 'Hornet Wing', cost: 2, traits: ['swarm', 'sniper'], shape: 'wing',
    range: 3, hp: 590, ad: 62, as: 0.8, mana: 70, armor: 0, speed: 1.8,
    ability: { name: 'Sting Volley', text: 'Zaps {1} enemies for {0} damage.',
      vals: e => [e[0].dmg, e[0].n], effects: [{ type: 'chain', dmg: [270, 430, 720], n: [3, 3, 4], decay: 0.75 }] } },

  { id: 'ramfrigate', name: 'Ram Frigate', cost: 2, traits: ['vanguard', 'raider'], shape: 'crab',
    range: 1, hp: 920, ad: 62, as: 0.6, mana: 90, armor: 20, speed: 1.7,
    ability: { name: 'Ram', text: 'Rams its target for {0} damage, stunning 1.5s.',
      vals: e => [e[0].dmg], effects: [{ type: 'stun', dmg: [260, 420, 700], dur: 1.5 }] } },

  { id: 'tesla', name: 'Tesla Spinner', cost: 2, traits: ['engineer', 'void'], shape: 'saucer',
    range: 3, hp: 630, ad: 52, as: 0.7, mana: 80, armor: 0, speed: 1.7,
    ability: { name: 'Tesla Field', text: 'Shocks enemies near its target for {0}.',
      vals: e => [e[0].dmg], effects: [{ type: 'aoe', dmg: [310, 500, 840], r: 1.5 }] } },

  { id: 'longbow', name: 'Longbow Platform', cost: 2, traits: ['sniper', 'vanguard'], shape: 'cross',
    range: 5, hp: 610, ad: 72, as: 0.6, mana: 90, armor: 10, speed: 1.5,
    ability: { name: 'Siege Lance', text: 'Skewers its target for {0} damage.',
      vals: e => [e[0].dmg], effects: [{ type: 'nuke', dmg: [430, 700, 1200] }] } },

  { id: 'corsair', name: 'Corsair Cutlass', cost: 2, traits: ['raider', 'void'], shape: 'hawk',
    range: 1, hp: 760, ad: 72, as: 0.75, mana: 80, armor: 10, speed: 1.9,
    ability: { name: 'Plunder Frenzy', text: '+{0}% damage and 30% lifesteal for 5s.',
      vals: e => [e[0].ad], effects: [{ type: 'buff', ad: [50, 70, 100], ls: 0.3, dur: 5 }] } },

  { id: 'carrier1', name: 'Drone Carrier Mk I', cost: 2, traits: ['swarm', 'engineer'], shape: 'disc',
    range: 3, hp: 710, ad: 46, as: 0.65, mana: 90, armor: 5, speed: 1.6,
    ability: { name: 'Launch Drones', text: 'Deploys {0} combat drone(s).',
      vals: e => [e[0].count], effects: [{ type: 'summon', count: [1, 1, 2], kind: 'drone', hp: [380, 600, 1000], ad: [38, 60, 100] }] } },

  { id: 'aegis', name: 'Aegis Escort', cost: 2, traits: ['vanguard', 'engineer'], shape: 'disc',
    range: 2, hp: 860, ad: 52, as: 0.6, mana: 100, armor: 20, speed: 1.6,
    ability: { name: 'Aegis Field', text: 'Shields the 2 weakest allies for {0}.',
      vals: e => [e[0].amt], effects: [{ type: 'shieldTeam', amt: [230, 380, 650], n: 2 }] } },

  // ---------- 3-COST ----------
  { id: 'phaselancer', name: 'Phase Lancer', cost: 3, traits: ['void', 'sniper'], shape: 'needle',
    range: 4, hp: 690, ad: 78, as: 0.75, mana: 90, armor: 0, speed: 1.7,
    ability: { name: 'Phase Beam', text: 'Fires a piercing beam dealing {0} damage.',
      vals: e => [e[0].dmg], effects: [{ type: 'line', dmg: [390, 640, 1100], len: 7, w: 0.9 }] } },

  { id: 'warhound', name: 'Warhound Destroyer', cost: 3, traits: ['raider', 'vanguard'], shape: 'hawk',
    range: 1, hp: 1120, ad: 82, as: 0.7, mana: 100, armor: 20, speed: 1.8,
    ability: { name: 'Cleaving Broadside', text: 'Deals {0} damage to enemies around its target.',
      vals: e => [e[0].dmg], effects: [{ type: 'aoe', dmg: [360, 580, 980], r: 1.6 }] } },

  { id: 'matriarch', name: 'Hive Matriarch', cost: 3, traits: ['swarm', 'void'], shape: 'crab',
    range: 3, hp: 860, ad: 62, as: 0.65, mana: 100, armor: 5, speed: 1.6,
    ability: { name: 'Brood Call', text: 'Births {0} drones and rallies the swarm (+25% AS, 4s).',
      vals: e => [e[0].count],
      effects: [{ type: 'summon', count: [2, 2, 3], kind: 'drone', hp: [420, 680, 1150], ad: [42, 68, 115] },
                { type: 'rally', trait: 'swarm', as: [25, 25, 25], dur: 4 }] } },

  { id: 'forgetender', name: 'Forge Tender', cost: 3, traits: ['engineer', 'vanguard'], shape: 'brick',
    range: 3, hp: 910, ad: 56, as: 0.6, mana: 90, armor: 15, speed: 1.6,
    ability: { name: 'Nanite Swarm', text: 'Repairs the most damaged ally for {0}.',
      vals: e => [e[0].amt], effects: [{ type: 'heal', amt: [520, 850, 1450] }] } },

  { id: 'ionmarksman', name: 'Ion Marksman', cost: 3, traits: ['sniper', 'void'], shape: 'needle',
    range: 5, hp: 630, ad: 88, as: 0.7, mana: 100, armor: 0, speed: 1.6,
    ability: { name: 'Ion Snipe', text: 'Snipes the weakest enemy for {0} (x2 below 40% hull).',
      vals: e => [e[0].dmg], effects: [{ type: 'execute', dmg: [420, 680, 1150], mult: 2, below: 0.4 }] } },

  { id: 'blitzraptor', name: 'Blitz Raptor', cost: 3, traits: ['raider', 'sniper'], shape: 'dart',
    range: 2, hp: 710, ad: 84, as: 0.85, mana: 80, armor: 5, speed: 2.0,
    ability: { name: 'Blitz Protocol', text: '+{0}% attack speed and +30% crit for 5s.',
      vals: e => [e[0].as], effects: [{ type: 'buff', as: [65, 90, 125], crit: 0.3, dur: 5 }] } },

  // ---------- 4-COST ----------
  { id: 'dreadanvil', name: 'Dreadnought Anvil', cost: 4, traits: ['vanguard', 'engineer'], shape: 'bulk',
    range: 1, hp: 1550, ad: 82, as: 0.6, mana: 110, armor: 30, speed: 1.5,
    ability: { name: 'Bastion Slam', text: 'Shields itself for {0} and slams nearby enemies for {1}.',
      vals: e => [e[0].amt, e[1].dmg],
      effects: [{ type: 'shieldSelf', amt: [720, 1150, 2100] },
                { type: 'aoeSelf', dmg: [260, 420, 720], r: 1.7 }] } },

  { id: 'novabombard', name: 'Nova Bombard', cost: 4, traits: ['sniper', 'swarm'], shape: 'cross',
    range: 5, hp: 760, ad: 98, as: 0.65, mana: 110, armor: 0, speed: 1.5,
    ability: { name: 'Nova Shell', text: 'Bombards a wide area for {0} damage.',
      vals: e => [e[0].dmg], effects: [{ type: 'aoe', dmg: [520, 840, 1450], r: 2.1 }] } },

  { id: 'voidreaver', name: 'Void Reaver', cost: 4, traits: ['void', 'raider'], shape: 'ray',
    range: 1, hp: 980, ad: 105, as: 0.8, mana: 90, armor: 10, speed: 2.2,
    ability: { name: 'Rift Ambush', text: 'Warps to the weakest enemy, hitting it for {0}.',
      vals: e => [e[0].dmg], effects: [{ type: 'blink', dmg: [580, 950, 1650], shield: [250, 400, 700] }] } },

  { id: 'swarmlocus', name: 'Swarm Locus', cost: 4, traits: ['swarm', 'vanguard'], shape: 'crab',
    range: 1, hp: 1450, ad: 72, as: 0.6, mana: 100, armor: 25, speed: 1.6,
    ability: { name: 'Locus Bloom', text: 'Releases {0} combat drones.',
      vals: e => [e[0].count], effects: [{ type: 'summon', count: [2, 3, 4], kind: 'drone', hp: [500, 800, 1350], ad: [50, 80, 135] }] } },

  { id: 'pulsearchon', name: 'Pulse Archon', cost: 4, traits: ['engineer', 'void'], shape: 'saucer',
    range: 3, hp: 870, ad: 72, as: 0.7, mana: 100, armor: 5, speed: 1.6,
    ability: { name: 'Pulse Cascade', text: 'Lightning arcs to {1} enemies for {0} damage.',
      vals: e => [e[0].dmg, e[0].n], effects: [{ type: 'chain', dmg: [400, 650, 1150], n: [4, 5, 7], decay: 0.8 }] } },

  // ---------- 5-COST ----------
  { id: 'leviathan', name: 'Leviathan Ark', cost: 5, traits: ['vanguard', 'swarm'], shape: 'mothership',
    range: 1, hp: 2150, ad: 92, as: 0.55, mana: 120, armor: 35, speed: 1.4,
    ability: { name: 'Ark Protocol', text: 'Shields itself for {0} and launches {1} escort drones.',
      vals: e => [e[0].amt, e[1].count],
      effects: [{ type: 'shieldSelf', amt: [850, 1400, 2500] },
                { type: 'summon', count: [2, 3, 4], kind: 'drone', hp: [550, 900, 1500], ad: [55, 90, 150] }] } },

  { id: 'stareater', name: 'Star Eater', cost: 5, traits: ['void', 'sniper'], shape: 'arrow',
    range: 4, hp: 1150, ad: 104, as: 0.7, mana: 140, armor: 5, speed: 1.5,
    ability: { name: 'Singularity', text: 'Collapses space around its target: {0} damage in a huge area.',
      vals: e => [e[0].dmg], effects: [{ type: 'aoe', dmg: [750, 1200, 2100], r: 2.6 }] } },

  { id: 'blackstar', name: 'Pirate King Blackstar', cost: 5, traits: ['raider', 'sniper'], shape: 'hawk',
    range: 3, hp: 1020, ad: 122, as: 0.8, mana: 100, armor: 10, speed: 1.8,
    ability: { name: "Dead Man's Volley", text: '+{0}% attack speed for 6s and blasts its target for {1}.',
      vals: e => [e[0].as, e[1].dmg],
      effects: [{ type: 'buff', as: [85, 115, 160], dur: 6 },
                { type: 'nuke', dmg: [420, 680, 1250] }] } },

  { id: 'omegafab', name: 'Omega Fabricator', cost: 5, traits: ['engineer', 'swarm'], shape: 'mothership',
    range: 3, hp: 1350, ad: 82, as: 0.65, mana: 110, armor: 15, speed: 1.4,
    ability: { name: 'Fabricate', text: 'Builds {0} laser turret(s).',
      vals: e => [e[0].count], effects: [{ type: 'summon', count: [1, 2, 3], kind: 'turret', hp: [650, 1050, 1800], ad: [85, 140, 240] }] } },
];

export const UNIT_BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));

// Summoned minion base defs (not purchasable)
export const MINIONS = {
  drone: { id: 'drone', name: 'Drone', cost: 0, traits: [], shape: 'drone',
    range: 1, hp: 380, ad: 38, as: 0.9, mana: 999, armor: 0, speed: 2.2, ability: null },
  turret: { id: 'turret', name: 'Laser Turret', cost: 0, traits: [], shape: 'turret',
    range: 4, hp: 650, ad: 85, as: 0.9, mana: 999, armor: 10, speed: 0, ability: null },
};

// Creep (PvE) defs
export const CREEPS = {
  husk: { id: 'creep_husk', name: 'Pirate Husk', cost: 0, traits: [], shape: 'husk',
    range: 1, hp: 450, ad: 40, as: 0.6, mana: 999, armor: 0, speed: 1.5, ability: null },
  stinger: { id: 'creep_stinger', name: 'Rust Stinger', cost: 0, traits: [], shape: 'drone',
    range: 3, hp: 380, ad: 45, as: 0.65, mana: 999, armor: 0, speed: 1.5, ability: null },
  titan: { id: 'creep_titan', name: 'Derelict Titan', cost: 0, traits: [], shape: 'bulk',
    range: 1, hp: 2600, ad: 120, as: 0.55, mana: 999, armor: 25, speed: 1.3, ability: null },
};

// PvE round compositions: round -> list of {def, mult} (mult scales hp/ad)
export const CREEP_ROUNDS = {
  1: [{ d: 'husk', m: 1 }, { d: 'husk', m: 1 }],
  2: [{ d: 'husk', m: 1 }, { d: 'husk', m: 1 }, { d: 'stinger', m: 1 }],
  5: [{ d: 'husk', m: 1.6 }, { d: 'husk', m: 1.6 }, { d: 'stinger', m: 1.6 }, { d: 'stinger', m: 1.6 }],
  9: [{ d: 'husk', m: 2.6 }, { d: 'husk', m: 2.6 }, { d: 'husk', m: 2.6 }, { d: 'stinger', m: 2.6 }, { d: 'stinger', m: 2.6 }],
  13: [{ d: 'titan', m: 1 }, { d: 'stinger', m: 3.4 }, { d: 'stinger', m: 3.4 }],
  17: [{ d: 'titan', m: 1.7 }, { d: 'husk', m: 5 }, { d: 'husk', m: 5 }, { d: 'stinger', m: 5 }],
  21: [{ d: 'titan', m: 2.6 }, { d: 'titan', m: 2.6 }, { d: 'stinger', m: 7 }, { d: 'stinger', m: 7 }],
  25: [{ d: 'titan', m: 4 }, { d: 'titan', m: 4 }, { d: 'titan', m: 4 }],
  29: [{ d: 'titan', m: 6 }, { d: 'titan', m: 6 }, { d: 'titan', m: 6 }, { d: 'titan', m: 6 }],
};

export const isCreepRound = r => !!CREEP_ROUNDS[r];

// ---------------------------------------------------------------
// Items
// ---------------------------------------------------------------
export const COMPONENTS = {
  laser: { id: 'laser', name: 'Laser Core', icon: '⌖', color: '#ff7a5c', desc: '+18% attack damage' },
  flux: { id: 'flux', name: 'Flux Coil', icon: '⟳', color: '#ffd166', desc: '+15% attack speed' },
  nano: { id: 'nano', name: 'Nano Plate', icon: '⬢', color: '#7dd87d', desc: '+200 hull' },
  plasma: { id: 'plasma', name: 'Plasma Cell', icon: '◉', color: '#c792ea', desc: '+25% ability power' },
};

// key = sorted pair joined by '+'
export const COMBINED = {
  'laser+laser': { id: 'annihilator', name: 'Annihilator Array', icon: '✹', color: '#ff5c47',
    desc: '+55% attack damage' },
  'flux+laser': { id: 'gatling', name: 'Gatling Battery', icon: '∷', color: '#ff9e42',
    desc: '+25% AD, +40% attack speed' },
  'laser+nano': { id: 'vampiric', name: 'Vampiric Hull', icon: '♥', color: '#e05c8a',
    desc: '+25% AD, 25% lifesteal' },
  'laser+plasma': { id: 'spellblade', name: 'Spellblade Prism', icon: '◤', color: '#e881d8',
    desc: '+25% AD, +30% ability power' },
  'flux+flux': { id: 'overdrive', name: 'Overdrive Coil', icon: '↻', color: '#ffd166',
    desc: '+75% attack speed' },
  'flux+nano': { id: 'reactive', name: 'Reactive Plating', icon: '⬡', color: '#b8e05c',
    desc: '+250 hull, +25% attack speed' },
  'flux+plasma': { id: 'turbine', name: 'Mana Turbine', icon: '⚛', color: '#8ad0ff',
    desc: '+25% AS, double energy from attacks' },
  'nano+nano': { id: 'fortress', name: 'Fortress Hull', icon: '⬣', color: '#7dd87d',
    desc: '+550 hull, +20 armor' },
  'nano+plasma': { id: 'voidprism', name: 'Void Prism', icon: '◈', color: '#c06fe8',
    desc: '+200 hull, wearer becomes VOID' },
  'plasma+plasma': { id: 'singularity', name: 'Singularity Core', icon: '☉', color: '#c792ea',
    desc: '+60% ability power' },
};

export const ITEM_BY_ID = (() => {
  const m = {};
  for (const c of Object.values(COMPONENTS)) m[c.id] = { ...c, component: true };
  for (const [k, it] of Object.entries(COMBINED)) m[it.id] = { ...it, recipe: k.split('+') };
  return m;
})();

export function combineKey(a, b) { return [a, b].sort().join('+'); }

// Stat application of an item id onto a sim-stat object
export function applyItem(stats, itemId) {
  switch (itemId) {
    case 'laser': stats.adMult += 0.18; break;
    case 'flux': stats.asMult += 0.15; break;
    case 'nano': stats.hpFlat += 200; break;
    case 'plasma': stats.ap += 0.25; break;
    case 'annihilator': stats.adMult += 0.55; break;
    case 'gatling': stats.adMult += 0.25; stats.asMult += 0.40; break;
    case 'vampiric': stats.adMult += 0.25; stats.ls += 0.25; break;
    case 'spellblade': stats.adMult += 0.25; stats.ap += 0.30; break;
    case 'overdrive': stats.asMult += 0.75; break;
    case 'reactive': stats.hpFlat += 250; stats.asMult += 0.25; break;
    case 'turbine': stats.asMult += 0.25; stats.manaMult += 1.0; break;
    case 'fortress': stats.hpFlat += 550; stats.armor += 20; break;
    case 'voidprism': stats.hpFlat += 200; stats.addTrait = 'void'; break;
    case 'singularity': stats.ap += 0.60; break;
  }
}

// ---------------------------------------------------------------
// Economy / progression constants
// ---------------------------------------------------------------
export const POOL_COPIES = { 1: 18, 2: 15, 3: 12, 4: 9, 5: 6 };
export const SHOP_ODDS = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 35, 15, 1],
  8: [16, 20, 35, 25, 4],
  9: [9, 15, 30, 30, 16],
};
export const XP_TO_NEXT = { 1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 56, 8: 80 };
export const MAX_LEVEL = 9;
export const REROLL_COST = 2;
export const XP_COST = 4;
export const XP_PER_BUY = 4;
export const XP_PER_ROUND = 2;
export const BENCH_SIZE = 9;
export const SHOP_SIZE = 5;
export const START_HP = 100;
export const START_GOLD = 6;
export const MAX_INTEREST = 5;

export const BOT_NAMES = ['AX-7 Kestrel', 'Cmdr. Vex', 'Riftlord', 'Unit 734', 'Capt. Mara', 'Drexl', 'Nova-9'];

export function starLabel(star) { return '★'.repeat(star); }

export function sellValue(unit) {
  const copies = Math.pow(3, unit.star - 1);
  const base = UNIT_BY_ID[unit.defId].cost;
  return unit.star === 1 ? base : base * copies - 1;
}

export function abilityText(def, star) {
  if (!def.ability) return 'No ability.';
  const s = Math.max(0, star - 1);
  const vals = def.ability.vals(def.ability.effects).map(v => Array.isArray(v) ? v[s] : v);
  return def.ability.text.replace(/\{(\d)\}/g, (_, i) => vals[+i]);
}
