import db from './db.js';

// ── 16 creatures across 5 types and 4 rarities ──────────────

const creatures = [
  // Nature family
  { id: 'grove-shell',      name: 'Grove Shell',      image_url: '/creatures/grove-shell.svg',      rarity: 'common',    type: 'nature'  },
  { id: 'moss-turtle',      name: 'Moss Turtle',      image_url: '/creatures/moss-turtle.svg',      rarity: 'uncommon',  type: 'nature'  },
  { id: 'ancient-verdant',  name: 'Ancient Verdant',  image_url: '/creatures/ancient-verdant.svg',  rarity: 'rare',      type: 'nature'  },
  // Fire family
  { id: 'ember-fox',        name: 'Ember Fox',        image_url: '/creatures/ember-fox.svg',        rarity: 'common',    type: 'fire'    },
  { id: 'blaze-hound',      name: 'Blaze Hound',      image_url: '/creatures/blaze-hound.svg',      rarity: 'uncommon',  type: 'fire'    },
  { id: 'inferno-drake',    name: 'Inferno Drake',    image_url: '/creatures/inferno-drake.svg',    rarity: 'rare',      type: 'fire'    },
  // Crystal family
  { id: 'crystal-newt',     name: 'Crystal Newt',     image_url: '/creatures/crystal-newt.svg',     rarity: 'common',    type: 'crystal' },
  { id: 'prism-salamander', name: 'Prism Salamander', image_url: '/creatures/prism-salamander.svg', rarity: 'uncommon',  type: 'crystal' },
  { id: 'gem-titan',        name: 'Gem Titan',        image_url: '/creatures/gem-titan.svg',        rarity: 'rare',      type: 'crystal' },
  // Wind family
  { id: 'breeze-hawk',      name: 'Breeze Hawk',      image_url: '/creatures/breeze-hawk.svg',      rarity: 'common',    type: 'wind'    },
  { id: 'gale-raptor',      name: 'Gale Raptor',      image_url: '/creatures/gale-raptor.svg',      rarity: 'uncommon',  type: 'wind'    },
  { id: 'storm-sovereign',  name: 'Storm Sovereign',  image_url: '/creatures/storm-sovereign.svg',  rarity: 'rare',      type: 'wind'    },
  // Shadow family
  { id: 'shadow-lynx',      name: 'Shadow Lynx',      image_url: '/creatures/shadow-lynx.svg',      rarity: 'uncommon',  type: 'shadow'  },
  { id: 'void-panther',     name: 'Void Panther',     image_url: '/creatures/void-panther.svg',     rarity: 'rare',      type: 'shadow'  },
  // Seasonal / legendary
  { id: 'ember-phoenix',    name: 'Ember Phoenix',    image_url: '/creatures/ember-phoenix.svg',    rarity: 'rare',      type: 'fire'    },
  { id: 'eclipse-lord',     name: 'Eclipse Lord',     image_url: '/creatures/eclipse-lord.svg',     rarity: 'legendary', type: 'shadow'  },
];

// ── 3-stage evolutions per creature family ───────────────────

