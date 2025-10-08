-- Manual migration to fix existing paid_messages table
-- Run this ONCE in your PostgreSQL database via Render console

-- Option 1: Safe (preserves existing data if any)
-- Add missing columns if they don't exist
DO $$ 
BEGIN
  -- Add priority column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='paid_messages' AND column_name='priority') THEN
    ALTER TABLE paid_messages ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  -- Add scheduled_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='paid_messages' AND column_name='scheduled_at') THEN
    ALTER TABLE paid_messages ADD COLUMN scheduled_at BIGINT;
  END IF;
  
  -- Add played_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='paid_messages' AND column_name='played_at') THEN
    ALTER TABLE paid_messages ADD COLUMN played_at BIGINT;
  END IF;
END $$;

-- Fix data types (if columns exist with wrong types)
-- Note: This might fail if column doesn't exist - that's OK
DO $$
BEGIN
  -- Fix created_at to BIGINT if it's INTEGER
  BEGIN
    ALTER TABLE paid_messages ALTER COLUMN created_at TYPE BIGINT;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if already BIGINT
  END;
  
  -- Fix expires_at to BIGINT if it's INTEGER
  BEGIN
    ALTER TABLE paid_messages ALTER COLUMN expires_at TYPE BIGINT;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if already BIGINT
  END;
  
  -- Fix nonce to INTEGER if it's something else
  BEGIN
    ALTER TABLE paid_messages ALTER COLUMN nonce TYPE INTEGER;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if already INTEGER
  END;
END $$;

-- Create indexes if missing
CREATE INDEX IF NOT EXISTS idx_paid_messages_status_expires ON paid_messages(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_paid_messages_status_created ON paid_messages(status, created_at);
CREATE INDEX IF NOT EXISTS idx_paid_messages_wallet ON paid_messages(wallet);
CREATE INDEX IF NOT EXISTS idx_paid_messages_wallet_created ON paid_messages(wallet, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_messages_wallet_nonce ON paid_messages(wallet, nonce) WHERE nonce IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_messages_msg_hash ON paid_messages(msg_hash) WHERE msg_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paid_messages_type_status_priority ON paid_messages(message_type, status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_paid_messages_played_at ON paid_messages(played_at) WHERE played_at IS NOT NULL;

-- Verify the fix worked
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'paid_messages'
ORDER BY ordinal_position;
