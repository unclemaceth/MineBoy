import { JsonRpcProvider, Interface, Contract, getAddress } from 'ethers';

// Normalize address to avoid checksum errors (lowercase then checksum)
function normalize(addr: string): string {
  return getAddress(addr.toLowerCase());
}

const SEAPORT = normalize(process.env.SEAPORT_V16 || '0x0000000000000068f116a894984e2db1123eb395');
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

// Guards with explicit messages so 500s become debuggable
function expect(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/**
 * Encode a Seaport fulfillOrder call with full validation
 */
export function encodeFulfillOrder(order: any): { to: string; data: string; value: string } {
  // Basic shape checks
  expect(order?.kind === 'seaport-v1.6', 'Unsupported order kind (expected seaport-v1.6)');
  
  const signature = order?.data?.signature;
  expect(typeof signature === 'string' && signature.length > 0, 'Missing or invalid signature');
  
  // Support both `parameters` and direct data (our bot stores order directly in data)
  const params = order?.data || {};
  expect(!!params, 'Missing order parameters');
  
  // Normalize addresses
  if (params.offerer) params.offerer = normalize(params.offerer);
  if (params.zone) params.zone = normalize(params.zone);
  
  // Normalize offer items
  if (params.offer) {
    params.offer.forEach((o: any, idx: number) => {
      expect(typeof o.itemType === 'number', `offer[${idx}].itemType missing`);
      if (o.token) o.token = normalize(o.token);
    });
  }
  
  // Normalize consideration items  
  if (params.consideration) {
    params.consideration.forEach((c: any, idx: number) => {
      expect(typeof c.itemType === 'number', `consideration[${idx}].itemType missing`);
      if (c.token) c.token = normalize(c.token);
      if (c.recipient) c.recipient = normalize(c.recipient);
    });
  }
  
  // Calculate total native APE value from consideration
  const totalWei = (params.consideration || [])
    .filter((c: any) => 
      c.itemType === 0 && 
      /^0x0{40}$/i.test(c.token)
    )
    .reduce((acc: bigint, c: any) => acc + BigInt(c.endAmount || c.startAmount), 0n);

  // Encode fulfillOrder call
  const data = seaportIface.encodeFunctionData('fulfillOrder', [
    params,
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