const evolutions = [
  // Nature: Grove Shell → Moss Turtle → Ancient Verdant
  { id: 'evo-gs-1', base_creature_id: 'grove-shell',      stage: 1, name: 'Grove Shell',      image_url: '/creatures/grove-shell.svg'      },
  { id: 'evo-gs-2', base_creature_id: 'grove-shell',      stage: 2, name: 'Moss Turtle',      image_url: '/creatures/moss-turtle.svg'      },
  { id: 'evo-gs-3', base_creature_id: 'grove-shell',      stage: 3, name: 'Ancient Verdant',  image_url: '/creatures/ancient-verdant.svg'  },
  // Fire: Ember Fox → Blaze Hound → Inferno Drake
  { id: 'evo-ef-1', base_creature_id: 'ember-fox',        stage: 1, name: 'Ember Fox',        image_url: '/creatures/ember-fox.svg'        },
  { id: 'evo-ef-2', base_creature_id: 'ember-fox',        stage: 2, name: 'Blaze Hound',      image_url: '/creatures/blaze-hound.svg'      },
  { id: 'evo-ef-3', base_creature_id: 'ember-fox',        stage: 3, name: 'Inferno Drake',    image_url: '/creatures/inferno-drake.svg'    },
  // Crystal: Crystal Newt → Prism Salamander → Gem Titan
  { id: 'evo-cn-1', base_creature_id: 'crystal-newt',     stage: 1, name: 'Crystal Newt',     image_url: '/creatures/crystal-newt.svg'     },
  { id: 'evo-cn-2', base_creature_id: 'crystal-newt',     stage: 2, name: 'Prism Salamander', image_url: '/creatures/prism-salamander.svg' },
  { id: 'evo-cn-3', base_creature_id: 'crystal-newt',     stage: 3, name: 'Gem Titan',        image_url: '/creatures/gem-titan.svg'        },
  // Wind: Breeze Hawk → Gale Raptor → Storm Sovereign
  { id: 'evo-bh-1', base_creature_id: 'breeze-hawk',      stage: 1, name: 'Breeze Hawk',      image_url: '/creatures/breeze-hawk.svg'      },
  { id: 'evo-bh-2', base_creature_id: 'breeze-hawk',      stage: 2, name: 'Gale Raptor',      image_url: '/creatures/gale-raptor.svg'      },
  { id: 'evo-bh-3', base_creature_id: 'breeze-hawk',      stage: 3, name: 'Storm Sovereign',  image_url: '/creatures/storm-sovereign.svg'  },
  // Shadow: Shadow Lynx → Void Panther → Eclipse Lord
  { id: 'evo-sl-1', base_creature_id: 'shadow-lynx',      stage: 1, name: 'Shadow Lynx',      image_url: '/creatures/shadow-lynx.svg'      },
  { id: 'evo-sl-2', base_creature_id: 'shadow-lynx',      stage: 2, name: 'Void Panther',     image_url: '/creatures/void-panther.svg'     },
  { id: 'evo-sl-3', base_creature_id: 'shadow-lynx',      stage: 3, name: 'Eclipse Lord',     image_url: '/creatures/eclipse-lord.svg'     },
  // Ember Phoenix — standalone (stage 1 only, no evo chain)
  { id: 'evo-ep-1', base_creature_id: 'ember-phoenix',    stage: 1, name: 'Ember Phoenix',    image_url: '/creatures/ember-phoenix.svg'    },
  // Eclipse Lord as standalone base
  { id: 'evo-el-1', base_creature_id: 'eclipse-lord',     stage: 1, name: 'Eclipse Lord',     image_url: '/creatures/eclipse-lord.svg'     },
];

// ── Quest definitions ────────────────────────────────────────

const questDefs = [
  { id: 'q-catch-3',        title: 'Early Hunt',      description: 'Catch 3 beasts',             type: 'catch_any',    target_value: null,       required: 3,  xp_reward: 50,  coin_reward: 10 },
  { id: 'q-catch-5',        title: 'Beast Hunter',    description: 'Catch 5 beasts',             type: 'catch_any',    target_value: null,       required: 5,  xp_reward: 100, coin_reward: 20 },
  { id: 'q-catch-10',       title: 'Beast Master',    description: 'Catch 10 beasts today',      type: 'catch_any',    target_value: null,       required: 10, xp_reward: 200, coin_reward: 50 },
  { id: 'q-catch-rare',     title: 'Rare Find',       description: 'Catch a rare beast',         type: 'catch_rarity', target_value: 'rare',     required: 1,  xp_reward: 150, coin_reward: 30 },
  { id: 'q-catch-uncommon', title: 'Getting Warmer',  description: 'Catch an uncommon beast',    type: 'catch_rarity', target_value: 'uncommon', required: 1,  xp_reward: 80,  coin_reward: 15 },
  { id: 'q-catch-fire',     title: 'Fire Starter',    description: 'Catch 2 fire-type beasts',   type: 'catch_type',   target_value: 'fire',     required: 2,  xp_reward: 90,  coin_reward: 18 },
  { id: 'q-catch-nature',   title: 'Into the Wild',   description: 'Catch 2 nature-type beasts', type: 'catch_type',   target_value: 'nature',   required: 2,  xp_reward: 90,  coin_reward: 18 },
  { id: 'q-catch-shadow',   title: 'Shadow Chaser',   description: 'Catch a shadow-type beast',  type: 'catch_type',   target_value: 'shadow',   required: 1,  xp_reward: 120, coin_reward: 25 },
];

