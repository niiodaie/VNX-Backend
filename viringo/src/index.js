import { createRequire } from 'node:module';
import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import db from './db.js';

const require = createRequire(import.meta.url);
const { version: API_VERSION } = require('../package.json');

const app = express();

// TEMP: allow all origins to verify CORS quickly
app.use(
  cors({
    origin: true,          // reflect request origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-User-Id'],
  }),
);

app.use(express.json());
// Allow configured frontends; default to known production/staging domains.
const defaultOrigins = [
  'https://viringo.pro',
  'https://www.viringo.pro',
  'https://viringo.visnec.com',
  'https://viringo.vercel.app',
];

const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((o) => o.trim())
  : defaultOrigins;

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / curl / server-to-server (no Origin header),
      // and any origin explicitly listed above.
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.use(express.json());


const DEFAULT_RADIUS_KM = 1.0;
const LOCAL_LEADERBOARD_RADIUS_KM = 50;
const SPAWN_COUNT_PER_CELL = 12;
const SPAWN_TTL_HOURS = 6;

function toSqliteDatetime(d) {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

// Auto-generate a fun display name from the user's UUID
const NAME_ADJ  = ['Ember','Breeze','Crystal','Shadow','Grove','Gale','Void','Prism','Storm','Inferno','Moss','Arcane'];
const NAME_NOUN = ['Hunter','Roamer','Seeker','Walker','Scout','Tracker','Warden','Stalker','Wanderer','Chaser','Ranger','Drifter'];
function generateDisplayName(userId) {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const adj  = NAME_ADJ[h % NAME_ADJ.length];
  const noun = NAME_NOUN[(h >>> 4) % NAME_NOUN.length];
  const num  = String((h >>> 8) % 100).padStart(2, '0');
  return `${adj}${noun}${num}`;
}
const XP_PER_CATCH = { common: 20, uncommon: 40, rare: 80, legendary: 120 };

// Season points awarded per catch (separate from player XP)
const SEASON_PTS = { common: 1, uncommon: 2, rare: 4, legendary: 10 };

// Tier thresholds (points required to reach each tier)
const TIERS = [
  { name: 'bronze',   min: 10,  label: 'Bronze',   color: '#cd7f32' },
  { name: 'silver',   min: 50,  label: 'Silver',   color: '#9aa5b4' },
  { name: 'gold',     min: 150, label: 'Gold',     color: '#f59e0b' },
  { name: 'platinum', min: 350, label: 'Platinum', color: '#a78bfa' },
];

// Season reward milestones shown in the UI
const SEASON_MILESTONES = [
  { points: 10,  tier: 'bronze',   label: 'Bronze Crest'   },
  { points: 50,  tier: 'silver',   label: 'Silver Crest'   },
  { points: 150, tier: 'gold',     label: 'Gold Crest'     },
  { points: 350, tier: 'platinum', label: 'Platinum Crown' },
];

function getTier(points) {
  let tier = null;
  for (const t of TIERS) { if (points >= t.min) tier = t; }
  return tier;
}

function getCurrentSeason() {
  return db.prepare(`
    SELECT s.*, c.name AS excl_name, c.image_url AS excl_image, c.rarity AS excl_rarity, c.type AS excl_type
    FROM seasons s
    LEFT JOIN creatures c ON c.id = s.exclusive_creature_id
    WHERE datetime('now') BETWEEN s.starts_at AND s.ends_at
    LIMIT 1
  `).get() || null;
}
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5700, 7500];

// Beast instance leveling
const BEAST_XP_PER_CATCH = 50;
const BEAST_XP_PER_LEVEL = 50;
const MAX_BEAST_LEVEL = 15;
const EVOLVE_LEVELS = { 1: 5, 2: 10 }; // stage → min level needed to evolve

function beastLevelFromXp(xp) {
  return Math.min(MAX_BEAST_LEVEL, Math.floor(xp / BEAST_XP_PER_LEVEL) + 1);
}

// Procedural spawn generation — called when a player enters an area with no active spawns.
// Seeded RNG from grid-cell + calendar date for deterministic daily layouts.
// Generates SPAWN_COUNT_PER_CELL spawns with staggered TTLs for natural rotation.
const _generateSpawnsNearTx = db.transaction((centerLat, centerLng, userId) => {
  const CELL = 0.005; // ~500 m grid
  const cellLat = Math.round(centerLat / CELL) * CELL;
  const cellLng = Math.round(centerLng / CELL) * CELL;

  const active = db.prepare(`
    SELECT COUNT(*) AS n FROM spawns
    WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
    AND (expires_at IS NULL OR expires_at > datetime('now'))
  `).get(cellLat - CELL, cellLat + CELL, cellLng - CELL, cellLng + CELL);
  if (active.n > 0) return;

  db.prepare(`
    DELETE FROM spawns
    WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
    AND expires_at IS NOT NULL AND expires_at <= datetime('now')
  `).run(cellLat - CELL * 3, cellLat + CELL * 3, cellLng - CELL * 3, cellLng + CELL * 3);

  const effects = getActiveEffects(userId);
  const dailyDistance = getTodayDistance(userId);
  const baseCount = SPAWN_COUNT_PER_CELL * (effects.lure ? 2 : 1);
  const bonusSpawns = dailyDistance >= 1000 ? Math.min(4, Math.floor(dailyDistance / 1000)) : 0;
  const totalSpawns = baseCount + bonusSpawns;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let seed = (Math.abs(Math.floor(cellLat * 10000)) * 31337 + Math.abs(Math.floor(cellLng * 10000)) * 13337 + parseInt(today)) >>> 0;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  }

  const allCreatures = db.prepare('SELECT id, rarity FROM creatures').all();
  const byRarity = {
    common:    allCreatures.filter(c => c.rarity === 'common'),
    uncommon:  allCreatures.filter(c => c.rarity === 'uncommon'),
    rare:      allCreatures.filter(c => c.rarity === 'rare'),
    legendary: allCreatures.filter(c => c.rarity === 'legendary'),
  };

  const activeSeason = getCurrentSeason();
  const hasLegendary = activeSeason && byRarity.legendary.length > 0;
  const incense = effects.incense;

  const insert = db.prepare('INSERT INTO spawns (id, creature_id, lat, lng, expires_at) VALUES (?, ?, ?, ?, ?)');

  for (let i = 0; i < totalSpawns; i++) {
    const angle = rand() * Math.PI * 2;
    const dist  = rand() * 0.004 + 0.0005;
    const spawnLat = centerLat + Math.cos(angle) * dist;
    const spawnLng = centerLng + Math.sin(angle) * dist;

    const ttlMs = (SPAWN_TTL_HOURS + (rand() * 4 - 2)) * 60 * 60 * 1000;
    const expires = toSqliteDatetime(new Date(Date.now() + ttlMs));

    const r = rand();
    let pool;
    if (incense && hasLegendary && r >= 0.70) pool = byRarity.legendary;
    else if (incense && r >= 0.85) pool = byRarity.rare;
    else if (incense && r >= 0.55) pool = byRarity.uncommon;
    else if (incense) pool = byRarity.common;
    else if (hasLegendary && r >= 0.92) pool = byRarity.legendary;
    else if (r < 0.50) pool = byRarity.common;
    else if (r < 0.75) pool = byRarity.uncommon;
    else pool = byRarity.rare;
    if (!pool || pool.length === 0) pool = byRarity.common;

    const picked = pool[Math.floor(rand() * pool.length)];
    insert.run(uuid(), picked.id, spawnLat, spawnLng, expires);
  }
});

function generateSpawnsNear(centerLat, centerLng, userId = null) {
  _generateSpawnsNearTx(centerLat, centerLng, userId);
}

