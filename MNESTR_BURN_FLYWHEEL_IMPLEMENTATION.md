# MNESTR Burn Flywheel Implementation Guide

## Overview

This document details the implementation of the automated MNESTR burn flywheel for the MineBoy NPC trading bot. The flywheel automatically swaps APE received from NPC sales to MNESTR and burns it, creating deflationary pressure on the MNESTR token.

---

## System Architecture

### Two-Wallet System

1. **Flywheel Trading Wallet**
   - Address: `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4`
   - Purpose: Buys and sells NPCs on the marketplace
   - Receives: 1% of swappable APE from treasury for gas fees

2. **Flywheel Treasury Wallet**
   - Address: `0x0a8f8f3a13cB687A43ef33504A823Cf35e822874`
   - Purpose: Receives NPC sale proceeds, swaps APE to MNESTR, burns MNESTR
   - Flow: APE → WAPE → MNESTR → 0xdead

### The Flywheel Process

1. Bot buys cheapest NPC on market
2. Bot lists NPC at +20% markup
3. When sold, 100% of proceeds go to Treasury
4. Treasury polls every 30s for balance ≥ 2.0 APE
5. **Burn sequence triggers:**
   - Reserve 0.5 APE for gas
   - Take 99% of remaining APE for swap
   - Wrap APE → WAPE
   - Approve DEX router
   - Swap WAPE → MNESTR
   - Burn all MNESTR to `0xdead`
   - Send 1% APE to trading wallet

---

## The Journey: What We Tried

### Attempt 1: Camelot V3 (Algebra) Direct Swap ❌

**Approach:**
```typescript
const V3_ROUTER = '0xC69Dc28924930583024E067b2B3d773018F4EB52';
const params = {
  tokenIn: WAPE,
  tokenOut: MNESTR,
  recipient: treasury,
  deadline,
  amountIn,
  amountOutMinimum,
  limitSqrtPrice: 0n
};
await router.exactInputSingle(params);
```

**Why it failed:**
- No direct WAPE→MNESTR pool exists on Camelot V3
- Factory check returned `0x0000...0000` (no pool)
- Even with multi-hop routing via apeUSD, quoter reverted
- The pool architecture on ApeChain doesn't support this path

**Error:**
```
missing revert data (action="call", data=null, reason=null)
```

---

### Attempt 2: YakRouter with Native APE (`swapNoSplitFromETH`) ❌

**Approach:**
```typescript
const YAK_ROUTER = '0x2b59Eb03865D18d8B62a5956BBbFaE352fc1C148';
// Using swapNoSplitFromETH with native APE
await router.swapNoSplitFromETH(trade, fee, to, { value: apeAmount });
```

**Why it failed:**
- Ethers v6 generated **wrong method selector** from tuple ABI
- Expected: `0xbefe9803`
- Got: `0x38a3374f` (incorrect)
- Even with manual calldata encoding, params didn't match successful transactions

**Error:**
```
transaction execution reverted (status: 0, gasUsed: 23183)
```

---

### Attempt 3: YakRouter Token-In, Missing `pools[]` Array ❌

**Approach:**
```typescript
const trade = {
  amountIn,
  amountOut: minAmount,
  path: [WAPE, MNESTR],
  adapters: [ADAPTER]  // Only 4 fields!
};
```

**Why it failed:**
- YakRouter's `Trade` struct actually has **5 fields**, not 4:
  ```solidity
  struct Trade {
    uint256 amountIn;
    uint256 amountOut;
    address[] path;
    address[] adapters;
    address[] pools;  // ← MISSING!
  }
  ```
- Without the `pools[]` array, the router couldn't execute the swap
- Transaction reverted immediately with low gas usage (28k-30k)

**Error:**
```
transaction execution reverted (gasUsed: 28469, status: 0)
```

---

### Attempt 4: YakRouter with Address Checksum Issues ❌

**Approach:**
```typescript
const POOL = '0x7101842054d75E8f2b15c0026254B0d7c525D594'; // Mixed case
const trade = {
  // ... 
  pools: [POOL]
};
```

**Why it failed:**
- Ethers v6 has **very strict address checksum validation** in `AbiCoder`
- Even properly checksummed addresses were rejected
- `getAddress()` didn't help - still rejected during encoding

**Error:**
```
bad address checksum (argument="address", value="0x7101842054d75E8f2b15c0026254B0d7c525D594", code=INVALID_ARGUMENT)
```

---

## ✅ The Successful Solution

### Key Discovery from On-Chain Transaction

By examining a successful manual swap transaction on ApeScan:
- **TX:** `0x20d093452d2d85afefd23aa754899d4a56cf52fb6c58b2b41ee5062ddd24f548`
- **Function:** `swapNoSplit` (selector `0xce6e28f2`)
- **Router:** `0x2b59Eb03865D18d8B62a5956BBbFaE352fc1C148`
- **Critical insight:** Trade struct has **3 arrays** (path, adapters, **pools**)

