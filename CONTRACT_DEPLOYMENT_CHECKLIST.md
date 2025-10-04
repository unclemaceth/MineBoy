# Contract Deployment Checklist - V3 Router

This document outlines **every step** required when deploying the **MiningClaimRouterV3** with dynamic fees, NFT multipliers, and multi-contract support.

---

## 📋 Prerequisites

- [ ] Admin wallet with APE for gas
- [ ] Private key in `.env` file
- [ ] Foundry installed (`forge`, `cast`)
- [ ] Access to Vercel (frontend) and Render (backend) dashboards
- [ ] Alchemy API key for NFT balance checks

---

## 🚀 Deployment Steps

### 1️⃣ Deploy Smart Contracts

#### Option A: Deploy All Three Contracts (Fresh Start)

```bash
cd contracts
forge script script/DeployApeChain.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy
```

**This deploys:**
- `ApeBitToken` (ERC-20 reward token)
- `ApeBitCartridge` (ERC-721 NFT)
- `MiningClaimRouter` (claim verification & reward distribution)

#### Option B: Deploy Only Router (Reuse Existing Token & Cartridge)

```bash
cd contracts
forge script script/DeployRouterOnly.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy
```

**Before running:** Update addresses in `DeployRouterOnly.s.sol`:
```solidity
address existingToken = 0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023; // ApeBitToken address
address feeRecipient = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5; // Your fee recipient
```

**Save the deployed contract addresses!**

---

### 2️⃣ Grant Roles & Permissions

#### A. Grant MINTER_ROLE to Router

The router needs permission to mint ABIT tokens.

```bash
cd contracts
forge script script/GrantMinterRole.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy
```

**Verify it worked:**
```bash
cast call 0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023 \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE()") \
  <ROUTER_ADDRESS> \
  --rpc-url https://rpc.apechain.com
```

Should return: `true`

#### B. Allow Cartridge on Router

The router needs to know which cartridge NFTs are valid.

**Update the script** `contracts/script/AddCartridgeToRouter.s.sol`:
```solidity
address routerAddress = <YOUR_NEW_ROUTER_ADDRESS>;
address cartridgeAddress = <YOUR_CARTRIDGE_ADDRESS>;
```

**Run it:**
```bash
cd contracts
forge script script/AddCartridgeToRouter.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy
```

**Verify it worked:**
```bash
cast call <ROUTER_ADDRESS> \
  "allowedCartridge(address)(bool)" \
  <CARTRIDGE_ADDRESS> \
  --rpc-url https://rpc.apechain.com
```

Should return: `true`

---

### 3️⃣ Configure Router On-Chain

**V3 routers store configuration on-chain, not in env vars!**

#### A. Add Fee Recipients

```bash
# Example: 0.002 APE to you, 0.002 to vault, 0.002 to gold cap
cast send <ROUTER_ADDRESS> \
  "addFeeRecipient(address,uint256)" \
  0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5 \
  2000000000000000 \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com

cast send <ROUTER_ADDRESS> \
  "addFeeRecipient(address,uint256)" \
  <VAULT_ADDRESS> \
  2000000000000000 \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com

cast send <ROUTER_ADDRESS> \
  "addFeeRecipient(address,uint256)" \
  <GOLDCAP_ADDRESS> \
  2000000000000000 \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com
```

**Total mine fee:** 0.006 APE per claim

#### B. Add NFT Multipliers

```bash
# NAPC: 1+ owned = 1.2x multiplier
cast send <ROUTER_ADDRESS> \
  "addMultiplier(address,uint256,uint256,string)" \
  0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA \
  1 \
  12000 \
  "NAPC" \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com

# NAPC Whale: 10+ owned = 1.5x multiplier
cast send <ROUTER_ADDRESS> \
  "addMultiplier(address,uint256,uint256,string)" \
  0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA \
  10 \
  15000 \
  "NAPC Whale" \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com
```

#### C. Allow Mining NFTs (Cartridges/Pickaxes)

```bash
# Allow original cartridges
cast send <ROUTER_ADDRESS> \
  "setCartridgeAllowed(address,bool)" \
  0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d \
  true \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com

# Allow pickaxes
cast send <ROUTER_ADDRESS> \
  "setCartridgeAllowed(address,bool)" \
  0x3322b37349aefd6f50f7909b641f2177c1d34d25 \
  true \
  --private-key <ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com
```

