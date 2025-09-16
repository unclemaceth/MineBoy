import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { OpenSessionReq, ClaimReq } from '../../shared/src/mining.js';
import { config, ADMIN_TOKEN } from './config.js';
import { cartridgeRegistry } from './registry.js';
import { ownershipVerifier } from './ownership.js';
import { sessionManager } from './sessions.js';
import { jobManager } from './jobs.js';
import { claimProcessor } from './claims.js';
import { setDifficultyOverride, getDifficultyOverride } from './difficulty.js';
// Robust interop-safe import
import * as Mining from '../../shared/src/mining';

const getDifficultyForEpoch =
  (Mining as any).getDifficultyForEpoch ??
  (Mining as any).default?.getDifficultyForEpoch;

if (typeof getDifficultyForEpoch !== 'function') {
  throw new Error('shared/mining is missing getDifficultyForEpoch');
}
import { locks } from './locks.js';
import { initDb } from './db.js';
import { startReceiptPoller } from './chain/receiptPoller.js';
import { registerClaimTxRoute } from './routes/claimTx.js';
import { registerLeaderboardRoute } from './routes/leaderboard.js';

const fastify = Fastify({ 
  logger: true,
  disableRequestLogging: false
});

// Initialize database
initDb(process.env.DATABASE_URL);

// Start receipt poller
const stopPoller = startReceiptPoller(process.env.RPC_URL!);

// Register CORS
await fastify.register(cors, {
  origin: true, // Allow all origins for development
  credentials: true
});

// Register new routes
await registerClaimTxRoute(fastify);
await registerLeaderboardRoute(fastify);

// Health check
fastify.get('/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    config: {
      chainId: config.CHAIN_ID,
      allowedCartridges: config.ALLOWED_CARTRIDGES.length
    }
  };
});

// Get available cartridges
fastify.get('/v2/cartridges', async () => {
  return cartridgeRegistry.getAllCartridges();
});

// Open a mining session
fastify.post<{ Body: OpenSessionReq }>('/v2/session/open', async (request, reply) => {
  const body = request.body as any;
  const { wallet, cartridge, clientInfo, minerId } = body;
  
  console.log('[session/open] Request body:', JSON.stringify(body, null, 2));
  
  try {
    // Validate minerId
    if (!minerId || typeof minerId !== 'string') {
      return reply.code(400).send({ error: 'minerId required' });
    }
    
    // Validate cartridge is allowed
    if (!cartridgeRegistry.isAllowed(cartridge.contract)) {
      return reply.code(400).send({ error: 'Cartridge not allowed' });
    }
    
    // Verify ownership
    const ownsToken = await ownershipVerifier.ownsCartridge(
      wallet, 
      cartridge.contract, 
      cartridge.tokenId
    );
    
    if (!ownsToken) {
      return reply.code(403).send({ error: 'Wallet does not own this cartridge token' });
    }
    
    // Acquire lock for this cartridge
    const { chainId, contract, tokenId } = cartridge;
    const lockResult = locks.acquire(chainId, contract, tokenId, minerId);
    if (!lockResult.ok) {
      return reply.code(409).send({ error: lockResult.reason });
    }
    
    // Create session
    const session = sessionManager.createSession(request.body as OpenSessionReq);
    
    // Create initial job
    const job = await jobManager.createJob(session.sessionId);
    if (!job) {
      return reply.code(500).send({ error: 'Failed to create job' });
    }
    
    // Get cartridge config for claim info
    const cartridgeConfig = cartridgeRegistry.getCartridge(cartridge.contract);
    if (!cartridgeConfig) {
      return reply.code(500).send({ error: 'Cartridge config not found' });
    }
    
    return {
      sessionId: session.sessionId,
      job,
      policy: {
        heartbeatSec: 20,
        cooldownSec: 2
      }
    };
    
  } catch (error: any) {
    fastify.log.error({ err: error, body: request.body }, '[OPEN_SESSION] failed');
    return reply.code(400).send({ error: error?.message ?? 'Open session failed' });
  }
});


// Get next job for session
fastify.get<{ Querystring: { sessionId: string } }>('/v2/job/next', async (request, reply) => {
  const { sessionId } = request.query;
  
  if (!sessionManager.isValidSession(sessionId)) {
    return reply.code(404).send({ error: 'Session not found or expired' });
  }
  
  const job = await jobManager.createJob(sessionId);
  if (!job) {
    return reply.code(500).send({ error: 'Failed to create job' });
  }
  
  return job;
});