### Working Implementation

```typescript
// Treasury burn function
export async function executeBurn() {
  const treasuryAddr = await treasury.getAddress();
  
  // 1. Calculate amounts
  const apeBalance = await treasury.provider!.getBalance(treasuryAddr);
  const gasReserve = parseEther('0.5');
  const swappableBalance = apeBalance - gasReserve;
  const apeForSwap = (swappableBalance * 99n) / 100n; // 99%
  const apeForTradingWallet = swappableBalance - apeForSwap; // 1%
  
  // 2. Contract addresses (lowercase to avoid checksum issues)
  const YAK_ROUTER = '0x2b59Eb03865D18d8B62a5956BBbFaE352fc1C148';
  const ADAPTER = '0xf05902d8eb53a354c9ddc67175df3d9bee1f9581';
  const POOL = '0x7101842054d75e8f2b15c0026254b0d7c525d594';
  
  // 3. Calculate slippage (15%)
  const ratePerAPE = 61000n * 10n**18n; // ~61k MNESTR per APE
  const expectedMNESTR = (apeForSwap * ratePerAPE) / 10n**18n;
  const minMNESTR = (expectedMNESTR * 85n) / 100n; // 15% slippage
  
  // 4. Wrap APE → WAPE
  const wape = new Contract(cfg.wape, WAPE_ABI, treasury);
  const wrapTx = await wape.deposit({ value: apeForSwap, gasLimit: 100000 });
  await wrapTx.wait(1);
  
  // 5. Approve YakRouter
  const approveTx = await wape.approve(YAK_ROUTER, apeForSwap);
  await approveTx.wait(1);
  
  // 6. Manually encode calldata (to ensure correct selector)
  const { AbiCoder } = await import('ethers');
  const abiCoder = AbiCoder.defaultAbiCoder();
  
  // Trade struct: (uint256, uint256, address[], address[], address[])
  // ALL ADDRESSES MUST BE LOWERCASE to avoid checksum validation
  const paramsEncoded = abiCoder.encode(
    ['tuple(uint256,uint256,address[],address[],address[])', 'uint256', 'address'],
    [
      [
        apeForSwap,
        minMNESTR,
        [cfg.wape.toLowerCase(), cfg.mnestr.toLowerCase()], // path
        [ADAPTER],    // adapters
        [POOL]        // pools ← Critical!
      ],
      0n,                              // fee
      treasuryAddr.toLowerCase()       // recipient
    ]
  );
  
  // 7. Build calldata with correct selector
  const methodSelector = '0xce6e28f2'; // swapNoSplit
  const calldata = methodSelector + paramsEncoded.slice(2);
  
  // 8. Send swap transaction
  const swapTx = await treasury.sendTransaction({
    to: YAK_ROUTER,
    data: calldata,
    value: 0, // Token-in, not native
    gasLimit: 300000
  });
  await swapTx.wait(1);
  
  // 9. Burn MNESTR
  const mnestrContract = new Contract(cfg.mnestr, ERC20_ABI, treasury);
  const mnestrBalance = await mnestrContract.balanceOf(treasuryAddr);
  
  const burnTx = await mnestrContract.transfer(
    '0x000000000000000000000000000000000000dEaD',
    mnestrBalance
  );
  await burnTx.wait(1);
  
  // 10. Send 1% APE to trading wallet
  const gasTx = await treasury.sendTransaction({
    to: cfg.flywheelAddr,
    value: apeForTradingWallet,
    gasLimit: 100000
  });
  await gasTx.wait(1);
  
  console.log(`[Treasury] ✅✅✅ FLYWHEEL BURN COMPLETE! ✅✅✅`);
}
```

---

## Critical Success Factors

### 1. **YakRouter Token-In Variant**
- Function: `swapNoSplit` (NOT `swapNoSplitFromETH`)
- Selector: `0xce6e28f2`
- Input: WAPE tokens (already wrapped)
- Transaction value: `0` (token-in, not native APE)

### 2. **Complete Trade Struct (5 Fields)**
```solidity
struct Trade {
  uint256 amountIn;        // Amount of WAPE to swap
  uint256 amountOut;       // Minimum MNESTR to receive
  address[] path;          // [WAPE, MNESTR]
  address[] adapters;      // [0xf05902d8eb53a354c9ddc67175df3d9bee1f9581]
  address[] pools;         // [0x7101842054d75e8f2b15c0026254b0d7c525d594] ← CRITICAL!
}
```

