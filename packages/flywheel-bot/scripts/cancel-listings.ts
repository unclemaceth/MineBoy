import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import axios from 'axios';

const RPC_URL = process.env.RPC_URL || 'https://rpc.apechain.com/http';
const FLYWHEEL_PK = process.env.FLYWHEEL_PRIVATE_KEY || '';
const FLYWHEEL_WALLET = process.env.FLYWHEEL_WALLET || '0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4';
const NPC_COLLECTION = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp';
const SEAPORT_CONTRACT = '0x0000000000000068F116a894984e2Db1123eB395'; // Seaport 1.6 on ApeChain

const SEAPORT_ABI = [
  'function cancel(tuple(address offerer, address zone, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 counter)[] orders) external returns (bool)'
];

async function cancelListings() {
  console.log('\n🗑️  Cancelling all active listings...\n');
  
  if (!FLYWHEEL_PK) {
    console.error('❌ FLYWHEEL_PRIVATE_KEY not set!');
    process.exit(1);
  }

  const provider = new JsonRpcProvider(RPC_URL, 33139);
  const wallet = new Wallet(FLYWHEEL_PK, provider);
  
  console.log(`Flywheel: ${await wallet.getAddress()}\n`);

  try {
    // Get all active listings by flywheel wallet
    console.log('📋 Fetching active listings from Magic Eden...');
    const response = await axios.get(
      `${MAGIC_EDEN_API}/apechain/orders/asks/v5`,
      {
        params: {
          contracts: [NPC_COLLECTION],
          maker: FLYWHEEL_WALLET,
          status: 'active',
          sortBy: 'price',
          limit: 50
        },
        headers: {
          'accept': '*/*'
        }
      }
    );

    const orders = response.data?.orders || [];
    console.log(`Found ${orders.length} active listings\n`);

    if (orders.length === 0) {
      console.log('✅ No active listings to cancel!');
      return;
    }

    // Show what we're cancelling
    for (const order of orders) {
      const tokenId = order?.criteria?.data?.token?.tokenId || 'unknown';
      const price = order?.price?.amount?.decimal?.toFixed(2) || 'unknown';
      console.log(`  - NPC #${tokenId}: ${price} APE (Order: ${order.id})`);
    }

    console.log('\n🚀 Cancelling listings via Magic Eden API...\n');

    // Cancel each listing via Magic Eden
    for (const order of orders) {
      const orderId = order.id;
      const tokenId = order?.criteria?.data?.token?.tokenId || 'unknown';
      
      try {
        // Use Magic Eden's execute/cancel API
        const cancelResponse = await axios.post(
          `${MAGIC_EDEN_API}/apechain/execute/cancel/v3`,
          {
            orderIds: [orderId],
            orderKind: 'seaport-v1.6'
          },
          {
            headers: {
              'accept': '*/*',
              'Content-Type': 'application/json'
            }
          }
        );

        const steps = cancelResponse.data?.steps || [];
        
        // Execute cancellation steps
        for (const step of steps) {
          for (const item of step.items || []) {
            if (item.data?.to && item.data?.data) {
              console.log(`  ⏳ Cancelling NPC #${tokenId}...`);
              const tx = await wallet.sendTransaction({
                to: item.data.to,
                data: item.data.data,
                value: item.data.value || 0
              });
              await tx.wait();
              console.log(`  ✅ Cancelled NPC #${tokenId} (tx: ${tx.hash})`);
            }
          }
        }
      } catch (err: any) {
        console.error(`  ❌ Failed to cancel NPC #${tokenId}:`, err.message);
      }
    }

    console.log('\n✅ Done!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cancelListings().catch(console.error);