---

### 4️⃣ Update Backend Environment Variables (Render)

Go to **Render Dashboard** → Your Backend Service → **Environment**

Update these variables:

| Variable | Value | Example | Notes |
|----------|-------|---------|-------|
| `ROUTER_ADDRESS` | New V3 router address | `0x...` | **REQUIRED** |
| `REWARD_TOKEN_ADDRESS` | ApeBitToken address | `0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023` | Keep existing |
| `ALCHEMY_API_KEY` | Alchemy API key | `3YobnRFCSYEuIC5c1ySEs...` | **NEW - Required for multipliers** |
| `NAPC_CONTRACT` | NAPC NFT address | `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA` | **NEW - For balance checks** |
| `CHAIN_ID` | ApeChain mainnet | `33139` | Keep existing |
| `RPC_URL` | ApeChain RPC | `https://rpc.apechain.com` | Keep existing |

**REMOVED:**
- ~~`ALLOWED_CARTRIDGES`~~ - Now managed on-chain via `allowedCartridge` mapping!

**Important Notes:**
- `SIGNER_PRIVATE_KEY` remains unchanged (backend signing key)
- The public address of `SIGNER_PRIVATE_KEY` must have `SIGNER_ROLE` on the router

**After updating:** Render will auto-redeploy the backend.

---

### 5️⃣ Update Frontend Environment Variables (Vercel)

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Update these variables:

| Variable | Value | Example | Notes |
|----------|-------|---------|-------|
| `NEXT_PUBLIC_ROUTER_ADDRESS` | New V3 router address | `0x...` | **REQUIRED** |
| `NEXT_PUBLIC_PICKAXE_ADDRESS` | Pickaxe NFT address | `0x3322b37349aefd6f50f7909b641f2177c1d34d25` | **NEW - Replaces cartridge** |
| `NEXT_PUBLIC_REWARD_TOKEN_ADDRESS` | ApeBitToken address | `0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023` | Keep existing |

**REMOVED:**
- ~~`NEXT_PUBLIC_CARTRIDGE_ADDRESS`~~ - Replaced by `NEXT_PUBLIC_PICKAXE_ADDRESS`

**After updating:** Trigger a new deployment or wait for the next git push.

---

### 6️⃣ Verify Everything Works

#### A. Check Contract Roles

```bash
# Check router has MINTER_ROLE on token
cast call <TOKEN_ADDRESS> \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE()") \
  <ROUTER_ADDRESS> \
  --rpc-url https://rpc.apechain.com

# Check backend signer has SIGNER_ROLE on router
cast call <ROUTER_ADDRESS> \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "SIGNER_ROLE()") \
  <SIGNER_PUBLIC_ADDRESS> \
  --rpc-url https://rpc.apechain.com

# Check cartridge is allowed
cast call <ROUTER_ADDRESS> \
  "allowedCartridge(address)(bool)" \
  <CARTRIDGE_ADDRESS> \
  --rpc-url https://rpc.apechain.com
```

All should return: `true`

#### B. Check Reward Tiers

```bash
# Check tier 0 reward
cast call <ROUTER_ADDRESS> \
  "rewardPerTier(uint256)(uint256)" \
  0 \
  --rpc-url https://rpc.apechain.com
```

Should return: `100000000000000000000` (100 ABIT in wei)

#### C. Check Fee Recipients & Multipliers

```bash
# Check first fee recipient
cast call <ROUTER_ADDRESS> \
  "feeRecipients(uint256)(address,uint256,bool)" \
  0 \
  --rpc-url https://rpc.apechain.com

# Check first multiplier
cast call <ROUTER_ADDRESS> \
  "multipliers(uint256)(address,uint256,uint256,bool,string)" \
  0 \
  --rpc-url https://rpc.apechain.com
```

#### D. Test a Claim

1. Connect wallet to the frontend
2. Load a pickaxe NFT
3. Mine a hash (press A button)
4. Claim the reward (press B button)
5. Check ApeScan for the transaction
6. Verify:
   - ABIT tokens were minted to your wallet (with multiplier if you own NAPC)
   - Fee was split correctly to all recipients
   - Total fee deducted from your wallet matches sum of all active fees

---

## 🔧 Common Issues & Fixes

### Issue: "Invalid signature" on claim

**Cause:** Backend signer doesn't have `SIGNER_ROLE`

