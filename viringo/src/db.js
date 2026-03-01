import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'creature-hunt.sqlite');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS creatures (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT,
    rarity TEXT,
    type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS spawns (
    id TEXT PRIMARY KEY,
    creature_id TEXT NOT NULL REFERENCES creatures(id),
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS catches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    creature_id TEXT NOT NULL REFERENCES creatures(id),
    spawn_id TEXT REFERENCES spawns(id),
    lat REAL,
    lng REAL,
    caught_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_spawns_lat_lng ON spawns(lat, lng);
  CREATE INDEX IF NOT EXISTS idx_spawns_expires ON spawns(expires_at);
  CREATE INDEX IF NOT EXISTS idx_catches_user ON catches(user_id);

  -- Player stats: XP, coins, streak
  CREATE TABLE IF NOT EXISTS player_stats (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    last_active_date TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Quest definitions (static templates)
  CREATE TABLE IF NOT EXISTS quest_defs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,       -- 'catch_any' | 'catch_rarity' | 'catch_type'
    target_value TEXT,        -- rarity or type filter (nullable)
    required INTEGER NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 50,
    coin_reward INTEGER NOT NULL DEFAULT 10
  );

  -- Daily quest progress per user (one row per user per quest per date)
  CREATE TABLE IF NOT EXISTS daily_quests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    quest_def_id TEXT NOT NULL REFERENCES quest_defs(id),
    date TEXT NOT NULL,        -- YYYY-MM-DD
    progress INTEGER DEFAULT 0,
    claimed INTEGER DEFAULT 0,
    claimed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON daily_quests(user_id, date);

  -- Evolution stage definitions (name + image per stage per species)
  CREATE TABLE IF NOT EXISTS creature_evolutions (
    id TEXT PRIMARY KEY,
    base_creature_id TEXT NOT NULL REFERENCES creatures(id),
    stage INTEGER NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL
  );

  -- One beast instance per species per user; levels up as player catches more of that species
  CREATE TABLE IF NOT EXISTS beast_instances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    base_creature_id TEXT NOT NULL REFERENCES creatures(id),
    stage INTEGER NOT NULL DEFAULT 1,
    level INTEGER NOT NULL DEFAULT 1,
    beast_xp INTEGER NOT NULL DEFAULT 0,
    evolved_at TEXT,
    first_caught_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, base_creature_id)
  );

  CREATE INDEX IF NOT EXISTS idx_beast_instances_user ON beast_instances(user_id);
  CREATE INDEX IF NOT EXISTS idx_catches_lat_lng ON catches(lat, lng);

  -- Seasons: time-bound competitive events with exclusive creatures
  CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    theme TEXT NOT NULL,
    element TEXT NOT NULL,
    exclusive_creature_id TEXT REFERENCES creatures(id),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Per-user season points (upserted on each catch during an active season)
  CREATE TABLE IF NOT EXISTS season_entries (
    id TEXT PRIMARY KEY,
    season_id TEXT NOT NULL REFERENCES seasons(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    points INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(season_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_season_entries_season ON season_entries(season_id, points DESC);
`);

// Migrate: add display_name if upgrading from older schema
try { db.exec('ALTER TABLE users ADD COLUMN display_name TEXT'); } catch { /* already exists */ }

export default db;
