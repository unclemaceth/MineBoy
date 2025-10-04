# 🚀 V3 Flywheel Deployment Guide

## Overview
This guide covers deploying the V3 system with:
- **$MNESTR token** (MineStrategy) - capped at 1B, burnable
- **V3 Router** with 10% treasury siphon + dynamic fees
- **Flywheel fee split** (0.01 APE total per claim)

---

## 📋 Prerequisites

### 1. Environment Variables
Create/update `.env` in the `contracts/` directory:

```bash
# Deployment
PRIVATE_KEY=your_deployer_private_key
BACKEND_SIGNER=0x...  # Your backend signer address

# After deploying MNESTR token:
MNESTR_TOKEN_ADDRESS=0x...  # Fill after Step 1

# Flywheel wallets
TREASURY_WALLET=0x...  # Receives 10% of mined MNESTR
MERCHANT_WALLET=0x...  # NGT/GoldCap - 0.0025 APE
FLYWHEEL_WALLET=0x...  # NPC trading bot - 0.0050 APE
TEAM_WALLET=0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5  # 0.0015 APE
LP_WALLET=0x...  # LP management - 0.0010 APE
```

---

## 🎯 Step 1: Deploy MineStrategy Token

### A. Deploy Contract
```bash
cd contracts
forge script script/DeployMineStrategy.s.sol \
  --rpc-url https://rpc.apechain.com \
  --broadcast \
  --legacy
```

### B. Save Address
The script will output:
```
MineStrategy Token: 0x...
```

**ACTION:** Add this to `.env` as `MNESTR_TOKEN_ADDRESS=0x...`

### C. Verify on Apescan (optional)
```bash
forge verify-contract \
  <MNESTR_TOKEN_ADDRESS> \
  src/MineStrategyToken.sol:MineStrategyToken \
  --rpc-url https://rpc.apechain.com \
  --constructor-args $(cast abi-encode "constructor(address)" <YOUR_ADMIN_ADDRESS>)
```

---

## 🎯 Step 2: Deploy V3 Router

### A. Ensure .env is Complete
Double-check:
- ✅ `MNESTR_TOKEN_ADDRESS` is set
- ✅ `TREASURY_WALLET` is set
- ✅ `BACKEND_SIGNER` is set

### B. Deploy Contract
```bash
forge script script/DeployRouterV3.s.sol \
  --rpc-url https://rpc.apechain.com \
  --broadcast \
  --legacy
```

### C. Save Address
The script will output:
```
MiningClaimRouterV3: 0x...
```

**ACTION:** Save this address for Step 3.

---

## 🎯 Step 3: Configure V3 Router

### A. Update Configuration Script
Edit `contracts/script/ConfigureRouterV3.s.sol`:

```solidity
// Line 18: Set your deployed router
address constant ROUTER_ADDRESS = 0x...;  // From Step 2

// Lines 21-24: Set flywheel wallets (if not already in .env)
address constant MERCHANT_WALLET = 0x...;
address constant FLYWHEEL_WALLET = 0x...;
address constant LP_WALLET = 0x...;
```

### B. Run Configuration
```bash
forge script script/ConfigureRouterV3.s.sol \
  --rpc-url https://rpc.apechain.com \
  --broadcast \
  --legacy
```

This will:
- ✅ Add 4 fee recipients (0.01 APE total)
- ✅ Add NPC multiplier (1.2x for 1+ NPCs)
- ✅ Allow Pickaxe NFTs for mining

---

## 🎯 Step 4: Grant MINTER_ROLE

The router needs permission to mint MNESTR:

```bash
cast send <MNESTR_TOKEN_ADDRESS> \
  "grantRole(bytes32,address)" \
  $(cast keccak "MINTER_ROLE()") \
  <ROUTER_V3_ADDRESS> \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com
```

### Verify:
```bash
cast call <MNESTR_TOKEN_ADDRESS> \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE()") \
  <ROUTER_V3_ADDRESS> \
  --rpc-url https://rpc.apechain.com
```

Should return: `true`

---

## 🎯 Step 5: Update Backend

### A. Update Environment Variables
In `packages/backend/.env`:

```bash
# Old
ROUTER_ADDRESS=0x...  # Old V2 address

# New
ROUTER_ADDRESS=0x...  # New V3 address from Step 2
REWARD_TOKEN_ADDRESS=0x...  # MNESTR from Step 1
```

### B. No Code Changes Needed!
The backend already uses `claimV3` and will automatically:
- ✅ Use new router address
- ✅ Sign with V3 EIP-712 domain
- ✅ Calculate multipliers

---

## 🎯 Step 6: Update Frontend

### A. Update Environment Variables
In `apps/minerboy-web/.env.local`:

```bash
# Old
NEXT_PUBLIC_ROUTER_ADDRESS=0x...  # Old V2

# New
NEXT_PUBLIC_ROUTER_ADDRESS=0x...  # New V3 from Step 2
```

### B. Already Updated!
The frontend already:
- ✅ Uses `RouterV3ABI`
- ✅ Sends 0.01 APE per claim
- ✅ Displays multiplier bonuses

---

## 🎯 Step 7: Deploy & Test

### A. Deploy Backend (Render)
```bash
cd packages/backend
git add -A
git commit -m "V3 Flywheel: Update env vars"
git push
```

Render will auto-deploy. Wait 2-3 minutes.

### B. Deploy Frontend (Vercel)
```bash
cd apps/minerboy-web
git add -A
git commit -m "V3 Flywheel: Update env vars + 0.01 APE fee"
git push
```

Vercel will auto-deploy. Wait 2-3 minutes.

### C. Test End-to-End
1. Open MineBoy game
2. Connect wallet
3. Select a Pickaxe
4. Mine until you find a hash
5. Submit claim (should cost **0.01 APE**)
6. Check:
   - ✅ Miner receives **90% of MNESTR**
   - ✅ Treasury receives **10% of MNESTR**
   - ✅ If you own NPCs, you get **1.2x multiplier**

---

## 📊 Fee Breakdown (Per Claim)

| Recipient | Amount | Purpose |
|-----------|--------|---------|
| **Merchant** | 0.0025 APE | NGT/GoldCap rewards |
| **Flywheel** | 0.0050 APE | NPC buy/sell bot |
| **Team** | 0.0015 APE | Development |
| **LP** | 0.0010 APE | Liquidity provision |
| **TOTAL** | **0.01 APE** | Per claim cost |

---

## 🔥 MNESTR Token Split (Per Claim)

| Recipient | % | Notes |
|-----------|---|-------|
| **Miner** | 90% | Direct reward |
| **Treasury** | 10% | For LP, buybacks, future burns |

---

## 🤖 Flywheel Bot (Future)

The Flywheel bot will be a separate service that:
1. Accumulates 0.0050 APE per claim
2. Buys cheapest NPC listings
3. Relists at +20% markup
4. On sale:
   - Swaps 70% of APE for MNESTR → **Burns it**
   - Keeps 30% for next buy
   - Adds LP with treasury MNESTR + remaining APE

**Status:** Contracts ready ✅ | Bot service: TBD 🚧

---

## 🎉 Summary

✅ **MNESTR Token**: Deployed with 1B cap + burnable
✅ **V3 Router**: Deployed with 10% treasury siphon
✅ **Fee Split**: 0.01 APE distributed to 4 wallets
✅ **Multipliers**: NPC holders get 1.2x rewards
✅ **Frontend**: Updated to 0.01 APE fee
✅ **Backend**: No changes needed (already V3)

**Next:** Build flywheel bot service for automated NPC trading & MNESTR burn! 🔥

