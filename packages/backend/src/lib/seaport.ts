import { JsonRpcProvider, Interface, Contract } from 'ethers';

const SEAPORT = process.env.SEAPORT_V16 || '0x0000000000000068F116a894984e2Db1123eB395';
const RPC = process.env.APECHAIN_RPC || process.env.RPC_URL || 'https://rpc.apechain.com/http';
const CHAIN_ID = Number(process.env.CHAIN_ID || 33139);

export const provider = new JsonRpcProvider(RPC, CHAIN_ID);

// Seaport 1.6 interface
export const seaportIface = new Interface([
  'event OrderFulfilled(bytes32 orderHash, address offerer, address zone, address recipient, tuple(uint8 itemType, address token, uint256 identifier, uint256 amount)[] offer, tuple(uint8 itemType, address token, uint256 identifier, uint256 amount, address recipient)[] consideration)',
  'function fulfillOrder((address offerer, address zone, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 counter) order, bytes32 fulfillerConduitKey) payable returns (bool fulfilled)'
]);

export const SEAPORT_ADDRESS = SEAPORT as `0x${string}`;
export const CHAIN_ID_VALUE = CHAIN_ID;

// ERC721 interface for ownership checks
export const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)'
];

/**
 * Encode a Seaport fulfillOrder call
 */
export function encodeFulfillOrder(order: any): { to: string; data: string; value: string } {
  const { data: orderComponents } = order;
  
  // Calculate total native APE value from consideration
  const totalWei = orderComponents.consideration
    .filter((c: any) => 
      c.itemType === 0 && 
      c.token.toLowerCase() === '0x0000000000000000000000000000000000000000'
    )
    .reduce((acc: bigint, c: any) => acc + BigInt(c.endAmount || c.startAmount), 0n);

  // Encode fulfillOrder call
  const data = seaportIface.encodeFunctionData('fulfillOrder', [
    orderComponents,
    '0x' + '0'.repeat(64) // fulfillerConduitKey = zero
  ]);

  return {
    to: SEAPORT,
    data,
    value: '0x' + totalWei.toString(16)
  };
}

/**
 * Check if an address owns an NFT
 */
export async function checkOwnership(
  collection: string,
  tokenId: string,
  expectedOwner: string
): Promise<boolean> {
  try {
    const nft = new Contract(collection, ERC721_ABI, provider);
    const owner = await nft.ownerOf(tokenId);
    return owner.toLowerCase() === expectedOwner.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Wait for a transaction and parse OrderFulfilled events
 */
export async function waitForOrderFulfilled(txHash: string, timeoutMs = 60_000): Promise<boolean> {
  try {
    const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs);
    if (!receipt?.logs?.length) return false;

    // Check for OrderFulfilled event
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== SEAPORT.toLowerCase()) continue;
      try {
        const parsed = seaportIface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === 'OrderFulfilled') {
          return true;
        }
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}
