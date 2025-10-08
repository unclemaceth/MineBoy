# Delegate.xyz Integration Analysis for MineBoy

**Date:** October 8, 2025  
**Status:** Research & Planning

---

## 🎯 Executive Summary

**RECOMMENDATION: YES, add delegate.xyz support**

**Primary Use Case:** Allow players to mine with hot wallets while keeping expensive NFTs (cartridges, NPCs) in cold storage.

**Key Benefit:** Users can keep $10K+ worth of cartridges/NPCs in cold wallets (hardware wallets, vaults) while mining from browser/mobile hot wallets.

**Implementation Complexity:** Medium (2-3 days work)

---

## 📊 Current MineBoy Architecture

### Ownership Checks Happen in 3 Places:

#### 1. **Frontend (Wallet Connect)**
- Location: `apps/minerboy-web/src/app/page.tsx`
- What: User connects wallet via RainbowKit
- Check: None at this stage (just connection)

#### 2. **Backend Session Open** (`/v2/session/open`)
- Location: `packages/backend/src/server.ts:283`
- Check: `ownershipVerifier.ownsCartridge(wallet, contract, tokenId)`
- Method: Calls `ERC721.ownerOf(tokenId)` via RPC
- **THIS IS WHERE WE'D ADD DELEGATE CHECK**

#### 3. **Smart Contract Claim** (`claimV3`)
- Location: `contracts/src/MiningClaimRouterV3.sol:211`
- Check: `IERC721(cartridge).ownerOf(tokenId) == msg.sender`
- **THIS IS WHERE WE'D ADD DELEGATE CHECK**

### Multiplier Checks (NPC Ownership):

#### Backend:
- Location: `packages/backend/src/multipliers.ts:63`
- Check: `getNFTBalance(walletAddress, nftContract)` via Alchemy API
- Method: Alchemy API call to get ERC721 balance

#### Smart Contract:
- Location: `contracts/src/MiningClaimRouterV3.sol:184`
- Check: `IERC721(nftContract).balanceOf(wallet)`
- **THIS IS WHERE WE'D ADD DELEGATE CHECK FOR MULTIPLIERS**

---

## 🔍 WHERE TO ADD DELEGATE CHECKS

### Option A: Backend + Smart Contract (RECOMMENDED)

**Backend (`/v2/session/open`):**
```typescript
// Current check (line 283):
const owns = await ownershipVerifier.ownsCartridge(w, canonical.contract, canonical.tokenId);

// With delegate:
const owns = await ownershipVerifier.ownsCartridgeOrDelegate(w, vaultAddress, canonical.contract, canonical.tokenId);
```

**Smart Contract (`claimV3`):**
```solidity
// Current check (line 211):
require(
    IERC721(claimData.cartridge).ownerOf(claimData.tokenId) == msg.sender,
    "Not cartridge owner"
);

// With delegate:
require(
    _isOwnerOrDelegate(msg.sender, claimData.vault, claimData.cartridge, claimData.tokenId),
    "Not owner or delegate"
);
```

**For Multipliers:**
```solidity
// Current (line 184):
uint256 balance = IERC721(m.nftContract).balanceOf(wallet);

// With delegate:
uint256 balance = IERC721(m.nftContract).balanceOf(vault);
// (Use vault address instead of hot wallet for balance check)
```

---

### Option B: Backend Only (FASTER, LESS SECURE)

Only check delegate in backend, don't modify smart contracts.

**Pros:**
- Faster to implement (no contract redeployment)
- Can iterate quickly
- Backend already gates all sessions

**Cons:**
- Less secure (someone could bypass backend and call contract directly)
- Mismatch between backend and contract logic
- Not "trustless" - relies on backend

---

### Option C: Smart Contract Only (MORE SECURE, SLOWER)

Only modify smart contracts, no backend changes.

**Pros:**
- Most secure (on-chain enforcement)
- Trustless
- Standard Web3 pattern

