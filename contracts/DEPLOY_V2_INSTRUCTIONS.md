# Deploy PaidMessagesRouter V2 (Multi-Tier Support)

## ✅ What's Changed

### Contract Updates
- **`price` → `minPrice`** - Renamed for clarity
- **`!=` → `<`** - Now accepts any amount ≥ minPrice
- **`setPrice()` → `setMinPrice()`** - Admin function renamed

### Result
- ✅ PAID messages (1 APE) work
- ✅ SHILL messages (15 APE) work
- ✅ Any amount ≥ 1 APE accepted
- ✅ Fee splits remain perfect (25/50/15/10)

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Set Up Environment

**Copy the Team Wallet private key to the contracts directory:**

```bash
cd /Users/mattrenshaw/ApeBit\ Miner/contracts

# Create .env file with your deployer private key
cat > .env << 'EOF'
# Use Team Wallet private key (has admin role)
PRIVATE_KEY=YOUR_TEAM_WALLET_PRIVATE_KEY_HERE

# ApeChain RPC
RPC_URL=https://rpc.apechain.com/http
EOF
```

> **Note:** You'll need the Team Wallet private key (`0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5`) to deploy, as it will be set as the admin.

---

### Step 2: Compile Contract

```bash
cd /Users/mattrenshaw/ApeBit\ Miner/contracts

# Install dependencies (if not already done)
forge install

# Compile the contract
forge build
```

**Expected Output:**
```
[⠊] Compiling...
[✓] Compiling 1 files with Solc 0.8.24
[✓] Solc 0.8.24 finished in XX.XXms
Compiler run successful!
```

---

### Step 3: Deploy to ApeChain

```bash
cd /Users/mattrenshaw/ApeBit\ Miner/contracts

forge script script/DeployPaidMessagesRouter.s.sol:DeployPaidMessagesRouter \
  --rpc-url https://rpc.apechain.com/http \
  --broadcast \
  --verify \
  -vvvv
```

**Expected Output:**
```
PaidMessagesRouter deployed to: 0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Admin: 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5
Min Price: 1000000000000000000

Fee Recipients:
  Merchant: 0xFB53Da794d3d4d831255e7AB40F4649791331e75
    Amount: 0.25 APE (2500 bps)
  Flywheel: 0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4
    Amount: 0.50 APE (5000 bps)
  Team: 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5
    Amount: 0.15 APE (1500 bps)
  LP: 0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043
    Amount: 0.10 APE (1000 bps)
```

**📝 SAVE THE CONTRACT ADDRESS** - You'll need it for the next steps!

---

### Step 4: Update Backend Environment Variables

**Update Render Service: `mineboy-backend`**

```bash
# In Render dashboard, update the environment variable:
PAID_MESSAGES_ROUTER=0xNEW_CONTRACT_ADDRESS_FROM_STEP_3
```

**Restart the service after updating.**

---

### Step 5: Update Frontend Environment Variables

**Update Vercel Deployment: `minerboy-web`**

```bash
# In Vercel dashboard, update the environment variable:
NEXT_PUBLIC_PAID_MESSAGES_ROUTER=0xNEW_CONTRACT_ADDRESS_FROM_STEP_3
```

**Redeploy the frontend after updating.**

---

### Step 6: Re-enable SHILL Messages in Frontend

**Edit:** `apps/minerboy-web/src/components/PaidMessageModal.tsx`

Find the `MESSAGE_TYPES` config and re-enable SHILL:

```typescript
const MESSAGE_TYPES = {
  PAID: {
    cost: '1',
    maxLen: 64,
    duration: '1 hour',
    label: '💬 Paid (1 APE • 64ch • 1hr)',
    disabled: false, // ✅ Already enabled
  },
  SHILL: {
    cost: '15',
    maxLen: 128,
    duration: '4 hours',
    label: '🔥 Shill (15 APE • 128ch • 4hr)',
    disabled: false, // ✅ CHANGE FROM true TO false
  },
};
```

**Remove the "Coming Soon" text from the dropdown option:**

