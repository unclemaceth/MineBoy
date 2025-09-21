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
import * as Mining from '../../shared/src/mining.js';

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
  credentials: true,
  exposedHeaders: ['X-Instance', 'X-Lock-Owner', 'X-Lock-Session', 'X-Lease-Id', 'X-Lock-Expires']
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
  
  // Handle both old and new request formats
  let wallet, chainId, contract, tokenId, sessionId, minerId, clientInfo;
  
  if (body.cartridge) {
    // Old format: { wallet, cartridge: { chainId, contract, tokenId }, clientInfo, minerId }
    wallet = body.wallet;
    chainId = body.cartridge.chainId;
    contract = body.cartridge.contract;
    tokenId = body.cartridge.tokenId;
    clientInfo = body.clientInfo;
    minerId = body.minerId;
    sessionId = null; // Will be generated
  } else {
    // New format: { wallet, chainId, contract, tokenId, sessionId }
    wallet = body.wallet;
    chainId = body.chainId;
    contract = body.contract;
    tokenId = body.tokenId;
    sessionId = body.sessionId;
    clientInfo = body.clientInfo || { ua: 'Unknown' };
    minerId = body.minerId || 'legacy-miner'; // Generate if not provided
  }
  
  console.log('[session/open] Request body:', JSON.stringify(body, null, 2));
  
  try {
    // Validate minerId
    if (!minerId || typeof minerId !== 'string') {
      return reply.code(400).send({ error: 'minerId required' });
    }
    
    // Validate cartridge is allowed
    if (!cartridgeRegistry.isAllowed(contract)) {
      return reply.code(400).send({ error: 'Cartridge not allowed' });
    }
    
    // Verify ownership
    const ownsToken = await ownershipVerifier.ownsCartridge(
      wallet, 
      contract, 
      tokenId
    );
    
    if (!ownsToken) {
      return reply.code(403).send({ error: 'Wallet does not own this cartridge token' });
    }
    
    // Two-tier locking system
    // chainId, contract, tokenId are already extracted above
    
    try {
      // Step 0: Check wallet session limit
      const sessionLimit = await SessionStore.checkWalletSessionLimit(wallet);
      if (!sessionLimit.allowed) {
        return reply.code(409).send({ 
          error: 'wallet_session_limit_exceeded',
          message: `You have reached the maximum of ${sessionLimit.limit} concurrent sessions. Close a session to start another.`,
          activeCount: sessionLimit.activeCount,
          limit: sessionLimit.limit
        });
      }
      
      // Step 1: Check/acquire ownership lock (1 hour anti-flip protection)
      const ownershipLock = await SessionStore.getOwnershipLock(chainId, contract, tokenId);
      
      if (ownershipLock && ownershipLock.wallet !== wallet) {
        // Cartridge is owned by different wallet - check TTL
        const lockKey = `mineboy:v2:lock:cartridge:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const ttl = await getRedis()?.pttl(lockKey) ?? 0;
        const remainingMinutes = Math.ceil(ttl / 60000);
        
        return reply.code(409).send({ 
          error: 'cartridge_in_use',
          message: `Cartridge is locked by another wallet. Lock expires in ~${remainingMinutes} minutes.`,
          ttl: ttl,
          remainingMinutes: remainingMinutes
        });
      }
      
      // Acquire ownership lock if not exists or owned by same wallet
      const ownershipAcquired = await SessionStore.acquireOwnershipLock(chainId, contract, tokenId, wallet);
      if (!ownershipAcquired) {
        return reply.code(409).send({ error: 'cartridge_in_use', message: 'Failed to acquire ownership lock' });
      }
      
    } catch (error) {
      console.error('[OPEN] Lock acquisition failed:', error);
      return reply.code(500).send({ error: 'Failed to acquire locks' });
    }
    
    // Create session in Redis (generate sessionId if not provided)
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
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
      return reply.code(500).send({ error: 'Failed to create session' });
    }
    
    // Step 2: Acquire session lock (60 seconds, prevents multi-tab mining)
    try {
      const sessionLock = await SessionStore.getSessionLock(chainId, contract, tokenId);
      
      if (sessionLock) {
        const now = Date.now();
        const timeSinceUpdate = now - sessionLock.updatedAt;
        
        if (timeSinceUpdate < 30000) { // 30 second grace period
          return reply.code(409).send({ 
            error: 'session_still_active',
            message: 'Another session is still active on this cartridge. Please wait ~30 seconds before retrying.',
            sessionId: sessionLock.sessionId,
            timeSinceUpdate: timeSinceUpdate
          });
        }
        
        // Allow same wallet to resume after grace period
        if (sessionLock.wallet !== wallet) {
          return reply.code(409).send({ 
            error: 'active_session_elsewhere',
            message: 'Another wallet has an active session on this cartridge.',
            sessionId: sessionLock.sessionId
          });
        }
      }
      
      // Acquire session lock
      const sessionAcquired = await SessionStore.acquireSessionLock(chainId, contract, tokenId, sessionId, wallet);
      if (!sessionAcquired) {
        console.error('[OPEN] Session lock acquisition failed');
        await SessionStore.deleteSession(sessionId);
        return reply.code(409).send({ error: 'session_lock_failed', message: 'Failed to acquire session lock' });
      }
      
      // Add to wallet session tracking
      await SessionStore.addWalletSession(wallet, chainId, contract, tokenId, sessionId);
      
    } catch (error) {
      console.error('[OPEN] Session lock acquisition failed:', error);
      await SessionStore.deleteSession(sessionId);
      return reply.code(500).send({ error: 'Failed to acquire session lock' });
    }
    
    // Create initial job
    const job = await jobManager.createJob(sessionId);
    if (!job) {
      await SessionStore.releaseSessionLock(chainId, contract, tokenId, sessionId, wallet);
      await SessionStore.deleteSession(sessionId);
      return reply.code(500).send({ error: 'Failed to create job' });
    }
    
    // Store job in session
    await SessionStore.setJob(sessionId, {
      jobId: job.jobId,
      nonce: job.nonce,
      suffix: job.suffix,
      height: 1 // Default height value
    });
    
    console.log(`Created session ${sessionId} for wallet ${wallet} with token ${contract}:${tokenId}`);
    console.log('[OPEN_SESSION] Building response...');
    
    // Build JSON-safe response
    const response = {
      sessionId,
      job: {
        id: job.jobId,
        data: job.nonce,
        nonce: job.nonce, // Add nonce field for debug modal
        target: job.suffix,
        suffix: job.suffix, // Add suffix field for debug modal
        height: 1, // Default height value
        difficulty: 6, // Default difficulty
        expiresAt: job.expiresAt ? Number(job.expiresAt) : undefined,
        ttlMs: job.ttlMs ? Number(job.ttlMs) : undefined,
        epoch: job.epoch ? Number(job.epoch) : undefined,
        rule: job.rule || 'suffix',
        difficultyBits: 6, // Default difficulty bits
        targetBits: undefined // Not available in Job type
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
    
    // Validate both locks for claim
    const ownershipLock = await SessionStore.getOwnershipLock(chainId, contract, tokenId);
    const sessionLock = await SessionStore.getSessionLock(chainId, contract, tokenId);
    
    if (!ownershipLock || ownershipLock.wallet !== session.wallet) {
      console.log(`[CLAIM_DEBUG] Ownership lock lost for ${contract}:${tokenId}`);
      
      reply.header('X-Instance', process.env.HOSTNAME || 'unknown');
      reply.header('X-Lock-Owner', 'none');
      reply.header('X-Lock-Session', 'none');
      reply.header('X-Lock-Expires', '0');
      
      return reply.code(409).send({ 
        error: 'lock_owned_elsewhere',
        message: 'Ownership lock lost - another wallet may have taken over',
        cartridgeId: `${contract}:${tokenId}`,
        sessionId,
        wallet: session.wallet
      });
    }
    
    if (!sessionLock || sessionLock.sessionId !== sessionId || sessionLock.wallet !== session.wallet) {
      console.log(`[CLAIM_DEBUG] Session lock lost for ${contract}:${tokenId}`);
      
      reply.header('X-Instance', process.env.HOSTNAME || 'unknown');
      reply.header('X-Lock-Owner', session.wallet);
      reply.header('X-Lock-Session', 'none');
      reply.header('X-Lock-Expires', '0');
      
      return reply.code(409).send({ 
        error: 'lock_owned_elsewhere',
        message: 'Session lock lost - another session may be active',
        cartridgeId: `${contract}:${tokenId}`,
        sessionId,
        wallet: session.wallet
      });
    }
    
    // Refresh both locks
    try {
      await SessionStore.refreshOwnershipLock(chainId, contract, tokenId, session.wallet);
      await SessionStore.refreshSessionLock(chainId, contract, tokenId, sessionId, session.wallet);
    } catch (error) {
      console.error('[CLAIM_DEBUG] Lock refresh failed:', error);
      return reply.code(500).send({ error: 'lock_refresh_failed' });
    }
    
    const result = await claimProcessor.processClaim(request.body);
    if (!result) {
      return reply.code(400).send({ error: 'Failed to process claim' });
    }
    
    // Add success headers
    reply.header('X-Instance', process.env.HOSTNAME || 'unknown');
    reply.header('X-Lock-Owner', minerId);
    reply.header('X-Lock-Session', sessionId);
    reply.header('X-Lock-Expires', Date.now() + 45000);
    
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

// Debug lock info
fastify.get('/v2/debug/lock', async (request, reply) => {
  const { sessionId, cartridge } = request.query as { sessionId?: string; cartridge?: string };
  
  if (sessionId) {
    const session = await SessionStore.getSession(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }
    
    const { contract, tokenId } = session.cartridge;
    const lockKey = `mineboy:v2:lock:${contract.toLowerCase()}:${tokenId}`;
    const lockOwner = await getRedis()?.get(lockKey);
    
    return {
      sessionId,
      cartridge: `${contract}:${tokenId}`,
      ownerMinerId: lockOwner,
      sessionMinerId: session.minerId,
      match: lockOwner === session.minerId,
      ttl: await getRedis()?.pttl(lockKey)
    };
  }
  
  if (cartridge) {
    const [contract, tokenId] = cartridge.split(':');
    const lockKey = `mineboy:v2:lock:${contract.toLowerCase()}:${tokenId}`;
    const lockOwner = await getRedis()?.get(lockKey);
    
    return {
      cartridge,
      ownerMinerId: lockOwner,
      ttl: await getRedis()?.pttl(lockKey)
    };
  }
  
  return { error: 'Provide sessionId or cartridge parameter' };
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

// Heartbeat route to refresh locks (two-tier system)
fastify.post('/v2/session/heartbeat', async (request, reply) => {
  try {
    const { sessionId, minerId, tokenId, chainId, contract } = request.body as any;
    
    console.log('[HB] Request:', { sessionId, minerId, tokenId, chainId, contract });
    
    if (!sessionId || !minerId || !tokenId || !chainId || !contract) {
      console.warn('[HB] 400 missing fields:', { 
        sessionId: !!sessionId, 
        minerId: !!minerId, 
        tokenId: !!tokenId, 
        chainId: !!chainId, 
        contract: !!contract 
      });
      return reply.code(400).send({ error: 'sessionId, minerId, tokenId, chainId, and contract required' });
    }
    
    const session = await SessionStore.getSession(sessionId);
    if (!session) {
      console.warn('[HB] 410 session expired:', { sessionId });
      return reply.code(410).send({ error: 'lock_expired', message: 'Session expired - please restart mining' });
    }
    
    if (session.minerId !== minerId) {
      console.warn('[HB] 409 minerId mismatch:', { expect: session.minerId, got: minerId, sessionId });
      return reply.code(409).send({ error: 'miner-mismatch', have: session.minerId, got: minerId });
    }
    
    // Validate session cartridge matches request
    const { chainId: sessionChainId, contract: sessionContract, tokenId: sessionTokenId } = session.cartridge;
    if (sessionChainId !== chainId || sessionContract !== contract || sessionTokenId !== tokenId) {
      console.warn('[HB] 409 cartridge mismatch:', { 
        session: `${sessionChainId}:${sessionContract}:${sessionTokenId}`,
        request: `${chainId}:${contract}:${tokenId}`
      });
      return reply.code(409).send({ error: 'cartridge-mismatch' });
    }
    
    // Step 1: Validate ownership lock (must own the cartridge)
    const ownershipLock = await SessionStore.getOwnershipLock(chainId, contract, tokenId);
    if (!ownershipLock || ownershipLock.wallet !== session.wallet) {
      console.warn('[HB] 409 ownership lock lost:', { sessionId, wallet: session.wallet });
      return reply.code(409).send({ error: 'lock_owned_elsewhere', message: 'Ownership lock lost - another wallet may have taken over' });
    }
    
    // Step 2: Validate session lock (must be the active session)
    const sessionLock = await SessionStore.getSessionLock(chainId, contract, tokenId);
    if (!sessionLock || sessionLock.sessionId !== sessionId || sessionLock.wallet !== session.wallet) {
      console.warn('[HB] 409 session lock lost:', { sessionId, sessionLock });
      return reply.code(409).send({ error: 'lock_owned_elsewhere', message: 'Session lock lost - another session may be active' });
    }
    
    // Step 3: Refresh both locks
    try {
      // Refresh ownership lock (update lastActive)
      const ownershipRefreshed = await SessionStore.refreshOwnershipLock(chainId, contract, tokenId, session.wallet);
      if (!ownershipRefreshed) {
        console.warn('[HB] 409 ownership refresh failed:', { sessionId, wallet: session.wallet });
        return reply.code(409).send({ error: 'ownership_refresh_failed' });
      }
      
      // Refresh session lock (60s TTL)
      const sessionRefreshed = await SessionStore.refreshSessionLock(chainId, contract, tokenId, sessionId, session.wallet);
      if (!sessionRefreshed) {
        console.warn('[HB] 409 session refresh failed:', { sessionId });
        return reply.code(409).send({ error: 'session_refresh_failed' });
      }
      
      // Refresh session TTL
      await SessionStore.refreshSession(sessionId);
      
    } catch (error) {
      console.error('[HB] Lock refresh error:', error);
      return reply.code(500).send({ error: 'lock_refresh_error' });
    }
    
    // Add lock headers for debugging
    reply.header('X-Instance', process.env.HOSTNAME || 'unknown');
    reply.header('X-Lock-Owner', session.wallet);
    reply.header('X-Lock-Session', sessionId);
    reply.header('X-Lock-Expires', Date.now() + 60000); // 60s from now
    
    console.log('[HB] 200 success:', { sessionId, minerId, wallet: session.wallet });
    return { ok: true };
    
  } catch (error: any) {
    fastify.log.error('Error processing heartbeat:', error);
    return reply.code(400).send({ error: 'Heartbeat failed' });
  }
});

// Stop mining session - releases session lock but keeps ownership lock
fastify.post('/v2/session/stop', async (request, reply) => {
  try {
    const { sessionId, minerId, tokenId, chainId, contract } = request.body as any;
    
    console.log('[STOP] Request:', { sessionId, minerId, tokenId, chainId, contract });
    
    if (!sessionId || !minerId || !tokenId || !chainId || !contract) {
      console.warn('[STOP] 400 missing fields:', { 
        sessionId: !!sessionId, 
        minerId: !!minerId, 
        tokenId: !!tokenId, 
        chainId: !!chainId, 
        contract: !!contract 
      });
      return reply.code(400).send({ error: 'sessionId, minerId, tokenId, chainId, and contract required' });
    }
    
    const session = await SessionStore.getSession(sessionId);
    if (!session) {
      console.warn('[STOP] 404 session not found:', { sessionId });
      return reply.code(404).send({ error: 'session_not_found' });
    }
    
    if (session.minerId !== minerId) {
      console.warn('[STOP] 409 minerId mismatch:', { expect: session.minerId, got: minerId, sessionId });
      return reply.code(409).send({ error: 'miner-mismatch', have: session.minerId, got: minerId });
    }
    
    // Validate session cartridge matches request
    const { chainId: sessionChainId, contract: sessionContract, tokenId: sessionTokenId } = session.cartridge;
    if (sessionChainId !== chainId || sessionContract !== contract || sessionTokenId !== tokenId) {
      console.warn('[STOP] 409 cartridge mismatch:', { 
        session: `${sessionChainId}:${sessionContract}:${sessionTokenId}`,
        request: `${chainId}:${contract}:${tokenId}`
      });
      return reply.code(409).send({ error: 'cartridge-mismatch' });
    }
    
    // Release session lock (but keep ownership lock for 1-hour cooldown)
    try {
      const sessionReleased = await SessionStore.releaseSessionLock(chainId, contract, tokenId, sessionId, session.wallet);
      if (!sessionReleased) {
        console.warn('[STOP] Session lock release failed:', { sessionId });
        // Don't fail the request - session might have already expired
      }
      
      // Remove from wallet session tracking
      await SessionStore.removeWalletSession(session.wallet, sessionId);
      
      // Delete session
      await SessionStore.deleteSession(sessionId);
      
      console.log('[STOP] 200 success:', { sessionId, minerId, wallet: session.wallet });
      return { 
        ok: true, 
        message: 'Mining session stopped. Ownership lock remains for 1 hour cooldown.',
        ownershipLockTtl: 3600 // 1 hour in seconds
      };
      
    } catch (error) {
      console.error('[STOP] Error releasing locks:', error);
      return reply.code(500).send({ error: 'failed_to_stop_session' });
    }
    
  } catch (error: any) {
    fastify.log.error('Error stopping mining session:', error);
    return reply.code(400).send({ error: 'Stop session failed' });
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