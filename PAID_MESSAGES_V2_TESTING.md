# PaidMessagesRouter V2 - Testing Checklist

## ✅ DEPLOYMENT COMPLETE

**Contract Address:** `0xD7E1110A69753459079F1aA8403C1846b9e886AB`  
**ApeScan:** https://apescan.io/address/0xD7E1110A69753459079F1aA8403C1846b9e886AB  
**Deployer:** `0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98`  
**Admin:** `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5` (Team Wallet)

---

## 📋 PRE-DEPLOYMENT AUDIT RESULTS

### ✅ No Hardcoded Issues Found
- ✅ Backend uses `process.env.PAID_MESSAGES_ROUTER` (no hardcoded address)
- ✅ Frontend uses `process.env.NEXT_PUBLIC_PAID_MESSAGES_ROUTER` (no hardcoded address)
- ✅ Backend `MESSAGE_TYPES` config correct:
  - PAID: 1 APE, 64 chars, 1 hour, green (#4ade80)
  - SHILL: 15 APE, 128 chars, 4 hours, red (#ef4444)
  - MINEBOY: 0 APE, 256 chars, 2 hours, white (#ffffff)
- ✅ Frontend `MESSAGE_TYPES` config correct:
  - PAID: 1 APE, 64 chars, 1 hour
  - SHILL: 15 APE, 128 chars, 4 hours
- ✅ No price hardcoding (all dynamic via MESSAGE_TYPES)
- ✅ SHILL enabled in frontend (removed "Coming Soon")

### ✅ Contract Configuration Verified
- Min Price: 1 APE (1e18 wei)
- Fee Splits: 25% / 50% / 50% / 10% = 100% ✅
- Merchant: `0xFB53Da794d3d4d831255e7AB40F4649791331e75`
- Flywheel: `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4` (50% cut!)
- Team: `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5`
- LP: `0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043`

---

## 🔧 ENVIRONMENT VARIABLE UPDATES

### Backend (Render: `mineboy-backend`)
**Update:**
```
PAID_MESSAGES_ROUTER=0xD7E1110A69753459079F1aA8403C1846b9e886AB
```

**Steps:**
1. Go to Render Dashboard → `mineboy-backend`
2. Environment → Edit
3. Update `PAID_MESSAGES_ROUTER` value
4. Save
5. **Manual Deploy** (or wait for auto-deploy from git push)

---

### Frontend (Vercel: `minerboy-web`)
**Update:**
```
NEXT_PUBLIC_PAID_MESSAGES_ROUTER=0xD7E1110A69753459079F1aA8403C1846b9e886AB
```

**Steps:**
1. Go to Vercel Dashboard → `minerboy-web`
2. Settings → Environment Variables
3. Update `NEXT_PUBLIC_PAID_MESSAGES_ROUTER` value
4. Save
5. **Redeploy** from Deployments tab

---

## 🧪 TESTING CHECKLIST

### Phase 1: Basic Connectivity Tests

#### Test 1.1: Backend Health Check
```bash
curl https://mineboy-g5xo.onrender.com/health
```
**Expected:** `{ "status": "ok", ... }`

---

#### Test 1.2: Backend Router Address Check
```bash
# SSH into Render or check logs for startup message
grep "PAID_MESSAGES_ROUTER" logs
```
**Expected:** Should show new address `0xD7E1110A69753459079F1aA8403C1846b9e886AB`

---

#### Test 1.3: Frontend Build Check
Go to: https://minerboy.io (or your Vercel URL)  
**Open Console:**
```javascript
console.log(process.env.NEXT_PUBLIC_PAID_MESSAGES_ROUTER)
```
**Expected:** `0xD7E1110A69753459079F1aA8403C1846b9e886AB`

---

### Phase 2: PAID Message Tests (1 APE)

#### Test 2.1: UI Elements
1. Open MineBoy dApp
2. Click "Paid Messages" button
3. Check modal displays:
   - ✅ Dropdown with "💬 Paid (1 APE • 64ch • 1hr)"
   - ✅ Dropdown with "🔥 Shill (15 APE • 128ch • 4hr)" (NOT disabled)
   - ✅ Message textarea (max 64 chars for PAID)
   - ✅ Character counter
   - ✅ "Community Chat" warning for PAID type

---

#### Test 2.2: Submit PAID Message (1 APE)
1. Select "💬 Paid" type
2. Enter test message: "Testing V2 router - PAID message!"
3. Click "Submit Message"
4. **Approve transaction** (1 APE + gas)
5. Wait for confirmation

**Expected:**
- ✅ Transaction sends 1 APE to `0xD7E1110A69753459079F1aA8403C1846b9e886AB`
- ✅ Contract splits instantly:
  - Merchant: 0.25 APE
  - Flywheel: 0.50 APE
  - Team: 0.15 APE
  - LP: 0.10 APE
- ✅ Message appears in banner within ~30 seconds
- ✅ Message is GREEN color
- ✅ Message has "PAID CONTENT: " prefix
- ✅ Message expires after 1 hour

---

#### Test 2.3: Verify Fee Distribution (1 APE Payment)
**Check ApeScan for transaction:**
```
https://apescan.io/tx/YOUR_TX_HASH
```

**Verify 4 internal transactions:**
1. `0xFB53Da794d3d4d831255e7AB40F4649791331e75` receives 0.25 APE (Merchant)
2. `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4` receives 0.50 APE (Flywheel) ✅
3. `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5` receives 0.15 APE (Team)
4. `0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043` receives 0.10 APE (LP)

**Verify balances increased:**
```bash
# Check Flywheel wallet
cast balance 0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4 --rpc-url https://rpc.apechain.com/http

# Check Merchant wallet
cast balance 0xFB53Da794d3d4d831255e7AB40F4649791331e75 --rpc-url https://rpc.apechain.com/http
```

---

### Phase 3: SHILL Message Tests (15 APE)

#### Test 3.1: UI Elements for SHILL
1. Open "Paid Messages" modal
2. Select "🔥 Shill" from dropdown
3. Check:
   - ✅ Character limit updates to 128
   - ✅ Cost displays as 15 APE
   - ✅ Duration displays as 4 hours
   - ✅ Warning changes to "Founder Announcements"

---

#### Test 3.2: Submit SHILL Message (15 APE)
1. Select "🔥 Shill" type
2. Enter longer message: "🚀 BIG ANNOUNCEMENT: MineBoy V2 is launching next week with 10x rewards! This is not a drill! Get your pickaxes ready!"
3. Click "Submit Message"
4. **Approve transaction** (15 APE + gas)
5. Wait for confirmation

**Expected:**
- ✅ Transaction sends 15 APE to `0xD7E1110A69753459079F1aA8403C1846b9e886AB`
- ✅ Contract splits instantly:
  - Merchant: 3.75 APE (25%)
  - Flywheel: 7.50 APE (50%) 🔥
  - Team: 2.25 APE (15%)
  - LP: 1.50 APE (10%)
- ✅ Message appears in banner within ~30 seconds
- ✅ Message is RED color
- ✅ Message has "Shilled Content: " prefix
- ✅ Message displays for 4 hours
- ✅ SHILL messages have higher priority in queue

---

#### Test 3.3: Verify Fee Distribution (15 APE Payment)
**Check ApeScan for transaction:**
```
https://apescan.io/tx/YOUR_TX_HASH
```

**Verify 4 internal transactions:**
1. Merchant receives 3.75 APE
2. **Flywheel receives 7.50 APE** ← This is the big one! 💰
3. Team receives 2.25 APE
4. LP receives 1.50 APE

---

### Phase 4: Backend Verification Tests

#### Test 4.1: Check Backend Logs
**Look for:**
```
[PaidMessages] Verifying transaction on chain...
[PaidMessages] ✅ Verified PAID/SHILL message
[PaidMessages] Amount: 1.0 APE / 15.0 APE (expected)
```

**Should NOT see:**
```
❌ Payment must be exactly X APE
❌ Wrong contract address
❌ Transaction sender mismatch
```

---

#### Test 4.2: Check Active Messages API
```bash
curl https://mineboy-g5xo.onrender.com/v2/messages/paid
```

**Expected Response:**
```json
{
  "messages": [
    {
      "id": "...",
      "wallet": "0x...",
      "message": "Testing V2 router - PAID message!",
      "messageType": "PAID",
      "color": "#4ade80",
      "prefix": "PAID CONTENT: ",
      "bannerDurationSec": 3600,
      "created_at": 1234567890,
      "expires_at": 1234571490
    }
  ]
}
```

---

#### Test 4.3: Check Queue Status
```bash
curl "https://mineboy-g5xo.onrender.com/v2/messages/queue?wallet=YOUR_WALLET"
```

**Expected:**
```json
{
  "totalActive": 2,
  "yourPosition": 1,
  "estimatedWaitMin": 5,
  "backlog": { "PAID": 1, "SHILL": 0, "MINEBOY": 1 }
}
```

---

### Phase 5: Queueing System Tests

#### Test 5.1: Multiple Messages (Same User)
1. Submit 2 PAID messages quickly (2 APE total)
2. Check queue position updates
3. Verify messages play sequentially
4. Verify 10-minute cooldown between PAID messages

**Expected:**
- ✅ Both messages accepted
- ✅ Second message waits 10 minutes after first finishes
- ✅ No more than 3 pending messages per wallet

---

#### Test 5.2: Priority System (SHILL > PAID)
1. Submit 1 PAID message (1 APE)
2. Submit 1 SHILL message (15 APE)
3. Watch banner

**Expected:**
- ✅ SHILL message plays before or interrupts PAID
- ✅ SHILL has higher visual prominence (red color)
- ✅ SHILL displays for full 4 hours

---

#### Test 5.3: Age-Based Priority Boost
1. Submit a PAID message
2. Wait 20 minutes (without it playing)
3. Submit another PAID message
4. Watch queue

**Expected:**
- ✅ First message gets +2 priority (10 min = +1, 20 min = +2)
- ✅ Older message plays first despite same type

---

### Phase 6: Error Handling Tests

#### Test 6.1: Insufficient Payment
**Manually try to send 0.5 APE (below minPrice):**
```bash
cast send 0xD7E1110A69753459079F1aA8403C1846b9e886AB \
  "pay(bytes32)" \
  0x0000000000000000000000000000000000000000000000000000000000000001 \
  --value 0.5ether \
  --rpc-url https://rpc.apechain.com/http \
  --private-key YOUR_KEY
```

**Expected:**
- ❌ Transaction REVERTS with "WrongAmount()"
- ✅ No money lost

---

#### Test 6.2: Message Too Long
1. Select PAID (64 char limit)
2. Try to enter 100 characters
3. Submit

**Expected:**
- ✅ Frontend blocks at 64 chars
- ✅ Backend rejects if somehow bypassed

---

#### Test 6.3: Blacklisted Words
1. Try to submit message with profanity
2. Check response

**Expected:**
- ❌ Backend rejects with "contains prohibited content"
- ✅ No transaction sent

---

#### Test 6.4: Daily Limit (10 messages/day)
1. Submit 10 PAID messages in one day
2. Try to submit 11th

**Expected:**
- ❌ Backend rejects with "daily limit exceeded"
- ✅ Can resume next day

---

### Phase 7: Contract Admin Tests (Optional)

#### Test 7.1: Update minPrice (Team Wallet Only)
```bash
# As Team Wallet admin
cast send 0xD7E1110A69753459079F1aA8403C1846b9e886AB \
  "setMinPrice(uint256)" \
  2000000000000000000 \
  --rpc-url https://rpc.apechain.com/http \
  --private-key TEAM_WALLET_PRIVATE_KEY
```

**Expected:**
- ✅ minPrice updates to 2 APE
- ✅ Old messages still valid
- ✅ New messages require ≥ 2 APE

---

#### Test 7.2: Update Fee Splits (Team Wallet Only)
```bash
# Change splits to 20/60/10/10 (give flywheel more!)
cast send 0xD7E1110A69753459079F1aA8403C1846b9e886AB \
  "setFeeSplits(uint256,uint256,uint256,uint256)" \
  2000 6000 1000 1000 \
  --rpc-url https://rpc.apechain.com/http \
  --private-key TEAM_WALLET_PRIVATE_KEY
```

**Expected:**
- ✅ Fee splits update
- ✅ Next payment uses new splits
- ✅ Flywheel gets 60% instead of 50%

---

## 📊 SUCCESS CRITERIA

### ✅ Phase 1: Deployment
- [x] Contract deployed successfully
- [x] Admin role assigned to Team Wallet
- [x] Fee splits configured correctly
- [x] minPrice set to 1 APE

### ✅ Phase 2: Backend Integration
- [ ] Backend updated with new router address
- [ ] Backend verifies transactions on-chain
- [ ] Backend accepts PAID (1 APE) payments
- [ ] Backend accepts SHILL (15 APE) payments
- [ ] Messages appear in API response

### ✅ Phase 3: Frontend Integration
- [ ] Frontend updated with new router address
- [ ] SHILL option enabled (not disabled)
- [ ] Dropdown shows both message types
- [ ] Character limits work correctly
- [ ] Transactions send to correct address

### ✅ Phase 4: Fee Distribution
- [ ] Merchant receives 25% of payments
- [ ] **Flywheel receives 50% of payments** ← Most important!
- [ ] Team receives 15% of payments
- [ ] LP receives 10% of payments
- [ ] All 4 wallets receive instantly (same tx)

### ✅ Phase 5: Message Display
- [ ] PAID messages show with green color
- [ ] SHILL messages show with red color
- [ ] Correct prefixes applied
- [ ] Messages expire after correct duration
- [ ] Queue system works (priority, cooldowns)

---

## 🚨 ROLLBACK PLAN (If Needed)

If anything goes wrong:

1. **Revert Environment Variables:**
   - Backend: `PAID_MESSAGES_ROUTER=OLD_ADDRESS`
   - Frontend: `NEXT_PUBLIC_PAID_MESSAGES_ROUTER=OLD_ADDRESS`

2. **Disable SHILL (temporary):**
   - Re-add `disabled` to SHILL option
   - Redeploy frontend

3. **Contract Issues:**
   - Team Wallet can update `minPrice` via `setMinPrice()`
   - Team Wallet can update fee splits via `setFeeSplits()`
   - No need to redeploy contract

---

## 💰 EXPECTED REVENUE (Flywheel)

| Scenario | PAID Messages | SHILL Messages | Flywheel Earnings |
|----------|---------------|----------------|-------------------|
| **Light Day** | 50 @ 1 APE | 5 @ 15 APE | 25 APE + 37.5 APE = **62.5 APE** |
| **Medium Day** | 100 @ 1 APE | 10 @ 15 APE | 50 APE + 75 APE = **125 APE** |
| **Heavy Day** | 200 @ 1 APE | 20 @ 15 APE | 100 APE + 150 APE = **250 APE** |

**Flywheel gets 50% of every payment!** 🔥

---

## 📞 SUPPORT

**Issues?**
- Check ApeScan for transaction details
- Check Render logs for backend errors
- Check browser console for frontend errors
- Verify env vars are updated and services restarted

**Contract Address:**  
`0xD7E1110A69753459079F1aA8403C1846b9e886AB`

**Admin Wallet (Team):**  
`0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5`

---

**Last Updated:** October 7, 2025  
**Version:** V2 (Multi-Tier Support)  
**Status:** ✅ Deployed & Ready for Testing