// Process claim
fastify.post<{ Body: ClaimReq }>('/v2/claim', async (request, reply) => {
  try {
    const { sessionId, minerId } = request.body as any;
    
    // Validate minerId
    if (!minerId) {
      return reply.code(400).send({ error: 'minerId required' });
    }
    
    // Check session and refresh lock
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    
    const { chainId, contract, tokenId } = session.cartridge;
    console.log(`[CLAIM_DEBUG] Session minerId: ${session.minerId}, Claim minerId: ${minerId}, Lock key: ${chainId}:${contract}:${tokenId}`);
    
    const lockOk = locks.refresh(chainId, contract, tokenId, minerId);
    if (!lockOk) {
      console.log(`[CLAIM_DEBUG] Lock refresh failed for ${chainId}:${contract}:${tokenId} with minerId ${minerId}`);
      return reply.code(409).send({ error: 'Cartridge lock lost or held by another miner' });
    }
    
    const result = await claimProcessor.processClaim(request.body);
    if (!result) {
      return reply.code(400).send({ error: 'Failed to process claim' });
    }
    
    return result;
    
  } catch (error: any) {
    fastify.log.error('Error processing claim:', error);
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'Claim processing failed' });
  }
});

// Close session
fastify.post<{ Body: { sessionId: string } }>('/v2/session/close', async (request, reply) => {
  const { sessionId } = request.body;
  
  const success = sessionManager.closeSession(sessionId);
  return { ok: success };
});

// Admin endpoints (basic stats)
fastify.get('/admin/stats', async () => {
  return {
    sessions: sessionManager.getStats(),
    claims: claimProcessor.getStats(),
    cartridges: cartridgeRegistry.getAllCartridges().length
  };
});

// Get current difficulty info
fastify.get('/v2/difficulty', async () => {
  const epoch = await jobManager.getCurrentEpoch();
  const diff = getDifficultyForEpoch(epoch);
  return {
    epoch,
    difficulty: diff,
    override: getDifficultyOverride()
  };
});

// Heartbeat route to refresh lock
fastify.post('/v2/session/heartbeat', async (request, reply) => {
  try {
    const { sessionId, minerId } = request.body as any;
    
    if (!sessionId || !minerId) {
      return reply.code(400).send({ error: 'sessionId and minerId required' });
    }
    
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    
    if (session.minerId !== minerId) {
      return reply.code(409).send({ error: 'MinerId mismatch' });
    }
    
    const { chainId, contract, tokenId } = session.cartridge;
    const lockOk = locks.refresh(chainId, contract, tokenId, minerId);
    if (!lockOk) {
      return reply.code(409).send({ error: 'Cartridge lock lost' });
    }
    
    sessionManager.updateHeartbeat(sessionId);
    return { ok: true };
    
  } catch (error: any) {
    fastify.log.error('Error processing heartbeat:', error);
    return reply.code(400).send({ error: 'Heartbeat failed' });
  }
});

// Admin route to change difficulty at runtime
fastify.post('/v2/admin/difficulty', async (request, reply) => {
  const auth = request.headers.authorization || '';
  if (!ADMIN_TOKEN || auth !== `Bearer ${ADMIN_TOKEN}`) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const body = request.body as any;
  if (body && Object.keys(body).length) {
    const allowed = ['rule','suffix','bits','ttlMs'];
    const o: any = {};
    for (const k of allowed) if (k in body) o[k] = body[k];
    setDifficultyOverride(o);
  } else {
    setDifficultyOverride(null);
  }
  return { ok: true, override: getDifficultyOverride() };
});

// Cleanup expired jobs periodically
setInterval(() => {
  jobManager.cleanupExpiredJobs();
}, 60000); // Every minute

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: config.PORT, 
      host: config.HOST 
    });
    
    console.log(`🚀 MineBoy Backend v2 running on ${config.HOST}:${config.PORT}`);
    console.log(`📡 Connected to Curtis testnet (${config.CHAIN_ID})`);
    console.log(`🎮 ${config.ALLOWED_CARTRIDGES.length} cartridges configured`);
    console.log(`💰 Initial reward: ${config.INITIAL_REWARD_WEI} wei (${config.INITIAL_REWARD_WEI.slice(0, 3)} ABIT)`);
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  stopPoller();
  await fastify.close();
  process.exit(0);
});

start();