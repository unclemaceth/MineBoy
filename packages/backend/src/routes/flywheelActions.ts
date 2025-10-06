import { FastifyInstance } from 'fastify';
import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import axios from 'axios';

const RPC_URL = process.env.RPC_URL || 'https://rpc.apechain.com/http';
const FLYWHEEL_PK = process.env.FLYWHEEL_PRIVATE_KEY || '';
const FLYWHEEL_WALLET = process.env.FLYWHEEL_WALLET || '0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4';
const NPC_COLLECTION = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp';

// Create listing on Magic Eden
async function createListing(tokenId: string, priceAPE: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!FLYWHEEL_PK) {
      return { success: false, error: 'FLYWHEEL_PRIVATE_KEY not set in environment' };
    }
    
    const provider = new JsonRpcProvider(RPC_URL, 33139);
    const wallet = new Wallet(FLYWHEEL_PK, provider);
    
    console.log(`[MagicEden] Listing token ${tokenId} at ${priceAPE} APE`);
    
    const priceWei = (Number(priceAPE) * 1e18).toString();
    
    const response = await axios.post(`${MAGIC_EDEN_API}/apechain/execute/list/v5`, {
      maker: await wallet.getAddress(),
      source: "magiceden.io",
      params: [{
        token: `${NPC_COLLECTION}:${tokenId}`,
        weiPrice: priceWei,
        orderKind: "seaport-v1.6",
        orderbook: "reservoir",
        automatedRoyalties: true,
        currency: "0x0000000000000000000000000000000000000000",
        expirationTime: String(Math.floor(Date.now() / 1000) + (7 * 24 * 3600))
      }]
    }, {
      headers: { 'accept': '*/*', 'Content-Type': 'application/json' }
    });
    
    const steps = response.data?.steps || [];
    
    if (steps.length === 0) {
      return { success: false, error: 'No steps returned from Magic Eden API' };
    }
    
    // Execute each step (approvals, signatures)
    for (const step of steps) {
      for (const item of step.items || []) {
        // Handle transaction (approval)
        if (item.data?.to && item.data?.data) {
          const tx = await wallet.sendTransaction({
            to: item.data.to,
            data: item.data.data,
            value: item.data.value || 0
          });
          await tx.wait();
        }
        
        // Handle signature (listing order)
        if (item.data?.sign) {
          const { domain, types, value } = item.data.sign;
          
          // Validate before signing (prevent invalid signatures)
          if (domain.chainId !== 33139) {
            return { success: false, error: `Wrong chainId: ${domain.chainId}, expected 33139` };
          }
          
          const maker = (value.maker || value.offerer || '').toLowerCase();
          const walletAddr = (await wallet.getAddress()).toLowerCase();
          if (maker !== walletAddr) {
            return { success: false, error: `Maker mismatch: ${maker} vs ${walletAddr}` };
          }
          
          // Sign typed data (DO NOT modify domain/types/value - sign exactly as provided)
          const signature = await wallet.signTypedData(domain, types, value);
          console.log(`[MagicEden] Generated signature: ${signature.substring(0, 20)}...`);
          
          // Build the POST URL
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
            
            // CRITICAL: Place signature in exact location API expects
            // The template has signature at order.data.signature
            const postBody = JSON.parse(JSON.stringify(item.data.post?.body || {}));
            
            // Replace the placeholder signature with our real one
            if (postBody.order?.data) {
              postBody.order.data.signature = signature;
              console.log(`[MagicEden] Placed signature in order.data.signature`);
            } else {
              // Fallback: if structure is different, put at root
              postBody.signature = signature;
              console.log(`[MagicEden] Placed signature at root level (fallback)`);
            }
            
            console.log(`[MagicEden] Posting to: ${fullUrl}`);
            const postResponse = await axios({
              method: item.data.post?.method || 'POST',
              url: fullUrl,
              data: postBody,
              headers: { 'accept': '*/*', 'Content-Type': 'application/json' }
            });
            console.log(`[MagicEden] Post response status: ${postResponse.status}`);
          }
        }
      }
    }
    
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message || 'Unknown error'
    };
  }
}

export default async function routes(app: FastifyInstance) {
  // Trigger listing for a specific NPC
  app.post<{ Params: { tokenId: string } }>(
    '/v2/flywheel/list/:tokenId',
    async (request, reply) => {
      // No auth required - it's just listing the bot's own NFTs
      // If you want to restrict later, use wallet signature instead of admin token
      
      const { tokenId } = request.params;
      
      if (!tokenId || !/^\d+$/.test(tokenId)) {
        return reply.code(400).send({ 
          error: 'Invalid token ID',
          message: 'Token ID must be a number'
        });
      }
      
      try {
        app.log.info(`[Flywheel] Creating listing for NPC token ID ${tokenId}...`);
        
        // Verify we own this token
        const provider = new JsonRpcProvider(RPC_URL, 33139);
        const npcContract = new Contract(
          NPC_COLLECTION,
          ['function ownerOf(uint256) view returns (address)'],
          provider
        );
        
        const owner = await npcContract.ownerOf(tokenId);
        if (owner.toLowerCase() !== FLYWHEEL_WALLET.toLowerCase()) {
          app.log.error(`[Flywheel] Token ${tokenId} is owned by ${owner}, not flywheel!`);
          return reply.code(400).send({
            error: 'Not owned',
            message: `Token ${tokenId} is not owned by flywheel wallet`
          });
        }
        
        app.log.info(`[Flywheel] Confirmed ownership of token ${tokenId}`);
        
        // Calculate listing price (floor + 20% markup)
        // For now, use a default price - could fetch floor dynamically
        const listingPrice = "55.5"; // ~46 APE floor + 20%
        
        const result = await createListing(tokenId, listingPrice);
        
        if (result.success) {
          app.log.info(`[Flywheel] Successfully listed NPC #${tokenId}`);
          return reply.send({
            ok: true,
            tokenId,
            message: `NPC #${tokenId} listed at ${listingPrice} APE`
          });
        } else {
          app.log.error(`[Flywheel] Failed to list NPC #${tokenId}: ${result.error}`);
          return reply.code(500).send({
            error: 'Listing failed',
            message: result.error || 'Unknown error'
          });
        }
        
      } catch (error: any) {
        app.log.error('[Flywheel] Error creating listing:', error);
        return reply.code(500).send({
          error: 'Failed to create listing',
          message: error.message
        });
      }
    }
  );
}
