-- Check ALL MINEBOY messages (including removed/expired)
SELECT 
  id,
  message,
  status,
  message_type,
  TO_TIMESTAMP(created_at/1000) as created,
  TO_TIMESTAMP(expires_at/1000) as expires,
  expires_at as expires_at_ms,
  EXTRACT(EPOCH FROM NOW())*1000 as now_ms,
  (expires_at - EXTRACT(EPOCH FROM NOW())*1000) / 1000 / 60 / 60 / 24 / 365 as years_until_expiry
FROM paid_messages
WHERE message_type = 'MINEBOY'
ORDER BY created_at DESC;

