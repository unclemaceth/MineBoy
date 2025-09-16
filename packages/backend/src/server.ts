import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { OpenSessionReq, ClaimReq } from '../../shared/src/mining.js';
import { config, ADMIN_TOKEN } from './config.js';
import { cartridgeRegistry } from './registry.js';
import { ownershipVerifier } from './ownership.js';
// import { sessionManager } from './sessions.js'; // Replaced with SessionStore
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
import { SessionStore } from './sessionStore.js';
import { safeStringify } from './jsonSafe.js';
import { getRedis } from './redis.js';

const fastify = Fastify({ 
  logger: true,
  disableRequestLogging: false
});

// Global error handler to catch BigInt serialization errors
fastify.setErrorHandler((err, req, reply) => {
  console.error('[GLOBAL_ERROR]', err);
  fastify.log.error({ err, url: req.url, body: req.body }, '[GLOBAL_ERROR]');
  reply.code(500).send({ error: 'internal-error', message: err.message });
});

// Global onSend hook to safely serialize ALL responses
fastify.addHook('onSend', (req, reply, payload, done) => {
  try {
    // If a string/buffer is already being sent, leave it
    if (typeof payload === 'string' || Buffer.isBuffer(payload)) return done();
    
    // If it's an object, stringify with our safe replacer
    if (payload && typeof payload === 'object') {
      reply.header('content-type', 'application/json; charset=utf-8');
      return done(null, safeStringify(payload));
    }
    
    return done();
  } catch (err) {
    console.error('[onSend] serialization failed:', err);
    req.log.error({ err, url: req.url }, '[onSend] serialization failed');
    return done(err as any);
  }
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

// Test endpoint to verify BigInt serialization works
fastify.get('/test-bigint', async () => {
  return {
    test: 'bigint serialization',
    bigint: BigInt(123456789),
    number: 42,
    string: 'hello'
  };
});

// Admin endpoint to clear all locks (for testing)
fastify.post('/admin/clear-locks', async (request, reply) => {
  const auth = request.headers.authorization || '';
  if (!ADMIN_TOKEN || auth !== `Bearer ${ADMIN_TOKEN}`) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  
  try {
    // Clear all lock keys from Redis
    const redis = getRedis();
    if (redis) {
      const keys = await redis.keys('mineboy:v2:lock:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Cleared ${keys.length} lock keys`);
      }
    }
    return { ok: true, message: 'All locks cleared' };
  } catch (error) {
    console.error('Error clearing locks:', error);
    return reply.code(500).send({ error: 'Failed to clear locks' });
  }
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
    
    // Acquire lock for this cartridge using Redis
    const { chainId, contract, tokenId } = cartridge;
    
    try {
      const lockAcquired = await SessionStore.acquireLock(contract, tokenId, minerId);
      if (!lockAcquired) {
        return reply.code(409).send({ error: 'Cartridge is locked by another miner' });
      }
    } catch (error) {
      console.error('[OPEN] Lock acquisition failed:', error);
      return reply.code(500).send({ error: 'Failed to acquire cartridge lock' });
    }
    
    // Create session in Redis
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const session = {
      sessionId,
      minerId,
      wallet,
      cartridge: { chainId, contract, tokenId },
      createdAt: Date.now()
    };
    
    try {
      await SessionStore.createSession(session);
    } catch (error) {
      console.error('[OPEN] Session creation failed:', error);
      await SessionStore.releaseLock(contract, tokenId, minerId);
      return reply.code(500).send({ error: 'Failed to create session' });
    }
    
    // Create initial job
    const job = await jobManager.createJob(sessionId);
    if (!job) {
      await SessionStore.releaseLock(contract, tokenId, minerId);
      await SessionStore.deleteSession(sessionId);
      return reply.code(500).send({ error: 'Failed to create job' });
    }
    
    // Store job in session
    await SessionStore.setJob(sessionId, {
      jobId: job.jobId,
      nonce: job.nonce,
      suffix: job.suffix,
      height: job.height
    });
    
    console.log(`Created session ${sessionId} for wallet ${wallet} with token ${contract}:${tokenId}`);
    console.log('[OPEN_SESSION] Building response...');
    
    // Build JSON-safe response
    const response = {
      sessionId,
      job: {
        id: job.jobId,
        data: job.nonce,
        target: job.suffix,
        height: job.height ? Number(job.height) : 0, // Never undefined
        difficulty: job.difficultyBits ? Number(job.difficultyBits) : 6
      },
      policy: {
        heartbeatSec: 20,
        cooldownSec: 2
      }
    };
    
    // Send response - global onSend hook will handle safe serialization
    console.log('[OPEN_SESSION] Sending response...');
    return reply.send(response);
    
  } catch (error: any) {
    console.error('[OPEN_SESSION] failed:', error);
    fastify.log.error({ err: error, body: request.body }, '[OPEN_SESSION] failed');
    return reply.code(500).send({ error: 'Internal server error', details: error?.message });
  }
});


// Get next job for session
fastify.get<{ Querystring: { sessionId: string } }>('/v2/job/next', async (request, reply) => {
  const { sessionId } = request.query;
  
  const session = await SessionStore.getSession(sessionId);
  if (!session) {
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
    const session = await SessionStore.getSession(sessionId);
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
  
  // Get session to release lock
  const session = await SessionStore.getSession(sessionId);
  if (session) {
    const { contract, tokenId } = session.cartridge;
    await SessionStore.releaseLock(contract, tokenId, session.minerId);
  }
  
  // Delete session
  await SessionStore.deleteSession(sessionId);
  return { ok: true };
});

// Admin endpoints (basic stats)
fastify.get('/admin/stats', async () => {
  return {
    sessions: { active: 'N/A' }, // Redis stats not implemented yet
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
    
    console.log('[HB] Request:', { sessionId, minerId });
    
    if (!sessionId || !minerId) {
      console.warn('[HB] 400 missing fields:', { sessionId: !!sessionId, minerId: !!minerId });
      return reply.code(400).send({ error: 'sessionId and minerId required' });
    }
    
    const session = await SessionStore.getSession(sessionId);
    if (!session) {
      console.warn('[HB] 404 no session:', { sessionId });
      return reply.code(409).send({ error: 'session-missing', sessionId });
    }
    
    if (session.minerId !== minerId) {
      console.warn('[HB] 409 minerId mismatch:', { expect: session.minerId, got: minerId, sessionId });
      return reply.code(409).send({ error: 'miner-mismatch', have: session.minerId, got: minerId });
    }
    
    // Refresh session TTL
    await SessionStore.refreshSession(sessionId);
    
    // Refresh cartridge lock
    const { contract, tokenId } = session.cartridge;
    const lockRefreshed = await SessionStore.refreshLock(contract, tokenId, minerId);
    if (!lockRefreshed) {
      console.warn('[HB] 409 lock refresh failed:', { sessionId, minerId, contract, tokenId });
      return reply.code(409).send({ error: 'lock-missing', sessionId, contract, tokenId });
    }
    
    console.log('[HB] 200 success:', { sessionId, minerId });
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
    console.log(`[SessionStore] using ${SessionStore.kind}`);
    
    // Test Redis connection
    if (SessionStore.kind === 'redis') {
      try {
        const testKey = 'test:connection';
        await SessionStore.acquireLock('test', 'test', 'test');
        console.log('[Redis] Connection test successful');
      } catch (error) {
        console.error('[Redis] Connection test failed:', error);
      }
    }
    
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