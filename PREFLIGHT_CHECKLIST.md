# 🚀 Paid Messages V2 - Final Preflight Checklist

**Run this checklist before announcing to users.**

---

## ✅ 1. DATABASE CONSTRAINTS (Defense in Depth)

### Verify in PostgreSQL:
```sql
-- Check table structure
\d paid_messages

-- Expected constraints:
-- ✅ PRIMARY KEY (id)
-- ✅ UNIQUE (tx_hash)
-- ✅ UNIQUE (wallet, nonce) WHERE nonce IS NOT NULL
-- ✅ UNIQUE (msg_hash) WHERE msg_hash IS NOT NULL
-- ✅ CHECK (status IN ('active','playing','expired','removed'))
-- ✅ CHECK (message_type IN ('MINEBOY','PAID','SHILL'))

-- Check indexes
\di paid_messages*

-- Expected indexes:
-- ✅ idx_paid_messages_status_expires
-- ✅ idx_paid_messages_status_created
-- ✅ idx_paid_messages_wallet
-- ✅ idx_paid_messages_wallet_created (for throughput queries)
-- ✅ idx_paid_messages_wallet_nonce (unique partial)
-- ✅ idx_paid_messages_msg_hash (unique partial)
-- ✅ idx_paid_messages_type_status_priority
-- ✅ idx_paid_messages_played_at (partial)
```

### Test constraint enforcement:
```sql
-- Should reject invalid status
INSERT INTO paid_messages (id, wallet, message, created_at, expires_at, status, message_type, color, banner_duration_sec)
VALUES ('test-1', '0xtest', 'test', 1234567890000, 1234567890000, 'invalid', 'PAID', '#fff', 3600);
-- Expected: ERROR - status constraint violation

-- Should reject invalid message_type
INSERT INTO paid_messages (id, wallet, message, created_at, expires_at, status, message_type, color, banner_duration_sec)
VALUES ('test-2', '0xtest', 'test', 1234567890000, 1234567890000, 'active', 'INVALID', '#fff', 3600);
-- Expected: ERROR - message_type constraint violation

-- Should enforce unique tx_hash
INSERT INTO paid_messages (id, wallet, message, tx_hash, created_at, expires_at, status, message_type, color, banner_duration_sec)
VALUES ('test-3', '0xtest1', 'test1', '0xdupe', 1234567890000, 1234567890000, 'active', 'PAID', '#fff', 3600);
INSERT INTO paid_messages (id, wallet, message, tx_hash, created_at, expires_at, status, message_type, color, banner_duration_sec)
VALUES ('test-4', '0xtest2', 'test2', '0xdupe', 1234567890000, 1234567890000, 'active', 'PAID', '#fff', 3600);
-- Expected: ERROR - duplicate tx_hash

-- Cleanup test data
DELETE FROM paid_messages WHERE id LIKE 'test-%';
```

---

## ✅ 2. ENVIRONMENT VARIABLES

### Backend (`packages/backend/.env` or Render env vars):
```bash
# Required for on-chain verification
✅ RPC_URL=https://apechain-mainnet.g.alchemy.com/v2/YOUR_KEY

# Required for paid messages
✅ PAID_MESSAGES_ROUTER=0xd7e1110a69753459079f1aa8403c1846b9e886ab  # lowercase!

# Required for persistence
✅ DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional but recommended
✅ ADMIN_TOKEN=1e97e071f3e42553dba423ce05b10c10
✅ REDIS_URL=redis://red-d34lk9e3jp1c73as6ne0:6379
```

### Verification:
```bash
# Check if all required vars are set
curl -s https://mineboy-g5xo.onrender.com/health | jq .

# Should see no errors about missing env vars in Render logs
```

### CORS Check:
```bash
# If you've locked down origins, test from browser console on mineboy.app:
fetch('https://mineboy-g5xo.onrender.com/v2/messages')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)

# Should NOT see CORS error
```

---

## ✅ 3. ROUTER ABI/EVENT VERIFICATION

### Contract: `0xD7E1110A69753459079F1aA8403C1846b9e886AB`

### Event Structure:
```solidity
event Paid(address indexed payer, uint256 amount, bytes32 msgHash);
```

### Event Topic (keccak256):
```
0x... (first topic after event signature)
```

### Message Hash Calculation:
```javascript
// Frontend must compute:
const msgHash = ethers.keccak256(ethers.toUtf8Bytes(message));

// Backend verifies:
const expectedHash = keccak256(toBytes(messageText));
// Must match on-chain event's msgHash
```

