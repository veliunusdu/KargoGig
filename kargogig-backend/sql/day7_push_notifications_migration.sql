-- Day 7: Push Notifications Migration
-- Creates user_push_tokens table for Expo Push Token storage
-- Pattern: token UNIQUE → upsert logic (update user_id + is_active=true + last_seen_at=now())

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: user_push_tokens
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  device_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- Unique token constraint (upsert target)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_tokens_token_unique 
  ON user_push_tokens(token);

-- Fast lookup by user_id (for fetching all tokens of a user)
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id 
  ON user_push_tokens(user_id);

-- Fast lookup for active tokens by user_id (most common query)
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id_active 
  ON user_push_tokens(user_id) 
  WHERE is_active = TRUE;

-- (Optional) Fast lookup by device_id (for device-specific operations)
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_device_id 
  ON user_push_tokens(device_id) 
  WHERE device_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own push tokens
CREATE POLICY user_push_tokens_select_own 
  ON user_push_tokens 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own push tokens
CREATE POLICY user_push_tokens_insert_own 
  ON user_push_tokens 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own push tokens
CREATE POLICY user_push_tokens_update_own 
  ON user_push_tokens 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own push tokens
CREATE POLICY user_push_tokens_delete_own 
  ON user_push_tokens 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Service role can manage all tokens (for backend operations)
-- Note: Backend uses service_role key, so RLS is bypassed automatically

-- ═══════════════════════════════════════════════════════════════════════════
-- Updated At Trigger
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_push_tokens_updated_at_trigger
  BEFORE UPDATE ON user_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_push_tokens_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Maintenance: Cleanup stale tokens
-- ═══════════════════════════════════════════════════════════════════════════

-- Optional: Delete tokens not seen in 90 days (can be run as cron job)
-- DELETE FROM user_push_tokens WHERE last_seen_at < NOW() - INTERVAL '90 days';
