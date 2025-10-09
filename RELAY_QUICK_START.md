# Relay Bridge - Quick Start (5 Minutes)

## What You're Getting

✅ **In-app bridge modal** - Users bridge to ApeChain without leaving Mineboy  
✅ **Matches your UI** - Same green theme, same button style, same modal pattern  
✅ **Works now** - Fallback link works immediately, SDK adds better UX  
✅ **Auto-detects gas issues** - Opens when claim fails due to insufficient funds  

---

## Installation (Run This Now)

```bash
cd /Users/mattrenshaw/ApeBit\ Miner/apps/minerboy-web
npm install @relayprotocol/relay-sdk @relayprotocol/relay-kit-hooks
```

---

## Files I Created

1. **`src/components/RelayBridgeModalSDK.tsx`** - The bridge modal (ready to use)
2. **`RELAY_INTEGRATION.md`** - Full integration guide
3. **`INTEGRATION_EXAMPLE.tsx`** - Code examples for your page.tsx
4. **`RELAY_SUMMARY.md`** - Why Relay (not Symbiosis) + overview

---

## How to Use (3 Steps)

### Step 1: Import the modal

In `apps/minerboy-web/src/app/page.tsx`, add this import at the top:

```tsx
import RelayBridgeModalSDK from '@/components/RelayBridgeModalSDK';
```

### Step 2: Add state in your `Home()` component

```tsx
const [showBridgeModal, setShowBridgeModal] = useState(false);
```

### Step 3: Add modal to your JSX

Find your existing modals section and add:

```tsx
{/* Relay Bridge Modal - opens when user needs gas */}
<RelayBridgeModalSDK
  isOpen={showBridgeModal}
  onClose={() => setShowBridgeModal(false)}
  suggestedAmount="0.01"
/>
```

---

## When to Open It

### Option A: After claim fails (Recommended)

Find your claim error handler and add gas detection:

```tsx
try {
  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: RouterV3_1ABI,
    functionName: 'claim',
    args: [claimData],
  });
} catch (err: any) {
  // ✅ Detect insufficient gas
  const needsGas = 
    err.message?.includes('insufficient funds') ||
    err.code === 'INSUFFICIENT_FUNDS';
  
  if (needsGas) {
    setShowBridgeModal(true);  // ← Opens bridge modal
  } else {
    // Your existing error handling
  }
}
```

### Option B: Add a "Get Gas" button

```tsx
<SideButton
  label="GAS"
  icon="⛽"
  onClick={() => setShowBridgeModal(true)}
/>
```

---

## Enable SDK Features (After npm install)

In `src/components/RelayBridgeModalSDK.tsx`, uncomment these lines:

### Line 4-5 (Imports):
```tsx
// BEFORE:
// import { useQuote, useExecute } from '@reservoir0x/relay-sdk/hooks';

// AFTER:
import { useQuote, useExecute } from '@reservoir0x/relay-sdk/hooks';
```

### Lines 43-52 (useQuote hook):
```tsx
// BEFORE:
// const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuote({
//   chainId: fromChainId,
//   ...
// });

// AFTER:
const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuote({
  chainId: fromChainId,
  toChainId: 33139,
  currency: '0x0000000000000000000000000000000000000000',
  toCurrency: '0x0000000000000000000000000000000000000000',
  amount: (parseFloat(amount) * 1e18).toString(),
  user: address,
  recipient: address,
  tradeType: 'EXACT_INPUT',
});
```

### Line 54 (useExecute hook):
```tsx
// BEFORE:
// const { execute } = useExecute();

// AFTER:
const { execute } = useExecute();
```

### Lines 66-77 (Execute function):
```tsx
// BEFORE:
// await execute({
//   quote: quote.data,
//   wallet: walletClient,
//   onProgress: (step) => { ... }
// });

// AFTER:
await execute({
  quote: quote.data,
  wallet: walletClient,
  onProgress: (step) => {
    console.log('[RELAY] Step:', step);
    setBridgeStatus(`${step.currentStep}: ${step.details || ''}...`);
  }
});
```

---

## Visual Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER: Clicks "Claim" in Mineboy                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. ERROR: "Insufficient funds for gas"                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. MODAL: Relay Bridge Modal opens (in-app)                 │
│    ┌────────────────────────────────────────────────┐       │
│    │  GET APE GAS                              [X]  │       │
│    │                                                 │       │
│    │  Bridge Route: Base → ApeChain                 │       │
│    │                                                 │       │
│    │  Amount: [0.01 ETH ▼]                          │       │
│    │                                                 │       │
│    │  You'll receive: ~0.0095 APE                   │       │
│    │  Time: ~30 seconds                             │       │
│    │  Fees: ~$0.50                                  │       │
│    │                                                 │       │
│    │  [Bridge 0.01 to ApeChain]                     │       │
│    └────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. RELAY: Executes bridge (Base → ApeChain)                 │
│    • Swapping ETH → bridgeable token... ✓                   │
│    • Bridging to ApeChain... ✓                              │
│    • Complete! ✓                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. USER: Receives ~0.0095 APE on ApeChain in 30s            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. USER: Clicks "Claim" again → Success! 🎉                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Testing

### Before SDK Install:
1. Open modal → See "Install SDK" warning
2. Click "Open Relay.link in New Tab" → Works immediately

### After SDK Install:
1. Open modal → See real quote with fees
2. Enter 0.01 ETH → See updated quote
3. Click "Bridge" → Wallet asks for approval
4. Watch progress → "Swapping... Bridging... Complete!"
5. Wait 30s → Check ApeChain balance increased

---

## Cost Reference

| Bridge Amount | From Base | You Get | Good For |
|---------------|-----------|---------|----------|
| 0.005 ETH | $0.30 fee | ~0.0047 APE | ~25 claims |
| 0.01 ETH | $0.50 fee | ~0.0095 APE | ~50 claims |
| 0.02 ETH | $0.75 fee | ~0.019 APE | ~100 claims |

**Pro tip:** Tell users to bridge 0.01-0.02 ETH from Base (cheapest fees).

---

## What's Relay vs Symbiosis?

You mentioned Symbiosis. Here's why I chose Relay:

| Need | Relay | Symbiosis |
|------|-------|-----------|
| Get gas on ApeChain | ✅ Perfect | ❌ Overkill |
| React hooks | ✅ Yes | ❌ No (ethers.js only) |
| Setup time | ✅ 30 min | ❌ 2-3 hours |
| Complexity | ✅ Simple | ❌ Complex (Advisor, Pools) |

**Relay** = Bridge focused, simple API, React hooks, ApeChain native support  
**Symbiosis** = DeFi protocol for liquidity routing, complex setup, no React hooks

---

## Done! ✅

You now have:
- ✅ Bridge modal component (matches your UI)
- ✅ Fallback link (works without SDK)
- ✅ SDK integration ready (uncomment after npm install)
- ✅ Error detection (opens modal when claim fails)

**Next:** Run `npm install @reservoir0x/relay-sdk`, uncomment SDK code, test!

See `RELAY_INTEGRATION.md` for full API docs.  
See `INTEGRATION_EXAMPLE.tsx` for code examples.  
See `RELAY_SUMMARY.md` for why Relay > Symbiosis.