### Test Transaction Flow:
1. User sends 1 APE to router with `msgHash = keccak256("Test message")`
2. Router emits: `Paid(userWallet, 1000000000000000000, 0x...hash)`
3. Backend fetches receipt, decodes event, verifies msgHash matches

---

## ✅ 4. BANNER UI COMPATIBILITY

### Test Both Formats:

**String format (backward compatible):**
```javascript
{
  "messages": ["MineBoy it Mines stuff!", "PAID CONTENT: User message"]
}
```

**Structured format (new):**
```javascript
{
  "messages": [
    {
      "text": "MineBoy it Mines stuff!",
      "color": "#ffffff",
      "prefix": "MineBoy: ",
      "type": "MINEBOY"
    },
    {
      "text": "User message",
      "color": "#4ade80",
      "prefix": "PAID CONTENT: ",
      "type": "PAID"
    }
  ]
}
```

### Verification:
```typescript
// ScrollingMessageBar should handle both:
messages.map((msg, i) => {
  const isStructured = typeof msg === 'object';
  const text = isStructured ? `${msg.prefix || ''}${msg.text}` : msg;
  const color = isStructured ? (msg.color || '#64ff8a') : '#64ff8a';
  // ...
})
```

### Visual Check:
- ✅ MINEBOY messages are white
- ✅ PAID messages are green
- ✅ SHILL messages are red
- ✅ Prefix appears exactly once (not doubled)
- ✅ Messages scroll smoothly with proper spacing

---

## ✅ 5. SMOKE TESTS

### 5.1 Health Check
```bash
curl -s https://mineboy-g5xo.onrender.com/health | jq .
```
**Expected:** `{"status":"ok"}`

---

### 5.2 Admin Message (MINEBOY)
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/admin/messages/mineboy \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' \
  -d '{"message":"Test admin message"}' | jq .
```
**Expected:** `{"ok":true,"messageId":"...","expiresAt":...}`

**Verify:**
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq '.messages[] | select(.type == "MINEBOY")'
```
**Expected:** White message with "MineBoy: Test admin message"

---

### 5.3 PAID Message (Happy Path)

**Step 1:** Send 1 APE to router
```javascript
// On ApeChain
const message = "This is a test PAID message!";
const msgHash = ethers.keccak256(ethers.toUtf8Bytes(message));
const tx = await router.pay(msgHash, { value: ethers.parseEther("1") });
await tx.wait();
```

**Step 2:** Submit to backend
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{
    "wallet": "0xYourWallet",
    "txHash": "0xYourTxHash",
    "message": "This is a test PAID message!",
    "messageType": "PAID"
  }' | jq .
```
**Expected:** `{"ok":true,"messageId":"...","expiresAt":...}`

**Verify Queue:**
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq .
```
**Expected:** Message with `color: "#4ade80"` and `prefix: "PAID CONTENT: "`

**Verify Playing (after scheduler picks it up):**
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq '.messages[] | select(.type == "PAID")'
```
**Expected:** Green message displaying on banner

---

### 5.4 SHILL Message (Premium)

**Step 1:** Send 15 APE to router
```javascript
const message = "Uncle Mac is the best Mac there ever was!";
const msgHash = ethers.keccak256(ethers.toUtf8Bytes(message));
const tx = await router.pay(msgHash, { value: ethers.parseEther("15") });
```

**Step 2:** Submit to backend
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{
    "wallet": "0xYourWallet",
    "txHash": "0xYourTxHash",
    "message": "Uncle Mac is the best Mac there ever was!",
    "messageType": "SHILL"
  }' | jq .
```
**Expected:** `{"ok":true,"messageId":"...","expiresAt":...}` (4 hours from now)

**Verify:**
```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq '.messages[] | select(.type == "SHILL")'
```
**Expected:** Red message with "Shilled Content: " prefix

---

### 5.5 Rejection Tests

#### A. Underpayment
```bash
# Send only 0.9 APE instead of 1 APE
# Then try to submit as PAID

curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{"wallet":"0x...","txHash":"0x...","message":"Test","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"verification_failed","message":"Insufficient payment: 0.9 APE (minimum 1 APE)"}`

#### B. Message Hash Mismatch
```bash
# Send tx with msgHash for "Message A"
# Try to submit "Message B" with same txHash

curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{"wallet":"0x...","txHash":"0xSameTx","message":"Different message","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"verification_failed","message":"Message hash mismatch (text differs from paid payload)"}`