### 3. **Lowercase Addresses**
All addresses must be **lowercase** to bypass Ethers v6's strict checksum validation:
```typescript
path: [cfg.wape.toLowerCase(), cfg.mnestr.toLowerCase()]
adapters: ['0xf05902d8eb53a354c9ddc67175df3d9bee1f9581'] // already lowercase
pools: ['0x7101842054d75e8f2b15c0026254b0d7c525d594']    // already lowercase
recipient: treasuryAddr.toLowerCase()
```

### 4. **Manual Calldata Encoding**
Ethers v6 generates incorrect method selectors from tuple syntax in ABIs. Solution:
```typescript
const methodSelector = '0xce6e28f2'; // Hardcode correct selector
const calldata = methodSelector + paramsEncoded.slice(2);
```

### 5. **Reasonable Slippage**
- 15% slippage tolerance
- Based on observed rate: ~61,000 MNESTR per APE
- Allows for price impact on larger swaps

---

## Contract Addresses

### DEX & Routing
- **YakRouter (Aggregator):** `0x2b59Eb03865D18d8B62a5956BBbFaE352fc1C148`
- **YakRouter Adapter:** `0xf05902d8eb53a354c9ddc67175df3d9bee1f9581`
- **WAPE/MNESTR Pool:** `0x7101842054d75e8f2b15c0026254b0d7c525d594`

### Tokens
- **WAPE (Wrapped APE):** `0x48b62137EdfA95a428D35C09E44256a739F6B557`
- **MNESTR (MineStrategy):** `0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276`

### System Wallets
- **Flywheel Trading:** `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4`
- **Flywheel Treasury:** `0x0a8f8f3a13cB687A43ef33504A823Cf35e822874`

---

## Verified Success

### First Successful Burn Transaction
- **Swap TX:** `0x6bae22b2c0185be7215f0f7b764cf3bce8aab9d2bbe31d1ee241954cc3abacf3`
- **Block:** 24708789
- **Amount In:** 9.282 WAPE
- **Amount Out:** 581,715.49 MNESTR
- **Burn TX:** `0xcff6fa416274bb0b1340f745761969b98395af18ede85ac11705c8fde7dee631`
- **Status:** ✅ Success

### Logs from Successful Burn
```
[Treasury] ✅ Swap confirmed in block 24708789
[Treasury] MNESTR Balance: 581715.489891534225398472 MNESTR
[Treasury] 🔥 Burned 581715.489891534225398472 MNESTR!
[Treasury] ✅ Sent to trading wallet
[Treasury] ✅✅✅ FLYWHEEL BURN COMPLETE! ✅✅✅
```

---

## Key Learnings

### 1. **DEX Discovery**
- On-chain transaction analysis is invaluable
- ApeScan's decoded function calls reveal exact parameters
- The WAPE/MNESTR pool is NOT on Camelot V3 - it's accessed via YakRouter

### 2. **Ethers v6 Gotchas**
- Tuple syntax in ABIs can generate wrong selectors
- Strict address checksum validation in `AbiCoder`
- Solution: Manual calldata encoding + lowercase addresses

### 3. **Struct Completeness**
- Always verify struct fields from on-chain transactions
- Missing fields cause early reverts with low gas usage
- The `pools[]` array was the critical missing piece

### 4. **Two-Wallet Design**
- Separation of concerns: trading vs treasury
- Trading wallet needs only ~0.1 APE for gas
- Treasury accumulates and processes bulk swaps
- Clean separation makes debugging easier

### 5. **Conservative Slippage**
- Larger swaps have more price impact
- 15% slippage provides safety margin
- Can be tightened as liquidity improves

---

## Future Improvements

### Potential Optimizations
1. **Dynamic Slippage**
   - Calculate slippage based on swap size
   - Use on-chain quoter if available
   - Adaptive to market conditions

2. **Gas Optimization**
   - Batch multiple operations if possible
   - Optimize gas limits based on historical usage
   - Monitor gas prices and delay non-urgent swaps

3. **Monitoring & Alerts**
   - Alert on failed burns
   - Track MNESTR burn rate
   - Monitor pool liquidity

4. **Liquidity Provision**
   - Consider providing liquidity to WAPE/MNESTR pool
   - Earn fees while improving flywheel efficiency
   - Reduce slippage for larger swaps

---

## Conclusion

The MNESTR burn flywheel is now **fully operational** and automatically creates deflationary pressure on the MNESTR token. The key to success was:

1. Using YakRouter's token-in variant (`swapNoSplit`)
2. Including all 5 fields in the Trade struct (especially `pools[]`)
3. Using lowercase addresses to bypass checksum validation
4. Manual calldata encoding to ensure correct method selector
5. Two-wallet architecture for clean separation of concerns

**Status:** ✅ Live and burning MNESTR on every NPC sale! 🔥

---

*Document created: October 7, 2025*  
*Last successful burn: Block 24708789*  
*Total MNESTR burned: 581,715+ (and counting)*
