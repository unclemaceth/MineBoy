/**
 * Direct Seaport order creation (NO MAGIC EDEN)
 * Create signed Seaport 1.6 orders for NFT listings
 */
import { ethers, Wallet, getAddress } from 'ethers';
import axios from 'axios';

// Normalize address to avoid checksum errors (lowercase then checksum)
function normalize(addr: string): string {
  return getAddress(addr.toLowerCase());
}

const SEAPORT_ADDRESS = normalize(process.env.SEAPORT_V16 || '0x0000000000000068f116a894984e2db1123eb395'); // Seaport 1.6
const CONDUIT_KEY = '0x0000000000000000000000000000000000000000000000000000000000000000'; // Zero conduit = Seaport transfers directly
const ZONE_ADDRESS = '0x0000000000000000000000000000000000000000'; // No zone

interface SeaportOrder {
  offerer: string;
  zone: string;
  offer: Array<{
    itemType: number;
    token: string;
    identifierOrCriteria: string;
    startAmount: string;
    endAmount: string;
  }>;
  consideration: Array<{
    itemType: number;
    token: string;
    identifierOrCriteria: string;
    startAmount: string;
    endAmount: string;
    recipient: string;
  }>;
  orderType: number;
  startTime: string;
  endTime: string;
  zoneHash: string;
  salt: string;
  conduitKey: string;
  totalOriginalConsiderationItems: number;
  counter: string;
}

/**
 * Ensure Seaport is approved to transfer NFTs from wallet
 * @returns true if already approved, false if approval was needed and executed
 */
async function ensureSeaportApproval(
  wallet: Wallet,
  nftContract: string
): Promise<boolean> {
  const walletAddr = await wallet.getAddress();
  
  const nft = new ethers.Contract(
    nftContract,
    [
      'function isApprovedForAll(address owner, address operator) view returns (bool)',
      'function setApprovalForAll(address operator, bool approved)'
    ],
    wallet
  );
  
  const isApproved = await nft.isApprovedForAll(walletAddr, SEAPORT_ADDRESS);
  
  if (isApproved) {
    console.log(`[Seaport] ✅ Already approved for ${nftContract.substring(0, 10)}...`);
    return true;
  }
  
  console.log(`[Seaport] Approving Seaport to transfer NFTs...`);
  const tx = await nft.setApprovalForAll(SEAPORT_ADDRESS, true);
  console.log(`[Seaport] Approval tx: ${tx.hash}`);
  await tx.wait(1);
  console.log(`[Seaport] ✅ Approved`);
  
  return false;
}

/**
 * Create and sign a Seaport order for an NFT listing
 */
