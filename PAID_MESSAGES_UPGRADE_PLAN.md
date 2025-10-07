# Paid Messages System - Upgrade Plan

## 📋 Current Status

### ✅ What Works
- Basic paid messages (1 APE, 64 chars, 1 hour)
- On-chain verification via router contract
- Content validation (blacklist, regex, NFKC normalization)
- TX hash uniqueness (prevents replay)
- Frontend modal with scrolling banner
- Auto-moderation

### ⚠️ What's Basic/Missing
- No message types (PAID/SHILL/MINEBOY)
- No nonce tracking per wallet
- No msgHash deduplication
- No priority/queueing system
- No per-wallet cooldown
- No color coding
- Fixed 1-hour duration
- Simple in-memory rate limiting
- No queue visibility for users
- No "max pending per wallet" limit

---

## 🎯 Proposed Upgrades

### **Phase 1: Database Schema Upgrade**

**Goal:** Add fields to support message types, queueing, and deduplication

**New Fields:**
```sql
ALTER TABLE paid_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'PAID';
ALTER TABLE paid_messages ADD COLUMN nonce BIGINT;
ALTER TABLE paid_messages ADD COLUMN msg_hash TEXT;
ALTER TABLE paid_messages ADD COLUMN color TEXT NOT NULL DEFAULT '#4ade80'; -- green
ALTER TABLE paid_messages ADD COLUMN banner_duration_sec INTEGER NOT NULL DEFAULT 3600;
ALTER TABLE paid_messages ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE paid_messages ADD COLUMN scheduled_at INTEGER;
ALTER TABLE paid_messages ADD COLUMN played_at INTEGER;

CREATE UNIQUE INDEX idx_paid_messages_wallet_nonce ON paid_messages (wallet, nonce) WHERE nonce IS NOT NULL;
CREATE UNIQUE INDEX idx_paid_messages_msg_hash ON paid_messages (msg_hash) WHERE msg_hash IS NOT NULL;
CREATE INDEX idx_paid_messages_type_status_priority ON paid_messages (message_type, status, priority, created_at);
```

**Migration Strategy:**
- Run `ALTER TABLE` statements on startup
- Backfill existing messages with `message_type='PAID'`, `color='#4ade80'`, `banner_duration_sec=3600`

---

### **Phase 2: Add SHILL Message Type**

**Spec:**
- **Price:** 15 APE
- **Max Length:** 128 characters
- **Banner Duration:** 4 hours (14,400 seconds)
- **Color:** `#ef4444` (red)
- **Display Format:** `"Shilled Content: [message]"`
- **Queue Behavior:** Only 1 active SHILL at a time; others queued FIFO

**Backend Changes:**
```typescript
const MESSAGE_TYPES = {
  PAID: { price: parseEther('1'), maxLen: 64, duration: 3600, color: '#4ade80' },
  SHILL: { price: parseEther('15'), maxLen: 128, duration: 14400, color: '#ef4444' },
  MINEBOY: { price: parseEther('0'), maxLen: 256, duration: 7200, color: '#ffffff' }, // admin only
};
```

**Frontend Changes:**
- Add message type selector in `PaidMessageModal`
- Show price difference (1 APE vs 15 APE)
- Update character counter (64 vs 128)
- Show estimated banner time

**Router Contract:**
- Already flexible (accepts any amount)
- Backend validates amount matches message type

---

### **Phase 3: Add MINEBOY Message Type**

**Spec:**
- **Price:** 0 APE (admin-only, no TX)
- **Max Length:** 256 characters
- **Banner Duration:** 2 hours (7,200 seconds)
- **Color:** `#ffffff` (white)
- **Display Format:** `"MineBoy: [message]"`
- **Use Cases:** Announcements, maintenance notices, feature launches

**Backend Changes:**
```typescript
// New admin endpoint
fastify.post('/v2/admin/messages/mineboy', async (req, res) => {
  if (!requireDebugAuth(req, res)) return;
  
  const { message } = req.body;
  
  // Validate
  const cleaned = message.normalize('NFKC').trim();
  if (cleaned.length > 256) {
    return res.status(400).send({ error: 'Max 256 characters' });
  }
  
  // Insert directly (no TX)
  const id = randomUUID();
  db.prepare(`
    INSERT INTO paid_messages 
    (id, wallet, message, tx_hash, amount_wei, created_at, expires_at, status, message_type, color, banner_duration_sec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    'SYSTEM',
    cleaned,
    `mineboy-${id}`, // Fake TX hash for uniqueness
    '0',
    Date.now(),
    Date.now() + 7200000,
    'active',
    'MINEBOY',
    '#ffffff',
    7200
  );
  
  return res.send({ ok: true, id });
});
```

---

### **Phase 4: Queueing System**

**Goal:** Fair round-robin with per-wallet cooldown and age-based priority

**Queue Logic:**
```typescript
// Weighted round-robin lanes
const LANE_WEIGHTS = {
  PAID: 5,    // 5/8 of slots
  SHILL: 1,   // 1/8 of slots
  MINEBOY: 2, // 2/8 of slots
};

