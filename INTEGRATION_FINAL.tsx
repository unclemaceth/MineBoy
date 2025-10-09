// FINAL INTEGRATION GUIDE - Drop this code into page.tsx

// ========================================
// 1. IMPORTS (add to top of file)
// ========================================
import { useState, useEffect } from 'react';
import RelayBridgeModalSDK from '@/components/RelayBridgeModalSDK';

// ========================================
// 2. STATE (add inside your Home() component)
// ========================================
const [showBridgeModal, setShowBridgeModal] = useState(false);

// ========================================
// 3. AUTO-RETRY CLAIM HOOK (optional but recommended)
// ========================================
useEffect(() => {
  // Make your claim handler available to the bridge modal
  (window as any).__mineboyAutoRetry = async () => {
    try {
      // YOUR EXISTING CLAIM LOGIC HERE
      // Replace this with your actual claim function:
      
      const result = await handleClaim(); // Your claim function
      
      if (result.success) {
        // Show success notification
        playConfirmSound();
        setClaimSuccess(true);
      }
    } catch (e) {
      // If auto-retry fails, modal will show fallback message
      console.error('[AUTO_RETRY] Failed:', e);
      throw e; // Let modal handle the error
    }
  };
  
  // Cleanup on unmount
  return () => {
    delete (window as any).__mineboyAutoRetry;
  };
}, [/* Add your claim dependencies here */]);

// ========================================
// 4. CLAIM ERROR HANDLER (modify your existing try/catch)
// ========================================
const handleClaimSubmit = async () => {
  try {
    // Your existing claim logic
    const txHash = await walletClient.writeContract({
      address: routerAddress,
      abi: RouterV3_1ABI,
      functionName: 'claim',
      args: [claimData],
    });
    
    await waitForTransaction(txHash);
    
    // Success handling...
    playConfirmSound();
    
  } catch (err: any) {
    console.error('[CLAIM_ERROR]', err);
    
    // ✅ DETECT GAS ERRORS (all common formats)
    const needsGas = 
      err.message?.includes('insufficient funds') ||
      err.message?.includes('insufficient balance') ||
      err.message?.includes('exceeds balance') ||
      err.message?.includes('gas required exceeds') ||
      err.code === 'INSUFFICIENT_FUNDS' ||
      err.code === 'UNPREDICTABLE_GAS_LIMIT' ||
      err.shortMessage?.includes('insufficient');
    
    if (needsGas) {
      // Open bridge modal instead of showing generic error
      setShowBridgeModal(true);
      playFailSound(); // Your existing sound
      
      // Optional: Analytics
      if ((window as any).gtag) {
        (window as any).gtag('event', 'claim_failed_gas', {
          chainId: fromChainId,
          wallet: address,
        });
      }
    } else {
      // Handle other errors normally (stale job, physics check, etc.)
      setErrorMessage(err.message || 'Claim failed');
      playFailSound();
    }
  }
};

// ========================================
// 5. JSX - ADD MODAL (before your closing </div>)
// ========================================
return (
  <div>
    {/* Your existing UI... */}
    
    {/* ✅ RELAY BRIDGE MODAL */}
    {process.env.NEXT_PUBLIC_FEATURE_RELAY === '1' && (
      <RelayBridgeModalSDK
        isOpen={showBridgeModal}
        onClose={() => setShowBridgeModal(false)}
        suggestedAmount="0.01" // 0.01 ETH ≈ 50 claims of gas
      />
    )}
    
    {/* Your other modals... */}
    <NavigationModal isOpen={showNavigationModal} page={navigationPage} onClose={closeNavigationModal} />
    {/* ... */}
  </div>
);

// ========================================
// 6. FEATURE FLAG SETUP
// ========================================
// Create .env.local:
// NEXT_PUBLIC_FEATURE_RELAY=1

// Or conditional rendering without flag:
// {showBridgeModal && (
//   <RelayBridgeModalSDK ... />
// )}

