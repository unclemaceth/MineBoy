# Relay Bridge - Production Deployment Checklist

## Pre-Deployment

### 1. Install Dependencies
```bash
cd apps/minerboy-web
npm install @relayprotocol/relay-sdk @relayprotocol/relay-kit-hooks
```

- [ ] Packages installed successfully
- [ ] No peer dependency warnings
- [ ] `package-lock.json` updated

### 2. Clean Build Test
```bash
npm run build
```

- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] Component imports resolve correctly
- [ ] Bundle size acceptable (check output)

### 3. Verify RPC Configuration
**File:** `src/lib/apechain.ts`

```tsx
rpcUrls: {
  default: { http: ['https://rpc.apechain.com'] }, // ← Verify this RPC
  public: { http: ['https://rpc.apechain.com'] },
}
```

- [ ] Primary RPC tested and responsive
- [ ] Optional: Add fallback RPC
- [ ] Explorer URL verified: `https://apescan.io`
- [ ] Balance reads work against this RPC

**Alternative RPCs** (if primary is slow):
- `https://apechain.calderachain.xyz/http`
- `https://rpc.ape.chain` (check ApeChain docs)

### 4. Wire Modal into Claim Error Handler
**File:** `src/app/page.tsx`

```tsx
// 1. Import
import RelayBridgeModalSDK from '@/components/RelayBridgeModalSDK';

// 2. State
const [showBridgeModal, setShowBridgeModal] = useState(false);

// 3. In your claim try/catch:
try {
  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: RouterV3_1ABI,
    functionName: 'claim',
    args: [claimData],
  });
  // ... success handling
} catch (err: any) {
  // Check all common gas errors
  const needsGas = 
    err.message?.includes('insufficient funds') ||
    err.message?.includes('insufficient balance') ||
    err.message?.includes('exceeds balance') ||
    err.code === 'INSUFFICIENT_FUNDS' ||
    err.code === 'UNPREDICTABLE_GAS_LIMIT';
  
  if (needsGas) {
    setShowBridgeModal(true); // ← Opens bridge modal
    playFailSound(); // Your existing sound
  } else {
    // Handle other errors
  }
}

// 4. Add modal to JSX
<RelayBridgeModalSDK
  isOpen={showBridgeModal}
  onClose={() => setShowBridgeModal(false)}
  suggestedAmount="0.01"
/>
```

**Verify triggers on:**
- [ ] `INSUFFICIENT_FUNDS` error
- [ ] `exceeds balance` message
- [ ] `insufficient balance` message  
- [ ] `UNPREDICTABLE_GAS_LIMIT` error
- [ ] MetaMask gas errors
- [ ] Coinbase Wallet gas errors

---

## Testing Matrix

### Chains to Test
- [ ] **Base** (8453) - Primary/recommended
- [ ] **Arbitrum** (42161) - Alternative L2
- [ ] **Ethereum** (1) - Mainnet (expensive)
- [ ] **Optimism** (10) - Optional
- [ ] **Polygon** (137) - Optional

### Wallets to Test
- [ ] MetaMask
- [ ] Coinbase Wallet
- [ ] WalletConnect (optional)
- [ ] Rainbow (optional)

### Test Flows (Per Chain/Wallet Combo)

#### Happy Path:
1. [ ] Connect wallet on test chain
2. [ ] Open modal
3. [ ] See ApeChain balance
4. [ ] Enter 0.01 amount
5. [ ] See live quote with fees
6. [ ] Click "Bridge to ApeChain"
7. [ ] Approve wallet transaction
8. [ ] See progress updates ("Swapping", "Bridging")
9. [ ] See explorer link appear
10. [ ] See "Waiting for APE on ApeChain…"
11. [ ] Balance updates in real-time
12. [ ] See "✅ APE received! You can now claim."
13. [ ] Modal auto-closes after 2s
14. [ ] Click "Claim" → Success!

#### Edge Cases:
- [ ] **Chain switch mid-quote:** Switch chains after quote loads → Should refetch
- [ ] **Disconnect wallet:** Disconnect during bridge → Should show error
- [ ] **Cancel transaction:** Cancel wallet approval → Should show error, allow retry
- [ ] **Repeat bridge:** Bridge twice in a row → Both should work
- [ ] **Invalid amounts:** Try 0, 0.0001, 10 → Should disable button
- [ ] **Preset buttons:** Click [0.005] [0.01] [0.02] → Amount updates
- [ ] **Switch to Base CTA:** On Ethereum, click "Switch to Base" → Chain switches

#### Base-First Hint:
- [ ] On Ethereum (chainId 1): See "Switch to Base" button
- [ ] On Base (chainId 8453): No hint shown
- [ ] On Arbitrum: No hint shown

#### Auto-Close Polling:
- [ ] After bridge completes, modal polls every 5s
- [ ] Balance updates in UI
- [ ] Modal closes when balance >= 0.005 APE
- [ ] Timeout after ~2 minutes (24 polls × 5s)

