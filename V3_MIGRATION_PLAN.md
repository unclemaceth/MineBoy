# V3 Router Migration Plan

**Goal:** Replace V2 router with V3 router featuring dynamic fees, NFT multipliers, and multi-contract support.

---

## 🎯 What's New in V3

### **1. Dynamic Fee Distribution**
- Multiple fee recipients (you, vault, gold cap, etc.)
- Adjustable amounts per recipient
- Enable/disable recipients without redeploying
- All-or-nothing atomic transfers

### **2. NFT Multiplier System**
- Check user's NFT balance (NAPC, partners, etc.)
- Apply reward multipliers (1.2x, 1.5x, etc.)
- Tiered multipliers (1 NAPC = 1.2x, 10 NAPC = 1.5x)
- Stack multipliers across different NFT contracts
- Add/remove multipliers for seasonal promos

### **3. Multi-Contract Support**
- On-chain allowlist for mining NFTs
- Support cartridges AND pickaxes simultaneously
- Add new NFT contracts without backend redeploy
- Disable contracts instantly if needed

### **4. Pickaxe Integration**
- Replace cartridges with pickaxes as primary mining NFT
- Varying H/s bonuses per pickaxe type:
  - Drip Axe: 8000 H/s
  - Pick Hammer: 7000 H/s
  - Blue Steel: 6000 H/s
  - Base: 5000 H/s
- Pull metadata from Alchemy

---

## 📋 Implementation Phases

### **Phase 1: Smart Contract** ✅ Ready to Build

#### Files to Create:
- `contracts/src/MiningClaimRouterV3.sol`
- `contracts/script/DeployRouterV3.s.sol`
- `contracts/script/ConfigureRouterV3.s.sol` (add fees/multipliers)

#### Contract Features:
```solidity
contract MiningClaimRouterV3 {
    // Dynamic fee system
    struct FeeRecipient {
        address recipient;
        uint256 amount;
        bool active;
    }
    FeeRecipient[] public feeRecipients;
    
    // NFT multiplier system
    struct NFTMultiplier {
        address nftContract;
        uint256 minBalance;
        uint256 multiplierBps; // 10000 = 1x, 12000 = 1.2x
        bool active;
        string name;
    }
    NFTMultiplier[] public multipliers;
    
    // Multi-contract support
    mapping(address => bool) public allowedCartridge;
    
    // Main claim function
    function claimV3(
        address cartridge,
        uint256 tokenId,
        address wallet,
        uint256 nonce,
        uint256 tier,
        uint256 tries,
        uint256 elapsedMs,
        bytes32 hash,
        uint256 expiry,
        bytes calldata signature
    ) external payable;
    
    // Admin functions
    function addFeeRecipient(address, uint256) external;
    function updateFeeRecipient(uint256, address, uint256) external;
    function setFeeRecipientActive(uint256, bool) external;
    function removeFeeRecipient(uint256) external;
    
    function addMultiplier(address, uint256, uint256, string) external;
    function updateMultiplier(uint256, uint256, uint256) external;
    function setMultiplierActive(uint256, bool) external;
    function removeMultiplier(uint256) external;
    
    function setCartridgeAllowed(address, bool) external;
    function setRewardTable(uint256[16]) external;
}
```

---

### **Phase 2: Backend Updates** ✅ Ready to Build

#### Files to Update:
- `packages/backend/src/claims.ts` - Update signature generation for V3
- `packages/backend/src/alchemy.ts` - **NEW** - NFT balance checks
- `packages/backend/src/multipliers.ts` - **NEW** - Multiplier calculation logic
- `packages/backend/.env` - Add `ALCHEMY_API_KEY`, `NAPC_CONTRACT`

#### Key Changes:

**1. New Alchemy Module (`alchemy.ts`):**
```typescript
export async function getNFTBalance(
  walletAddress: string,
  nftContract: string
): Promise<number> {
  const response = await fetch(
    `https://apechain-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}/getNFTsForOwner`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: walletAddress,
        contractAddresses: [nftContract],
        withMetadata: false,
      }),
    }
  );
  const data = await response.json();
  return data.ownedNfts?.length || 0;
}
```

**2. New Multiplier Module (`multipliers.ts`):**
```typescript
export async function calculateMultiplier(
  walletAddress: string
): Promise<{ multiplier: number; details: string[] }> {
  // Fetch multiplier config from router contract
  // Check user's NFT balances
  // Apply highest multiplier per contract
  // Stack multipliers across contracts
  // Return total multiplier + details for logging
}
```

**3. Update Claim Signing (`claims.ts`):**
```typescript
// OLD: claimV2
const domain = {
  name: 'MiningClaimRouter',
  version: '2',
  chainId: 33139,
  verifyingContract: routerAddress,
};

const types = {
  ClaimV2: [
    { name: 'cartridge', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'tier', type: 'uint256' },
    { name: 'tries', type: 'uint256' },
    { name: 'elapsedMs', type: 'uint256' },
    { name: 'hash', type: 'bytes32' },
    { name: 'expiry', type: 'uint256' },
  ],
};

// NEW: claimV3 (same structure, version bump)
const domain = {
  name: 'MiningClaimRouter',
  version: '3',
  chainId: 33139,
  verifyingContract: routerAddress,
};

