import { JsonRpcProvider, Wallet } from 'ethers';
import axios from 'axios';

const RPC_URL = process.env.RPC_URL || 'https://rpc.apechain.com/http';
const FLYWHEEL_PK = process.env.FLYWHEEL_PRIVATE_KEY || '';
const NPC_COLLECTION = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp';

const TOKENS_TO_LIST = [
  { tokenId: '83', price: '55.7' }  // Just one for debugging
];

async function createListing(wallet: Wallet, tokenId: string, priceAPE: string) {
  console.log(`\n📝 Creating listing for NPC #${tokenId} at ${priceAPE} APE...`);
  
  const priceWei = (Number(priceAPE) * 1e18).toString();
  
  try {
    const response = await axios.post(`${MAGIC_EDEN_API}/apechain/execute/list/v5`, {
      maker: await wallet.getAddress(),
      source: "magiceden.io",
      params: [{
        token: `${NPC_COLLECTION}:${tokenId}`,
        weiPrice: priceWei,
        orderKind: "seaport-v1.6",
        orderbook: "reservoir",
        automatedRoyalties: true,
        royaltyBps: 690, // 6.9% creator royalties
        currency: "0x0000000000000000000000000000000000000000",
        expirationTime: String(Math.floor(Date.now() / 1000) + (7 * 24 * 3600)),
        options: {
          "seaport-v1.6": {
            useOffChainCancellation: false,
            replaceOrderId: undefined
          }
        }
      }]
    }, {
      headers: { 'accept': '*/*', 'Content-Type': 'application/json' }
    });
    
    const steps = response.data?.steps || [];
    
    if (steps.length === 0) {
      console.error('  ❌ No steps returned from Magic Eden API');
      return false;
    }
    
    console.log(`  ℹ️  Got ${steps.length} steps from Magic Eden`);
    
    // Execute each step
    for (const step of steps) {
      for (const item of step.items || []) {
        // Execute transaction (approval)
        if (item.data?.to && item.data?.data) {
          console.log(`  ⏳ Executing approval transaction...`);
          const tx = await wallet.sendTransaction({
            to: item.data.to,
            data: item.data.data,
            value: item.data.value || 0
          });
          await tx.wait();
          console.log(`  ✅ Approval confirmed`);
        }
        
        // Sign listing order
        if (item.data?.sign) {
          const { domain, types, value } = item.data.sign;
          
          // Validate
          if (domain.chainId !== 33139) {
            console.error(`  ❌ Wrong chainId: ${domain.chainId}`);
            return false;
          }
          
          console.log(`\n  📋 TYPED DATA TO SIGN:`);
          console.log(JSON.stringify({ domain, types, value }, null, 2));
          
          console.log(`\n  ✍️  Signing listing order...`);
          const signature = await wallet.signTypedData(domain, types, value);
          console.log(`  ✅ Signature: ${signature.substring(0, 20)}...`);
          
          // Post signature
          const postUrl = item.data.post?.endpoint;
          if (postUrl) {
            let fullUrl;
            if (postUrl.startsWith('http')) {
              fullUrl = postUrl;
            } else if (postUrl.startsWith('/apechain/')) {
              fullUrl = `https://api-mainnet.magiceden.dev/v3/rtp${postUrl}`;
            } else {
              fullUrl = `https://api-mainnet.magiceden.dev/v3/rtp/apechain${postUrl}`;
            }
            
            // Place signature in order.data.signature
            const postBody = JSON.parse(JSON.stringify(item.data.post?.body || {}));
            if (postBody.order?.data) {
              postBody.order.data.signature = signature;
            } else {
              postBody.signature = signature;
            }
            
            console.log(`\n  📤 POST BODY:`);
            console.log(JSON.stringify(postBody, null, 2));
            
            console.log(`\n  ⏳ Submitting to ${fullUrl}...`);
            const postResponse = await axios({
              method: item.data.post?.method || 'POST',
              url: fullUrl,
              data: postBody,
              headers: { 'accept': '*/*', 'Content-Type': 'application/json' }
            });
            
            console.log(`\n  📥 RESPONSE:`);
            console.log(JSON.stringify(postResponse.data, null, 2));
            console.log(`  ✅ Listed! Response status: ${postResponse.status}`);
          }
        }
      }
    }
    
    return true;
  } catch (error: any) {
    console.error(`  ❌ Error:`, error.response?.data || error.message);
    return false;
  }
}

async function main() {
  console.log('\n🔄 Force Re-listing NPCs with Royalty Fix\n');
  console.log('═══════════════════════════════════════\n');
  
  if (!FLYWHEEL_PK) {
    console.error('❌ FLYWHEEL_PRIVATE_KEY not set!');
    process.exit(1);
  }
  
  const provider = new JsonRpcProvider(RPC_URL, 33139);
  const wallet = new Wallet(FLYWHEEL_PK, provider);
  
  console.log(`Flywheel: ${await wallet.getAddress()}`);
  console.log(`Price: 55.6 APE each`);
  console.log(`Royalties: 6.9% (included via royaltyBps: 690)\n`);
  
  for (const { tokenId, price } of TOKENS_TO_LIST) {
    const success = await createListing(wallet, tokenId, price);
    if (success) {
      console.log(`✅ NPC #${tokenId} listed at ${price} APE`);
    } else {
      console.log(`❌ Failed to list NPC #${tokenId}`);
    }
    
    // Wait a bit between listings
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ Done! Check Magic Eden in ~30 seconds for new listings.\n');
}

main().catch(console.error);
