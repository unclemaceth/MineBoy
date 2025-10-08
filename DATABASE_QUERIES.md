# 📊 Paid Messages Database - Query Guide

## 🔗 Database Access

**Connect to PostgreSQL:**
```bash
# Via Render Dashboard
# → Select your PostgreSQL service
# → "Connect" → "External Connection" → Copy PSQL command

# Or use connection string from .env:
psql $DATABASE_URL
```

---

## 📝 ALL MESSAGES QUERIES

### Get All Messages (with metadata)
```sql
SELECT 
  id,
  wallet,
  message,
  message_type,
  status,
  created_at,
  expires_at,
  tx_hash,
  amount_wei,
  color
FROM paid_messages
ORDER BY created_at DESC
LIMIT 100;
```

### Get All Active Messages
```sql
SELECT 
  wallet,
  message,
  message_type,
  TO_TIMESTAMP(created_at/1000) as created,
  TO_TIMESTAMP(expires_at/1000) as expires
FROM paid_messages
WHERE status = 'active'
ORDER BY priority ASC, created_at ASC;
```

### Get All Playing Messages
```sql
SELECT 
  wallet,
  message,
  message_type,
  color,
  TO_TIMESTAMP(played_at/1000) as started_playing
FROM paid_messages
WHERE status = 'playing'
ORDER BY played_at DESC;
```

### Get Message History (Last 24 Hours)
```sql
SELECT 
  message,
  wallet,
  message_type,
  TO_TIMESTAMP(created_at/1000) as created,
  status
FROM paid_messages
WHERE created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000
ORDER BY created_at DESC;
```

---

## 👥 WALLET QUERIES

### All Unique Wallets That Sent Messages
```sql
SELECT DISTINCT 
  wallet,
  COUNT(*) as message_count,
  SUM(CAST(amount_wei AS NUMERIC)) / 1e18 as total_ape_spent
FROM paid_messages
WHERE amount_wei IS NOT NULL
GROUP BY wallet
ORDER BY message_count DESC;
```

### Top 10 Most Active Wallets
```sql
SELECT 
  wallet,
  COUNT(*) as messages,
  COUNT(CASE WHEN message_type = 'PAID' THEN 1 END) as paid_count,
  COUNT(CASE WHEN message_type = 'SHILL' THEN 1 END) as shill_count,
  SUM(CAST(amount_wei AS NUMERIC)) / 1e18 as total_ape
FROM paid_messages
WHERE amount_wei IS NOT NULL
GROUP BY wallet
ORDER BY messages DESC
LIMIT 10;
```

### Wallet's Message History
```sql
SELECT 
  message,
  message_type,
  status,
  TO_TIMESTAMP(created_at/1000) as created,
  CAST(amount_wei AS NUMERIC) / 1e18 as ape_paid,
  tx_hash
FROM paid_messages
WHERE wallet = '0xYourWalletAddressLowercase'
ORDER BY created_at DESC;
```

---

## 🔍 SEARCH MESSAGES BY KEYWORD

### Search All Messages Containing a Word
```sql
SELECT 
  message,
  wallet,
  message_type,
  TO_TIMESTAMP(created_at/1000) as created,
  status
FROM paid_messages
WHERE message ILIKE '%keyword%'
ORDER BY created_at DESC;
```

### Search Case-Sensitive
```sql
SELECT message, wallet, created_at
FROM paid_messages
WHERE message LIKE '%ExactWord%'
ORDER BY created_at DESC;
```

### Search Multiple Keywords (OR)
```sql
SELECT message, wallet, message_type
FROM paid_messages
WHERE message ILIKE '%ape%' 
   OR message ILIKE '%miner%'
   OR message ILIKE '%mac%'
ORDER BY created_at DESC;
```

### Search Multiple Keywords (AND)
```sql
SELECT message, wallet, message_type
FROM paid_messages
WHERE message ILIKE '%uncle%' 
  AND message ILIKE '%mac%'
ORDER BY created_at DESC;
```

### Find Messages by User
```sql
SELECT message, message_type, created_at
FROM paid_messages
WHERE message ILIKE '%@username%'
ORDER BY created_at DESC;
```

---

## 💰 REVENUE ANALYTICS