#### Explorer Links:
- [ ] Click "View on Explorer →" link
- [ ] Opens ApeScan in new tab
- [ ] Shows correct transaction

---

## Analytics & Logging

### Setup Analytics (Optional but Recommended)

**Option A: Google Analytics**
Add to `_app.tsx` or `layout.tsx`:
```tsx
<Script src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID" />
<Script id="google-analytics">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
  `}
</Script>
```

**Events Emitted:**
- [ ] `relay_quote_loaded` - When quote appears
- [ ] `relay_execute_started` - When bridge starts
- [ ] `relay_progress_step` - Each progress update
- [ ] `relay_execute_complete` - When bridge finishes
- [ ] `relay_execute_error` - On bridge failure

**Event Parameters:**
- `fromChainId` - Source chain
- `amount` - Bridge amount
- `quoteId` - Relay quote ID (if available)
- `step` - Progress step name
- `error` - Error message (on failure)
- `finalBalance` - APE balance after bridge

### Sentry Integration (Optional)
Wrap `executeQuote()` in Sentry transaction:
```tsx
import * as Sentry from '@sentry/nextjs';

const transaction = Sentry.startTransaction({
  op: 'relay.bridge',
  name: 'Relay Bridge Execution',
});

try {
  await data.executeQuote!(...);
  transaction.setStatus('ok');
} catch (e) {
  transaction.setStatus('unknown_error');
  Sentry.captureException(e);
  throw e;
} finally {
  transaction.finish();
}
```

---

## Feature Flag Setup

### Environment Variable
Add to `.env.local` and `.env.production`:
```bash
NEXT_PUBLIC_FEATURE_RELAY=1
```

### Conditional Rendering
Wrap modal in feature check:
```tsx
{process.env.NEXT_PUBLIC_FEATURE_RELAY === '1' && (
  <RelayBridgeModalSDK
    isOpen={showBridgeModal}
    onClose={() => setShowBridgeModal(false)}
    suggestedAmount="0.01"
  />
)}

{/* Fallback: Always show deep link */}
{needsGas && !showBridgeModal && (
  <a 
    href={`https://relay.link/bridge/apechain?fromChainId=${chainId}&toAddress=${address}`}
    target="_blank"
    rel="noreferrer"
  >
    Get APE Gas →
  </a>
)}
```

### Rollout Strategy
1. [ ] **Week 1:** Enable in staging only (`NEXT_PUBLIC_FEATURE_RELAY=1`)
2. [ ] **Week 1:** Test with internal team (5-10 bridges)
3. [ ] **Week 2:** Enable for 10% of production users (A/B test)
4. [ ] **Week 2:** Monitor analytics + error rates
5. [ ] **Week 3:** Enable for 100% if metrics look good
6. [ ] **Week 4:** Remove feature flag, make permanent

---

## Auto-Retry Claim (Optional)

### Setup in page.tsx
```tsx
// Make claim handler available globally
useEffect(() => {
  (window as any).__mineboyAutoRetry = async () => {
    // Your existing claim logic here
    try {
      const result = await handleClaim(); // Your claim function
      if (result.success) {
        // Show success toast
      }
    } catch (e) {
      // Let modal show fallback message
      throw e;
    }
  };
  
  return () => {
    delete (window as any).__mineboyAutoRetry;
  };
}, [/* your claim dependencies */]);
```

**Behavior:**
- [ ] After APE arrives, modal waits 1s
- [ ] Calls `window.__mineboyAutoRetry()`
- [ ] If succeeds: Modal closes, claim completes
- [ ] If fails: Shows "✅ APE received! Tap Claim to continue."

---

## Guard Rails (Production Safety)

### Verify These Are Active:
- [x] Amount clamped to [0.001, 5.0]
- [x] Button disabled when:
  - [ ] Quote missing
  - [ ] Stale quote detected
  - [ ] Polling in progress
  - [ ] Invalid amount
  - [ ] Wallet disconnected
- [x] Stale quote guard fires before `executeQuote()`
- [x] Polling timeout clears intervals properly
- [x] Component unmount cleans up polling

### Code Nits to Double-Check:
```tsx
// ✅ Stale quote guard (line ~128)
if (data.quote.from.chainId !== fromChainId) {
  setErrMsg('Network changed. Refreshing quote…');
  await refetch();
  return; // ← Blocks execution
}

// ✅ Polling cleanup (line ~112)
useEffect(() => {
  return () => {
    setIsPollingGas(false); // ← Cleanup on unmount
  };
}, []);