#### C. Rate Limit (3 messages/hour)
```bash
# Submit 3 PAID messages from same wallet
# 4th should be rejected

curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -H 'Content-Type: application/json' \
  -d '{"wallet":"0xYourWallet","txHash":"0xTx4","message":"Fourth message","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"rate_limit","message":"Too many messages this hour (limit: 3 per hour)"}`

#### D. Empty/Punctuation-Only
```bash
# Empty
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d '{"wallet":"0x...","txHash":"0x...","message":"   ","messageType":"PAID"}' | jq .

# Punctuation only
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d '{"wallet":"0x...","txHash":"0x...","message":"!!!???","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"invalid_message","message":"Message must contain letters or numbers"}`

#### E. Too Long
```bash
# PAID max is 64 chars
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d "{\"wallet\":\"0x...\",\"txHash\":\"0x...\",\"message\":\"$(printf 'a%.0s' {1..65})\",\"messageType\":\"PAID\"}" | jq .
```
**Expected:** `{"code":"invalid_message","message":"Message must be 64 characters or less"}`

#### F. Blacklist Hit
```bash
curl -s -X POST https://mineboy-g5xo.onrender.com/v2/messages/paid \
  -d '{"wallet":"0x...","txHash":"0x...","message":"Free airdrop! Click my link!","messageType":"PAID"}' | jq .
```
**Expected:** `{"code":"invalid_message","message":"Message contains prohibited content"}`

---

## ✅ 6. SCHEDULER VERIFICATION

### Test Lane Behavior:
```bash
# Add messages:
# 1 SHILL, 3 PAID, 1 MINEBOY

# Watch Render logs for scheduler output:
[MessageScheduler] Lane sequence: SHILL → PAID → MINEBOY → PAID → MINEBOY → PAID → PAID → PAID
[MessageScheduler] Distribution: SHILL=1/8, PAID=5/8, MINEBOY=2/8
[MessageScheduler] ✅ Played from SHILL lane: "Uncle Mac is the best Mac..."
[MessageScheduler] ✅ Played from PAID lane: "Test message 1..."
[MessageScheduler] ✅ Played from MINEBOY lane: "MineBoy it Mines stuff..."
```

### Verify Cooldowns:
- ✅ Same wallet's PAID messages have 10-minute gaps
- ✅ SHILL messages have 4-hour gaps (only 1 active at a time)
- ✅ MINEBOY messages have no cooldown

### Check "No Eligible" Logs:
```bash
# When queue is empty or all on cooldown:
[MessageScheduler] ℹ️  No eligible messages in any lane (all playing, on cooldown, or queue empty)
```

---

## ✅ 7. OBSERVABILITY

### Key Logs to Monitor:

**Startup:**
```
[MessageScheduler] Lane sequence: SHILL → PAID → MINEBOY → PAID → MINEBOY → PAID → PAID → PAID
[MessageScheduler] Distribution: SHILL=1/8, PAID=5/8, MINEBOY=2/8
[PaidMessages] Using PostgreSQL for message persistence
```

**Message Submission:**
```
[PM:VALIDATE] Raw input: "Test message"
[PM:VALIDATE] After NFKC normalize: "Test message"
[PAID_MESSAGE] Added PAID message from 0x... (tx: 0x...)
[PaidMessages] Message added: uuid-here (PAID, expires in 3600s)
```

**Scheduler:**
```
[MessageScheduler] ✅ Played from PAID lane: "Test message..."
[MessageScheduler] ℹ️  No eligible messages in any lane
```

**Errors:**
```
[PAID_MESSAGE] Verification failed: Message hash mismatch
[PaidMessages] ❌ On-chain verification failed
[MessageScheduler] Error in tick: <error>
```

### Analytics Queries (PostgreSQL):

**Queue depth:**
```sql
SELECT status, COUNT(*) FROM paid_messages GROUP BY status;
```

**Throughput (last hour):**
```sql
SELECT COUNT(*) FROM paid_messages 
WHERE played_at >= EXTRACT(EPOCH FROM NOW())*1000 - 3600000;
```

**Top wallets (last 24h):**
```sql
SELECT wallet, COUNT(*) as msg_count 
FROM paid_messages 
WHERE created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000 
GROUP BY wallet 
ORDER BY msg_count DESC 
LIMIT 10;
```

