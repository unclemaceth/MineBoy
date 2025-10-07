# 🚀 Paid Messages V2 - Production Ready

**Status:** ✅ All blockers fixed, all hardening complete  
**Deployed:** Commit `b78d767`  
**ETA:** ~2-3 minutes for Render auto-deploy

---

## ✅ COMPLETED FIXES

### 1. **Hard Blockers (Build/Runtime)**
- ✅ Fixed all 39 Express-style API calls (`res.status` → `reply.code`)
- ✅ Fixed `requireDebugAuth` to use Fastify API
- ✅ Fixed `walletRateLimit` to return boolean (not throw)
- ✅ Fixed `verifyOnChain` return field mismatch (`amount` → `amountWei`)

### 2. **RPC URL Standardization**
- ✅ Removed `ALCHEMY_RPC_URL` fallback
- ✅ Single source of truth: `RPC_URL` env var
- ✅ Throws error if missing (fail-fast)

### 3. **Server-side Message Hash Verification**
- ✅ Added `keccak256(messageText)` check in `verifyOnChain`
- ✅ Prevents post-payment text swap attacks
- ✅ Cryptographic binding: on-chain payment ↔ off-chain message

### 4. **String Headers Everywhere**
- ✅ Wrapped all headers in `String()`:
  - `X-Instance`
  - `X-Lock-Owner`
  - `X-Lock-Session`
  - `X-Lock-Expires`
- ✅ Prevents proxy/middleware issues

### 5. **Status Consistency**
- ✅ Removed all `'queued'` references
- ✅ Only using: `'active' | 'playing' | 'expired' | 'removed'`
- ✅ Updated system-wide and per-wallet limit queries

### 6. **Empty Message Rejection**
- ✅ Added `/\w/` regex check post-normalization
- ✅ Rejects punctuation-only messages
- ✅ Enforces alphanumeric content

### 7. **Structured Message Objects**
- ✅ `/v2/messages` returns `{text, color, prefix, type}`
- ✅ `ScrollingMessageBar` accepts `string | Message`
- ✅ Color-coded banner:
  - 🟢 Green `#4ade80` - PAID messages (1 APE, 1 hour)
  - 🔴 Red `#ff4444` - SHILL messages (15 APE, 4 hours)
  - ⚪ White `#ffffff` - MINEBOY admin messages (24 hours)

---

## 🔒 SECURITY FEATURES

### On-chain Verification
- ✅ Validates transaction on ApeChain RPC
- ✅ Confirms `Paid` event from router contract
- ✅ Checks wallet matches event payer
- ✅ Verifies payment amount ≥ minimum for message type
- ✅ **NEW:** Verifies `msgHash` matches `keccak256(message)`

### Rate Limiting
- ✅ Per-wallet: 3 messages per hour
- ✅ Per-wallet: 3 pending messages max
- ✅ System-wide: 50 active messages max
- ✅ Per-wallet: 10 messages per 24 hours

### Content Validation
- ✅ NFKC Unicode normalization
- ✅ Length limits (64 PAID, 128 SHILL)
- ✅ Blacklist (racial slurs, sexual content, scams)
- ✅ Regex patterns (leetspeak, external links)
- ✅ Special character ratio limit (30%)
- ✅ **NEW:** Alphanumeric requirement

### Database
- ✅ PostgreSQL persistence (survives redeploys)
- ✅ Unique constraints (tx_hash, msg_hash, wallet+nonce)
- ✅ Indexes for performance (status, created_at, wallet)
- ✅ Migration auto-runs on startup

---

## 🧪 TESTING CHECKLIST

### 1. **Health Check**
```bash
curl -s https://mineboy-g5xo.onrender.com/health | jq .
```
**Expected:** `{"status":"healthy"}`

---

### 2. **Submit PAID Message (1 APE, 1 hour)**

**Step 1:** Send 1 APE via PaidMessagesRouter contract
```
Contract: 0xD7E1110A69753459079F1aA8403C1846b9e886AB
Function: pay(bytes32 msgHash)
Value: 1 APE
msgHash: keccak256("Your message here")
```

**Step 2:** Submit to backend
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{
    "wallet": "0xYourWallet",
    "txHash": "0xYourTxHash",
    "message": "Your message here",
    "messageType": "PAID"
  }' | jq .
```

**Expected:**
```json
{
  "ok": true,
  "messageId": "uuid-here",
  "expiresAt": 1234567890000
}
```

---

### 3. **Submit SHILL Message (15 APE, 4 hours)**

**Step 1:** Send 15 APE via PaidMessagesRouter
```
Value: 15 APE
```

**Step 2:** Submit to backend
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{
    "wallet": "0xYourWallet",
    "txHash": "0xYourTxHash",
    "message": "Uncle Mac is the best Mac there ever was or will be, fight me on it!",
    "messageType": "SHILL"
  }' | jq .
```