**Cons:**
- Requires contract redeployment (MiningClaimRouterV3 is already deployed)
- Gas costs for delegate checks
- Slower iteration

---

## 🛠️ RECOMMENDED IMPLEMENTATION PLAN

### Phase 1: Backend + Frontend (Quick Win) - 2 days

**Goal:** Get delegate working for session locking, iterate on UX

1. **Add Delegate Registry Interface** (`packages/backend/src/delegate.ts`)
   ```typescript
   export class DelegateVerifier {
     async checkDelegateForToken(
       hotWallet: string,
       vaultWallet: string, 
       contract: string,
       tokenId: string
     ): Promise<boolean> {
       // Call delegate registry at 0x00000000000000447e69651d841bD8D104Bed493
       // Check: wallet/contract/token scopes
     }
   }
   ```

2. **Update Ownership Verifier** (`packages/backend/src/ownership.ts`)
   ```typescript
   async ownsCartridgeOrDelegate(
     hotWallet: string,
     vaultWallet: string | null,
     contract: string,
     tokenId: string
   ): Promise<boolean> {
     // 1. Check if hot wallet owns it directly
     if (await this.ownsCartridge(hotWallet, contract, tokenId)) {
       return true;
     }
     
     // 2. If vault provided, check delegate
     if (vaultWallet) {
       if (await this.ownsCartridge(vaultWallet, contract, tokenId)) {
         return await delegateVerifier.checkDelegateForToken(
           hotWallet, vaultWallet, contract, tokenId
         );
       }
     }
     
     return false;
   }
   ```

3. **Update Session Open Endpoint** (`packages/backend/src/server.ts:260`)
   ```typescript
   fastify.post('/v2/session/open', async (request, reply) => {
     const { sessionId, wallet, minerId, chainId, contract, tokenId, vault } = body;
     
     // If vault provided, verify delegation
     const effectiveWallet = vault || wallet;
     const owns = await ownershipVerifier.ownsCartridgeOrDelegate(
       wallet,      // hot wallet
       vault,       // vault (or null)
       contract,
       tokenId
     );
     
     if (!owns) {
       return errorResponse(reply, 403, 'ownership_required', 
         'Wallet does not own this cartridge or is not delegated');
     }
     
     // Lock under vault's address (not hot wallet)
     await SessionStore.acquireOwnershipLock(chainId, contract, tokenId, effectiveWallet, ...);
   });
   ```

4. **Frontend UX** (`apps/minerboy-web/src/app/page.tsx`)
   - Add "Using delegate wallet?" toggle
   - Show vault address input
   - Call delegate API to auto-suggest vault
   - Link to delegate.xyz setup page
   - Pass `vault` param to `/v2/session/open`

5. **Update Multiplier Checks** (`packages/backend/src/multipliers.ts:63`)
   ```typescript
   export async function calculateMultiplier(
     walletAddress: string,
     vaultAddress?: string  // NEW: check vault for NFT holdings
   ): Promise<MultiplierResult> {
     const effectiveWallet = vaultAddress || walletAddress;
     
     // Check NFT balance of vault (not hot wallet)
     const balance = await getNFTBalance(effectiveWallet, contract);
     // ... rest of logic
   }
   ```

**Deliverables:**
- ✅ Backend supports delegate checks for cartridge ownership
- ✅ Frontend has delegate UX
- ✅ Multipliers check vault's NPC holdings
- ⚠️ Smart contracts still require direct ownership (bypassed by backend gating)

**Risk:** Advanced users could call smart contract directly and bypass delegate check

---

### Phase 2: Smart Contract Upgrade (Secure) - 1-2 days

**Goal:** On-chain delegate enforcement

1. **Deploy Delegate Registry to ApeChain** (if not already deployed)
   - Registry address: `0x00000000000000447e69651d841bD8D104Bed493`
   - Check if exists, deploy via CREATE2 if not