function xpToLevel(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getOrCreateUserId(req) {
  let userId = req.headers['x-user-id'] || req.body?.user_id;
  if (!userId) userId = uuid();
  const existing = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(userId);
  if (!existing) {
    const displayName = generateDisplayName(userId);
    db.prepare('INSERT INTO users (id, display_name) VALUES (?, ?)').run(userId, displayName);
  } else if (!existing.display_name) {
    // Backfill name for existing users without one
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(generateDisplayName(userId), userId);
  }
  return userId;
}

function getOrCreateStats(userId) {
  let stats = db.prepare('SELECT * FROM player_stats WHERE user_id = ?').get(userId);
  if (!stats) {
    db.prepare('INSERT INTO player_stats (user_id) VALUES (?)').run(userId);
    stats = db.prepare('SELECT * FROM player_stats WHERE user_id = ?').get(userId);
  }
  return stats;
}

// Pick 3 random quest defs for the day (deterministic per user+date using a simple hash)
function getDailyQuestDefs(userId, date) {
  const all = db.prepare('SELECT * FROM quest_defs').all();
  // Seeded shuffle: hash userId+date to get consistent daily selection
  let hash = 0;
  for (const ch of userId + date) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const shuffled = [...all].sort((a, b) => {
    const ha = (hash ^ a.id.charCodeAt(0) * 2654435761) >>> 0;
    const hb = (hash ^ b.id.charCodeAt(0) * 2654435761) >>> 0;
    return ha - hb;
  });
  return shuffled.slice(0, 3);
}

function ensureDailyQuests(userId, date) {
  const existing = db.prepare('SELECT quest_def_id FROM daily_quests WHERE user_id = ? AND date = ?').all(userId, date);
  if (existing.length > 0) return;
  const defs = getDailyQuestDefs(userId, date);
  const insert = db.prepare('INSERT INTO daily_quests (id, user_id, quest_def_id, date) VALUES (?, ?, ?, ?)');
  for (const def of defs) insert.run(uuid(), userId, def.id, date);
}

// Update quest progress after a catch
function updateQuestProgress(userId, creature) {
  const date = todayDate();
  ensureDailyQuests(userId, date);
  const quests = db.prepare(`
    SELECT dq.*, qd.type, qd.target_value, qd.required
    FROM daily_quests dq
    JOIN quest_defs qd ON qd.id = dq.quest_def_id
    WHERE dq.user_id = ? AND dq.date = ? AND dq.claimed = 0
  `).all(userId, date);

  const update = db.prepare('UPDATE daily_quests SET progress = MIN(progress + 1, ?) WHERE id = ?');
  for (const q of quests) {
    if (q.progress >= q.required) continue;
    const matches =
      q.type === 'catch_any' ||
      (q.type === 'catch_rarity' && q.target_value === creature.rarity) ||
      (q.type === 'catch_type'   && q.target_value === creature.type);
    if (matches) update.run(q.required, q.id);
  }
}

// Award XP + update streak
function awardXP(userId, xp) {
  const stats = getOrCreateStats(userId);
  const today = todayDate();
  let newStreak = stats.streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (stats.last_active_date === yesterday) newStreak += 1;
  else if (stats.last_active_date !== today) newStreak = 1;
  const streakBonus = Math.floor(xp * (newStreak > 1 ? 0.1 * Math.min(newStreak, 7) : 0));
  const totalXp = stats.xp + xp + streakBonus;
  const newLevel = xpToLevel(totalXp);
  db.prepare(`
    UPDATE player_stats SET xp = ?, level = ?, streak = ?, last_active_date = ?, updated_at = datetime('now')
    WHERE user_id = ?
  `).run(totalXp, newLevel, newStreak, today, userId);
  return { xp: totalXp, level: newLevel, streak: newStreak, xpGained: xp + streakBonus, streakBonus, levelUp: newLevel > stats.level };
}

// ── Routes ──────────────────────────────────────────────────

const spawnQuery = db.prepare(`
  SELECT s.id, s.creature_id, s.lat, s.lng, s.expires_at,
         c.name, c.image_url, c.rarity, c.type
  FROM spawns s JOIN creatures c ON c.id = s.creature_id
  WHERE s.lat BETWEEN ? AND ? AND s.lng BETWEEN ? AND ?
  AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
`);

app.get('/spawns', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusKm = parseFloat(req.query.radius) || DEFAULT_RADIUS_KM;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat and lng required' });
  const userId = req.headers['x-user-id'] || null;
  const d = radiusKm / 111;
  let rows = spawnQuery.all(lat - d, lat + d, lng - d, lng + d);
  if (rows.length === 0) {
    generateSpawnsNear(lat, lng, userId);
    rows = spawnQuery.all(lat - d, lat + d, lng - d, lng + d);
  }
  res.json(rows);
});

app.post('/catch', (req, res) => {
  try {
    const userId = getOrCreateUserId(req);
    const { spawn_id, creature_id, lat, lng } = req.body || {};
    if (!creature_id && !spawn_id) return res.status(400).json({ error: 'spawn_id or creature_id required' });

    let creatureId = creature_id;
    if (spawn_id) {
      const spawn = db.prepare('SELECT creature_id FROM spawns WHERE id = ?').get(spawn_id);
      if (!spawn) return res.status(404).json({ error: 'spawn not found' });
      creatureId = spawn.creature_id;
    }

    const validCreature = db.prepare('SELECT id FROM creatures WHERE id = ?').get(creatureId);
    if (!validCreature) return res.status(400).json({ error: 'invalid creature_id' });

    // Delete spawn BEFORE inserting catch to avoid FK constraint issues if enforcement is on
    if (spawn_id) {
      db.prepare('DELETE FROM spawns WHERE id = ?').run(spawn_id);
    }

    db.prepare('INSERT INTO catches (id, user_id, creature_id, spawn_id, lat, lng) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), userId, creatureId, spawn_id || null, lat ?? null, lng ?? null);

    const creature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(creatureId);
    if (!creature) return res.status(400).json({ error: 'creature not found after catch' });

    let xp = XP_PER_CATCH[creature.rarity] ?? 20;
    if (getActiveEffects(userId).lucky_charm) xp *= 2;
    const statsUpdate = awardXP(userId, xp);
    updateQuestProgress(userId, creature);

    // Award season points if an active season exists
    const activeSeason = getCurrentSeason();
    let seasonPoints = null;
    if (activeSeason) {
      const pts = SEASON_PTS[creature.rarity] ?? 1;
      const existing = db.prepare('SELECT * FROM season_entries WHERE season_id = ? AND user_id = ?').get(activeSeason.id, userId);
      if (existing) {
        db.prepare(`UPDATE season_entries SET points = points + ?, updated_at = datetime('now') WHERE season_id = ? AND user_id = ?`)
          .run(pts, activeSeason.id, userId);
        seasonPoints = existing.points + pts;
      } else {
        db.prepare('INSERT OR IGNORE INTO season_entries (id, season_id, user_id, points) VALUES (?, ?, ?, ?)')
          .run(uuid(), activeSeason.id, userId, pts);
        const inserted = db.prepare('SELECT points FROM season_entries WHERE season_id = ? AND user_id = ?').get(activeSeason.id, userId);
        seasonPoints = inserted?.points ?? pts;
      }
    }

    // Update or create beast instance
    const existingBeast = db.prepare('SELECT * FROM beast_instances WHERE user_id = ? AND base_creature_id = ?').get(userId, creatureId);
    let beastInstance;
    if (existingBeast) {
      const newXp = Math.min(existingBeast.beast_xp + BEAST_XP_PER_CATCH, (MAX_BEAST_LEVEL - 1) * BEAST_XP_PER_LEVEL);
      const newLevel = beastLevelFromXp(newXp);
      db.prepare('UPDATE beast_instances SET beast_xp = ?, level = ? WHERE id = ?')
        .run(newXp, newLevel, existingBeast.id);
      beastInstance = { ...existingBeast, beast_xp: newXp, level: newLevel };
    } else {
      const newXp = BEAST_XP_PER_CATCH;
      const newLevel = beastLevelFromXp(newXp);
      const beastId = uuid();
      db.prepare('INSERT OR IGNORE INTO beast_instances (id, user_id, base_creature_id, stage, level, beast_xp) VALUES (?, ?, ?, 1, ?, ?)')
        .run(beastId, userId, creatureId, newLevel, newXp);
      const saved = db.prepare('SELECT * FROM beast_instances WHERE user_id = ? AND base_creature_id = ?').get(userId, creatureId);
      beastInstance = saved ?? { id: beastId, user_id: userId, base_creature_id: creatureId, stage: 1, level: newLevel, beast_xp: newXp };
    }
    const canEvolve = (EVOLVE_LEVELS[beastInstance.stage] ?? Infinity) <= beastInstance.level;

    const updatedStats = getOrCreateStats(userId);
    res.status(201).json({ creature, user_id: userId, ...statsUpdate, coins: updatedStats.coins, beastInstance, canEvolve, seasonPoints });
  } catch (err) {
    console.error('[POST /catch] Unhandled error:', err);
    res.status(500).json({ error: 'Catch failed. Please try again.' });
  }
});

app.get('/me/bestiary', (req, res) => {
  const userId = req.headers['x-user-id'];
  const creatures = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures').all();
  if (!userId) return res.json(creatures.map(c => ({ ...c, discovered: false, total_caught: 0, first_caught_at: null, beast_stage: null, beast_level: null })));

  const catchesByCreature = db.prepare(`
    SELECT creature_id, COUNT(*) AS total_caught, MIN(caught_at) AS first_caught_at
    FROM catches WHERE user_id = ? GROUP BY creature_id
  `).all(userId);
  const catchMap = Object.fromEntries(catchesByCreature.map(r => [r.creature_id, { total_caught: r.total_caught, first_caught_at: r.first_caught_at }]));

  const beasts = db.prepare('SELECT base_creature_id, stage, level FROM beast_instances WHERE user_id = ?').all(userId);
  const beastMap = Object.fromEntries(beasts.map(b => [b.base_creature_id, { stage: b.stage, level: b.level }]));

  const entries = creatures.map(c => {
    const caught = catchMap[c.id];
    const total_caught = caught?.total_caught ?? 0;
    const beast = beastMap[c.id];
    return {
      ...c,
      discovered: total_caught > 0,
      total_caught,
      first_caught_at: caught?.first_caught_at ?? null,
      beast_stage: beast?.stage ?? null,
      beast_level: beast?.level ?? null,
    };
  });
  res.json(entries);
});

app.get('/me/collection', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json([]);
  const rows = db.prepare(`
    SELECT ca.id, ca.creature_id, ca.lat, ca.lng, ca.caught_at,
           c.name, c.image_url, c.rarity, c.type
    FROM catches ca JOIN creatures c ON c.id = ca.creature_id
    WHERE ca.user_id = ?
    ORDER BY ca.caught_at DESC
  `).all(userId);
  res.json(rows);
});

