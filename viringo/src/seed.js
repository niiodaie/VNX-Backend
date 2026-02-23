import db from './db.js';
import { v4 as uuid } from 'uuid';

// 5 base creatures + 1 seasonal exclusive
const creatures = [
  { id: 'creature-1', name: 'Ember Fox',     image_url: '/creatures/ember-fox.svg',     rarity: 'common',    type: 'fire'    },
  { id: 'creature-2', name: 'Moss Turtle',   image_url: '/creatures/moss-turtle.svg',   rarity: 'common',    type: 'nature'  },
  { id: 'creature-3', name: 'Breeze Hawk',   image_url: '/creatures/breeze-hawk.svg',   rarity: 'uncommon',  type: 'wind'    },
  { id: 'creature-4', name: 'Crystal Newt',  image_url: '/creatures/crystal-newt.svg',  rarity: 'rare',      type: 'crystal' },
  { id: 'creature-5', name: 'Shadow Lynx',   image_url: '/creatures/shadow-lynx.svg',   rarity: 'rare',      type: 'shadow'  },
  { id: 'creature-6', name: 'Ember Phoenix', image_url: '/creatures/ember-phoenix.svg', rarity: 'legendary', type: 'fire'    },
];

// Season 1: The Phoenix Age (Feb 2026)
const season = {
  id: 'season-1',
  name: 'The Phoenix Age',
  theme: 'An ancient firebird awakens across the world. Catch it before the season ends.',
  element: 'fire',
  exclusive_creature_id: 'creature-6',
  starts_at: '2026-02-01T00:00:00.000Z',
  ends_at:   '2026-02-28T23:59:59.000Z',
};

// Play area: example area (Philadelphia City Hall approx 39.9523, -75.1638) with nearby spawn points
const SPAWN_RADIUS_M = 0.00045; // ~50m in degrees approx
const CENTER = { lat: 39.9523, lng: -75.1638 };

const spawnPoints = [
  { lat: CENTER.lat + 0.0002, lng: CENTER.lng },
  { lat: CENTER.lat - 0.00015, lng: CENTER.lng + 0.0002 },
  { lat: CENTER.lat + 0.00025, lng: CENTER.lng - 0.0002 },
  { lat: CENTER.lat, lng: CENTER.lng + 0.0003 },
  { lat: CENTER.lat - 0.0002, lng: CENTER.lng - 0.00015 },
  { lat: CENTER.lat + 0.0001, lng: CENTER.lng + 0.00025 },
  { lat: CENTER.lat - 0.00025, lng: CENTER.lng },
  { lat: CENTER.lat + 0.0003, lng: CENTER.lng + 0.0001 },
  { lat: CENTER.lat - 0.0001, lng: CENTER.lng - 0.00025 },
  { lat: CENTER.lat + 0.00015, lng: CENTER.lng - 0.0001 },
];

const evolutions = [
  // Ember Fox — fire
  { id: 'evo-1-1', base_creature_id: 'creature-1', stage: 1, name: 'Ember Fox',        image_url: '/creatures/ember-fox.svg' },
  { id: 'evo-1-2', base_creature_id: 'creature-1', stage: 2, name: 'Blaze Hound',      image_url: '/creatures/blaze-hound.svg' },
  { id: 'evo-1-3', base_creature_id: 'creature-1', stage: 3, name: 'Inferno Drake',    image_url: '/creatures/inferno-drake.svg' },
  // Moss Turtle — nature
  { id: 'evo-2-1', base_creature_id: 'creature-2', stage: 1, name: 'Moss Turtle',      image_url: '/creatures/moss-turtle.svg' },
  { id: 'evo-2-2', base_creature_id: 'creature-2', stage: 2, name: 'Grove Shell',      image_url: '/creatures/grove-shell.svg' },
  { id: 'evo-2-3', base_creature_id: 'creature-2', stage: 3, name: 'Ancient Verdant',  image_url: '/creatures/ancient-verdant.svg' },
  // Breeze Hawk — wind
  { id: 'evo-3-1', base_creature_id: 'creature-3', stage: 1, name: 'Breeze Hawk',      image_url: '/creatures/breeze-hawk.svg' },
  { id: 'evo-3-2', base_creature_id: 'creature-3', stage: 2, name: 'Gale Raptor',      image_url: '/creatures/gale-raptor.svg' },
  { id: 'evo-3-3', base_creature_id: 'creature-3', stage: 3, name: 'Storm Sovereign',  image_url: '/creatures/storm-sovereign.svg' },
  // Crystal Newt — crystal
  { id: 'evo-4-1', base_creature_id: 'creature-4', stage: 1, name: 'Crystal Newt',     image_url: '/creatures/crystal-newt.svg' },
  { id: 'evo-4-2', base_creature_id: 'creature-4', stage: 2, name: 'Prism Salamander', image_url: '/creatures/prism-salamander.svg' },
  { id: 'evo-4-3', base_creature_id: 'creature-4', stage: 3, name: 'Gem Titan',        image_url: '/creatures/gem-titan.svg' },
  // Shadow Lynx — shadow
  { id: 'evo-5-1', base_creature_id: 'creature-5', stage: 1, name: 'Shadow Lynx',      image_url: '/creatures/shadow-lynx.svg' },
  { id: 'evo-5-2', base_creature_id: 'creature-5', stage: 2, name: 'Void Panther',     image_url: '/creatures/void-panther.svg' },
  { id: 'evo-5-3', base_creature_id: 'creature-5', stage: 3, name: 'Eclipse Lord',     image_url: '/creatures/eclipse-lord.svg' },
  // Ember Phoenix — seasonal legendary (only stage 1, no evolution)
  { id: 'evo-6-1', base_creature_id: 'creature-6', stage: 1, name: 'Ember Phoenix',    image_url: '/creatures/ember-phoenix.svg' },
];