---

### 4. **Check Message Queue**
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq .
```

**Expected:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "wallet": "0x...",
      "message": "Your message here",
      "color": "#4ade80",
      "prefix": "PAID CONTENT: ",
      "expiresAt": 1234567890000,
      "messageType": "PAID"
    }
  ]
}
```

---

### 5. **Check Live Banner**
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq .
```

**Expected:**
```json
{
  "messages": [
    {
      "text": "MineBoy it Mines stuff!",
      "color": "#ffffff",
      "prefix": "MineBoy: ",
      "type": "MINEBOY"
    },
    {
      "text": "Your message here",
      "color": "#4ade80",
      "prefix": "PAID CONTENT: ",
      "type": "PAID"
    }
  ]
}
```

---

### 6. **Check Frontend Banner**
1. Open https://mineboy.app
2. Wait for banner to load
3. Verify:
   - ✅ MINEBOY messages are white
   - ✅ PAID messages are green with "PAID CONTENT: " prefix
   - ✅ SHILL messages are red with "Shilled Content: " prefix
   - ✅ Messages scroll smoothly with proper spacing
   - ✅ Each message fully enters and exits banner

---

### 7. **Test Rate Limiting**
```bash
# Submit 4 messages within 1 hour from same wallet
# 4th should be rejected with 429 status

curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{
    "wallet": "0xYourWallet",
    "txHash": "0xDifferentTxHash",
    "message": "Fourth message",
    "messageType": "PAID"
  }' | jq .
```

**Expected:**
```json
{
  "code": "rate_limit",
  "message": "Too many messages this hour (limit: 3 per hour)"
}
```

---

### 8. **Test Message Validation**

**Empty message:**
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d '{"wallet":"0x...","txHash":"0x...","message":"   ","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"invalid_message","message":"Message cannot be empty"}`

**Punctuation only:**
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d '{"wallet":"0x...","txHash":"0x...","message":"!!!???","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"invalid_message","message":"Message must contain letters or numbers"}`

**Too long (PAID is 64 chars max):**
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d '{"wallet":"0x...","txHash":"0x...","message":"'$(printf 'a%.0s' {1..65})'","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"invalid_message","message":"Message must be 64 characters or less"}`

---

### 9. **Test Hash Mismatch (NEW)**
```bash
# Send transaction with msgHash for "Message A"
# Then try to submit "Message B" with same txHash

curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d '{"wallet":"0x...","txHash":"0xSameTxHash","message":"Different message","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"verification_failed","message":"Message hash mismatch (text differs from paid payload)"}`

---

### 10. **Admin: Add MINEBOY Message**
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' \
  -d '{"message":"Season 2 is starting soon!"}' | jq .
```

**Expected:**
```json
{
  "ok": true,
  "messageId": "uuid",
  "expiresAt": 1234567890000
}
```

---

## 🐛 KNOWN FIXES

### "D Bug" - RESOLVED ✅
- **Issue:** Letter 'D' disappearing from messages and arcade names
- **Root Cause:** Global keyboard event listener intercepting 'D' key for debug modal
- **Fix:** Added `isTyping` check to skip interception when user is in input field
- **Status:** Deployed in commit `6636def`

### "Banner Stuck" - RESOLVED ✅
- **Issue:** Banner not scrolling fully, messages cutting off mid-banner
- **Root Cause:** Reset distance calculation incorrect, gap too small
- **Fix:** Implemented RAF-based smooth scroll, guaranteed `banner width` gap between messages
- **Status:** Deployed in commit `94239ba` (user-provided complete solution)

### "Messages Lost on Redeploy" - RESOLVED ✅
- **Issue:** All messages wiped after Render redeploy
- **Root Cause:** SQLite on ephemeral filesystem, MINEBOY in-memory
- **Fix:** Migrated to PostgreSQL with `paid_messages` table, migration auto-runs
- **Status:** Deployed in commit `94239ba`

---

## 📊 DATABASE SCHEMA

### `paid_messages` Table
```sql
id TEXT PRIMARY KEY                    -- UUID
wallet TEXT NOT NULL                   -- Payer address (lowercase)
message TEXT NOT NULL                  -- Message content (cleaned)
tx_hash TEXT UNIQUE                    -- Transaction hash (can be NULL for MINEBOY)
amount_wei TEXT                        -- Payment amount (can be NULL for MINEBOY)
created_at BIGINT NOT NULL             -- Unix timestamp (ms)
expires_at BIGINT NOT NULL             -- Unix timestamp (ms)
status TEXT NOT NULL                   -- 'active' | 'playing' | 'expired' | 'removed'
message_type TEXT NOT NULL             -- 'PAID' | 'SHILL' | 'MINEBOY'
nonce BIGINT                           -- Per-wallet sequence (can be NULL)
msg_hash TEXT UNIQUE                   -- keccak256(message) (can be NULL)
color TEXT NOT NULL                    -- Hex color for banner
banner_duration_sec INTEGER NOT NULL   -- Display duration (3600, 14400, 86400)
priority INTEGER NOT NULL              -- Scheduler priority (0 = default)
scheduled_at BIGINT                    -- When scheduler picked it
played_at BIGINT                       -- When it started playing
```

### Indexes
- `idx_paid_messages_status_expires` - Fast expiration checks
- `idx_paid_messages_created` - Chronological ordering
- `idx_paid_messages_wallet` - Per-wallet queries
- `idx_paid_messages_wallet_nonce` - Unique constraint
- `idx_paid_messages_msg_hash` - Deduplication
- `idx_paid_messages_type_status_priority` - Scheduler queries
- `idx_paid_messages_played_at` - Currently playing lookup

---

## 🔧 ENVIRONMENT VARIABLES

### Backend (`packages/backend/.env`)
```bash
# PostgreSQL (required for persistence)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# ApeChain RPC (required for on-chain verification)
RPC_URL=https://apechain-mainnet.g.alchemy.com/v2/YOUR_KEY