app.get('/me/stats', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json({ xp: 0, level: 1, coins: 0, streak: 0 });
  const stats = getOrCreateStats(userId);
  const nextLevelXp = LEVEL_THRESHOLDS[stats.level] ?? null;
  const currentLevelXp = LEVEL_THRESHOLDS[stats.level - 1] ?? 0;
  res.json({ ...stats, nextLevelXp, currentLevelXp });
});

app.get('/me/quests', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json([]);
  const date = todayDate();
  ensureDailyQuests(userId, date);
  const rows = db.prepare(`
    SELECT dq.id, dq.progress, dq.claimed,
           qd.title, qd.description, qd.required, qd.xp_reward, qd.coin_reward, qd.type, qd.target_value
    FROM daily_quests dq JOIN quest_defs qd ON qd.id = dq.quest_def_id
    WHERE dq.user_id = ? AND dq.date = ?
  `).all(userId, date);
  res.json(rows);
});

app.post('/me/quests/:id/claim', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const quest = db.prepare(`
    SELECT dq.*, qd.required, qd.xp_reward, qd.coin_reward
    FROM daily_quests dq JOIN quest_defs qd ON qd.id = dq.quest_def_id
    WHERE dq.id = ? AND dq.user_id = ?
  `).get(req.params.id, userId);
  if (!quest) return res.status(404).json({ error: 'quest not found' });
  if (quest.claimed) return res.status(400).json({ error: 'already claimed' });
  if (quest.progress < quest.required) return res.status(400).json({ error: 'not completed yet' });

  db.prepare('UPDATE daily_quests SET claimed = 1, claimed_at = datetime(\'now\') WHERE id = ?').run(quest.id);
  db.prepare('UPDATE player_stats SET coins = coins + ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(quest.coin_reward, userId);
  const statsUpdate = awardXP(userId, quest.xp_reward);
  res.json({ claimed: true, ...statsUpdate, coins_earned: quest.coin_reward });
});

app.get('/creatures', (req, res) => {
  res.json(db.prepare('SELECT id, name, image_url, rarity, type FROM creatures').all());
});

app.post('/me', (req, res) => {
  const userId = getOrCreateUserId(req);
  res.json({ user_id: userId });
});

// ── Leaderboard ─────────────────────────────────────────────

const LEADERBOARD_LIMIT = 20;

function buildLeaderboardRows(rows, currentUserId) {
  return rows.map((row, i) => ({
    rank: i + 1,
    user_id: row.user_id,
    display_name: row.display_name || generateDisplayName(row.user_id),
    level: row.level,
    xp: row.xp,
    streak: row.streak,
    total_caught: row.total_caught,
    species_count: row.species_count,
    is_me: row.user_id === currentUserId,
  }));
}

app.get('/leaderboard', (req, res) => {
  const userId = req.headers['x-user-id'] || null;
  const mode   = req.query.mode === 'local' ? 'local' : 'global';
  const lat    = parseFloat(req.query.lat);
  const lng    = parseFloat(req.query.lng);

  let rows;
  if (mode === 'local' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const d = LOCAL_LEADERBOARD_RADIUS_KM / 111;
    rows = db.prepare(`
      SELECT u.id AS user_id, u.display_name,
             ps.xp, ps.level, ps.streak,
             COUNT(DISTINCT ca.creature_id) AS species_count,
             COUNT(ca.id) AS total_caught
      FROM users u
      JOIN player_stats ps ON ps.user_id = u.id
      JOIN catches ca ON ca.user_id = u.id
      WHERE ca.lat BETWEEN ? AND ? AND ca.lng BETWEEN ? AND ?
      GROUP BY u.id
      ORDER BY ps.xp DESC
      LIMIT ?
    `).all(lat - d, lat + d, lng - d, lng + d, LEADERBOARD_LIMIT);
  } else {
    rows = db.prepare(`
      SELECT u.id AS user_id, u.display_name,
             ps.xp, ps.level, ps.streak,
             COUNT(DISTINCT ca.creature_id) AS species_count,
             COUNT(ca.id) AS total_caught
      FROM users u
      JOIN player_stats ps ON ps.user_id = u.id
      LEFT JOIN catches ca ON ca.user_id = u.id
      GROUP BY u.id
      ORDER BY ps.xp DESC
      LIMIT ?
    `).all(LEADERBOARD_LIMIT);
  }

  const entries = buildLeaderboardRows(rows, userId);

  // Include current user's rank even if outside top-20
  let userEntry = entries.find(e => e.is_me) || null;
  if (!userEntry && userId) {
    const userStats = db.prepare('SELECT * FROM player_stats WHERE user_id = ?').get(userId);
    if (userStats) {
      const rankRow = db.prepare(`
        SELECT COUNT(*) + 1 AS rank FROM player_stats WHERE xp > ?
      `).get(userStats.xp);
      const totalCaught = db.prepare('SELECT COUNT(*) AS n FROM catches WHERE user_id = ?').get(userId);
      const species     = db.prepare('SELECT COUNT(DISTINCT creature_id) AS n FROM catches WHERE user_id = ?').get(userId);
      const user        = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
      userEntry = {
        rank: rankRow.rank,
        user_id: userId,
        display_name: user?.display_name || generateDisplayName(userId),
        level: userStats.level,
        xp: userStats.xp,
        streak: userStats.streak,
        total_caught: totalCaught.n,
        species_count: species.n,
        is_me: true,
      };
    }
  }

  res.json({ entries, userEntry, mode });
});

