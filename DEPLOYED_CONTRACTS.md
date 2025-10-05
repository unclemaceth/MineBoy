# Deployed Contracts - ApeChain Mainnet

## Core Contracts

### MineStrategyToken (MNESTR)
**Address:** `TBD`
**Description:** ERC-20 reward token with burnable functionality and 1B supply cap

### MiningClaimRouterV3
**Address:** `0xf808fC0a027e8F61C24580dda1A43afe3c088354`
**Description:** Main claim router with dynamic fees, NFT multipliers, and treasury split

### PaidMessagesRouter
**Address:** `0x18Dd2B1424a4Db6c406B2853889828084D5ef2b6`
**Description:** Router for paid message submissions (1 APE per message)
**Deployed:** Block 24666870
**Transaction:** `0x3aa37db50d540f8f2cf4a5cf5d108c53e8471d58c7f5d43f6962d116fa150b9f`

**Fee Distribution:**
- Merchant (Gold Cap): 0.25 APE (25%)
- Flywheel (NPC Bot): 0.50 APE (50%)
- Team: 0.15 APE (15%)
- LP: 0.10 APE (10%)

## NFT Contracts

### NAPC (NoApeProfileClub)
**Address:** `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`
**Description:** Profile NFT collection, provides 1.2x-1.5x mining multiplier

### Pickaxe NFTs
**Address:** `0x3322b37349AeFD6F50F7909B641f2177c1D34D25`
**Description:** Mining tool NFTs with varying hashrates

### ApeBit Cartridges (Legacy)
**Address:** `0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d`
**Description:** Original cartridge NFTs (not allowed on V3 router)

## Fee Recipients

### Merchant Wallet (Gold Cap/NGT)
**Address:** `0xFB53Da794d3d4d831255e7AB40F4649791331e75`

### Flywheel Wallet (NPC Trading Bot)
**Address:** `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4`

### Team Wallet
**Address:** `0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5`

### LP Wallet
**Address:** `0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043`

## Environment Variables

### Backend (Render)
```bash
PAID_MESSAGES_ROUTER=0x18Dd2B1424a4Db6c406B2853889828084D5ef2b6
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_PAID_MESSAGES_ROUTER=0x18Dd2B1424a4Db6c406B2853889828084D5ef2b6
```

## Verification

View contracts on ApeScan:
- PaidMessagesRouter: https://apescan.io/address/0x18Dd2B1424a4Db6c406B2853889828084D5ef2b6
- MiningClaimRouterV3: https://apescan.io/address/0xf808fC0a027e8F61C24580dda1A43afe3c088354