2. **Create MiningClaimRouterV4** with delegate support
   ```solidity
   interface IDelegateRegistry {
       function checkDelegateForERC721(
           address delegate,
           address vault, 
           address contract_,
           uint256 tokenId,
           bytes32 rights
       ) external view returns (bool);
   }
   
   contract MiningClaimRouterV4 {
       IDelegateRegistry constant DELEGATE_REG = 
           IDelegateRegistry(0x00000000000000447e69651d841bD8D104Bed493);
       
       bytes32 constant MINEBOY_RIGHTS = keccak256("mineboy");
       
       struct ClaimV4 {
           address cartridge;
           uint256 tokenId;
           address wallet;     // hot wallet (msg.sender)
           address vault;      // vault wallet (owns the NFT)
           uint256 nonce;
           uint8 tier;
           uint32 tries;
           uint32 elapsedMs;
           bytes32 hash;
           uint256 expiry;
       }
       
       function _isOwnerOrDelegate(
           address sender,
           address vault,
           address token,
           uint256 tokenId
       ) internal view returns (bool) {
           address owner = IERC721(token).ownerOf(tokenId);
           
           // Direct ownership
           if (owner == sender) return true;
           
           // Delegate check
           if (vault != address(0) && owner == vault) {
               return DELEGATE_REG.checkDelegateForERC721(
                   sender,    // hot wallet
                   vault,     // vault owns NFT
                   token,
                   tokenId,
                   MINEBOY_RIGHTS
               );
           }
           
           return false;
       }
       
       function claimV4(ClaimV4 calldata claimData, bytes calldata signature) 
           external payable whenNotPaused 
       {
           require(msg.sender == claimData.wallet, "Invalid caller");
           
           // Check ownership or delegation
           require(
               _isOwnerOrDelegate(
                   msg.sender,
                   claimData.vault,
                   claimData.cartridge,
                   claimData.tokenId
               ),
               "Not owner or delegate"
           );
           
           // For multipliers, use vault address
           address effectiveWallet = claimData.vault != address(0) 
               ? claimData.vault 
               : claimData.wallet;
           
           uint256 multiplierBps = calculateMultiplier(effectiveWallet);
           
           // Mint to vault address (not hot wallet)
           IApeBitMintable(rewardToken).mint(effectiveWallet, finalReward);
           
           // ... rest of claim logic
       }
   }
   ```

3. **Deploy & Configure V4 Router**
   - Deploy to ApeChain
   - Grant SIGNER_ROLE to backend signer
   - Set fee recipients
   - Set reward table
   - Update backend to use V4 router

**Deliverables:**
- ✅ On-chain delegate enforcement
- ✅ Trustless (no backend bypass possible)
- ✅ Multipliers check vault's NFT holdings on-chain
- ✅ Rewards mint to vault (not hot wallet)

---

## 💰 COST-BENEFIT ANALYSIS

### Benefits:

1. **Security**: Users keep valuable NFTs in cold storage
   - Cartridges: ~$500-$5,000 each
   - NPCs: ~$100-$1,000 each (for multipliers)
   - Total exposure: $5K-$50K per user

2. **UX**: Mine from browser/mobile without hardware wallet signing
   - No hardware wallet friction
   - No seed phrase exposure
   - Mobile-friendly

3. **Competitive**: Standard Web3 feature (ApeCoin staking, Blur, etc. all support it)

4. **Marketing**: "Mine safely from any device" is a strong selling point

### Costs:

1. **Development**: 3-4 days total (Phase 1 + Phase 2)
2. **Testing**: 1 day
3. **Gas**: Small increase (~5-10K gas per claim for delegate check)
4. **Complexity**: More UX states to handle (hot vs vault)
5. **Support**: Users need to understand delegation concept

---

## 🚨 EDGE CASES TO HANDLE

### 1. User transfers NFT while mining
**Current behavior:** Session lock prevents this (ownership lock expires after session)  
**With delegate:** Same behavior, but lock under vault address

### 2. User revokes delegation mid-session
**Solution:** Check delegation on claim (not just session open)