### Total Revenue by Type
```sql
SELECT 
  message_type,
  COUNT(*) as count,
  SUM(CAST(amount_wei AS NUMERIC)) / 1e18 as total_ape
FROM paid_messages
WHERE amount_wei IS NOT NULL
GROUP BY message_type
ORDER BY total_ape DESC;
```

### Revenue Last 24 Hours
```sql
SELECT 
  message_type,
  COUNT(*) as count,
  SUM(CAST(amount_wei AS NUMERIC)) / 1e18 as total_ape,
  AVG(CAST(amount_wei AS NUMERIC)) / 1e18 as avg_ape
FROM paid_messages
WHERE created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000
  AND amount_wei IS NOT NULL
GROUP BY message_type;
```

### Daily Revenue Trend
```sql
SELECT 
  DATE(TO_TIMESTAMP(created_at/1000)) as day,
  COUNT(*) as messages,
  SUM(CAST(amount_wei AS NUMERIC)) / 1e18 as total_ape
FROM paid_messages
WHERE amount_wei IS NOT NULL
  AND created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 604800000 -- Last 7 days
GROUP BY day
ORDER BY day DESC;
```

---

## 📈 QUEUE ANALYTICS

### Current Queue Status
```sql
SELECT 
  status,
  COUNT(*) as count
FROM paid_messages
GROUP BY status;
```

### Average Wait Time
```sql
SELECT 
  AVG(played_at - created_at) / 1000 / 60 as avg_wait_minutes
FROM paid_messages
WHERE played_at IS NOT NULL
  AND created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000;
```

### Messages Per Hour (Last 24h)
```sql
SELECT 
  EXTRACT(HOUR FROM TO_TIMESTAMP(created_at/1000)) as hour,
  COUNT(*) as messages
FROM paid_messages
WHERE created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000
GROUP BY hour
ORDER BY hour;
```

### Queue Depth Over Time
```sql
SELECT 
  DATE_TRUNC('hour', TO_TIMESTAMP(created_at/1000)) as hour,
  COUNT(*) as messages_created,
  message_type
FROM paid_messages
WHERE created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000
GROUP BY hour, message_type
ORDER BY hour DESC;
```

---

## 🔥 TRENDING & POPULAR

### Most Common Words in Messages
```sql
SELECT 
  word,
  COUNT(*) as frequency
FROM (
  SELECT 
    LOWER(UNNEST(STRING_TO_ARRAY(message, ' '))) as word
  FROM paid_messages
  WHERE message_type IN ('PAID', 'SHILL')
) words
WHERE LENGTH(word) > 3  -- Skip short words
GROUP BY word
ORDER BY frequency DESC
LIMIT 20;
```

### Longest Messages
```sql
SELECT 
  message,
  LENGTH(message) as length,
  wallet,
  message_type
FROM paid_messages
ORDER BY length DESC
LIMIT 10;
```

### Most Expensive Messages (SHILL)
```sql
SELECT 
  message,
  wallet,
  CAST(amount_wei AS NUMERIC) / 1e18 as ape_paid,
  TO_TIMESTAMP(created_at/1000) as created
FROM paid_messages
WHERE message_type = 'SHILL'
ORDER BY ape_paid DESC
LIMIT 10;
```

---

## 🚨 MODERATION QUERIES

### Find Messages Pending Review
```sql
SELECT 
  id,
  message,
  wallet,
  status,
  TO_TIMESTAMP(created_at/1000) as created
FROM paid_messages
WHERE status = 'active'
  AND message ILIKE '%suspicious%'  -- Replace with your criteria
ORDER BY created_at DESC;
```

### Check for Spam (Same Message Multiple Times)
```sql
SELECT 
  message,
  COUNT(*) as times_sent,
  STRING_AGG(DISTINCT wallet, ', ') as wallets
FROM paid_messages
GROUP BY message
HAVING COUNT(*) > 1
ORDER BY times_sent DESC;
```

### Messages by Blacklisted Wallets
```sql
SELECT 
  pm.message,
  pm.wallet,
  bw.reason as blacklist_reason,
  pm.created_at
FROM paid_messages pm
JOIN blacklisted_wallets bw ON pm.wallet = bw.wallet
ORDER BY pm.created_at DESC;
```

---

