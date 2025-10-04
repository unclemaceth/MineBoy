/**
 * @file alchemy.ts
 * @description Alchemy API integration for NFT balance checks
 * Used by the multiplier system to verify user's NFT holdings
 */

const ALCHEMY_BASE_URL = 'https://apechain-mainnet.g.alchemy.com/v2';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
  console.warn('[ALCHEMY] Warning: ALCHEMY_API_KEY not set - multipliers will not work');
}

/**
 * Get NFT balance for a specific wallet and contract
 * @param walletAddress User's wallet address
 * @param nftContract NFT contract address to check
 * @returns Number of NFTs owned (0 if none or error)
 */
export async function getNFTBalance(
  walletAddress: string,
  nftContract: string
): Promise<number> {
  if (!ALCHEMY_API_KEY) {
    console.error('[ALCHEMY] Cannot check NFT balance: ALCHEMY_API_KEY not set');
    return 0;
  }

  try {
    const url = `${ALCHEMY_BASE_URL}/${ALCHEMY_API_KEY}/getNFTs`;
    
    const params = new URLSearchParams({
      owner: walletAddress,
      'contractAddresses[]': nftContract,
      withMetadata: 'false', // We only need count, not full metadata
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[ALCHEMY] API error: ${response.status} ${response.statusText}`);
      return 0;
    }

    const data = await response.json();
    const balance = data.ownedNfts?.length || 0;

    console.log(`[ALCHEMY] Balance check: ${walletAddress.slice(0, 8)}... owns ${balance} of ${nftContract.slice(0, 8)}...`);

    return balance;
  } catch (error) {
    console.error('[ALCHEMY] Error fetching NFT balance:', error);
    return 0;
  }
}

/**
 * Get NFT balances for multiple contracts at once
 * @param walletAddress User's wallet address
 * @param nftContracts Array of NFT contract addresses
 * @returns Map of contract address to balance
 */
export async function getNFTBalances(
  walletAddress: string,
  nftContracts: string[]
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();

  // Fetch all balances in parallel
  const results = await Promise.all(
    nftContracts.map(contract => 
      getNFTBalance(walletAddress, contract)
        .then(balance => ({ contract, balance }))
    )
  );

  // Build map
  results.forEach(({ contract, balance }) => {
    balances.set(contract.toLowerCase(), balance);
  });

  return balances;
}

/**
 * Test Alchemy connection
 * @returns True if Alchemy is configured and working
 */
export async function testAlchemyConnection(): Promise<boolean> {
  if (!ALCHEMY_API_KEY) {
    console.error('[ALCHEMY] Test failed: ALCHEMY_API_KEY not set');
    return false;
  }

  try {
    const testWallet = '0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5'; // Your wallet
    const napc = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';

    console.log('[ALCHEMY] Testing connection...');
    const balance = await getNFTBalance(testWallet, napc);
    console.log('[ALCHEMY] Test successful! Balance:', balance);

    return true;
  } catch (error) {
    console.error('[ALCHEMY] Test failed:', error);
    return false;
  }
}