**Fix:**
```bash
cd contracts
cast send <ROUTER_ADDRESS> \
  "grantRole(bytes32,address)" \
  $(cast keccak "SIGNER_ROLE()") \
  <SIGNER_PUBLIC_ADDRESS> \
  --private-key <YOUR_ADMIN_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com
```

---

### Issue: "Cartridge not allowed"

**Cause:** Cartridge not whitelisted on router

**Fix:** Run `AddCartridgeToRouter.s.sol` script (see step 2B)

---

### Issue: Claim transaction reverts silently

**Cause:** Router doesn't have `MINTER_ROLE`

**Fix:** Run `GrantMinterRole.s.sol` script (see step 2A)

---

### Issue: Backend signing with wrong router address

**Cause:** `ROUTER_ADDRESS` env var not updated on Render

**Fix:** Update the env var and redeploy backend (see step 3)

---

### Issue: Frontend showing wrong router in Glyph wallet

**Cause:** `NEXT_PUBLIC_ROUTER_ADDRESS` env var not updated on Vercel

**Fix:** Update the env var and redeploy frontend (see step 4)

---

### Issue: "Claim expired" even though it was just created

**Cause:** Expiry in milliseconds instead of seconds (should be fixed in code)

**Check backend logs** for:
```
[CLAIM_SIGN_V2] Claim expiry: 1759275934
[CLAIM_SIGN_V2] Current timestamp: 1759275634
[CLAIM_SIGN_V2] Expiry - now: 300 seconds
```

If "Expiry - now" is millions of seconds, the bug is back.

---

## 📝 Deployment Record Template

Use this to track your deployments:

```
Deployment Date: YYYY-MM-DD
Network: ApeChain Mainnet (33139)

Contract Addresses:
- ApeBitToken: 0x...
- ApeBitCartridge: 0x...
- MiningClaimRouter: 0x...

Admin Addresses:
- Deployer: 0x...
- Backend Signer: 0x...
- Fee Recipient: 0x...

Roles Granted:
[x] MINTER_ROLE to Router
[x] SIGNER_ROLE to Backend
[x] Cartridge allowed on Router

Environment Variables Updated:
[x] Render backend
[x] Vercel frontend

Verification:
[x] Test claim successful
[x] Tokens minted correctly
[x] Fee sent to recipient
```

---

## 🎯 Quick Reference: Contract Addresses (Current Deployment)

**ApeChain Mainnet:**
- **ApeBitToken (ABIT):** `0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023`
- **ApeBitCartridge (NFT):** `0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d`
- **MiningClaimRouter:** `0x9C192037b3EDa88cB4B31Ab1ad2AAD43Df352E43`

**Signer:** `0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98`
**Fee Recipient:** `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5`

---

## 🚨 CRITICAL: V3 Migration Notes

### **No Backwards Compatibility**
- ❌ V3 router does **NOT** support `claimV2`
- ✅ Only `claimV3` with multipliers and dynamic fees
- ⚠️ **Frontend and backend must be updated together**
- ⚠️ **Users must refresh page after deployment**

### **Migration Checklist**
1. Deploy V3 router
2. Configure fees/multipliers on-chain
3. Update backend to use `claimV3` signature format
4. Update frontend to call `claimV3` on router
5. Test end-to-end before announcing

### **Never Do This**
- ❌ **Never** force push to `main` branch
- ❌ **Never** redeploy all 3 contracts if you only need to update the router
- ❌ **Never** forget to grant `MINTER_ROLE` after deploying a new router
- ❌ **Never** forget to update environment variables on Render AND Vercel
- ❌ **Never** commit private keys to git
- ❌ **Never** skip the verification steps
- ❌ **Never** deploy V3 router without updating frontend/backend simultaneously

---

## ✅ Checklist Summary

**After deploying contracts:**
- [ ] Grant MINTER_ROLE to router
- [ ] Grant SIGNER_ROLE to backend signer (if new router)
- [ ] Allow cartridge on router
- [ ] Update 5 Render env vars
- [ ] Update 3 Vercel env vars
- [ ] Wait for auto-deployments
- [ ] Verify all roles with `cast call`
- [ ] Test a claim end-to-end

**If all checks pass:** 🎉 **You're good to go!**

---

*Last Updated: 2025-09-30*
*Maintained by: MineBoy Team*