// ========================================
// 7. ANALYTICS SETUP (optional)
// ========================================
// If you're using GA, add to _app.tsx or layout.tsx:
/*
<Script src="https://www.googletagmanager.com/gtag/js?id=YOUR_GA_ID" />
<Script id="google-analytics">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'YOUR_GA_ID');
  `}
</Script>
*/

// Events automatically tracked:
// - relay_quote_loaded
// - relay_execute_started
// - relay_progress_step
// - relay_execute_complete
// - relay_execute_error

// ========================================
// 8. INSTALLATION COMMAND
// ========================================
// Run this in your terminal:
// cd apps/minerboy-web
// npm install @relayprotocol/relay-sdk @relayprotocol/relay-kit-hooks

// ========================================
// 9. BUILD & TEST
// ========================================
// npm run build  # Should complete without errors
// npm run dev    # Test locally

// ========================================
// 10. TESTING CHECKLIST
// ========================================
/*
HAPPY PATH:
1. Connect wallet on Base
2. Try to claim without enough gas
3. Bridge modal opens
4. See balance, quote, presets
5. Bridge 0.01 ETH
6. Watch progress updates
7. See "APE received!"
8. Modal auto-closes
9. (Optional) Claim auto-retries
10. Success! 🎉

EDGE CASES:
- Switch chains mid-quote → Should refetch
- Cancel wallet tx → Should allow retry
- Invalid amount → Button disabled
- Disconnect wallet → Shows "Connect wallet"
- On Ethereum → Shows "Switch to Base" hint

WALLETS TO TEST:
- MetaMask
- Coinbase Wallet
- WalletConnect

CHAINS TO TEST:
- Base (8453) - cheapest
- Arbitrum (42161)
- Ethereum (1) - shows switch hint
*/

// ========================================
// 11. DEPLOYMENT
// ========================================
/*
STAGING:
1. Set NEXT_PUBLIC_FEATURE_RELAY=1 in .env.staging
2. Deploy to staging
3. Test with team (5-10 bridges)

PRODUCTION:
1. Deploy code with flag OFF (NEXT_PUBLIC_FEATURE_RELAY=0)
2. Week 1: Enable flag, monitor closely
3. Week 2: If metrics good, keep enabled
4. Week 3: Remove flag, make permanent
*/

// ========================================
// 12. MONITORING
// ========================================
/*
METRICS TO WATCH:
- Claim failure rate (should stay same or decrease)
- Bridge modal open rate (>80% of gas failures)
- Bridge completion rate (>70% of attempts)
- Time to APE arrival (target <60s)
- Error rate (target <5%)

FUNNEL:
Claim Failed (Gas) → Modal Open → Quote Load → Bridge Execute → APE Arrives → Claim Success
     100%              80%           95%          70%             98%           95%
*/

// ========================================
// 13. COMMON ISSUES & FIXES
// ========================================
/*
ISSUE: Quote never loads
FIX: Check RPC in src/lib/apechain.ts

ISSUE: Bridge hangs
FIX: Check Relay API status (status.relay.link)

ISSUE: Balance wrong
FIX: Verify apePublicClient queries ApeChain

ISSUE: Polling never ends
FIX: Check GAS_THRESHOLD (0.005 APE) and timeout (24 polls)

ISSUE: Explorer link broken
FIX: Verify ApeScan URL format in component
*/

// ========================================
// 14. SUPPORT
// ========================================
/*
DOCS:
- Full guide: RELAY_SHIPPED.md
- Quick start: RELAY_QUICK_START.md
- Deployment: RELAY_DEPLOYMENT_CHECKLIST.md
- Before/after: RELAY_BEFORE_AFTER.md

RELAY DOCS:
- https://docs.relay.link/

APECHAIN:
- RPC: https://rpc.apechain.com
- Explorer: https://apescan.io
- Docs: https://docs.apechain.com
*/

// ========================================
// DONE! Ready to ship 🚀
// ========================================