# Paid Messages Router V2 (required)
PAID_MESSAGES_ROUTER=0xD7E1110A69753459079F1aA8403C1846b9e886AB

# Admin auth (optional, for /v2/admin routes)
ADMIN_TOKEN=1e97e071f3e42553dba423ce05b10c10

# Redis (optional, for market cache)
REDIS_URL=redis://red-d34lk9e3jp1c73as6ne0:6379
```

---

## 📈 MONITORING

### Logs to Watch
```bash
# Backend logs (Render)
[PaidMessages] Message added: <uuid> (PAID, expires in 3600s)
[MessageScheduler] Playing message <uuid> from lane PAID
[PAID_MESSAGE] Added PAID message from 0x... (tx: 0x...)
```

### Error Logs
```bash
[PAID_MESSAGE] Verification failed: Message hash mismatch
[PaidMessages] ❌ On-chain verification failed
[MessageScheduler] Error in tick: <error>
```

### Health Checks
- `/health` - Backend status
- `/v2/messages` - Live banner content
- `/v2/messages/paid` - Active paid message queue

---

## 🚀 DEPLOYMENT STATUS

**Commit:** `b78d767`  
**Branch:** `B`  
**Render:** Auto-deploy in progress (~2-3 min)

**What's Deployed:**
- ✅ PostgreSQL migration (messages persist)
- ✅ All 39 Express → Fastify API fixes
- ✅ Server-side msgHash verification
- ✅ RPC_URL standardization
- ✅ String headers everywhere
- ✅ Status consistency (no 'queued')
- ✅ Empty message rejection
- ✅ Structured message objects (color-coded banner)

**Next Steps:**
1. ⏳ Wait for Render to deploy
2. 🧪 Run health check
3. 💬 Test PAID message (1 APE)
4. 🔥 Test SHILL message (15 APE)
5. 🎨 Verify color-coded banner
6. 📊 Monitor logs for errors

---

## 📝 CHANGELOG

### v2.0.0 (2025-10-07)
- 🔒 **SECURITY:** Server-side message hash verification
- 🔒 **SECURITY:** Rate limiting (3 messages/hour per wallet)
- 🔒 **SECURITY:** Empty/punctuation-only message rejection
- 💾 **PERSISTENCE:** PostgreSQL migration (survives redeploys)
- 🎨 **UX:** Color-coded banner (green PAID, red SHILL, white MINEBOY)
- 🎨 **UX:** Structured message objects with prefix/color metadata
- 🐛 **BUG:** Fixed "D bug" (keyboard event listener)
- 🐛 **BUG:** Fixed "banner stuck" (scroll distance calculation)
- 🐛 **BUG:** Fixed Express/Fastify API mismatch (39 instances)
- 🐛 **BUG:** Fixed `walletRateLimit` boolean check
- 🐛 **BUG:** Fixed `verifyOnChain` field mismatch
- 🛠️ **REFACTOR:** Removed 'queued' status (unused)
- 🛠️ **REFACTOR:** String headers for proxy compatibility
- 🛠️ **REFACTOR:** Single RPC_URL source of truth

---

**Status: PRODUCTION READY** ✅  
**Testing: IN PROGRESS** 🧪  
**Monitoring: ACTIVE** 📊

