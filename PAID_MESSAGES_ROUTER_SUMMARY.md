# Paid Messages Router - Implementation Summary

## What We Built

A **flexible, admin-controlled router contract** for paid messages that works with **all wallet types** (EOA, AA/Glyph, WalletConnect).

## Why We Needed This

**Original Problem:**
- Backend verifier expected `tx.to === TEAM_WALLET` (direct transfer)
- Glyph wallet sends through smart account contracts
- WalletConnect wallets may also route through contracts
- Transaction was failing with "Payment did not go to team wallet"

**Solution:**
- Router contract accepts payments and emits a `Paid` event
- Backend verifies the event in the transaction receipt (not `tx.to`)
- Works with **any wallet type** because the event is always emitted

## Key Features

### 1. **Flexible Configuration** (No Redeployment Needed)
- ✅ Update price via `setPrice()`
- ✅ Update team wallet via `setTeamWallet()`
- ✅ Update flywheel wallet via `setFlywheelWallet()`
- ✅ Update LP wallet via `setLPWallet()`
- ✅ Update fee splits via `setFeeSplits()`

### 2. **Fee Splits** (Like MiningClaimRouterV3)
- Configurable split between team/flywheel/LP
- Default: 50% team, 30% flywheel, 20% LP
- Must always add up to 100% (10000 basis points)

### 3. **Security**
- ReentrancyGuard protection
- AccessControl for admin functions
- Message hash verification (prevents replay attacks)
- Rejects plain ETH sends (must call `pay()`)

## How It Works

### Frontend Flow:
```typescript
1. User enters message
2. Calculate msgHash = keccak256(message)
3. Call router.pay(msgHash) with 1 APE value
4. Wallet popup appears (works with all wallet types!)
5. Transaction confirmed
6. Submit txHash + message to backend
```

### Backend Verification:
```typescript
1. Receive txHash + message from frontend
2. Fetch transaction receipt
3. Find Paid event from router address
4. Decode event: { payer, amount, msgHash }
5. Verify:
   - payer matches claimed wallet
   - amount is exactly 1 APE
   - msgHash matches keccak256(message)
6. Store message in database
```

## Files Changed

### Smart Contracts:
- ✅ `contracts/src/PaidMessagesRouter.sol` - Main router contract
- ✅ `contracts/script/DeployPaidMessagesRouter.s.sol` - Deploy script
- ✅ `apps/minerboy-web/src/abi/PaidMessagesRouter.json` - ABI for frontend

### Backend:
- ✅ `packages/backend/src/paidMessages.ts` - Updated verifier to check events
- ✅ `packages/backend/src/server.ts` - Updated endpoint to use new verifier

### Frontend:
- ✅ `apps/minerboy-web/src/components/PaidMessageModal.tsx` - Updated to call router

### Documentation:
- ✅ `DEPLOY_PAID_MESSAGES_ROUTER.md` - Deployment guide
- ✅ `PAID_MESSAGES_ROUTER_SUMMARY.md` - This file

## Next Steps

### 1. Update Deploy Script
Edit `contracts/script/DeployPaidMessagesRouter.s.sol`:
- Set real `flywheelWallet` address (currently placeholder)
- Set real `lpWallet` address (currently placeholder)
- Adjust fee splits if needed (currently 50/30/20)

### 2. Deploy Contract
```bash
cd contracts
forge script script/DeployPaidMessagesRouter.s.sol:DeployPaidMessagesRouter \
  --rpc-url $ALCHEMY_RPC_URL \
  --broadcast \
  --verify
```

### 3. Configure Environment Variables

**Backend (Render):**
```bash
PAID_MESSAGES_ROUTER=0xDEPLOYED_ADDRESS
```

**Frontend (Vercel):**
```bash
NEXT_PUBLIC_PAID_MESSAGES_ROUTER=0xDEPLOYED_ADDRESS
```

### 4. Redeploy Services
- Redeploy backend on Render
- Redeploy frontend on Vercel

### 5. Test
1. Connect wallet (try both Glyph and WalletConnect)
2. Click message banner
3. Submit a test message
4. Verify it appears in the banner

## Admin Operations

### Update Price to 0.5 APE:
```bash
cast send $ROUTER_ADDRESS "setPrice(uint256)" 500000000000000000 \
  --rpc-url $ALCHEMY_RPC_URL --private-key $PRIVATE_KEY
```

### Update Fee Splits (60% team, 25% flywheel, 15% LP):
```bash
cast send $ROUTER_ADDRESS "setFeeSplits(uint256,uint256,uint256)" 6000 2500 1500 \
  --rpc-url $ALCHEMY_RPC_URL --private-key $PRIVATE_KEY
```

### Update Team Wallet:
```bash
cast send $ROUTER_ADDRESS "setTeamWallet(address)" 0xNEW_ADDRESS \
  --rpc-url $ALCHEMY_RPC_URL --private-key $PRIVATE_KEY
```

## Benefits Over Original Approach

| Feature | Direct Transfer | Router Contract |
|---------|----------------|-----------------|
| Works with Glyph/AA wallets | ❌ | ✅ |
| Works with WalletConnect | ⚠️ Maybe | ✅ |
| Update price without redeploy | ❌ | ✅ |
| Update recipient without redeploy | ❌ | ✅ |
| Fee splits | ❌ | ✅ |
| Message hash verification | ❌ | ✅ |
| Replay attack prevention | ⚠️ Basic | ✅ Strong |

## Technical Details

**Contract Address:** TBD (after deployment)

**Event Signature:**
```solidity
event Paid(address indexed payer, uint256 amount, bytes32 msgHash)
```

**Admin Functions:**
- `setPrice(uint256 newPrice)`
- `setTeamWallet(address payable newWallet)`
- `setFlywheelWallet(address payable newWallet)`
- `setLPWallet(address payable newWallet)`
- `setFeeSplits(uint256 teamBps, uint256 flywheelBps, uint256 lpBps)`

**View Functions:**
- `price() returns (uint256)`
- `teamWallet() returns (address)`
- `flywheelWallet() returns (address)`
- `lpWallet() returns (address)`
- `teamBps() returns (uint256)`
- `flywheelBps() returns (uint256)`
- `lpBps() returns (uint256)`