### 3. User has multiple vaults
**Solution:** Auto-detect via delegate API, let user choose

### 4. Vault delegates to multiple hot wallets
**Solution:** Allowed - each hot wallet can mine with same vault's NFTs (session locks prevent conflicts)

### 5. User tries to use someone else's vault
**Solution:** Delegation check fails, session open rejected

### 6. Delegate registry not deployed on ApeChain
**Solution:** 
- Phase 1: Use Arbitrum One registry via bridge query (slow)
- Phase 2: Deploy registry to ApeChain via community CREATE2

---

## 📋 IMPLEMENTATION CHECKLIST

### Pre-flight:
- [ ] Verify delegate registry exists on ApeChain at `0x00000000000000447e69651d841bD8D104Bed493`
- [ ] If not, coordinate deployment with Delegate team or deploy via CREATE2
- [ ] Test registry is readable from backend RPC
- [ ] Test registry is callable from smart contract

### Phase 1 (Backend):
- [ ] Create `packages/backend/src/delegate.ts`
- [ ] Update `packages/backend/src/ownership.ts`
- [ ] Update `packages/backend/src/server.ts` (`/v2/session/open`)
- [ ] Update `packages/backend/src/multipliers.ts`
- [ ] Update `packages/backend/src/claims.ts` (signature generation)
- [ ] Add delegate API client for auto-detection

### Phase 1 (Frontend):
- [ ] Add vault input field
- [ ] Add "Using delegate?" toggle
- [ ] Auto-detect vault via delegate API
- [ ] Show delegation status (active/inactive)
- [ ] Link to delegate.xyz setup page
- [ ] Update session open call to include vault param

### Phase 2 (Contracts):
- [ ] Create `contracts/src/MiningClaimRouterV4.sol`
- [ ] Add IDelegateRegistry interface
- [ ] Implement `_isOwnerOrDelegate` helper
- [ ] Update `claimV4` function
- [ ] Update multiplier calculation to use vault
- [ ] Write deployment script
- [ ] Write tests
- [ ] Deploy to ApeChain
- [ ] Verify on explorer

### Testing:
- [ ] Test hot wallet owns NFT (no delegation)
- [ ] Test vault owns NFT + delegation exists
- [ ] Test vault owns NFT + NO delegation (should fail)
- [ ] Test hot wallet tries to use random vault (should fail)
- [ ] Test multipliers work with vault's NPC holdings
- [ ] Test rewards mint to vault (not hot wallet)
- [ ] Test delegation revoked mid-session
- [ ] Test NFT transferred mid-session

---

## 🎯 FINAL RECOMMENDATION

**YES, implement delegate.xyz support in 2 phases:**

1. **Week 1 (Phase 1):** Backend + Frontend
   - Quick win, immediate UX improvement
   - Low risk (backend gates everything anyway)
   - Can iterate on UX before contract changes

2. **Week 2 (Phase 2):** Smart Contract V4
   - Secure, trustless implementation
   - Standard Web3 pattern
   - Marketing moment: "Secure cold storage mining"

**Priority: HIGH** - This is a standard feature for any serious Web3 app handling valuable NFTs.

**ROI: STRONG** - Low development cost, high user security benefit, competitive table stakes.

---

## 📚 References

- Delegate.xyz Docs: https://docs.delegate.xyz
- Delegate Registry: `0x00000000000000447e69651d841bD8D104Bed493`
- Delegate API: https://api.delegate.xyz/registry/v2
- GitHub: https://github.com/delegatecash/delegation-registry
- ApeChain Docs: https://docs.apechain.com

---

## 🤝 Next Steps

1. **Confirm decision**: Do you want to proceed with implementation?
2. **Check registry**: Is delegate registry deployed on ApeChain?
3. **Phase 1 start**: Should I begin with backend + frontend implementation?
4. **Rights label**: Do you want to use `"mineboy"` as the rights label, or something else?

**Ready to start implementation when you are!** 🚀

