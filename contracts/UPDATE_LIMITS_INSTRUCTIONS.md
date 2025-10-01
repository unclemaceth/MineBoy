# Update Cartridge Limits Instructions

This guide explains how to update the ApeBitCartridge contract to increase:
- **maxSupply**: from 500 to 750
- **maxPerWallet**: remains at 2

## Prerequisites

1. You must have the admin private key (DEFAULT_ADMIN_ROLE)
2. Foundry must be installed
3. Environment variables must be set

## Steps

### 1. Set Environment Variables

Create or update your `.env` file in the `contracts/` directory:

```bash
PRIVATE_KEY=your_admin_private_key_here
CARTRIDGE_ADDRESS=0xCA2d7b429248a38b276c8293506F3Be8e1fC2C2d
RPC_URL=https://apechain.calderachain.xyz/http
```

### 2. Run the Update Script

From the `contracts/` directory:

```bash
forge script script/UpdateCartridgeLimits.s.sol:UpdateCartridgeLimits \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

### 3. Verify the Changes

After the transaction is confirmed, you can verify the new limits:

```bash
cast call 0xCA2d7b429248a38b276c8293506F3Be8e1fC2C2d "maxSupply()" --rpc-url https://apechain.calderachain.xyz/http
cast call 0xCA2d7b429248a38b276c8293506F3Be8e1fC2C2d "maxPerWallet()" --rpc-url https://apechain.calderachain.xyz/http
```

The first command should return `750` (0x2ee in hex)
The second command should return `2` (0x02 in hex)

## What Gets Updated

### On-Chain Changes:
- `maxSupply` updated to 750
- `maxPerWallet` remains at 2

### No Code Changes Needed:
The frontend and backend automatically read these values from the contract:
- `useContractState()` hook fetches `maxSupply` and `maxPerWallet`
- Backend's `MintingService` checks `maxPerWallet()` dynamically
- Mint counter shows remaining supply automatically

### Frontend Info Already Updated:
- Info section now shows "Cartridge Limit: 2 per wallet"
- Welcome page already shows "up to 2 per wallet"

## Troubleshooting

**Error: "Only admin can call this function"**
- Make sure you're using the correct admin private key

**Error: "Invalid address"**
- Verify the CARTRIDGE_ADDRESS is correct

**Transaction Reverts**
- Check that you have enough APE for gas
- Verify you have admin permissions on the contract

## After Update

Once the transaction is confirmed:
1. Users will be able to mint up to 2 cartridges per wallet
2. The max supply will be increased to 750
3. No frontend redeployment needed - changes are instant
4. Backend will automatically respect the new limits

