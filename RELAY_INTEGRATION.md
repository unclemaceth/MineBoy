# Relay Bridge Integration Guide

## Overview
This guide shows how to integrate Relay's cross-chain bridge SDK into Mineboy, allowing users to bridge gas to ApeChain without leaving your app.

## Installation

```bash
cd apps/minerboy-web
npm install @relayprotocol/relay-sdk @relayprotocol/relay-kit-hooks
```

## Files Created

1. **`src/components/RelayBridgeModal.tsx`** - Simple placeholder version (works now with fallback link)
2. **`src/components/RelayBridgeModalSDK.tsx`** - Full SDK version (enable after installing SDK)

## Integration Steps

### Step 1: Add to your main page

In `apps/minerboy-web/src/app/page.tsx`, add the bridge modal:

```tsx
import { useState } from 'react';
import RelayBridgeModalSDK from '@/components/RelayBridgeModalSDK';

export default function HomePage() {
  const [showBridgeModal, setShowBridgeModal] = useState(false);

  return (
    <>
      {/* Your existing UI */}
      
      {/* Show bridge button when user needs gas */}
      <button onClick={() => setShowBridgeModal(true)}>
        Get APE Gas ⛽
      </button>

      {/* Bridge Modal */}
      <RelayBridgeModalSDK
        isOpen={showBridgeModal}
        onClose={() => setShowBridgeModal(false)}
        suggestedAmount="0.01"
      />
    </>
  );
}
```

### Step 2: Show modal when claims fail due to gas

In your claim error handler:

```tsx
try {
  await claimTx.wait();
} catch (err: any) {
  if (err.message.includes('insufficient funds') || err.code === 'INSUFFICIENT_FUNDS') {
    setShowBridgeModal(true); // ← Open bridge modal
  }
}
```

### Step 3: Component is ready to use!

The `RelayBridgeModalSDK.tsx` component uses the correct SDK packages:
- `@relayprotocol/relay-sdk` - Core SDK with `createClient()`
- `@relayprotocol/relay-kit-hooks` - React hooks like `useQuote()`

The component:
- ✅ Fetches real-time quotes from Relay API
- ✅ Shows ApeChain gas balance
- ✅ Executes bridge with progress tracking
- ✅ Has fallback deep link if anything fails

## Features

### ✅ What It Does:
- **In-app bridging** - Users never leave Mineboy
- **Real-time quotes** - Shows fees, time, and amount before bridging
- **Progress tracking** - Visual feedback during bridge (Swapping → Bridging → Complete)
- **Fallback link** - Opens Relay.link in new tab if SDK not installed
- **Multi-chain support** - Works from Ethereum, Base, Arbitrum, Optimism, Polygon → ApeChain

### 🎨 UI Matches Your Style:
- Same green theme as NavigationModal
- Same button styling
- Same modal backdrop
- Same header pattern

## Testing

### Before SDK Install (Fallback Mode):
1. Click "Get APE Gas"
2. Modal shows warning about dev mode
3. "Open Relay.link in New Tab" button works immediately

### After SDK Install (Full Mode):
1. Click "Get APE Gas"
2. Enter amount (e.g., 0.01 ETH)
3. See real quote with fees
4. Click "Bridge {amount} to ApeChain"
5. Approve wallet transaction
6. Watch progress: Swapping → Bridging → Complete
7. APE arrives on ApeChain in ~30s

## API Reference

### RelayBridgeModalSDK Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | - | Controls modal visibility |
| `onClose` | `() => void` | - | Callback when modal closes |
| `suggestedAmount` | `string` | `'0.01'` | Pre-filled bridge amount in ETH |

### useQuote Hook

```tsx
const { data: quote, isLoading, error } = useQuote({
  chainId: 8453,        // Source chain (e.g., Base)
  toChainId: 33139,     // ApeChain
  amount: '10000000000000000', // 0.01 ETH in wei
  user: address,        // User's wallet
  recipient: address,   // Same as user for gas bridging
  currency: '0x0...0',  // Native token
  toCurrency: '0x0...0' // Native APE
});
```

### execute Function

```tsx
await execute({
  quote,
  wallet: walletClient,
  onProgress: (step) => {
    console.log(step.currentStep); // 'Swapping', 'Bridging', 'Complete'
    setBridgeStatus(step.details);
  }
});
```

## Relay API Endpoints

- **Quote:** `https://api.relay.link/quote`
- **Execute:** `https://api.relay.link/execute`
- **Docs:** https://docs.relay.link/

## Supported Chains → ApeChain

| Chain | Chain ID | Notes |
|-------|----------|-------|
| Ethereum | 1 | Mainnet |
| Base | 8453 | **Recommended** (cheapest fees) |
| Arbitrum | 42161 | Good for existing L2 users |
| Optimism | 10 | Alternative L2 |
| Polygon | 137 | Cheapest gas |

## Cost Estimates

| From Chain | Bridge Fee | Time | APE Received (0.01 ETH in) |
|------------|------------|------|----------------------------|
| Base | ~$0.50 | ~30s | ~0.0095 APE |
| Arbitrum | ~$1.00 | ~30s | ~0.0090 APE |
| Ethereum | ~$2.00 | ~30s | ~0.0080 APE |

## Troubleshooting

### SDK Not Found Error
```bash
npm install @reservoir0x/relay-sdk --save
```

### Quote Fails
- Check user has sufficient balance on source chain
- Verify amount > $1 USD (Relay minimum)
- Check fromChainId is supported

### Bridge Stuck
- Bridge typically completes in 30-60s
- Check destination chain in block explorer
- User can retry claim after APE arrives

## Next Steps

1. ✅ **Install SDK** - Run `npm install @reservoir0x/relay-sdk`
2. ✅ **Uncomment hooks** - Enable SDK code in `RelayBridgeModalSDK.tsx`
3. ✅ **Add to UI** - Show bridge button/modal in your claim flow
4. ✅ **Test on testnet** - Bridge from Curtis testnet first
5. ✅ **Deploy to prod** - Enable for mainnet users

## Alternative: Option 2 (Gasless Claims)

If you want **true cross-chain claims** (pay on Base, auto-claim on ApeChain), you'll need:

1. Deploy Paymaster contract on ApeChain
2. Add payment detection backend (watch for USDC on Base)
3. Backend submits claims on user's behalf
4. User receives MNEstr without needing APE

Let me know if you want this architecture!

## Support

- **Relay Docs:** https://docs.relay.link/
- **Relay Discord:** https://discord.gg/relay
- **GitHub Issues:** https://github.com/reservoirprotocol/relay-sdk