const types = {
  ClaimV3: [
    { name: 'cartridge', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'tier', type: 'uint256' },
    { name: 'tries', type: 'uint256' },
    { name: 'elapsedMs', type: 'uint256' },
    { name: 'hash', type: 'bytes32' },
    { name: 'expiry', type: 'uint256' },
  ],
};
```

**4. Update Claim Response:**
```typescript
// Add multiplier info to response
return {
  claim: { /* ... */ },
  signature,
  multiplier: {
    value: 1.2,
    details: ['NAPC: 1.2x (owns 3)'],
  },
};
```

---

### **Phase 3: Frontend Updates** ✅ Ready to Build

#### Files to Update:
- `apps/minerboy-web/src/lib/api.ts` - Update claim submission
- `apps/minerboy-web/src/app/page.tsx` - Update claim flow, add multiplier display
- `apps/minerboy-web/src/abi/RouterV3.json` - **NEW** - V3 ABI
- `apps/minerboy-web/.env.local` - Update router address

#### Key Changes:

**1. Update Claim Submission (`api.ts`):**
```typescript
// OLD: Call claimV2
const tx = await routerContract.claimV2(
  claim.cartridge,
  claim.tokenId,
  claim.wallet,
  claim.nonce,
  claim.tier,
  claim.tries,
  claim.elapsedMs,
  claim.hash,
  claim.expiry,
  signature,
  { value: parseEther('0.001') }
);

// NEW: Call claimV3
const tx = await routerContract.claimV3(
  claim.cartridge,
  claim.tokenId,
  claim.wallet,
  claim.nonce,
  claim.tier,
  claim.tries,
  claim.elapsedMs,
  claim.hash,
  claim.expiry,
  signature,
  { value: parseEther('0.006') } // Updated fee!
);
```

**2. Display Multiplier in Terminal (`page.tsx`):**
```typescript
// After successful claim
if (result.multiplier && result.multiplier.value > 1.0) {
  pushLine(`🚀 MULTIPLIER: ${result.multiplier.value}x`);
  result.multiplier.details.forEach(detail => {
    pushLine(`   ${detail}`);
  });
}
```

**3. Update Pickaxe Loading:**
- Replace cartridge contract with pickaxe contract
- Pull metadata from Alchemy
- Display pickaxe type and H/s bonus

---

### **Phase 4: Deployment** ✅ Follow Checklist

See `CONTRACT_DEPLOYMENT_CHECKLIST.md` for full steps.

**Quick Summary:**
1. Deploy V3 router contract
2. Grant `MINTER_ROLE` to router
3. Configure fees/multipliers on-chain
4. Allow pickaxe + cartridge contracts
5. Update backend env vars (Render)
6. Update frontend env vars (Vercel)
7. Test end-to-end
8. Announce to users

---

## 🔧 Configuration Examples

### **Initial Fee Setup (0.006 APE total)**
```bash
# You: 0.002 APE
cast send $ROUTER "addFeeRecipient(address,uint256)" \
  0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5 \
  2000000000000000 \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com

# Vault: 0.002 APE
cast send $ROUTER "addFeeRecipient(address,uint256)" \
  $VAULT_ADDRESS \
  2000000000000000 \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com

# Gold Cap: 0.002 APE
cast send $ROUTER "addFeeRecipient(address,uint256)" \
  $GOLDCAP_ADDRESS \
  2000000000000000 \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com
```

### **Initial Multiplier Setup**
```bash
# NAPC: 1+ owned = 1.2x
cast send $ROUTER "addMultiplier(address,uint256,uint256,string)" \
  0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA \
  1 \
  12000 \
  "NAPC" \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com
```

### **Allow Mining NFTs**
```bash
# Pickaxes (primary)
cast send $ROUTER "setCartridgeAllowed(address,bool)" \
  0x3322b37349aefd6f50f7909b641f2177c1d34d25 \
  true \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com

# Original cartridges (legacy support)
cast send $ROUTER "setCartridgeAllowed(address,bool)" \
  0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d \
  true \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com
```

---

## 🎮 Future Admin Operations

### **Adjust Fees (No Redeploy Needed!)**
```bash
# Increase your cut to 0.003 APE
cast send $ROUTER "updateFeeRecipient(uint256,address,uint256)" \
  0 \
  0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5 \
  3000000000000000 \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com

# Temporarily disable gold cap
cast send $ROUTER "setFeeRecipientActive(uint256,bool)" \
  2 \
  false \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com
```

### **Add Seasonal Multiplier**
```bash
# Partner promo: 1+ PartnerNFT = 1.1x for 30 days
cast send $ROUTER "addMultiplier(address,uint256,uint256,string)" \
  $PARTNER_NFT \
  1 \
  11000 \
  "Partner Promo" \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com

# Remove after season
cast send $ROUTER "removeMultiplier(uint256)" \
  2 \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com
```

### **Add New Mining NFT**
```bash
# Deploy basic pickaxe, then:
cast send $ROUTER "setCartridgeAllowed(address,bool)" \
  $BASIC_PICKAXE \
  true \
  --private-key $ADMIN_KEY --rpc-url https://rpc.apechain.com
```

---

## ✅ Ready to Build?

**Next steps:**
1. ✅ Write `MiningClaimRouterV3.sol`
2. ✅ Write deployment scripts
3. ✅ Update backend for V3 signatures + multipliers
4. ✅ Update frontend for V3 claims + pickaxes
5. ✅ Test on testnet (optional)
6. ✅ Deploy to mainnet
7. ✅ Configure fees/multipliers
8. ✅ Test end-to-end
9. ✅ Announce to community

**Should I start building the V3 contract now?**