Find the `<option value="SHILL"` line and change:
```tsx
// FROM:
<option value="SHILL" disabled>🔥 Shill (Coming Soon)</option>

// TO:
<option value="SHILL">🔥 Shill (15 APE • 128ch • 4hr)</option>
```

---

### Step 7: Commit & Deploy Frontend Changes

```bash
cd /Users/mattrenshaw/ApeBit\ Miner

git add apps/minerboy-web/src/components/PaidMessageModal.tsx
git commit -m "feat: Enable SHILL messages with V2 router"
git push origin B
```

**Vercel will auto-deploy the changes.**

---

## 🧪 TESTING

### Test 1: PAID Message (1 APE)
1. Go to MineBoy dApp
2. Open "Paid Messages" modal
3. Select "💬 Paid" type
4. Enter message (max 64 chars)
5. Click "Submit" - pay 1 APE
6. Verify message appears in banner

**Expected Fee Split:**
- Merchant: 0.25 APE
- Flywheel: 0.50 APE
- Team: 0.15 APE
- LP: 0.10 APE

---

### Test 2: SHILL Message (15 APE)
1. Go to MineBoy dApp
2. Open "Paid Messages" modal
3. Select "🔥 Shill" type
4. Enter message (max 128 chars)
5. Click "Submit" - pay 15 APE
6. Verify message appears in banner (red color, 4 hours)

**Expected Fee Split:**
- Merchant: 3.75 APE
- Flywheel: 7.50 APE
- Team: 2.25 APE
- LP: 1.50 APE

---

### Test 3: Verify Fee Distribution

**Check Flywheel Wallet Balance:**
```bash
cast balance 0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4 --rpc-url https://rpc.apechain.com/http
```

**Check Merchant Wallet Balance:**
```bash
cast balance 0xFB53Da794d3d4d831255e7AB40F4649791331e75 --rpc-url https://rpc.apechain.com/http
```

**Check Team Wallet Balance:**
```bash
cast balance 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5 --rpc-url https://rpc.apechain.com/http
```

**Check LP Wallet Balance:**
```bash
cast balance 0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043 --rpc-url https://rpc.apechain.com/http
```

---

## 🔧 OPTIONAL: Update minPrice Later

If you ever want to change the minimum price:

```bash
# Connect as admin (Team Wallet)
cast send 0xNEW_CONTRACT_ADDRESS \
  "setMinPrice(uint256)" \
  2000000000000000000 \
  --rpc-url https://rpc.apechain.com/http \
  --private-key $PRIVATE_KEY
```

This would set minPrice to 2 APE.

---

## 📊 CURRENT CONFIG

| Setting | Value |
|---------|-------|
| **Contract** | `PaidMessagesRouter` (V2) |
| **Min Price** | 1 APE (1e18 wei) |
| **Admin** | `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5` |
| **Merchant** | `0xFB53Da794d3d4d831255e7AB40F4649791331e75` (25%) |
| **Flywheel** | `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4` (50%) |
| **Team** | `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5` (15%) |
| **LP** | `0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043` (10%) |

---

## 🎯 SUMMARY

**What You're Deploying:**
- New contract with flexible pricing (≥ 1 APE)
- Same fee splits as V3 Router (25/50/15/10)
- Same wallets as V3 Router
- Supports PAID (1 APE) and SHILL (15 APE)

**What Happens Next:**
1. Deploy contract (5 min)
2. Update backend env var (1 min)
3. Update frontend env var (1 min)
4. Enable SHILL in code (2 min)
5. Test both message types (5 min)

**Total Time:** ~15 minutes

---

## 🚨 TROUBLESHOOTING

### Error: "Insufficient funds"
- Ensure deployer wallet has enough APE for gas (~0.01 APE)

### Error: "Invalid private key"
- Check that `PRIVATE_KEY` in `.env` has `0x` prefix

### Error: "Contract verification failed"
- Verification can be done manually later, deployment still succeeds

### Messages not appearing
- Check that backend `PAID_MESSAGES_ROUTER` is updated
- Restart backend service after env var change
- Check Discord/logs for any errors

### Fee splits not working
- Contract automatically splits on payment
- Use ApeScan to verify transaction recipients
- Check wallet balances before/after payment

---

**Ready to deploy? Start with Step 1!** 🚀