app.patch('/me/name', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { name } = req.body || {};
  if (!name || name.trim().length < 2 || name.trim().length > 20) {
    return res.status(400).json({ error: 'Name must be 2–20 characters' });
  }
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name.trim(), userId);
  res.json({ display_name: name.trim() });
});

app.get('/me/beasts', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json([]);
  const beasts = db.prepare(`
    SELECT bi.id, bi.base_creature_id, bi.stage, bi.level, bi.beast_xp, bi.evolved_at, bi.first_caught_at,
           ce.name AS current_name, ce.image_url AS current_image,
           c.type, c.rarity,
           (SELECT COUNT(*) FROM catches ca WHERE ca.user_id = bi.user_id AND ca.creature_id = bi.base_creature_id) AS total_caught
    FROM beast_instances bi
    JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage
    JOIN creatures c ON c.id = bi.base_creature_id
    WHERE bi.user_id = ?
    ORDER BY bi.first_caught_at ASC
  `).all(userId);
  const withFlags = beasts.map((b) => ({
    ...b,
    can_evolve: b.stage < 3 && b.level >= (EVOLVE_LEVELS[b.stage] ?? Infinity),
    xp_to_next_level: b.level < MAX_BEAST_LEVEL ? (b.level * BEAST_XP_PER_LEVEL) - b.beast_xp : 0,
  }));
  res.json(withFlags);
});

app.post('/me/beasts/:id/evolve', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const beast = db.prepare('SELECT * FROM beast_instances WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!beast) return res.status(404).json({ error: 'beast not found' });
  if (beast.stage >= 3) return res.status(400).json({ error: 'already at max stage' });
  const requiredLevel = EVOLVE_LEVELS[beast.stage];
  if (beast.level < requiredLevel) return res.status(400).json({ error: `Level ${requiredLevel} required` });

  const newStage = beast.stage + 1;
  db.prepare("UPDATE beast_instances SET stage = ?, evolved_at = datetime('now') WHERE id = ?").run(newStage, beast.id);
  const evo = db.prepare('SELECT * FROM creature_evolutions WHERE base_creature_id = ? AND stage = ?').get(beast.base_creature_id, newStage);
  res.json({ id: beast.id, stage: newStage, level: beast.level, beast_xp: beast.beast_xp, evo });
});

// ── Season endpoints ────────────────────────────────────────

app.get('/seasons/current', (req, res) => {
  const userId = req.headers['x-user-id'] || null;
  const season = getCurrentSeason();
  if (!season) return res.json({ season: null, userEntry: null, milestones: SEASON_MILESTONES });

  const seasonData = {
    id: season.id,
    name: season.name,
    theme: season.theme,
    element: season.element,
    starts_at: season.starts_at,
    ends_at: season.ends_at,
    exclusive_creature: season.exclusive_creature_id ? {
      id: season.exclusive_creature_id,
      name: season.excl_name,
      image_url: season.excl_image,
      rarity: season.excl_rarity,
      type: season.excl_type,
    } : null,
  };

  let userEntry = null;
  if (userId) {
    const entry = db.prepare('SELECT * FROM season_entries WHERE season_id = ? AND user_id = ?').get(season.id, userId);
    const points = entry?.points ?? 0;
    const tier = getTier(points);
    const rankRow = db.prepare('SELECT COUNT(*) + 1 AS rank FROM season_entries WHERE season_id = ? AND points > ?').get(season.id, points);
    const hasExclusive = season.exclusive_creature_id
      ? !!db.prepare('SELECT id FROM catches WHERE user_id = ? AND creature_id = ?').get(userId, season.exclusive_creature_id)
      : false;
    userEntry = { points, tier: tier?.name ?? null, rank: rankRow.rank, has_exclusive: hasExclusive };
  }

  res.json({ season: seasonData, userEntry, milestones: SEASON_MILESTONES });
});

app.get('/seasons/current/leaderboard', (req, res) => {
  const userId = req.headers['x-user-id'] || null;
  const season = getCurrentSeason();
  if (!season) return res.json({ entries: [], userEntry: null });

  const rows = db.prepare(`
    SELECT u.id AS user_id, u.display_name,
           ps.level, ps.streak,
           se.points
    FROM season_entries se
    JOIN users u ON u.id = se.user_id
    JOIN player_stats ps ON ps.user_id = se.user_id
    WHERE se.season_id = ?
    ORDER BY se.points DESC
    LIMIT 20
  `).all(season.id);

  const entries = rows.map((row, i) => ({
    rank: i + 1,
    user_id: row.user_id,
    display_name: row.display_name || generateDisplayName(row.user_id),
    level: row.level,
    streak: row.streak,
    points: row.points,
    tier: getTier(row.points)?.name ?? null,
    is_me: row.user_id === userId,
  }));

  let userEntry = entries.find(e => e.is_me) || null;
  if (!userEntry && userId) {
    const entry = db.prepare('SELECT * FROM season_entries WHERE season_id = ? AND user_id = ?').get(season.id, userId);
    if (entry) {
      const rankRow = db.prepare('SELECT COUNT(*) + 1 AS rank FROM season_entries WHERE season_id = ? AND points > ?').get(season.id, entry.points);
      const u = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
      const ps = db.prepare('SELECT level, streak FROM player_stats WHERE user_id = ?').get(userId);
      userEntry = {
        rank: rankRow.rank,
        user_id: userId,
        display_name: u?.display_name || generateDisplayName(userId),
        level: ps?.level ?? 1,
        streak: ps?.streak ?? 0,
        points: entry.points,
        tier: getTier(entry.points)?.name ?? null,
        is_me: true,
      };
    }
  }

  res.json({ entries, userEntry });
});

// ── Haversine distance ──────────────────────────────────────

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAX_SINGLE_UPDATE_METERS = 200;
const MIN_UPDATE_METERS = 5;

function getTodayDistance(userId) {
  if (!userId) return 0;
  const row = db.prepare('SELECT meters FROM daily_distance WHERE user_id = ? AND date = ?').get(userId, todayDate());
  return row?.meters ?? 0;
}

function getActiveEffects(userId) {
  if (!userId) return { lure: false, incense: false, lucky_charm: false };
  const rows = db.prepare(
    "SELECT effect_type FROM active_effects WHERE user_id = ? AND expires_at > datetime('now')"
  ).all(userId);
  const set = new Set(rows.map((r) => r.effect_type));
  return {
    lure: set.has('lure'),
    incense: set.has('incense'),
    lucky_charm: set.has('lucky_charm'),
  };
}

// ── Presence (in-memory, ephemeral) ─────────────────────────

const presenceMap = new Map();
const PRESENCE_TTL_MS = 3 * 60 * 1000;

app.put('/me/presence', (req, res) => {
  const userId = getOrCreateUserId(req);
  const { lat, lng } = req.body || {};
  if (Number.isNaN(+lat) || Number.isNaN(+lng)) return res.status(400).json({ error: 'lat and lng required' });

  const prev = presenceMap.get(userId);
  let distanceDelta = 0;

  if (prev && prev.lat != null && prev.lng != null) {
    const d = haversineMeters(prev.lat, prev.lng, +lat, +lng);
    if (d >= MIN_UPDATE_METERS && d <= MAX_SINGLE_UPDATE_METERS) {
      distanceDelta = d;
      const today = todayDate();
      const existing = db.prepare('SELECT meters FROM daily_distance WHERE user_id = ? AND date = ?').get(userId, today);
      if (existing) {
        db.prepare('UPDATE daily_distance SET meters = meters + ? WHERE user_id = ? AND date = ?').run(distanceDelta, userId, today);
      } else {
        db.prepare('INSERT INTO daily_distance (user_id, date, meters) VALUES (?, ?, ?)').run(userId, today, distanceDelta);
      }
      db.prepare('UPDATE player_stats SET total_meters = total_meters + ? WHERE user_id = ?').run(distanceDelta, userId);
      updateWalkQuestProgress(userId, distanceDelta);
    }
  }

  const user  = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
  const stats = db.prepare('SELECT level FROM player_stats WHERE user_id = ?').get(userId);
  presenceMap.set(userId, {
    lat: +lat,
    lng: +lng,
    lastSeen: Date.now(),
    displayName: user?.display_name || generateDisplayName(userId),
    level: stats?.level ?? 1,
  });
  res.json({ ok: true, distance_delta: Math.round(distanceDelta) });
});

