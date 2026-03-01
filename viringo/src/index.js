import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import db from './db.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
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
function generateSpawnsNear(centerLat, centerLng) {
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

  const insert = db.prepare('INSERT INTO spawns (id, creature_id, lat, lng, expires_at) VALUES (?, ?, ?, ?, ?)');

  const insertMany = db.transaction(() => {
    for (let i = 0; i < SPAWN_COUNT_PER_CELL; i++) {
      const angle = rand() * Math.PI * 2;
      const dist  = rand() * 0.004 + 0.0005; // ~50–450 m from cell center
      const spawnLat = centerLat + Math.cos(angle) * dist;
      const spawnLng = centerLng + Math.sin(angle) * dist;

      // Stagger expiry: base TTL ± 2 hours for natural turnover
      const ttlMs = (SPAWN_TTL_HOURS + (rand() * 4 - 2)) * 60 * 60 * 1000;
      const expires = toSqliteDatetime(new Date(Date.now() + ttlMs));

      // Rarity: 50% common, 25% uncommon, 17% rare, 8% legendary (if season active)
      const r = rand();
      let pool;
      if (hasLegendary && r >= 0.92) pool = byRarity.legendary;
      else if (r < 0.50) pool = byRarity.common;
      else if (r < 0.75) pool = byRarity.uncommon;
      else pool = byRarity.rare;
      if (!pool || pool.length === 0) pool = byRarity.common;

      const picked = pool[Math.floor(rand() * pool.length)];
      insert.run(uuid(), picked.id, spawnLat, spawnLng, expires);
    }
  });

  insertMany();
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
  const d = radiusKm / 111;
  let rows = spawnQuery.all(lat - d, lat + d, lng - d, lng + d);
  if (rows.length === 0) {
    generateSpawnsNear(lat, lng);
    rows = spawnQuery.all(lat - d, lat + d, lng - d, lng + d);
  }
  res.json(rows);
});

app.post('/catch', (req, res) => {
  const userId = getOrCreateUserId(req);
  const { spawn_id, creature_id, lat, lng } = req.body || {};
  if (!creature_id && !spawn_id) return res.status(400).json({ error: 'spawn_id or creature_id required' });

  let creatureId = creature_id;
  if (spawn_id) {
    const spawn = db.prepare('SELECT creature_id FROM spawns WHERE id = ?').get(spawn_id);
    if (!spawn) return res.status(404).json({ error: 'spawn not found' });
    creatureId = spawn.creature_id;
  }

  db.prepare('INSERT INTO catches (id, user_id, creature_id, spawn_id, lat, lng) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), userId, creatureId, spawn_id || null, lat ?? null, lng ?? null);

  // Remove the spawn so it can't be caught again
  if (spawn_id) {
    db.prepare('DELETE FROM spawns WHERE id = ?').run(spawn_id);
  }

  const creature = db.prepare('SELECT id, name, image_url, rarity, type FROM creatures WHERE id = ?').get(creatureId);
  const xp = XP_PER_CATCH[creature.rarity] ?? 20;
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
      db.prepare('INSERT INTO season_entries (id, season_id, user_id, points) VALUES (?, ?, ?, ?)')
        .run(uuid(), activeSeason.id, userId, pts);
      seasonPoints = pts;
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
    db.prepare('INSERT INTO beast_instances (id, user_id, base_creature_id, stage, level, beast_xp) VALUES (?, ?, ?, 1, ?, ?)')
      .run(beastId, userId, creatureId, newLevel, newXp);
    beastInstance = { id: beastId, user_id: userId, base_creature_id: creatureId, stage: 1, level: newLevel, beast_xp: newXp };
  }
  const canEvolve = (EVOLVE_LEVELS[beastInstance.stage] ?? Infinity) <= beastInstance.level;

  res.status(201).json({ creature, user_id: userId, ...statsUpdate, beastInstance, canEvolve, seasonPoints });
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

// ── Presence (in-memory, ephemeral) ─────────────────────────

const presenceMap = new Map(); // userId → { lat, lng, lastSeen, displayName, level }
const PRESENCE_TTL_MS = 3 * 60 * 1000; // 3 minutes

app.put('/me/presence', (req, res) => {
  const userId = getOrCreateUserId(req);
  const { lat, lng } = req.body || {};
  if (Number.isNaN(+lat) || Number.isNaN(+lng)) return res.status(400).json({ error: 'lat and lng required' });
  const user  = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
  const stats = db.prepare('SELECT level FROM player_stats WHERE user_id = ?').get(userId);
  presenceMap.set(userId, {
    lat: +lat,
    lng: +lng,
    lastSeen: Date.now(),
    displayName: user?.display_name || generateDisplayName(userId),
    level: stats?.level ?? 1,
  });
  res.json({ ok: true });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));