// ✅ Interval cleanup (line ~143)
clearInterval(iv); // ← Clears before exit
```

---

## Success Metrics to Watch

### Conversion Funnel:
1. **Claim failures** (total)
2. **Bridge modal opens** (% of failures)
3. **Quote loads** (% of opens)
4. **Bridge executes** (% of quotes)
5. **APE arrives** (% of executions)
6. **Claim succeeds** (% of arrivals)

### Target Metrics:
- [ ] Bridge modal open rate: >80% of gas failures
- [ ] Quote load success: >95%
- [ ] Bridge execution rate: >70% of quotes
- [ ] APE arrival rate: >98% of executions
- [ ] Avg time to APE arrival: <60s
- [ ] Post-bridge claim success: >95%

### Drop-Off Analysis:
- [ ] At quote loading (chain unsupported?)
- [ ] At wallet approval (user cancels?)
- [ ] During bridge (transaction fails?)
- [ ] At APE arrival (RPC issues?)

### Wallet-Specific Issues:
- [ ] MetaMask error rate: < 5%
- [ ] Coinbase Wallet error rate: < 5%
- [ ] WalletConnect error rate: < 10%

---

## Deployment Steps

### 1. Staging
```bash
# Set feature flag
echo "NEXT_PUBLIC_FEATURE_RELAY=1" >> .env.staging

# Deploy
npm run build
npm run deploy:staging

# Verify
curl https://staging.mineboy.com/health
```

- [ ] Deployed to staging
- [ ] Feature flag enabled
- [ ] Modal appears on claim error
- [ ] Test bridge from Base → ApeChain
- [ ] Verify APE arrives
- [ ] Test claim succeeds

### 2. Production (Week 1)
```bash
# Keep feature flag OFF initially
echo "NEXT_PUBLIC_FEATURE_RELAY=0" >> .env.production

# Deploy code (inactive)
npm run build
npm run deploy:production
```

- [ ] Code deployed but inactive
- [ ] Verify deep link fallback still works
- [ ] No errors in logs

### 3. Production (Week 2 - Gradual Rollout)
```bash
# Enable feature flag
echo "NEXT_PUBLIC_FEATURE_RELAY=1" >> .env.production
npm run deploy:production
```

- [ ] Feature flag enabled
- [ ] Monitor error rates for 24h
- [ ] Check analytics funnel
- [ ] Gather user feedback

### 4. Production (Week 3 - Full Rollout)
- [ ] All metrics green
- [ ] No critical issues reported
- [ ] Feature flag stays enabled permanently
- [ ] Update docs for team

---

## Rollback Plan

### If Issues Arise:
1. **Immediate:** Set `NEXT_PUBLIC_FEATURE_RELAY=0`
2. **Deploy:** Push config change (takes ~5 min)
3. **Verify:** Deep link fallback active
4. **Debug:** Check Sentry/logs for errors
5. **Fix:** Address root cause
6. **Re-enable:** After verification

### Common Issues & Fixes:
- **Quote failures:** Check RPC_URL, verify Relay API status
- **Bridge hangs:** Increase timeout, add retry logic
- **Wrong balance:** Verify `apePublicClient` RPC
- **Explorer links broken:** Check ApeScan URL format
- **Polling never ends:** Verify threshold and timeout

---

## Post-Deployment

### Week 1 Checklist:
- [ ] Monitor analytics dashboard daily
- [ ] Check error logs 2x/day
- [ ] Respond to user feedback
- [ ] Document any issues
- [ ] Keep deep link visible as backup

### Week 2 Checklist:
- [ ] Review metrics vs targets
- [ ] Adjust feature flag if needed
- [ ] Optimize based on data
- [ ] Remove feature flag if stable

### Week 3 Checklist:
- [ ] Full rollout decision
- [ ] Update team documentation
- [ ] Add to onboarding materials
- [ ] Archive this checklist

---

## Team Communication

### Announce to Team:
```
🎉 Relay Bridge Modal is now live!

Users can now bridge gas to ApeChain without leaving Mineboy.

💡 Pro Tip: Recommend users bridge from Base for cheapest fees (~$0.50)

📊 What to watch:
- Conversion rate: claim failures → bridge success
- Average bridge time: Target <60s
- Error rate: Target <5%

🐛 Issues? Report in #eng-bugs with:
- User wallet address
- From chain
- Amount
- Error message
- Timestamp
```

---

## Quick Reference

### Files Modified:
- `src/lib/apechain.ts` (NEW)
- `src/components/RelayBridgeModalSDK.tsx` (NEW)
- `src/app/page.tsx` (claim error handler)
- `.env.local` / `.env.production` (feature flag)

### Key Functions:
- `apePublicClient.getBalance()` - Check APE balance
- `useQuote()` - Fetch bridge quote
- `data.executeQuote()` - Execute bridge
- `window.__mineboyAutoRetry()` - Auto-retry claim

### Support Links:
- **Relay Docs:** https://docs.relay.link/
- **Relay Status:** https://status.relay.link/
- **ApeChain RPC:** https://rpc.apechain.com
- **ApeScan:** https://apescan.io

---

## ✅ Final Pre-Deploy Checklist

- [ ] Dependencies installed
- [ ] Clean build passes
- [ ] RPC verified and fast
- [ ] Claim error handler wired
- [ ] All test flows pass
- [ ] Analytics configured
- [ ] Feature flag setup
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Documentation complete

**Ready to deploy!** 🚀