## 🛠️ ADMIN OPERATIONS

### Manually Remove a Message
```sql
UPDATE paid_messages
SET status = 'removed'
WHERE id = 'message-uuid-here';
```

### Blacklist a Wallet
```sql
INSERT INTO blacklisted_wallets (wallet, reason, blocked_at, blocked_by)
VALUES (
  '0xwalletaddresslowercase',
  'Spam/Abuse',
  EXTRACT(EPOCH FROM NOW())*1000,
  'admin'
);
```

### Unblacklist a Wallet
```sql
DELETE FROM blacklisted_wallets
WHERE wallet = '0xwalletaddresslowercase';
```

### Check Wallet's Blacklist Status
```sql
SELECT * FROM blacklisted_wallets
WHERE wallet = '0xwalletaddresslowercase';
```

---

## 🎯 EXPORT QUERIES

### Export All Messages to CSV
```sql
\copy (SELECT wallet, message, message_type, TO_TIMESTAMP(created_at/1000) as created, status FROM paid_messages ORDER BY created_at DESC) TO '/tmp/messages.csv' CSV HEADER;
```

### Export Top Wallets
```sql
\copy (SELECT wallet, COUNT(*) as messages, SUM(CAST(amount_wei AS NUMERIC)) / 1e18 as total_ape FROM paid_messages WHERE amount_wei IS NOT NULL GROUP BY wallet ORDER BY messages DESC) TO '/tmp/top_wallets.csv' CSV HEADER;
```

---

## 📊 FULL TABLE SCHEMA

```sql
\d paid_messages
```

**Columns:**
- `id` - UUID primary key
- `wallet` - Sender address (lowercase)
- `message` - Message content
- `tx_hash` - Transaction hash (null for MINEBOY)
- `amount_wei` - Payment amount (null for MINEBOY)
- `created_at` - Unix timestamp (milliseconds)
- `expires_at` - Unix timestamp (milliseconds)
- `status` - 'active' | 'playing' | 'expired' | 'removed'
- `message_type` - 'MINEBOY' | 'PAID' | 'SHILL'
- `nonce` - Per-wallet sequence
- `msg_hash` - keccak256(message)
- `color` - Hex color for banner
- `banner_duration_sec` - Display duration
- `priority` - Scheduler priority (lower = higher)
- `scheduled_at` - When picked by scheduler
- `played_at` - When started playing

---

## 🔌 API ENDPOINTS (Alternative to Direct SQL)

### Get Active Messages
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq .
```

### Get Currently Playing Messages
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq .
```

### Get Queue Status
```bash
curl -s "https://mineboy-g5xo.onrender.com/v2/messages/queue?wallet=0xYourWallet" | jq .
```

### Get Stats (Admin)
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/admin/messages/paid/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq .
```

---

## 💡 QUICK REFERENCE

**Most Useful Queries:**

1. **See all recent messages:**
   ```sql
   SELECT message, wallet, message_type, TO_TIMESTAMP(created_at/1000) FROM paid_messages ORDER BY created_at DESC LIMIT 50;
   ```

2. **Find messages with keyword:**
   ```sql
   SELECT message, wallet FROM paid_messages WHERE message ILIKE '%keyword%';
   ```

3. **Top spenders:**
   ```sql
   SELECT wallet, SUM(CAST(amount_wei AS NUMERIC))/1e18 as ape FROM paid_messages GROUP BY wallet ORDER BY ape DESC LIMIT 10;
   ```

4. **Queue status:**
   ```sql
   SELECT status, COUNT(*) FROM paid_messages GROUP BY status;
   ```

5. **Today's revenue:**
   ```sql
   SELECT message_type, COUNT(*), SUM(CAST(amount_wei AS NUMERIC))/1e18 as ape FROM paid_messages WHERE created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000 GROUP BY message_type;
   ```

---

**🔍 Pro Tips:**

- Use `ILIKE` for case-insensitive search
- Timestamps are in milliseconds, divide by 1000 for seconds
- `amount_wei` is stored as TEXT, cast to NUMERIC for math
- Wallet addresses are stored lowercase
- Use `TO_TIMESTAMP(created_at/1000)` for readable dates
- Add `LIMIT` to large queries for performance

**Need custom queries? Ask me!** 🚀