// ── Auto-rolling season (one per calendar month) ─────────────

const SEASON_THEMES = [
  { element: 'nature',  name: 'Verdant Awakening',   theme: 'The forests stir with ancient energy. Seek the beasts hidden among the roots.' },
  { element: 'fire',    name: 'The Phoenix Age',     theme: 'An ancient firebird awakens across the world. Catch it before the season ends.' },
  { element: 'crystal', name: 'Crystal Convergence', theme: 'Gemstone creatures emerge from deep underground. Hunt the prismatic beasts.' },
  { element: 'wind',    name: 'Storm Season',        theme: 'Gale-force winds carry new beasts into the open. Brave the storm.' },
  { element: 'shadow',  name: 'Eclipse Reign',       theme: 'Darkness blankets the land. Only the boldest hunters venture out.' },
];

function toSqliteDatetime(d) {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function currentSeasonDef() {
  const now = new Date();
  const monthIndex = now.getUTCMonth();
  const t = SEASON_THEMES[monthIndex % SEASON_THEMES.length];
  const start = new Date(Date.UTC(now.getUTCFullYear(), monthIndex, 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), monthIndex + 1, 0, 23, 59, 59));
  const id = `season-${start.getUTCFullYear()}-${String(monthIndex + 1).padStart(2, '0')}`;
  return { id, ...t, starts_at: toSqliteDatetime(start), ends_at: toSqliteDatetime(end) };
}

// ── Seed ─────────────────────────────────────────────────────

function seed() {
  const insCreature = db.prepare(
    'INSERT OR REPLACE INTO creatures (id, name, image_url, rarity, type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of creatures) insCreature.run(c.id, c.name, c.image_url, c.rarity, c.type);
  console.log('Seeded', creatures.length, 'creatures.');

  const insEvo = db.prepare(
    'INSERT OR REPLACE INTO creature_evolutions (id, base_creature_id, stage, name, image_url) VALUES (?, ?, ?, ?, ?)'
  );
  for (const e of evolutions) insEvo.run(e.id, e.base_creature_id, e.stage, e.name, e.image_url);
  console.log('Seeded', evolutions.length, 'evolution stages.');

  const insQuest = db.prepare(
    'INSERT OR REPLACE INTO quest_defs (id, title, description, type, target_value, required, xp_reward, coin_reward) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const q of questDefs) {
    insQuest.run(q.id, q.title, q.description, q.type, q.target_value, q.required, q.xp_reward, q.coin_reward);
  }
  console.log('Seeded', questDefs.length, 'quest definitions.');

  // Auto-rolling season for the current month
  const season = currentSeasonDef();
  db.prepare(
    'INSERT OR REPLACE INTO seasons (id, name, theme, element, exclusive_creature_id, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(season.id, season.name, season.theme, season.element, 'eclipse-lord', season.starts_at, season.ends_at);
  console.log(`Seeded season: ${season.name} (${season.starts_at.slice(0, 10)} – ${season.ends_at.slice(0, 10)})`);

  // Purge expired spawns (keep active ones intact)
  const purged = db.prepare(
    "DELETE FROM spawns WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')"
  ).run();
  if (purged.changes > 0) console.log('Purged', purged.changes, 'expired spawns.');

  console.log('Seed complete.');
}

seed();
