# 🎉 V3 Flywheel System - DEPLOYED!

**Deployment Date:** October 4, 2025  
**Network:** ApeChain Mainnet (Chain ID: 33139)

---

## 📝 Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| **MNESTR Token** | `0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276` | [View](https://apescan.io/address/0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276) |
| **V3 Router** | `0xf808fC0a027e8F61C24580dda1A43afe3c088354` | [View](https://apescan.io/address/0xf808fC0a027e8F61C24580dda1A43afe3c088354) |

---

## 💰 Fee Structure (0.01 APE per claim)

| Recipient | Amount | Wallet Address |
|-----------|--------|----------------|
| **Merchant** (Gold Cap) | 0.0025 APE | `0xFB53Da794d3d4d831255e7AB40F4649791331e75` |
| **Flywheel** (NPC Bot) | 0.0050 APE | `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4` |
| **Team** | 0.0015 APE | `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5` |
| **LP** | 0.0010 APE | `0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043` |
| **TOTAL** | **0.01 APE** | - |

---

## 🔥 MNESTR Reward Split

| Recipient | Percentage | Notes |
|-----------|------------|-------|
| **Miner** | 90% | Direct reward to player |
| **Treasury** | 10% | `0xA54d55565F43EC95969aF15a750438aBcD3B6C54` |

**Treasury Purpose:** LP provision, buybacks, future burns

---

## 🎮 NPC Multipliers

| Tier | Requirement | Multiplier |
|------|-------------|------------|
| **Base** | 1+ NPCs | 1.2x rewards |
| **Whale** | 10+ NPCs | 1.5x rewards |

**NPC Contract:** `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`

---

## ⛏️ Allowed Mining NFTs

| NFT | Address |
|-----|---------|
| **Pickaxes** | `0x3322b37349AeFD6F50F7909B641f2177c1D34D25` |
| **Cartridges** | `0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d` |

---

## 🚀 Next Steps

### 1. Update Backend (Render)

Environment variables to update:
```bash
ROUTER_ADDRESS=0xf808fC0a027e8F61C24580dda1A43afe3c088354
REWARD_TOKEN_ADDRESS=0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276
```

### 2. Update Frontend (Vercel)

Environment variables to update:
```bash
NEXT_PUBLIC_ROUTER_ADDRESS=0xf808fC0a027e8F61C24580dda1A43afe3c088354
```

### 3. Test End-to-End

1. Connect wallet to MineBoy
2. Select a Pickaxe
3. Mine until hash found
4. Submit claim (should cost 0.01 APE)
5. Verify:
   - Miner receives ~90% of MNESTR
   - Treasury receives ~10% of MNESTR
   - If you own NPCs, multiplier applied

---

## 🔧 Admin Functions

### Update Treasury Wallet
```bash
cast send 0xf808fC0a027e8F61C24580dda1A43afe3c088354 \
  "setTreasuryWallet(address)" \
  <NEW_TREASURY_ADDRESS> \
  --private-key <ADMIN_KEY> \
  --rpc-url https://rpc.apechain.com
```

### Add Fee Recipient
```bash
cast send 0xf808fC0a027e8F61C24580dda1A43afe3c088354 \
  "addFeeRecipient(address,uint256)" \
  <RECIPIENT_ADDRESS> \
  <AMOUNT_IN_WEI> \
  --private-key <ADMIN_KEY> \
  --rpc-url https://rpc.apechain.com
```

### Add NFT Multiplier
```bash
cast send 0xf808fC0a027e8F61C24580dda1A43afe3c088354 \
  "addMultiplier(address,uint256,uint256,string)" \
  <NFT_CONTRACT> \
  <MIN_BALANCE> \
  <MULTIPLIER_BPS> \
  "<NAME>" \
  --private-key <ADMIN_KEY> \
  --rpc-url https://rpc.apechain.com
```

---

## 📊 Verification Commands

### Check Total Fee
```bash
cast call 0xf808fC0a027e8F61C24580dda1A43afe3c088354 \
  "getTotalMineFee()(uint256)" \
  --rpc-url https://rpc.apechain.com
```

Expected: `10000000000000000` (0.01 APE)

### Check MNESTR Supply
```bash
cast call 0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276 \
  "cap()(uint256)" \
  --rpc-url https://rpc.apechain.com
```

Expected: `1000000000000000000000000000` (1 billion)

### Check Router Has MINTER_ROLE
```bash
cast call 0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276 \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE()") \
  0xf808fC0a027e8F61C24580dda1A43afe3c088354 \
  --rpc-url https://rpc.apechain.com
```

Expected: `true`

---

## 🎉 Success!

All contracts deployed and configured! Ready for production use.

**What's Next:** Build the Flywheel NPC trading bot as a separate service! 🤖
