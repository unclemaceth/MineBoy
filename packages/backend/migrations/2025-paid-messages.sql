-- Paid Messages System (includes MINEBOY, PAID, SHILL)
-- All messages persist until expired or manually deleted

CREATE TABLE IF NOT EXISTS paid_messages (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  message TEXT NOT NULL,
  tx_hash TEXT UNIQUE, -- nullable for MINEBOY admin messages
  amount_wei TEXT, -- nullable for MINEBOY admin messages
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'playing', 'expired', 'removed')),
  message_type TEXT NOT NULL DEFAULT 'PAID' CHECK (message_type IN ('MINEBOY', 'PAID', 'SHILL')),
  nonce INTEGER,
  msg_hash TEXT,
  color TEXT NOT NULL DEFAULT '#4ade80',
  banner_duration_sec INTEGER NOT NULL DEFAULT 3600,
  priority INTEGER NOT NULL DEFAULT 0,
  scheduled_at BIGINT,
  played_at BIGINT
);

-- Indexes for performance and analytics
CREATE INDEX IF NOT EXISTS idx_paid_messages_status_expires ON paid_messages(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_paid_messages_status_created ON paid_messages(status, created_at);
CREATE INDEX IF NOT EXISTS idx_paid_messages_wallet ON paid_messages(wallet);
CREATE INDEX IF NOT EXISTS idx_paid_messages_wallet_created ON paid_messages(wallet, created_at); -- for throughput queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_messages_wallet_nonce ON paid_messages(wallet, nonce) WHERE nonce IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_messages_msg_hash ON paid_messages(msg_hash) WHERE msg_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paid_messages_type_status_priority ON paid_messages(message_type, status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_paid_messages_played_at ON paid_messages(played_at) WHERE played_at IS NOT NULL;

-- Blacklist table for wallet bans
CREATE TABLE IF NOT EXISTS blacklisted_wallets (
  wallet TEXT PRIMARY KEY,
  reason TEXT,
  blocked_at BIGINT NOT NULL,
  blocked_by TEXT
);

COMMENT ON TABLE paid_messages IS 'All message types (MINEBOY admin messages, PAID user messages, SHILL premium messages) - persisted across deploys';
COMMENT ON COLUMN paid_messages.message_type IS 'MINEBOY (free admin messages), PAID (1 APE, 1 hour), SHILL (15 APE, 4 hours)';
COMMENT ON COLUMN paid_messages.tx_hash IS 'Transaction hash for PAID/SHILL messages (null for MINEBOY)';
COMMENT ON COLUMN paid_messages.status IS 'active (queued for scheduler), playing (currently displaying), expired (TTL passed), removed (manually deleted)';
COMMENT ON COLUMN paid_messages.nonce IS 'Per-wallet sequence number for PAID/SHILL (null for MINEBOY) - prevents duplicate submissions';
COMMENT ON COLUMN paid_messages.msg_hash IS 'keccak256(message) for PAID/SHILL (null for MINEBOY) - cryptographic binding to on-chain payment';
