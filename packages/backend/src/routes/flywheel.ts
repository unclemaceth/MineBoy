import { FastifyInstance } from 'fastify';
import { JsonRpcProvider, Contract, formatEther, formatUnits } from 'ethers';

const RPC_URL = process.env.RPC_URL || 'https://rpc.apechain.com/http';
const MNESTR = '0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276';
const NPC_COLLECTION = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const FLYWHEEL_WALLET = '0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4';
const DEX_ROUTER = '0x18E621B64d7808c3C47bccbbD7485d23F257D26f';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function cap() view returns (uint256)'
];

// Common burn addresses
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ERC721_ABI = [
  'function ownerOf(uint256) view returns (address)'
];

const ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])'
];

const WAPE = '0x48b62137EdfA95a428D35C09E44256a739F6B557';

// In-memory cache for expensive operations
let cache: {
  lastFetch: number;
  data: any;
} = { lastFetch: 0, data: null };

const CACHE_TTL = 30000; // 30 seconds

export default async function routes(app: FastifyInstance) {
  app.get('/v2/flywheel/stats', async (request, reply) => {
    try {
      // Return cached data if fresh
      const now = Date.now();
      if (cache.data && (now - cache.lastFetch) < CACHE_TTL) {
        return reply.send(cache.data);
      }

      const provider = new JsonRpcProvider(RPC_URL, 33139);

      // Fetch APE balance
      const apeBalance = await provider.getBalance(FLYWHEEL_WALLET);
      const apeBalanceFormatted = parseFloat(formatEther(apeBalance)).toFixed(4);

      // Fetch MNESTR data
      const mnestr = new Contract(MNESTR, ERC20_ABI, provider);
      const [decimals, totalSupply, cap, deadBalance, zeroBalance] = await Promise.all([
        mnestr.decimals(),
        mnestr.totalSupply(),
        mnestr.cap(),
        mnestr.balanceOf(BURN_ADDRESS),
        mnestr.balanceOf(ZERO_ADDRESS)
      ]);

      const totalSupplyFormatted = formatUnits(totalSupply, decimals);
      const capFormatted = formatUnits(cap, decimals);
      
      // Calculate unminted (available to mint)
      const unminted = parseFloat(capFormatted) - parseFloat(totalSupplyFormatted);
      
      // Calculate actually burned (sent to burn addresses)
      const actuallyBurned = parseFloat(formatUnits(deadBalance, decimals)) + parseFloat(formatUnits(zeroBalance, decimals));

      // Get MNESTR price from Camelot (1 MNESTR = ? APE)
      let mnestrPrice = '0.0001';
      let marketCap = '0';
      try {
        const router = new Contract(DEX_ROUTER, ROUTER_ABI, provider);
        const oneToken = BigInt(10 ** Number(decimals)); // 1 MNESTR
        const path = [MNESTR, WAPE];
        const amounts = await router.getAmountsOut(oneToken, path);
        mnestrPrice = parseFloat(formatEther(amounts[1])).toFixed(8);
        marketCap = (parseFloat(totalSupplyFormatted) * parseFloat(mnestrPrice)).toFixed(2);
      } catch (err) {
        app.log.warn('Failed to fetch MNESTR price from DEX:', err);
      }

      // Fetch cheapest NPC from Magic Eden API
      let cheapestNPC = null;
      try {
        const response = await fetch(
          `https://api-mainnet.magiceden.dev/v3/rtp/apechain/tokens/v7?collection=${NPC_COLLECTION}&sortBy=floorAskPrice&limit=1`,
          {
            headers: {
              'accept': '*/*',
              'x-me-origin': 'mineboy'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.tokens && data.tokens.length > 0) {
            const token = data.tokens[0];
            if (token.market?.floorAsk?.price?.amount?.native) {
              cheapestNPC = {
                tokenId: token.token.tokenId,
                price: parseFloat(token.market.floorAsk.price.amount.native).toFixed(4)
              };
            }
          }
        }
      } catch (err) {
        app.log.warn('Failed to fetch cheapest NPC:', err);
      }

      // TODO: Track owned NPCs and sales in database
      // For now, return empty arrays - you can add DB tracking later
      const ownedNPCs: any[] = [];
      const previousSales: any[] = [];

      const stats = {
        apeBalance: apeBalanceFormatted,
        mnestrPrice,
        mnestrMarketCap: marketCap,
        mnestrCap: (parseFloat(capFormatted) / 1000000).toFixed(2) + 'M',
        mnestrSupply: (parseFloat(totalSupplyFormatted) / 1000000).toFixed(2) + 'M',
        mnestrUnminted: (unminted / 1000000).toFixed(2) + 'M',
        mnestrBurned: (actuallyBurned / 1000000).toFixed(2) + 'M',
        cheapestNPC,
        ownedNPCs,
        previousSales
      };

      // Update cache
      cache = {
        lastFetch: now,
        data: stats
      };

      return reply.send(stats);
    } catch (error: any) {
      app.log.error('Failed to fetch flywheel stats:', error);
      return reply.code(500).send({ 
        error: 'Failed to fetch flywheel stats',
        message: error.message 
      });
    }
  });
}
