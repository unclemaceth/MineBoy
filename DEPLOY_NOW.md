# 🚀 DEPLOY V3 FLYWHEEL - READY TO GO!

## 📋 Wallet Addresses (Confirmed)

```bash
TREASURY_WALLET=0xA54d55565F43EC95969aF15a750438aBcD3B6C54
TEAM_WALLET=0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5
MERCHANT_WALLET=0xFB53Da794d3d4d831255e7AB40F4649791331e75  # Gold Cap
LP_WALLET=0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043
FLYWHEEL_WALLET=0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4
```

---

## 🎯 Step 1: Create `.env` File

```bash
cd contracts
cat > .env << 'EOF'
# Deployment
PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY_HERE
BACKEND_SIGNER=YOUR_BACKEND_SIGNER_ADDRESS_HERE

# Treasury (10% MNESTR siphon)
TREASURY_WALLET=0xA54d55565F43EC95969aF15a750438aBcD3B6C54

# Fee recipients (will add to ConfigureRouterV3.s.sol)
TEAM_WALLET=0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5
MERCHANT_WALLET=0xFB53Da794d3d4d831255e7AB40F4649791331e75
LP_WALLET=0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043
FLYWHEEL_WALLET=0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4
EOF
```

**⚠️ ACTION REQUIRED:**
- Replace `YOUR_DEPLOYER_PRIVATE_KEY_HERE` with your actual private key
- Replace `YOUR_BACKEND_SIGNER_ADDRESS_HERE` with your backend signer address

---

## 🎯 Step 2: Deploy MNESTR Token

```bash
cd contracts
forge script script/DeployMineStrategy.s.sol \
  --rpc-url https://rpc.apechain.com \
  --broadcast \
  --legacy
```

**Expected output:**
```
MineStrategy Token: 0x...
```

**⚠️ ACTION REQUIRED:**
Copy the token address and add to `.env`:
```bash
echo "MNESTR_TOKEN_ADDRESS=0x..." >> .env
```

---

## 🎯 Step 3: Update ConfigureRouterV3.s.sol

Edit `contracts/script/ConfigureRouterV3.s.sol`:

**Line 21-24:** (Already correct! ✅)
```solidity
address constant MERCHANT_WALLET = 0xFB53Da794d3d4d831255e7AB40F4649791331e75;
address constant FLYWHEEL_WALLET = 0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4;
address constant TEAM_WALLET = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5;
address constant LP_WALLET = 0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043;
```

---

## 🎯 Step 4: Deploy V3 Router

```bash
forge script script/DeployRouterV3.s.sol \
  --rpc-url https://rpc.apechain.com \
  --broadcast \
  --legacy
```

**Expected output:**
```
MiningClaimRouterV3: 0x...
```

**⚠️ ACTION REQUIRED:**
Copy the router address for Step 5.

---

## 🎯 Step 5: Configure V3 Router

Edit `contracts/script/ConfigureRouterV3.s.sol`:

**Line 18:**
```solidity
address constant ROUTER_ADDRESS = 0x...;  // Paste V3 router from Step 4
```

Then run:
```bash
forge script script/ConfigureRouterV3.s.sol \
  --rpc-url https://rpc.apechain.com \
  --broadcast \
  --legacy
```

This will:
- ✅ Add 4 fee recipients (0.01 APE total)
- ✅ Add NPC multiplier (1.2x)
- ✅ Allow Pickaxe NFTs

---

## 🎯 Step 6: Grant MINTER_ROLE to Router

```bash
# Replace <MNESTR_TOKEN> and <ROUTER_V3> with your addresses
cast send <MNESTR_TOKEN> \
  "grantRole(bytes32,address)" \
  $(cast keccak "MINTER_ROLE()") \
  <ROUTER_V3> \
  --private-key <YOUR_PRIVATE_KEY> \
  --rpc-url https://rpc.apechain.com
```

**Verify it worked:**
```bash
cast call <MNESTR_TOKEN> \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE()") \
  <ROUTER_V3> \
  --rpc-url https://rpc.apechain.com
```

Should return: `true`

---

## 🎯 Step 7: Update Backend Environment

In `packages/backend/.env` (or Render dashboard):

```bash
ROUTER_ADDRESS=<ROUTER_V3_ADDRESS_FROM_STEP_4>
REWARD_TOKEN_ADDRESS=<MNESTR_TOKEN_ADDRESS_FROM_STEP_2>
```

Redeploy backend on Render.

---

## 🎯 Step 8: Update Frontend Environment

In Vercel dashboard for `minerboy-web`:

```bash
NEXT_PUBLIC_ROUTER_ADDRESS=<ROUTER_V3_ADDRESS_FROM_STEP_4>
```

Redeploy frontend on Vercel.

---

## 🎯 Step 9: Test End-to-End

1. Open MineBoy game
2. Connect wallet
3. Select a Pickaxe
4. Mine until you find a hash
5. Submit claim (should cost **0.01 APE**)
6. Verify:
   - ✅ Miner receives **~90 MNESTR** (90% of reward)
   - ✅ Treasury receives **~10 MNESTR** (10% of reward)
   - ✅ 4 wallets receive APE fees

---

## 📊 Summary of Changes

| Item | Value |
|------|-------|
| **Token** | MineStrategy (MNESTR) |
| **Max Supply** | 1,000,000,000 MNESTR |
| **Claim Fee** | 0.01 APE (was 0.006) |
| **Miner Split** | 90% of MNESTR |
| **Treasury Split** | 10% of MNESTR |
| **Merchant Fee** | 0.0025 APE |
| **Flywheel Fee** | 0.0050 APE |
| **Team Fee** | 0.0015 APE |
| **LP Fee** | 0.0010 APE |

---

## 🔥 Ready to Deploy!

Start with Step 1 and work through sequentially. Let me know if you hit any issues! 🚀