// Per-wallet cooldown (seconds between plays)
const PER_WALLET_COOLDOWN = {
  PAID: 600,    // 10 minutes
  SHILL: 14400, // 4 hours (can only have 1 active)
  MINEBOY: 0,   // No cooldown for system messages
};

// Age boost (increase priority for waiting messages)
function calculatePriority(createdAt: number, basePriority: number): number {
  const ageMinutes = (Date.now() - createdAt) / 60000;
  const ageBoost = Math.floor(ageMinutes / 10); // +1 priority per 10 minutes
  return basePriority - ageBoost; // Lower = higher priority
}

// Scheduler (runs every 10 seconds)
async function scheduleNext() {
  const lanes = [
    ...(Array(5).fill('PAID')),
    'SHILL',
    ...(Array(2).fill('MINEBOY')),
  ];
  
  for (const lane of lanes) {
    const next = await pickNext(lane);
    if (next) {
      await play(next);
      return;
    }
  }
}

// Pick next message (respecting cooldown)
async function pickNext(messageType: string) {
  // Get recently played wallets (within cooldown window)
  const cooldownSec = PER_WALLET_COOLDOWN[messageType];
  const cooldownStart = Date.now() - (cooldownSec * 1000);
  
  const recentWallets = db.prepare(`
    SELECT DISTINCT wallet FROM paid_messages
    WHERE played_at > ? AND message_type = ?
  `).all(cooldownStart, messageType).map(r => r.wallet);
  
  // Find next eligible message (not in cooldown)
  const next = db.prepare(`
    SELECT * FROM paid_messages
    WHERE status = 'active' 
      AND message_type = ?
      AND wallet NOT IN (${recentWallets.map(() => '?').join(',')})
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
  `).get(messageType, ...recentWallets);
  
  return next;
}

// Play message
async function play(msg: PaidMessage) {
  db.prepare(`
    UPDATE paid_messages 
    SET status = 'playing', played_at = ? 
    WHERE id = ?
  `).run(Date.now(), msg.id);
  
  // After banner_duration_sec, mark as expired
  setTimeout(() => {
    db.prepare(`
      UPDATE paid_messages 
      SET status = 'expired' 
      WHERE id = ?
    `).run(msg.id);
  }, msg.banner_duration_sec * 1000);
}
```

---

### **Phase 5: Enhanced Security**

**5.1 Nonce Tracking**
```typescript
// On message submission, assign nonce
function getNextNonce(wallet: string): number {
  const lastNonce = db.prepare(`
    SELECT MAX(nonce) as max_nonce 
    FROM paid_messages 
    WHERE wallet = ?
  `).get(wallet).max_nonce || 0;
  
  return lastNonce + 1;
}

// Compute msgHash
function computeMsgHash(wallet: string, content: string, nonce: number): string {
  return keccak256(toBytes(`${wallet.toLowerCase()}:${content}:${nonce}`));
}
```

**5.2 Max Pending Per Wallet**
```typescript
function checkPendingLimit(wallet: string) {
  const pendingCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM paid_messages 
    WHERE wallet = ? AND status IN ('active', 'playing')
  `).get(wallet).count;
  
  if (pendingCount >= 3) {
    throw new Error('You already have 3 pending messages. Wait for one to play.');
  }
}
```

**5.3 Wallet Blacklist**
```sql
CREATE TABLE IF NOT EXISTS blacklisted_wallets (
  wallet TEXT PRIMARY KEY,
  reason TEXT,
  blocked_at INTEGER NOT NULL,
  blocked_by TEXT
);
```

---

### **Phase 6: Frontend Updates**

**6.1 Message Type Selector**
```tsx
<select value={messageType} onChange={(e) => setMessageType(e.target.value)}>
  <option value="PAID">Paid Message (1 APE, 64 chars, 1 hour)</option>
  <option value="SHILL">Shill Message (15 APE, 128 chars, 4 hours)</option>
</select>
```

**6.2 Color-Coded Banner**
```tsx
// In ScrollingMessageBar.tsx
<span style={{
  color: message.color || '#4ade80', // Default green
  textShadow: message.message_type === 'SHILL' ? '0 0 10px #ef4444' : 'none',
}}>
  {message.message_type === 'SHILL' ? 'Shilled Content: ' : ''}
  {message.message_type === 'MINEBOY' ? 'MineBoy: ' : ''}
  {message.message}
</span>
```

**6.3 Beta Disclaimer**
```tsx
<div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '12px' }}>
  ⚠️ <strong>Beta Testing:</strong> If your message doesn't appear within 10 minutes, 
  please reach out in <a href="https://discord.gg/..." target="_blank">Discord</a>. 
  This feature is meant to be fun and useful for founders to share announcements!
</div>
```

**6.4 Queue Position**
```tsx
// Fetch queue status
const queueStatus = await fetch('/v2/messages/queue').then(r => r.json());

<p style={{ fontSize: '12px', color: '#8fbc8f' }}>
  {queueStatus.yourPosition > 0 
    ? `You're #${queueStatus.yourPosition} in queue (~${queueStatus.estimatedWaitMin} min wait)`
    : 'Your message will appear soon!'
  }