const questDefs = [
  { id: 'q-catch-3',        title: 'Early Hunt',      description: 'Catch 3 beasts',             type: 'catch_any',    target_value: null, required: 3,  xp_reward: 50,  coin_reward: 10 },
  { id: 'q-catch-5',        title: 'Beast Hunter',    description: 'Catch 5 beasts',             type: 'catch_any',    target_value: null, required: 5,  xp_reward: 100, coin_reward: 20 },
  { id: 'q-catch-rare',     title: 'Rare Find',       description: 'Catch a rare beast',         type: 'catch_rarity', target_value: 'rare',     required: 1,  xp_reward: 150, coin_reward: 30 },
  { id: 'q-catch-uncommon', title: 'Getting Warmer',  description: 'Catch an uncommon beast',    type: 'catch_rarity', target_value: 'uncommon', required: 1,  xp_reward: 80,  coin_reward: 15 },
  { id: 'q-catch-fire',     title: 'Fire Starter',    description: 'Catch 2 fire-type beasts',   type: 'catch_type',   target_value: 'fire',     required: 2,  xp_reward: 90,  coin_reward: 18 },
  { id: 'q-catch-nature',   title: 'Into the Wild',   description: 'Catch 2 nature-type beasts', type: 'catch_type',   target_value: 'nature',   required: 2,  xp_reward: 90,  coin_reward: 18 },
  { id: 'q-catch-shadow',   title: 'Shadow Chaser',   description: 'Catch a shadow-type beast',  type: 'catch_type',   target_value: 'shadow',   required: 1,  xp_reward: 120, coin_reward: 25 },
  { id: 'q-catch-10',       title: 'Beast Master',    description: 'Catch 10 beasts today',      type: 'catch_any',    target_value: null, required: 10, xp_reward: 200, coin_reward: 50 },
];

function seed() {
  const insertCreature = db.prepare(`
    INSERT OR REPLACE INTO creatures (id, name, image_url, rarity, type) VALUES (?, ?, ?, ?, ?)
  `);
  creatures.forEach((c) => insertCreature.run(c.id, c.name, c.image_url, c.rarity, c.type));

  const insertEvo = db.prepare(`
    INSERT OR REPLACE INTO creature_evolutions (id, base_creature_id, stage, name, image_url)
    VALUES (?, ?, ?, ?, ?)
  `);
  evolutions.forEach((e) => insertEvo.run(e.id, e.base_creature_id, e.stage, e.name, e.image_url));
  console.log('Seeded', evolutions.length, 'evolution stages.');

  const insertQuest = db.prepare(`
    INSERT OR REPLACE INTO quest_defs (id, title, description, type, target_value, required, xp_reward, coin_reward)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  questDefs.forEach((q) =>
    insertQuest.run(q.id, q.title, q.description, q.type, q.target_value, q.required, q.xp_reward, q.coin_reward)
  );
  console.log('Seeded', questDefs.length, 'quest definitions.');

  db.exec('DELETE FROM spawns');
  const insertSpawn = db.prepare(`
    INSERT INTO spawns (id, creature_id, lat, lng, expires_at) VALUES (?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour

  spawnPoints.forEach((point, i) => {
    const creature = creatures[i % creatures.length];
    insertSpawn.run(uuid(), creature.id, point.lat, point.lng, expires);
  });

  console.log('Seeded', creatures.length, 'creatures and', spawnPoints.length, 'spawns.');

  // Seed Season 1
  db.prepare(`
    INSERT OR REPLACE INTO seasons (id, name, theme, element, exclusive_creature_id, starts_at, ends_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(season.id, season.name, season.theme, season.element, season.exclusive_creature_id, season.starts_at, season.ends_at);
  console.log('Seeded season:', season.name);
}

seed();
