-- ============================================================
-- BIST100 AI - Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Watchlist items
CREATE TABLE IF NOT EXISTS watchlist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  name        TEXT NOT NULL,
  target_price FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Price alerts
CREATE TABLE IF NOT EXISTS price_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  target_price FLOAT NOT NULL,
  condition    TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  active       BOOLEAN DEFAULT TRUE,
  triggered    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Usage tracking (daily requests + tokens per user)
CREATE TABLE IF NOT EXISTS user_usage (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INT  DEFAULT 0,
  token_count   INT  DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_own" ON watchlist_items
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_own" ON price_alerts
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_own" ON user_usage
  FOR ALL USING (auth.uid() = user_id);

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_watchlist_updated_at
  BEFORE UPDATE ON watchlist_items
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
