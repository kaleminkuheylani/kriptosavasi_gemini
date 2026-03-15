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

-- Keep symbols canonical and prevent duplicate watchlist entries per user
UPDATE watchlist_items
SET symbol = UPPER(symbol)
WHERE symbol <> UPPER(symbol);

DELETE FROM watchlist_items a
USING watchlist_items b
WHERE a.user_id = b.user_id
  AND a.symbol = b.symbol
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_user_symbol_unique
  ON watchlist_items(user_id, symbol);
CREATE INDEX IF NOT EXISTS watchlist_items_user_id_idx
  ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS watchlist_items_symbol_idx
  ON watchlist_items(symbol);

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
CREATE INDEX IF NOT EXISTS price_alerts_user_id_idx
  ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS price_alerts_symbol_idx
  ON price_alerts(symbol);

-- 3. Usage tracking (daily requests + tokens per user)
CREATE TABLE IF NOT EXISTS user_usage (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INT  DEFAULT 0,
  token_count   INT  DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
CREATE INDEX IF NOT EXISTS user_usage_user_date_idx
  ON user_usage(user_id, date);

-- 4. Stock comments
CREATE TABLE IF NOT EXISTS stock_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  author_name  TEXT NOT NULL,
  content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 2 AND 1000),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
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

ALTER TABLE stock_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON stock_comments
  FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON stock_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON stock_comments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON stock_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_watchlist_updated_at
  BEFORE UPDATE ON watchlist_items
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER trg_stock_comments_updated_at
  BEFORE UPDATE ON stock_comments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
