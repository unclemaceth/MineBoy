// Example: How to integrate RelayBridgeModal into your existing page.tsx

// 1. ADD IMPORT at top of page.tsx
import RelayBridgeModalSDK from '@/components/RelayBridgeModalSDK';

// 2. ADD STATE in your Home() component
const [showBridgeModal, setShowBridgeModal] = useState(false);

// 3. DETECT insufficient gas in your claim error handler
// Find your existing claim submission code and wrap with error detection:

// BEFORE:
try {
  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: RouterV3_1ABI,
    functionName: 'claim',
    args: [/* your claim args */],
  });
  // ... rest of claim flow
} catch (err) {
  console.error('Claim failed:', err);
}

// AFTER:
try {
  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: RouterV3_1ABI,
    functionName: 'claim',
    args: [/* your claim args */],
  });
  // ... rest of claim flow
} catch (err: any) {
  console.error('Claim failed:', err);
  
  // ✅ NEW: Check if error is due to insufficient gas
  const insufficientGas = 
    err.message?.includes('insufficient funds') ||
    err.message?.includes('insufficient balance') ||
    err.code === 'INSUFFICIENT_FUNDS' ||
    err.message?.includes('exceeds balance');
  
  if (insufficientGas) {
    // Show bridge modal instead of generic error
    setShowBridgeModal(true);
    playFailSound();
  } else {
    // Handle other errors normally
    // ... your existing error handling
  }
}

// 4. ADD MODAL to your JSX (before closing </div>)
return (
  <div>
    {/* Your existing UI... */}
    
    {/* ✅ NEW: Relay Bridge Modal */}
    <RelayBridgeModalSDK
      isOpen={showBridgeModal}
      onClose={() => setShowBridgeModal(false)}
      suggestedAmount="0.01" // 0.01 ETH ≈ 50-100 claims of gas
    />
    
    {/* Your other modals... */}
    <NavigationModal isOpen={showNavigationModal} page={navigationPage} onClose={closeNavigationModal} />
    {/* ... */}
  </div>
);

// 5. OPTIONAL: Add "Get Gas" button to your HUD or menu
// For example, in your side buttons area:
<SideButton
  label="GAS"
  icon="⛽"
  onClick={() => {
    setShowBridgeModal(true);
    playButtonSound();
  }}
  disabled={false}
/>

// 6. OPTIONAL: Show proactive hint when balance is low
useEffect(() => {
  const checkBalance = async () => {
    if (!address) return;
    
    const balance = await publicClient.getBalance({ address });
    const balanceInEth = parseFloat(formatEther(balance));
    
    // If user has less than 0.005 APE (~25 claims), show hint
    if (balanceInEth < 0.005) {
      setScrollingMessages(prev => [
        ...prev,
        { 
          text: 'Running low on gas! Tap here to bridge more APE.', 
          color: '#ffd700',
          prefix: '⛽ ',
          type: 'GAS_WARNING' 
        }
      ]);
    }
  };
  
  checkBalance();
}, [address]);

// That's it! Users will now see the bridge modal when they run out of gas.