export async function createSeaportListing(
  wallet: Wallet,
  nftContract: string,
  tokenId: string,
  priceWei: string,
  durationSeconds: number = 7 * 24 * 3600, // 7 days default
  treasuryAddress?: string // Optional: send proceeds to treasury instead of offerer
): Promise<{ order: SeaportOrder; signature: string; domain: any }> {
  
  const offerer = await wallet.getAddress();
  
  // Security Fix #3: Verify ownership before listing
  const nft = new ethers.Contract(
    nftContract,
    ['function ownerOf(uint256) view returns (address)'],
    wallet
  );
  
  const owner = await nft.ownerOf(tokenId);
  if (owner.toLowerCase() !== offerer.toLowerCase()) {
    throw new Error(`Not owner of token ${tokenId}: owner=${owner}, wallet=${offerer}`);
  }
  
  console.log(`[Seaport] ✅ Ownership verified for token #${tokenId}`);
  
  // Security Fix #2: Ensure Seaport approval before creating listing
  await ensureSeaportApproval(wallet, nftContract);
  const now = Math.floor(Date.now() / 1000);
  const endTime = now + durationSeconds;
  
  // Get counter from Seaport contract (needed for signature)
  const provider = wallet.provider;
  if (!provider) throw new Error('Wallet has no provider');
  
  console.log(`[Seaport] Getting counter for ${offerer}...`);
  
  let counter;
  try {
    const seaportContract = new ethers.Contract(
      SEAPORT_ADDRESS,
      ['function getCounter(address) view returns (uint256)'],
      provider
    );
    
    counter = await seaportContract.getCounter(offerer);
    console.log(`[Seaport] Counter: ${counter.toString()}`);
  } catch (error) {
    console.warn(`[Seaport] Failed to get counter, using 0:`, error);
    counter = 0n;
  }
  
  // Calculate royalty (6.9% = 690 bps)
  const royaltyBps = 690;
  const priceWeiBigInt = BigInt(priceWei);
  const royaltyAmount = (priceWeiBigInt * BigInt(royaltyBps)) / BigInt(10000);
  const sellerAmount = priceWeiBigInt - royaltyAmount;
  
  const royaltyRecipient = normalize('0xd05a86b9f803a4e68a0967e85947ce616be78cf5'); // NPC creator
  
  // Build Seaport OrderComponents
  const order: SeaportOrder = {
    offerer,
    zone: ZONE_ADDRESS,
    offer: [
      {
        itemType: 2, // ERC721
        token: nftContract,
        identifierOrCriteria: tokenId,
        startAmount: '1',
        endAmount: '1'
      }
    ],
    consideration: [
      // Treasury wallet gets price minus royalty (for burning)
      {
        itemType: 0, // Native token (APE)
        token: '0x0000000000000000000000000000000000000000',
        identifierOrCriteria: '0',
        startAmount: sellerAmount.toString(),
        endAmount: sellerAmount.toString(),
        recipient: treasuryAddress || offerer // Treasury receives proceeds for burning
      },
      // Creator gets royalty
      {
        itemType: 0, // Native token (APE)
        token: '0x0000000000000000000000000000000000000000',
        identifierOrCriteria: '0',
        startAmount: royaltyAmount.toString(),
        endAmount: royaltyAmount.toString(),
        recipient: royaltyRecipient
      }
    ],
    orderType: 0, // FULL_OPEN (anyone can fulfill)
    startTime: now.toString(),
    endTime: endTime.toString(),
    zoneHash: '0x' + '0'.repeat(64),
    salt: '0x' + ethers.hexlify(ethers.randomBytes(32)).slice(2),
    conduitKey: CONDUIT_KEY,
    totalOriginalConsiderationItems: 2, // REQUIRED by Seaport 1.6! Must equal consideration.length
    counter: counter.toString()
  };
  
  // EIP-712 domain for Seaport 1.6 on ApeChain
  const domain = {
    name: 'Seaport',
    version: '1.6',
    chainId: 33139,
    verifyingContract: SEAPORT_ADDRESS
  };
  
  // EIP-712 types for Seaport OrderComponents
  const types = {
    OrderComponents: [
      { name: 'offerer', type: 'address' },
      { name: 'zone', type: 'address' },
      { name: 'offer', type: 'OfferItem[]' },
      { name: 'consideration', type: 'ConsiderationItem[]' },
      { name: 'orderType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'conduitKey', type: 'bytes32' },
      { name: 'counter', type: 'uint256' }
    ],
    OfferItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' }
    ],
    ConsiderationItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ]
  };
  
  // Sign the order
  const signature = await wallet.signTypedData(domain, types, order);
  
  console.log(`[Seaport] Created and signed order for NFT #${tokenId} at ${ethers.formatEther(priceWei)} APE`);
  
  return { order, signature, domain };
}

/**
 * Store a signed order in the backend
 */
export async function storeOrderInBackend(
  tokenId: string,
  priceWei: string,
  order: SeaportOrder,
  signature: string,
  domain: any
): Promise<boolean> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'https://mineboy-g5xo.onrender.com';
    
    await axios.post(`${backendUrl}/market/admin/store-order`, {
      tokenId,
      priceWei,
      signature,
      orderComponents: order,
      domain,
      expiresAt: Number(order.endTime)
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[Seaport] ✅ Stored order in backend`);
    return true;
    
  } catch (error: any) {
    console.error(`[Seaport] Failed to store order in backend:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Create a listing (sign order + store in backend)
 */
export async function createListing(
  wallet: Wallet,
  nftContract: string,
  tokenId: string,
  priceAPE: string,
  treasuryAddress?: string
): Promise<boolean> {
  try {
    const priceWei = ethers.parseEther(priceAPE).toString();
    
    console.log(`[Seaport] Creating listing for NFT #${tokenId} at ${priceAPE} APE...`);
    
    // Create and sign Seaport order
    const { order, signature, domain } = await createSeaportListing(
      wallet,
      nftContract,
      tokenId,
      priceWei
    );
    
    // Store in backend
    const stored = await storeOrderInBackend(tokenId, priceWei, order, signature, domain);
    
    if (!stored) {
      console.error(`[Seaport] Failed to store order for NFT #${tokenId}`);
      return false;
    }
    
    console.log(`[Seaport] ✅ Listing created for NFT #${tokenId}`);
    return true;
    
  } catch (error: any) {
    console.error(`[Seaport] Error creating listing:`, error.message);
    return false;
  }
}