app.get('/presence/nearby', (req, res) => {
  const userId  = req.headers['x-user-id'] || null;
  const lat     = parseFloat(req.query.lat);
  const lng     = parseFloat(req.query.lng);
  const radiusKm = parseFloat(req.query.radius) || 1.0;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat and lng required' });
  const now = Date.now();
  const d   = radiusKm / 111;
  const nearby = [];
  for (const [uid, p] of presenceMap) {
    if (now - p.lastSeen > PRESENCE_TTL_MS) { presenceMap.delete(uid); continue; }
    if (uid === userId) continue;
    if (Math.abs(p.lat - lat) <= d && Math.abs(p.lng - lng) <= d) {
      nearby.push({ user_id: uid, lat: p.lat, lng: p.lng, display_name: p.displayName, level: p.level });
    }
  }
  res.json(nearby);
});

// ── Walking quest progress ──────────────────────────────────

function updateWalkQuestProgress(userId, deltaMeters) {
  const date = todayDate();
  ensureDailyQuests(userId, date);
  const quests = db.prepare(`
    SELECT dq.*, qd.type, qd.target_value, qd.required
    FROM daily_quests dq
    JOIN quest_defs qd ON qd.id = dq.quest_def_id
    WHERE dq.user_id = ? AND dq.date = ? AND dq.claimed = 0 AND qd.type = 'walk_distance'
  `).all(userId, date);

  for (const q of quests) {
    if (q.progress >= q.required) continue;
    const newProgress = Math.min(q.required, q.progress + Math.round(deltaMeters));
    db.prepare('UPDATE daily_quests SET progress = ? WHERE id = ?').run(newProgress, q.id);
  }
}

// ── Distance endpoint ───────────────────────────────────────

app.get('/me/distance', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json({ today_meters: 0, total_meters: 0, milestones: [] });
  const today = getTodayDistance(userId);
  const stats = db.prepare('SELECT total_meters FROM player_stats WHERE user_id = ?').get(userId);
  const total = stats?.total_meters ?? 0;

  const DISTANCE_MILESTONES = [500, 1000, 2000, 5000, 10000];
  const milestones = DISTANCE_MILESTONES.map((m) => ({
    meters: m,
    label: m >= 1000 ? `${m / 1000}km` : `${m}m`,
    reached_today: today >= m,
    reached_total: total >= m,
  }));

  res.json({ today_meters: Math.round(today), total_meters: Math.round(total), milestones });
});

// ── Shop ────────────────────────────────────────────────────

app.get('/shop/items', (req, res) => {
  const items = db.prepare('SELECT id, name, description, price, effect_type, duration_min, image_url FROM shop_items').all();
  res.json(items);
});

app.post('/shop/buy', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ error: 'item_id required' });

  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'item not found' });

  const stats = getOrCreateStats(userId);
  if (stats.coins < item.price) return res.status(400).json({ error: 'not enough coins' });

  db.prepare('UPDATE player_stats SET coins = coins - ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(item.price, userId);
  const existing = db.prepare('SELECT id, quantity FROM inventory WHERE user_id = ? AND item_id = ?').get(userId, item_id);
  if (existing) {
    db.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO inventory (id, user_id, item_id, quantity) VALUES (?, ?, ?, 1)').run(uuid(), userId, item_id);
  }
  const updated = getOrCreateStats(userId);
  res.json({ ok: true, coins: updated.coins });
});

app.get('/me/inventory', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json([]);
  const rows = db.prepare(`
    SELECT inv.id, inv.item_id, inv.quantity, si.name, si.description, si.effect_type, si.duration_min
    FROM inventory inv JOIN shop_items si ON si.id = inv.item_id
    WHERE inv.user_id = ? AND inv.quantity > 0
  `).all(userId);
  res.json(rows);
});

app.post('/me/inventory/:itemId/use', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const itemId = req.params.itemId;

  const inv = db.prepare('SELECT inv.*, si.effect_type, si.duration_min FROM inventory inv JOIN shop_items si ON si.id = inv.item_id WHERE inv.user_id = ? AND inv.item_id = ?').get(userId, itemId);
  if (!inv || inv.quantity < 1) return res.status(404).json({ error: 'item not in inventory or quantity 0' });

  if (inv.effect_type === 'rare_egg') {
    const uncommonPlus = db.prepare("SELECT id FROM creatures WHERE rarity IN ('uncommon','rare','legendary')").all();
    if (uncommonPlus.length === 0) return res.status(500).json({ error: 'no creatures for egg' });
    const picked = uncommonPlus[Math.floor(Math.random() * uncommonPlus.length)];
    const creatureId = picked.id;
    const creature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(creatureId);
    db.prepare('INSERT INTO catches (id, user_id, creature_id, spawn_id, lat, lng) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), userId, creatureId, null, null, null);
    const existingBeast = db.prepare('SELECT * FROM beast_instances WHERE user_id = ? AND base_creature_id = ?').get(userId, creatureId);
    if (existingBeast) {
      const newXp = Math.min(existingBeast.beast_xp + BEAST_XP_PER_CATCH, (MAX_BEAST_LEVEL - 1) * BEAST_XP_PER_LEVEL);
      const newLevel = beastLevelFromXp(newXp);
      db.prepare('UPDATE beast_instances SET beast_xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, existingBeast.id);
    } else {
      db.prepare('INSERT INTO beast_instances (id, user_id, base_creature_id, stage, level, beast_xp) VALUES (?, ?, ?, 1, ?, ?)').run(uuid(), userId, creatureId, beastLevelFromXp(BEAST_XP_PER_CATCH), BEAST_XP_PER_CATCH);
    }
    db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(inv.id);
    return res.json({ ok: true, effect_type: 'rare_egg', creature });
  }

  const durationMin = inv.duration_min ?? 30;
  const expiresAt = toSqliteDatetime(new Date(Date.now() + durationMin * 60 * 1000));
  db.prepare('INSERT INTO active_effects (id, user_id, effect_type, expires_at) VALUES (?, ?, ?, ?)').run(uuid(), userId, inv.effect_type, expiresAt);
  db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(inv.id);
  res.json({ ok: true, effect_type: inv.effect_type, expires_at: expiresAt, duration_min: durationMin });
});

app.get('/me/effects', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json([]);
  const rows = db.prepare(
    "SELECT effect_type, expires_at FROM active_effects WHERE user_id = ? AND expires_at > datetime('now')"
  ).all(userId);
  res.json(rows.map((r) => ({ effect_type: r.effect_type, expires_at: r.expires_at })));
});

// ── Friends (social) ─────────────────────────────────────────

