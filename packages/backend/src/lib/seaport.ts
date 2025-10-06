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

const ZERO20 = '0x' + '00'.repeat(20);
const ZERO32 = '0x' + '00'.repeat(32);

/**
 * Encode a Seaport fulfillOrder call with full validation
 */
export function encodeFulfillOrder(input: {
  order: {
    kind: string;
    data: {
      signature: string;
      parameters?: any;
      components?: any;
      [key: string]: any; // Allow direct order components at data level
    };
  };
  fulfiller?: string;
  fulfillerConduitKey?: string;
}): { to: string; data: string; value: string } {
  
  const { order, fulfiller = ZERO20 } = input;
  
  // Basic checks
  expect(order?.kind === 'seaport-v1.6', 'Unsupported order kind (expected seaport-v1.6)');
  
  const signature = order?.data?.signature;
  expect(typeof signature === 'string' && signature.length > 0, 'Missing or invalid signature');
  
  // Accept both `parameters`, `components`, or direct order data
  const params: any = order?.data?.parameters ?? order?.data?.components ?? order?.data;
  expect(!!params && typeof params === 'object', 'Missing order parameters');
  
  // Normalize addresses (ethers v6 strict)
  params.offerer = normalize(params.offerer ?? ZERO20);
  params.zone = normalize(params.zone ?? ZERO20);
  
  // Lists - must exist
  expect(Array.isArray(params.offer) && params.offer.length > 0, 'offer[] missing/empty');
  expect(Array.isArray(params.consideration) && params.consideration.length > 0, 'consideration[] missing/empty');
  
  params.offer.forEach((o: any, i: number) => {
    expect(typeof o.itemType === 'number', `offer[${i}].itemType missing`);
    o.token = normalize(o.token ?? ZERO20);
    o.identifierOrCriteria = String(o.identifierOrCriteria ?? '0');
    o.startAmount = String(o.startAmount ?? '0');
    o.endAmount = String(o.endAmount ?? '0');
  });
  
  params.consideration.forEach((c: any, i: number) => {
    expect(typeof c.itemType === 'number', `consideration[${i}].itemType missing`);
    c.token = normalize(c.token ?? ZERO20);
    c.recipient = normalize(c.recipient ?? fulfiller);
    c.identifierOrCriteria = String(c.identifierOrCriteria ?? '0');
    c.startAmount = String(c.startAmount ?? '0');
    c.endAmount = String(c.endAmount ?? '0');
  });
  
  // Scalar fields
  params.orderType = Number(params.orderType ?? 0);
  params.startTime = String(params.startTime ?? '0');
  params.endTime = String(params.endTime ?? '0');
  params.salt = String(params.salt ?? '0');
  params.totalOriginalConsiderationItems = Number(
    params.totalOriginalConsiderationItems ?? params.consideration.length
  );
  params.counter = String(params.counter ?? '0');
  
  // 32-byte hex fields
  params.zoneHash = (params.zoneHash && typeof params.zoneHash === 'string') ? params.zoneHash : ZERO32;
  params.conduitKey = (params.conduitKey && typeof params.conduitKey === 'string') ? params.conduitKey : ZERO32;
  
  // Calculate value = sum of native consideration endAmounts
  const isNative = (c: any) => c.itemType === 0 && /^0x0{40}$/i.test(c.token);
  const totalWei = params.consideration
    .filter(isNative)
    .map((c: any) => BigInt(c.endAmount))
    .reduce((a: bigint, b: bigint) => a + b, 0n);
  
  // Encode fulfillOrder call
  let data: string;
  try {
    data = seaportIface.encodeFunctionData('fulfillOrder', [
      params,
      input.fulfillerConduitKey ?? ZERO32
    ]);
  } catch (e: any) {
    throw new Error(`encode fulfillOrder failed: ${e?.message ?? e}`);
  }
  
  return {
    to: SEAPORT,
    data,
    value: totalWei.toString()
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
