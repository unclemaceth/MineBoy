# PaidMessagesRouter Deployment Guide

## Overview
The `PaidMessagesRouter` is a flexible contract that accepts 1 APE payments for posting messages. It supports:
- ✅ **All wallet types** (EOA, AA/Glyph, WalletConnect)
- ✅ **Configurable price** (can be updated without redeploying)
- ✅ **Fee splits** (team/flywheel/LP with configurable percentages)
- ✅ **Admin controls** (update wallets and splits on the fly)

## Pre-Deployment Setup

### 1. Update Deploy Script Wallets
Edit `contracts/script/DeployPaidMessagesRouter.s.sol` and set the real wallet addresses:

```solidity
// Fee recipients
address payable teamWallet = payable(0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5);
address payable flywheelWallet = payable(0xYOUR_FLYWHEEL_WALLET); // TODO: Set real address
address payable lpWallet = payable(0xYOUR_LP_WALLET); // TODO: Set real address

// Fee splits (must add up to 10000 = 100%)
uint256 teamBps = 5000;      // 50%
uint256 flywheelBps = 3000;  // 30%
uint256 lpBps = 2000;        // 20%
```

### 2. Set Environment Variables
Ensure your `.env` has:
```bash
PRIVATE_KEY=your_deployer_private_key
ALCHEMY_RPC_URL=https://apechain-mainnet.g.alchemy.com/v2/YOUR_KEY
```

## Deployment

### Deploy to ApeChain Mainnet
```bash
cd contracts
forge script script/DeployPaidMessagesRouter.s.sol:DeployPaidMessagesRouter \
  --rpc-url $ALCHEMY_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key YOUR_APESCAN_KEY \
  --verifier-url https://apescan.io/api
```

**Save the deployed contract address!**

## Post-Deployment Configuration

### 1. Update Backend Environment
Add to your backend `.env` (Render):
```bash
PAID_MESSAGES_ROUTER=0xYOUR_DEPLOYED_ROUTER_ADDRESS
```

### 2. Update Frontend Environment
Add to `apps/minerboy-web/.env.local`:
```bash
NEXT_PUBLIC_PAID_MESSAGES_ROUTER=0xYOUR_DEPLOYED_ROUTER_ADDRESS
```

### 3. Redeploy Services
- **Backend**: Redeploy on Render (will pick up new env var)
- **Frontend**: Redeploy on Vercel (will pick up new env var)

## Admin Functions (After Deployment)

You can update these without redeploying:

### Update Price
```bash
cast send $ROUTER_ADDRESS \
  "setPrice(uint256)" 2000000000000000000 \
  --rpc-url $ALCHEMY_RPC_URL \
  --private-key $PRIVATE_KEY
```
*(Example: 2 ether = 2 APE)*

### Update Team Wallet
```bash
cast send $ROUTER_ADDRESS \
  "setTeamWallet(address)" 0xNEW_TEAM_WALLET \
  --rpc-url $ALCHEMY_RPC_URL \
  --private-key $PRIVATE_KEY
```

### Update Fee Splits
```bash
cast send $ROUTER_ADDRESS \
  "setFeeSplits(uint256,uint256,uint256)" 6000 2500 1500 \
  --rpc-url $ALCHEMY_RPC_URL \
  --private-key $PRIVATE_KEY
```
*(Example: 60% team, 25% flywheel, 15% LP)*

## Testing

### 1. Test the Contract Call
```bash
# Get current price
cast call $ROUTER_ADDRESS "price()(uint256)" --rpc-url $ALCHEMY_RPC_URL

# Get current wallets
cast call $ROUTER_ADDRESS "teamWallet()(address)" --rpc-url $ALCHEMY_RPC_URL
cast call $ROUTER_ADDRESS "flywheelWallet()(address)" --rpc-url $ALCHEMY_RPC_URL
cast call $ROUTER_ADDRESS "lpWallet()(address)" --rpc-url $ALCHEMY_RPC_URL
```

### 2. Test End-to-End
1. Connect wallet on frontend
2. Click the scrolling message banner
3. Enter a test message
4. Click "PAY 1 APE & POST"
5. Approve transaction in wallet
6. Wait for confirmation
7. Message should appear in the banner within 5 minutes

## Troubleshooting

### "Router contract not configured"
- Frontend env var `NEXT_PUBLIC_PAID_MESSAGES_ROUTER` is missing
- Redeploy Vercel after adding the env var

### "Router event not found"
- Backend env var `PAID_MESSAGES_ROUTER` is missing or wrong
- Transaction didn't call the router contract
- Check transaction on ApeScan to verify it called the correct address

### "Message hash mismatch"
- Frontend and backend are hashing the message differently
- Ensure message is trimmed on both sides: `message.trim()`

### Wallet popup doesn't appear
- Check browser console for errors
- Ensure ApeChain is added to the wallet
- Try disconnecting and reconnecting wallet

## Contract Details

**Constructor Parameters:**
- `admin`: Address with ADMIN_ROLE (can update settings)
- `initialPrice`: Price in wei (1 ether = 1 APE)
- `teamWallet`: Receives team share of payments
- `flywheelWallet`: Receives flywheel share of payments
- `lpWallet`: Receives LP share of payments
- `teamBps`: Team basis points (100 bps = 1%)
- `flywheelBps`: Flywheel basis points
- `lpBps`: LP basis points

**Events:**
- `Paid(address indexed payer, uint256 amount, bytes32 msgHash)`: Emitted on successful payment
- `PriceUpdated(uint256 oldPrice, uint256 newPrice)`: Emitted when price changes
- `WalletUpdated(string walletType, address oldWallet, address newWallet)`: Emitted when wallet changes
- `FeeSplitUpdated(uint256 teamBps, uint256 flywheelBps, uint256 lpBps)`: Emitted when splits change

## Security Notes

1. **Admin Role**: Only the admin address can update settings
2. **Fee Split Validation**: Splits must always add up to 10000 (100%)
3. **Reentrancy Protection**: Uses OpenZeppelin's `ReentrancyGuard`
4. **Message Hash Verification**: Backend verifies the message hash matches the event
5. **No Direct Sends**: Contract rejects plain ETH/APE sends (must call `pay()`)