app.get('/me/friends', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json([]);
  const rows = db.prepare(`
    SELECT f.friend_id AS user_id, u.display_name
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId);
  res.json(rows);
});

app.post('/me/friends', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { friend_user_id } = req.body || {};
  if (!friend_user_id) return res.status(400).json({ error: 'friend_user_id required' });
  if (friend_user_id === userId) return res.status(400).json({ error: 'cannot add yourself' });

  const friendExists = db.prepare('SELECT id FROM users WHERE id = ?').get(friend_user_id);
  if (!friendExists) return res.status(404).json({ error: 'user not found' });

  try {
    db.prepare('INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)').run(uuid(), userId, friend_user_id);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT' && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'already friends' });
    throw e;
  }

  const friend = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(friend_user_id);
  res.status(201).json({ user_id: friend.id, display_name: friend.display_name });
});

app.delete('/me/friends/:friendUserId', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { friendUserId } = req.params;
  db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(userId, friendUserId);
  res.status(204).send();
});

app.post('/me/friends/:friendUserId/gift', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { friendUserId } = req.params;
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ error: 'item_id required' });

  const friendship = db.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?').get(userId, friendUserId);
  if (!friendship) return res.status(403).json({ error: 'not friends with this user' });

  const inv = db.prepare('SELECT inv.* FROM inventory inv WHERE inv.user_id = ? AND inv.item_id = ?').get(userId, item_id);
  if (!inv || inv.quantity < 1) return res.status(404).json({ error: 'item not in inventory or quantity 0' });

  const friendExists = db.prepare('SELECT id FROM users WHERE id = ?').get(friendUserId);
  if (!friendExists) return res.status(404).json({ error: 'friend not found' });

  if (inv.quantity <= 1) {
    db.prepare('DELETE FROM inventory WHERE id = ?').run(inv.id);
  } else {
    db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(inv.id);
  }

  const friendInv = db.prepare('SELECT id, quantity FROM inventory WHERE user_id = ? AND item_id = ?').get(friendUserId, item_id);
  if (friendInv) {
    db.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?').run(friendInv.id);
  } else {
    db.prepare('INSERT INTO inventory (id, user_id, item_id, quantity) VALUES (?, ?, ?, 1)').run(uuid(), friendUserId, item_id);
  }

  res.json({ ok: true, item_id });
});

// ── Battle (in-memory state) ─────────────────────────────────

const WILD_LEVEL_BY_RARITY = { common: 3, uncommon: 6, rare: 9, legendary: 12 };

function battleStats(level, stage) {
  return {
    hp: level * 10 + stage * 15,
    atk: level * 2 + stage * 5,
    def: level + stage * 3,
  };
}

function battleDamage(atk, def) {
  return Math.max(1, Math.floor(atk - def / 2));
}

const battleMap = new Map();

const BATTLE_TTL_MS = 10 * 60 * 1000;

function pruneExpiredBattles() {
  const now = Date.now();
  for (const [id, b] of battleMap) {
    if (now - b.createdAt > BATTLE_TTL_MS) battleMap.delete(id);
  }
}

app.post('/battle/start', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { spawn_id, beast_id } = req.body || {};
  if (!spawn_id || !beast_id) return res.status(400).json({ error: 'spawn_id and beast_id required' });

  const spawn = db.prepare('SELECT id, creature_id, lat, lng FROM spawns WHERE id = ?').get(spawn_id);
  if (!spawn) return res.status(404).json({ error: 'spawn not found' });

  const beast = db.prepare(`
    SELECT bi.*, ce.name AS current_name, ce.image_url AS current_image
    FROM beast_instances bi
    JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage
    WHERE bi.id = ? AND bi.user_id = ?
  `).get(beast_id, userId);
  if (!beast) return res.status(404).json({ error: 'beast not found' });

  const wildCreature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(spawn.creature_id);
  if (!wildCreature) return res.status(400).json({ error: 'creature not found' });

  const wildLevel = WILD_LEVEL_BY_RARITY[wildCreature.rarity] ?? 3;
  const playerStats = battleStats(beast.level, beast.stage);
  const wildStats = battleStats(wildLevel, 1);

  const battleId = uuid();
  const battle = {
    battleId,
    userId,
    beastId: beast.id,
    spawnId: spawn_id,
    wildCreatureId: spawn.creature_id,
    playerHP: playerStats.hp,
    playerMaxHP: playerStats.hp,
    wildHP: wildStats.hp,
    wildMaxHP: wildStats.hp,
    playerAtk: playerStats.atk,
    playerDef: playerStats.def,
    wildAtk: wildStats.atk,
    wildDef: wildStats.def,
    healCount: 0,
    createdAt: Date.now(),
  };
  battleMap.set(battleId, battle);
  pruneExpiredBattles();

  res.json({
    battle_id: battleId,
    player_hp: battle.playerHP,
    player_max_hp: battle.playerMaxHP,
    wild_hp: battle.wildHP,
    wild_max_hp: battle.wildMaxHP,
    wild_creature: wildCreature,
    beast_name: beast.current_name,
    beast_image: beast.current_image,
  });
});

app.post('/battle/turn', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { battle_id, action } = req.body || {};
  if (!battle_id || !action) return res.status(400).json({ error: 'battle_id and action required' });
  if (!['attack', 'power', 'heal'].includes(action)) return res.status(400).json({ error: 'action must be attack, power, or heal' });

  const battle = battleMap.get(battle_id);
  if (!battle || battle.userId !== userId) return res.status(404).json({ error: 'battle not found' });

  const log = [];

  if (action === 'heal') {
    if (battle.healCount >= 2) return res.status(400).json({ error: 'no heals left' });
    const amount = Math.floor(battle.playerMaxHP * 0.3);
    battle.playerHP = Math.min(battle.playerMaxHP, battle.playerHP + amount);
    battle.healCount++;
    log.push(`You heal for ${amount} HP.`);
  } else {
    let damage = battleDamage(battle.playerAtk, battle.wildDef);
    if (action === 'power') {
      if (Math.random() > 0.7) {
        damage = 0;
        log.push('Power Strike missed!');
      } else {
        damage = Math.floor(damage * 1.5);
        log.push(`Power Strike hits for ${damage} damage!`);
      }
    } else {
      log.push(`You attack for ${damage} damage!`);
    }
    if (damage > 0) {
      battle.wildHP = Math.max(0, battle.wildHP - damage);
    }
  }

  let result = null;
  if (battle.wildHP <= 0) {
    battleMap.delete(battle_id);
    const wildCreature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(battle.wildCreatureId);
    const xp = (XP_PER_CATCH[wildCreature.rarity] ?? 20) * 2;
    const bonusCoins = { common: 5, uncommon: 10, rare: 20, legendary: 40 }[wildCreature.rarity] ?? 5;
    db.prepare('DELETE FROM spawns WHERE id = ?').run(battle.spawnId);
    db.prepare('INSERT INTO catches (id, user_id, creature_id, spawn_id, lat, lng) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), userId, battle.wildCreatureId, null, null, null);
    const creature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(battle.wildCreatureId);
    updateQuestProgress(userId, creature);
    awardXP(userId, xp);
    const stats = getOrCreateStats(userId);
    db.prepare('UPDATE player_stats SET coins = coins + ? WHERE user_id = ?').run(bonusCoins, userId);
    const existingBeast = db.prepare('SELECT * FROM beast_instances WHERE user_id = ? AND base_creature_id = ?').get(userId, battle.wildCreatureId);
    if (existingBeast) {
      const newXp = Math.min(existingBeast.beast_xp + BEAST_XP_PER_CATCH, (MAX_BEAST_LEVEL - 1) * BEAST_XP_PER_LEVEL);
      db.prepare('UPDATE beast_instances SET beast_xp = ?, level = ? WHERE id = ?').run(newXp, beastLevelFromXp(newXp), existingBeast.id);
    } else {
      db.prepare('INSERT OR IGNORE INTO beast_instances (id, user_id, base_creature_id, stage, level, beast_xp) VALUES (?, ?, ?, 1, ?, ?)')
        .run(uuid(), userId, battle.wildCreatureId, beastLevelFromXp(BEAST_XP_PER_CATCH), BEAST_XP_PER_CATCH);
    }
    result = { winner: 'player', xp, coins: bonusCoins, creature: wildCreature };
  } else {
    const wildDamage = battleDamage(battle.wildAtk, battle.playerDef);
    battle.playerHP = Math.max(0, battle.playerHP - wildDamage);
    log.push(`Wild attacks for ${wildDamage} damage!`);

    if (battle.playerHP <= 0) {
      battleMap.delete(battle_id);
      result = { winner: 'wild' };
    }
  }

  res.json({
    player_hp: battle.playerHP,
    player_max_hp: battle.playerMaxHP,
    wild_hp: battle.wildHP,
    wild_max_hp: battle.wildMaxHP,
    log,
    result,
  });
});

// ── PvP Battle (instant AI or real 2P with challenge/accept) ─────

const pvpBattleMap = new Map();
const pvpChallengesMap = new Map();
const CHALLENGE_TTL_MS = 15 * 60 * 1000;

function pruneExpiredPvpBattles() {
  const now = Date.now();
  for (const [id, b] of pvpBattleMap) {
    if (now - b.createdAt > BATTLE_TTL_MS) pvpBattleMap.delete(id);
  }
}
function pruneExpiredChallenges() {
  const now = Date.now();
  for (const [id, c] of pvpChallengesMap) {
    if (now - c.createdAt > CHALLENGE_TTL_MS) pvpChallengesMap.delete(id);
  }
}

function pickOpponentAction(battle) {
  const canHeal = battle.opponentHealCount < 2 && battle.opponentHP < battle.opponentMaxHP;
  const choices = ['attack', 'power'];
  if (canHeal) choices.push('heal');
  return choices[Math.floor(Math.random() * choices.length)];
}

// Instant PvP (opponent is AI) — unchanged
app.post('/battle/pvp/challenge', (req, res) => {
  const challengerId = req.headers['x-user-id'];
  if (!challengerId) return res.status(401).json({ error: 'no user' });
  const { opponent_user_id, my_beast_id } = req.body || {};
  if (!opponent_user_id || !my_beast_id) return res.status(400).json({ error: 'opponent_user_id and my_beast_id required' });
  if (opponent_user_id === challengerId) return res.status(400).json({ error: 'cannot challenge yourself' });

  const myBeast = db.prepare(`
    SELECT bi.*, ce.name AS current_name, ce.image_url AS current_image
    FROM beast_instances bi
    JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage
    WHERE bi.id = ? AND bi.user_id = ?
  `).get(my_beast_id, challengerId);
  if (!myBeast) return res.status(404).json({ error: 'beast not found' });

  const opponentBeasts = db.prepare(`
    SELECT bi.id, bi.base_creature_id, bi.stage, bi.level, ce.name AS current_name, ce.image_url AS current_image
    FROM beast_instances bi
    JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage
    WHERE bi.user_id = ?
  `).all(opponent_user_id);
  if (!opponentBeasts.length) return res.status(400).json({ error: 'opponent has no beasts' });

  const opponentBeast = opponentBeasts[Math.floor(Math.random() * opponentBeasts.length)];
  const creature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(opponentBeast.base_creature_id);
  if (!creature) return res.status(400).json({ error: 'creature not found' });

  const myStats = battleStats(myBeast.level, myBeast.stage);
  const oppStats = battleStats(opponentBeast.level, opponentBeast.stage);

  const battleId = uuid();
  const battle = {
    battleId,
    challengerId,
    opponentId: opponent_user_id,
    myBeastId: myBeast.id,
    opponentBeastId: opponentBeast.id,
    myHP: myStats.hp,
    myMaxHP: myStats.hp,
    opponentHP: oppStats.hp,
    opponentMaxHP: oppStats.hp,
    myAtk: myStats.atk,
    myDef: myStats.def,
    opponentAtk: oppStats.atk,
    opponentDef: oppStats.def,
    myHealCount: 0,
    opponentHealCount: 0,
    createdAt: Date.now(),
  };
  pvpBattleMap.set(battleId, battle);
  pruneExpiredPvpBattles();

  res.json({
    battle_id: battleId,
    player_hp: battle.myHP,
    player_max_hp: battle.myMaxHP,
    wild_hp: battle.opponentHP,
    wild_max_hp: battle.opponentMaxHP,
    wild_creature: { ...creature, name: opponentBeast.current_name, image_url: opponentBeast.current_image },
    beast_name: myBeast.current_name,
    beast_image: myBeast.current_image,
  });
});

// Real 2P: request challenge (pending until opponent accepts)
app.post('/battle/pvp/request', (req, res) => {
  const challengerId = req.headers['x-user-id'];
  if (!challengerId) return res.status(401).json({ error: 'no user' });
  const { opponent_user_id, my_beast_id } = req.body || {};
  if (!opponent_user_id || !my_beast_id) return res.status(400).json({ error: 'opponent_user_id and my_beast_id required' });
  if (opponent_user_id === challengerId) return res.status(400).json({ error: 'cannot challenge yourself' });

  const myBeast = db.prepare(`
    SELECT bi.*, ce.name AS current_name, ce.image_url AS current_image
    FROM beast_instances bi
    JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage
    WHERE bi.id = ? AND bi.user_id = ?
  `).get(my_beast_id, challengerId);
  if (!myBeast) return res.status(404).json({ error: 'beast not found' });

  const oppUser = db.prepare('SELECT id FROM users WHERE id = ?').get(opponent_user_id);
  if (!oppUser) return res.status(404).json({ error: 'opponent not found' });

  const challengeId = uuid();
  pvpChallengesMap.set(challengeId, {
    challengeId,
    challengerId,
    opponentId: opponent_user_id,
    challengerBeastId: myBeast.id,
    challengerBeastName: myBeast.current_name,
    challengerBeastImage: myBeast.current_image,
    status: 'pending',
    createdAt: Date.now(),
  });
  pruneExpiredChallenges();
  res.status(201).json({ challenge_id: challengeId });
});

app.get('/me/pvp/challenges', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json({ incoming: [], outgoing: [] });
  const incoming = [];
  const outgoing = [];
  for (const [cid, c] of pvpChallengesMap) {
    if (c.opponentId === userId && c.status === 'pending') {
      const challengerName = db.prepare('SELECT display_name FROM users WHERE id = ?').get(c.challengerId);
      incoming.push({
        challenge_id: cid,
        challenger_id: c.challengerId,
        challenger_name: challengerName?.display_name || null,
        beast_name: c.challengerBeastName,
      });
    } else if (c.challengerId === userId) {
      outgoing.push({
        challenge_id: cid,
        opponent_id: c.opponentId,
        status: c.status,
        battle_id: c.battleId || null,
      });
    }
  }
  res.json({ incoming, outgoing });
});

app.post('/battle/pvp/accept', (req, res) => {
  const opponentId = req.headers['x-user-id'];
  if (!opponentId) return res.status(401).json({ error: 'no user' });
  const { challenge_id, my_beast_id } = req.body || {};
  if (!challenge_id || !my_beast_id) return res.status(400).json({ error: 'challenge_id and my_beast_id required' });

  const challenge = pvpChallengesMap.get(challenge_id);
  if (!challenge || challenge.opponentId !== opponentId || challenge.status !== 'pending') return res.status(404).json({ error: 'challenge not found' });

  const myBeast = db.prepare(`
    SELECT bi.*, ce.name AS current_name, ce.image_url AS current_image
    FROM beast_instances bi
    JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage
    WHERE bi.id = ? AND bi.user_id = ?
  `).get(my_beast_id, opponentId);
  if (!myBeast) return res.status(404).json({ error: 'beast not found' });

  const challengerBeast = db.prepare(`
    SELECT bi.id, bi.user_id, bi.base_creature_id, bi.stage, bi.level, ce.name AS current_name, ce.image_url AS current_image
    FROM beast_instances bi
    JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage
    WHERE bi.id = ? AND bi.user_id = ?
  `).get(challenge.challengerBeastId, challenge.challengerId);
  if (!challengerBeast) return res.status(400).json({ error: 'challenger beast not found' });
  const creature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(challengerBeast.base_creature_id);

  const myStats = battleStats(myBeast.level, myBeast.stage);
  const oppStats = battleStats(challengerBeast.level, challengerBeast.stage);

  const battleId = uuid();
  const battle = {
    battleId,
    challengerId: challenge.challengerId,
    opponentId,
    myBeastId: challengerBeast.id,
    opponentBeastId: myBeast.id,
    myHP: oppStats.hp,
    myMaxHP: oppStats.hp,
    opponentHP: myStats.hp,
    opponentMaxHP: myStats.hp,
    myAtk: oppStats.atk,
    myDef: oppStats.def,
    opponentAtk: myStats.atk,
    opponentDef: myStats.def,
    myHealCount: 0,
    opponentHealCount: 0,
    turn: 'challenger',
    createdAt: Date.now(),
  };
  pvpBattleMap.set(battleId, battle);
  challenge.status = 'accepted';
  challenge.battleId = battleId;
  pruneExpiredPvpBattles();

  res.json({
    battle_id: battleId,
    player_hp: battle.opponentHP,
    player_max_hp: battle.opponentMaxHP,
    wild_hp: battle.myHP,
    wild_max_hp: battle.myMaxHP,
    wild_creature: { ...creature, name: challengerBeast.current_name, image_url: challengerBeast.current_image },
    beast_name: myBeast.current_name,
    beast_image: myBeast.current_image,
    is_challenger: false,
    turn: 'opponent',
  });
});

app.get('/battle/pvp/:battleId/state', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const battle = pvpBattleMap.get(req.params.battleId);
  if (!battle) return res.status(404).json({ error: 'battle not found' });
  const isChallenger = battle.challengerId === userId;
  if (!isChallenger && battle.opponentId !== userId) return res.status(403).json({ error: 'not in this battle' });
  const playerHp = isChallenger ? battle.myHP : battle.opponentHP;
  const playerMaxHp = isChallenger ? battle.myMaxHP : battle.opponentMaxHP;
  const wildHp = isChallenger ? battle.opponentHP : battle.myHP;
  const wildMaxHp = isChallenger ? battle.opponentMaxHP : battle.myMaxHP;
  const myBeastId = isChallenger ? battle.myBeastId : battle.opponentBeastId;
  const oppBeastId = isChallenger ? battle.opponentBeastId : battle.myBeastId;
  const myBeast = db.prepare('SELECT bi.*, ce.name AS current_name, ce.image_url AS current_image FROM beast_instances bi JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage WHERE bi.id = ?').get(myBeastId);
  const oppBeast = db.prepare('SELECT bi.*, ce.name AS current_name, ce.image_url AS current_image FROM beast_instances bi JOIN creature_evolutions ce ON ce.base_creature_id = bi.base_creature_id AND ce.stage = bi.stage WHERE bi.id = ?').get(oppBeastId);
  const wildCreature = oppBeast ? { id: oppBeast.base_creature_id, name: oppBeast.current_name, image_url: oppBeast.current_image, rarity: 'common', type: '' } : null;
  res.json({
    player_hp: playerHp,
    player_max_hp: playerMaxHp,
    wild_hp: wildHp,
    wild_max_hp: wildMaxHp,
    turn: battle.turn || 'challenger',
    is_challenger: isChallenger,
    beast_name: myBeast?.current_name ?? '',
    beast_image: myBeast?.current_image ?? '',
    wild_creature: wildCreature,
  });
});

app.post('/battle/pvp/turn', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'no user' });
  const { battle_id, action } = req.body || {};
  if (!battle_id || !action) return res.status(400).json({ error: 'battle_id and action required' });
  if (!['attack', 'power', 'heal'].includes(action)) return res.status(400).json({ error: 'action must be attack, power, or heal' });

  const battle = pvpBattleMap.get(battle_id);
  if (!battle) return res.status(404).json({ error: 'battle not found' });
  const isChallenger = battle.challengerId === userId;
  const isOpponent = battle.opponentId === userId;
  if (!isChallenger && !isOpponent) return res.status(403).json({ error: 'not in this battle' });

  if (battle.turn) {
    const myTurn = (isChallenger && battle.turn === 'challenger') || (isOpponent && battle.turn === 'opponent');
    if (!myTurn) return res.status(400).json({ error: 'not your turn' });
  } else if (!isChallenger) {
    return res.status(403).json({ error: 'not in this battle' });
  }

  const log = [];
  const isReal2P = !!battle.turn;

  if (isReal2P && isOpponent) {
    // Opponent's move: damage/heal opponent's own HP (myHP from battle = challenger's HP, opponentHP = opponent's)
    if (action === 'heal') {
      if (battle.opponentHealCount >= 2) return res.status(400).json({ error: 'no heals left' });
      const amount = Math.floor(battle.opponentMaxHP * 0.3);
      battle.opponentHP = Math.min(battle.opponentMaxHP, battle.opponentHP + amount);
      battle.opponentHealCount++;
      log.push(`You heal for ${amount} HP.`);
    } else {
      let damage = battleDamage(battle.opponentAtk, battle.myDef);
      if (action === 'power') {
        if (Math.random() > 0.7) { damage = 0; log.push('Power Strike missed!'); } else { damage = Math.floor(damage * 1.5); log.push(`Power Strike hits for ${damage} damage!`); }
      } else log.push(`You attack for ${damage} damage!`);
      if (damage > 0) battle.myHP = Math.max(0, battle.myHP - damage);
    }
    battle.turn = 'challenger';
  } else {
    // Challenger's move (or instant AI flow)
    if (action === 'heal') {
      if (battle.myHealCount >= 2) return res.status(400).json({ error: 'no heals left' });
      const amount = Math.floor(battle.myMaxHP * 0.3);
      battle.myHP = Math.min(battle.myMaxHP, battle.myHP + amount);
      battle.myHealCount++;
      log.push(`You heal for ${amount} HP.`);
    } else {
      let damage = battleDamage(battle.myAtk, battle.opponentDef);
      if (action === 'power') {
        if (Math.random() > 0.7) {
          damage = 0;
          log.push('Power Strike missed!');
        } else {
          damage = Math.floor(damage * 1.5);
          log.push(`Power Strike hits for ${damage} damage!`);
        }
      } else {
        log.push(`You attack for ${damage} damage!`);
      }
      if (damage > 0) battle.opponentHP = Math.max(0, battle.opponentHP - damage);
    }
    if (isReal2P) battle.turn = 'opponent';
  }

  let result = null;

  if (battle.opponentHP <= 0) {
    pvpBattleMap.delete(battle_id);
    const PVP_WIN_XP = 50;
    const PVP_WIN_COINS = 25;
    awardXP(userId, PVP_WIN_XP);
    db.prepare('UPDATE player_stats SET coins = coins + ? WHERE user_id = ?').run(PVP_WIN_COINS, userId);
    result = { winner: 'player', xp: PVP_WIN_XP, coins: PVP_WIN_COINS };
  } else if (isReal2P && isOpponent && battle.myHP <= 0) {
    pvpBattleMap.delete(battle_id);
    const PVP_WIN_XP = 50;
    const PVP_WIN_COINS = 25;
    awardXP(userId, PVP_WIN_XP);
    db.prepare('UPDATE player_stats SET coins = coins + ? WHERE user_id = ?').run(PVP_WIN_COINS, userId);
    result = { winner: 'player', xp: PVP_WIN_XP, coins: PVP_WIN_COINS };
  } else if (!isReal2P) {
    // Opponent (AI) turn
    const oppAction = pickOpponentAction(battle);
    if (oppAction === 'heal') {
      const amount = Math.floor(battle.opponentMaxHP * 0.3);
      battle.opponentHP = Math.min(battle.opponentMaxHP, battle.opponentHP + amount);
      battle.opponentHealCount++;
      log.push('Opponent heals!');
    } else {
      let damage = battleDamage(battle.opponentAtk, battle.myDef);
      if (oppAction === 'power' && Math.random() <= 0.7) damage = Math.floor(damage * 1.5);
      if (damage > 0) {
        battle.myHP = Math.max(0, battle.myHP - damage);
        log.push(`Opponent attacks for ${damage} damage!`);
      }
    }
    if (battle.myHP <= 0) {
      pvpBattleMap.delete(battle_id);
      result = { winner: 'wild' };
    }
  }

  const resPlayerHp = isChallenger ? battle.myHP : battle.opponentHP;
  const resPlayerMaxHp = isChallenger ? battle.myMaxHP : battle.opponentMaxHP;
  const resWildHp = isChallenger ? battle.opponentHP : battle.myHP;
  const resWildMaxHp = isChallenger ? battle.opponentMaxHP : battle.myMaxHP;

  res.json({
    player_hp: resPlayerHp,
    player_max_hp: resPlayerMaxHp,
    wild_hp: resWildHp,
    wild_max_hp: resWildMaxHp,
    log,
    result,
  });
});

// ── Health endpoint ─────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: API_VERSION, timestamp: new Date().toISOString() });
});

// ── Global error handler ────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));
}

export { app };