**Revenue (last 24h):**
```sql
SELECT 
  message_type,
  COUNT(*) as count,
  SUM(CAST(amount_wei AS NUMERIC)) / 1e18 as total_ape
FROM paid_messages 
WHERE created_at >= EXTRACT(EPOCH FROM NOW())*1000 - 86400000
  AND amount_wei IS NOT NULL
GROUP BY message_type;
```

---

## ✅ 8. EDGE CASES

### AA Wallets (Glyph, Coinbase Smart Wallet):
- ✅ Router event verification sidesteps `tx.from` checks
- ✅ Only cares that `Paid` event was emitted by router
- ✅ `payer` address from event matches claimed wallet

**Test with Glyph:**
```bash
# Submit transaction via Glyph wallet
# Backend should accept as long as router event exists
```

### Clock Skew:
- ✅ All TTLs use `Date.now()` (server time)
- ✅ No issues with multiple Render instances (all on NTP)
- ✅ `expires_at` is absolute timestamp, not relative

### CORS:
```bash
# Test from browser console on https://mineboy.app
fetch('https://mineboy-g5xo.onrender.com/v2/messages')
  .then(r => r.json())
  .then(d => console.log('✅ CORS OK:', d))
  .catch(e => console.error('❌ CORS FAIL:', e))
```

### Font Reflow (Banner):
- ✅ `useLayoutEffect` measures after font load
- ✅ `document.fonts.ready` triggers re-measure
- ✅ `ResizeObserver` handles dynamic changes
- ✅ `gap = Math.max(messageGap, width)` prevents snap-back

---

## ✅ 9. NICE-TO-HAVES (Optional Fast Wins)

### A. Idempotency Key (Prevent Double-Submit)
```typescript
// In /v2/messages/paid route:
const idempotencyKey = req.headers['x-idempotency-key'] as string;
if (idempotencyKey) {
  // Check if already processed
  const existing = await db.prepare(`
    SELECT id FROM paid_messages WHERE tx_hash = @txHash
  `).get({ txHash });
  
  if (existing) {
    return reply.send({ 
      ok: true, 
      messageId: existing.id, 
      note: 'Already processed (idempotent)' 
    });
  }
}
```

### B. Queue Position + ETA
```typescript
// After adding message:
const queuePosition = await db.prepare(`
  SELECT COUNT(*) as position 
  FROM paid_messages 
  WHERE status = 'active' AND priority <= @priority AND created_at < @created_at
`).get({ priority: 0, created_at: now });

const estimatedStartsAt = now + (queuePosition.position * 10000); // ~10s per message

return reply.send({ 
  ok: true, 
  messageId: result.id,
  expiresAt: result.expiresAt,
  queuePosition: queuePosition.position,
  estimatedStartsAt
});
```

### C. 429 with Retry-After
```typescript
if (isRateLimited) {
  const retryAfterSec = 3600; // 1 hour
  return reply.code(429)
    .header('Retry-After', String(retryAfterSec))
    .send({
      code: 'rate_limit',
      message: 'Too many messages this hour (limit: 3 per hour)',
      retryAfterSec
    });
}
```

---

## ✅ 10. FINAL GO/NO-GO CHECKLIST

Before announcing to users:

- [ ] Database constraints verified (CHECK, UNIQUE, indexes)
- [ ] Environment variables set and verified
- [ ] Health endpoint returns OK
- [ ] Admin message (MINEBOY) works and displays white
- [ ] PAID message (1 APE) works and displays green
- [ ] SHILL message (15 APE) works and displays red
- [ ] Rejection tests pass (underpay, hash mismatch, rate limit, empty, blacklist)
- [ ] Scheduler logs show proper lane distribution
- [ ] Banner scrolls smoothly with proper colors
- [ ] CORS works from https://mineboy.app
- [ ] No errors in Render logs for 10 minutes
- [ ] Analytics queries return expected data

**If all boxes checked:** ✅ **SHIP IT!** 🚀

---

## 📞 SUPPORT

If issues arise:
1. Check Render logs for error messages
2. Run SQL query: `SELECT * FROM paid_messages WHERE status = 'active' ORDER BY created_at DESC LIMIT 10;`
3. Verify environment variables in Render dashboard
4. Check CORS headers in browser network tab
5. Test `/health` endpoint

**Status:** Production Ready ✅  
**Last Updated:** 2025-10-07  
**Version:** V2.0.0