</p>
```

---

### **Phase 7: API Enhancements**

**7.1 Queue Endpoint**
```typescript
fastify.get('/v2/messages/queue', async (req, res) => {
  const { wallet } = req.query;
  
  const totalActive = db.prepare(`
    SELECT COUNT(*) as count 
    FROM paid_messages 
    WHERE status = 'active'
  `).get().count;
  
  const yourPosition = wallet ? db.prepare(`
    SELECT COUNT(*) + 1 as position 
    FROM paid_messages 
    WHERE status = 'active' 
      AND (priority < (SELECT priority FROM paid_messages WHERE wallet = ? AND status = 'active' LIMIT 1)
      OR (priority = (SELECT priority FROM paid_messages WHERE wallet = ? AND status = 'active' LIMIT 1) 
          AND created_at < (SELECT created_at FROM paid_messages WHERE wallet = ? AND status = 'active' LIMIT 1)))
  `).get(wallet, wallet, wallet).position : null;
  
  const estimatedWaitMin = Math.ceil(totalActive * 10 / 60); // 10 sec per message
  
  return res.send({
    totalActive,
    yourPosition,
    estimatedWaitMin,
    backlog: totalActive > 300 ? 'HIGH' : totalActive > 100 ? 'MEDIUM' : 'LOW',
  });
});
```

**7.2 Enhanced Rate Limiting**
```typescript
// In paidMessages.ts
export function checkDailyLimit(wallet: string) {
  const dayStart = Date.now() - (24 * 3600 * 1000);
  
  const todayCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM paid_messages 
    WHERE wallet = ? AND created_at > ?
  `).get(wallet, dayStart).count;
  
  if (todayCount >= 10) {
    throw new Error('Daily limit reached (10 messages per 24 hours)');
  }
}
```

---

## 📅 Implementation Timeline

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| **Phase 1:** Schema Upgrade | 1 hour | HIGH |
| **Phase 2:** SHILL Type | 2 hours | HIGH |
| **Phase 3:** MINEBOY Type | 1 hour | MEDIUM |
| **Phase 4:** Queueing | 4 hours | HIGH |
| **Phase 5:** Security | 3 hours | HIGH |
| **Phase 6:** Frontend | 3 hours | MEDIUM |
| **Phase 7:** API | 2 hours | LOW |

**Total:** ~16 hours of work

---

## 🚀 Suggested Order

1. **Start with Phase 1 + 2** (SHILL messages) - Quick win, revenue boost
2. **Then Phase 5** (Security) - Before heavy usage
3. **Then Phase 4** (Queueing) - Prevents spam/starvation
4. **Then Phase 6** (Frontend polish) - Better UX
5. **Then Phase 3 + 7** (Nice-to-haves)

---

## 💰 Revenue Impact

- **Current:** 1 APE per message
- **With SHILL:** 15 APE per shill message
- **Potential:** If 5% of messages are shills, that's 14 APE extra per shill vs 1 APE paid = **13 APE profit per shill**

---

## 🛡️ Security Checklist

- [x] On-chain TX verification
- [x] Content validation (blacklist/regex)
- [x] TX hash uniqueness
- [ ] Nonce tracking (prevents exact dupes)
- [ ] MsgHash deduplication
- [ ] Max pending per wallet (3)
- [ ] Daily limit per wallet (10)
- [ ] Wallet blacklist table
- [ ] Per-wallet cooldown
- [ ] Admin emergency stop

---

## ⚠️ Beta Disclaimer Text

> **⚠️ This feature is in beta testing!** If your message doesn't appear within 10 minutes, please reach out in our [Discord](https://discord.gg/yourserver). We're building this to be fun for the community and useful for founders to share announcements. Non-refundable. Auto-moderated.

---

## 📝 Next Steps

**Would you like me to:**
1. Start with Phase 1 + 2 (SHILL messages)?
2. Implement all security fixes first (Phase 5)?
3. Build the full queueing system (Phase 4)?
4. Something else?

Let me know which phase to tackle first!
