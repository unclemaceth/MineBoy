// Phase 3 anti-bot backend - force clean rebuild
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { OpenSessionReq, ClaimReq } from '../../shared/src/mining.js';
import { config, ADMIN_TOKEN } from './config.js';
import { cartridgeRegistry } from './registry.js';
import { ownershipVerifier } from './ownership.js';
// import { sessionManager } from './sessions.js'; // Replaced with SessionStore
import { jobManager } from './jobs.js';
import { claimProcessor } from './claims.js';
import { setDifficultyOverride, getDifficultyOverride } from './difficulty.js';
import { canonicalizeCartridge, cartKey, normalizeAddress, sameAddr } from './canonical.js';
// Robust interop-safe import
import * as Mining from '../../shared/src/mining.js';
import * as Rewards from '../../shared/src/rewards.js';

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
import { registerSeasonLeaderboardRoute } from './routes/leaderboardSeasons.js';
import { registerAdminPollerRoute } from './routes/adminPoller.js';
import { mintingService } from './minting.js';
import { registerHealthRoute } from './routes/health.js';
import teamsRoutes from './routes/teams.js';
import adminSeasonsRoutes from './routes/adminSeasons.js';
import statsRoutes from './routes/stats.js';
import flywheelRoutes from './routes/flywheel.js';
import flywheelActionsRoutes from './routes/flywheelActions.js';
import marketRoutes from './routes/market.js';
import { registerMaintenance } from './routes/maintenance.js';
import { registerJobRoutes } from './routes/job.js';
import { registerAdminExportRoute } from './routes/adminExport.js';
import { SessionStore } from './sessionStore.js';
import { safeStringify } from './jsonSafe.js';
import { getRedis } from './redis.js';
import { messageStore } from './messages.js';
import { 
  initPaidMessagesTable, 
  addPaidMessage, 
  getActivePaidMessages,
  removePaidMessage,
  markExpired,
  validateMessage,
  verifyOnChain,
  walletRateLimit,
  getStats as getPaidMessageStats
} from './paidMessages.js';
import { startMessageScheduler, getCurrentlyPlaying } from './messageScheduler.js';

// ---- Job serialization helpers ----
type ApiJob = {
  id: string;            // same as jobId
  jobId: string;
  data: string;          // hex string of the fixed part
  rule: 'suffix' | 'prefix';
  target: string;        // e.g. "000000"
  difficulty: number;    // bits (optional but nice)
  nonceStart?: number;   // default 0 (for UI)
  ttlSec?: number;       // optional
  expiresAt?: number;    // legacy compatibility
  // ANTI-BOT FIELDS
  allowedSuffixes?: string[];
  counterStart?: number;
  counterEnd?: number;
  maxHps?: number;
  issuedAtMs?: number;
};

function hexlifyData(data: any): `0x${string}` {
  if (typeof data === 'string' && data.startsWith('0x')) return data as `0x${string}`;
  if (typeof data === 'string') return (`0x${Buffer.from(data, 'utf8').toString('hex')}`) as `0x${string}`;
  if (data instanceof Uint8Array) return (`0x${Buffer.from(data).toString('hex')}`) as `0x${string}`;
  if (Array.isArray(data)) return (`0x${Buffer.from(Uint8Array.from(data)).toString('hex')}`) as `0x${string}`;
  // fall back if your job uses job.bytes / job.dataHex
  if (data?.bytes) return (`0x${Buffer.from(data.bytes).toString('hex')}`) as `0x${string}`;
  if (data?.dataHex) return data.dataHex as `0x${string}`;
  throw new Error('Unsupported job data type');
}

function serializeJob(job: any | null): ApiJob | null {
  if (!job) return null;
  
  // Ensure data is always present - use nonce for suffix-POW
  let dataHex: string;
  if (job.dataHex) {
    dataHex = job.dataHex;
  } else if (job.nonce) {
    dataHex = hexlifyData(job.nonce);
  } else if (job.data) {
    dataHex = hexlifyData(job.data);
  } else if (job.bytes) {
    dataHex = hexlifyData(job.bytes);
  } else {
    // Fallback - generate some default data
    dataHex = '0x48656c6c6f20576f726c64'; // "Hello World" in hex
  }
  
  return {
    id: job.jobId || job.id,
    jobId: job.jobId || job.id,
    data: dataHex,
    rule: job.rule || 'suffix',
    target: job.suffix || job.target || '000000',
    difficulty: job.difficultyBits || job.difficulty || 6,
    nonceStart: 0,
    ttlSec: job.ttlMs ? Math.ceil(job.ttlMs / 1000) : undefined,
    expiresAt: job.expiresAt,
    // ANTI-BOT: Include new required fields
    allowedSuffixes: job.allowedSuffixes,
    counterStart: job.counterStart,
    counterEnd: job.counterEnd,
    maxHps: job.maxHps,
    issuedAtMs: job.issuedAtMs,
  };
}

// Structured error response helper
function errorResponse(reply: any, status: number, code: string, message: string, details?: any) {
  return reply.code(status).send({ code, message, details });
}

// Debug auth guard (Fastify-compatible)
function requireDebugAuth(req: any, reply: any): boolean {
  const tok = process.env.DEBUG_TOKEN || process.env.ADMIN_TOKEN;
  if (!tok) return true; // no auth required if not configured
  const providedToken = req.headers['x-debug-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (providedToken === tok) return true;
  reply.code(401).send({ code: 'unauthorized', message: 'Missing/invalid debug token' });
  return false;
}

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


// Register CORS
await fastify.register(cors, {
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Debug'],
  exposedHeaders: ['X-Instance', 'X-Lock-Owner', 'X-Lock-Session', 'X-Lease-Id', 'X-Lock-Expires']
});

// Register new routes
await registerMaintenance(fastify);   // <-- register BEFORE other routes
await registerClaimTxRoute(fastify);
await registerLeaderboardRoute(fastify);
await registerSeasonLeaderboardRoute(fastify);
await registerAdminPollerRoute(fastify);
await registerAdminExportRoute(fastify); // Admin snapshot export
await registerHealthRoute(fastify);
await fastify.register(teamsRoutes);
await fastify.register(adminSeasonsRoutes);
await fastify.register(statsRoutes);
await fastify.register(flywheelRoutes);
await fastify.register(flywheelActionsRoutes);
await fastify.register(marketRoutes);
registerJobRoutes(fastify); // ANTI-BOT: Job eligibility endpoint

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
  return {
    cartridges: config.ALLOWED_CARTRIDGES.map((contract, index) => ({
      contract,
      name: `ApeBit Cartridge ${index + 1}`,
      chainId: config.CHAIN_ID
    }))
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


// Open a mining session
fastify.post<{ Body: OpenSessionReq }>('/v2/session/open', async (request, reply) => {
  const body = request.body as any;
  const { sessionId: clientSessionId, wallet, minerId, chainId, contract, tokenId } = body;
  
  if (!clientSessionId || !wallet || !minerId || !chainId || !contract || !tokenId) {
    return errorResponse(reply, 400, 'invalid_request', 'Missing required fields: sessionId, wallet, minerId, chainId, contract, tokenId');
  }

  try {
    const now = Date.now();
    const canonical = canonicalizeCartridge({ chainId, contract, tokenId });
    const w = normalizeAddress(wallet);
    
    console.log('[OPEN] Using new cartridge lock system:', {
      sessionId: clientSessionId,
      wallet: w,
      chainId: canonical.chainId,
      contract: canonical.contract,
      tokenId: canonical.tokenId,
      minerId
    });

    // Verify ownership first
    const owns = await ownershipVerifier.ownsCartridge(w, canonical.contract, canonical.tokenId);
    if (!owns) {
      return errorResponse(reply, 403, 'ownership_required', 'Wallet does not own this cartridge');
    }

    // Check wallet session limit (prevent exploit where user transfers multiple cartridges to one wallet)
    const sessionLimit = await SessionStore.checkWalletSessionLimit(w);
    if (!sessionLimit.allowed) {
      console.warn('[OPEN] Wallet session limit exceeded:', {
        wallet: w,
        activeCount: sessionLimit.activeCount,
        limit: sessionLimit.limit
      });
      return reply.status(429).send({
        code: 'wallet_session_limit',
        message: `Wallet has too many active mining sessions (${sessionLimit.activeCount}/${sessionLimit.limit})`,
        details: {
          activeCount: sessionLimit.activeCount,
          limit: sessionLimit.limit
        }
      });
    }

    // 1) Check existing ownership lock
    const lock = await SessionStore.getOwnershipLock(canonical.chainId, canonical.contract, canonical.tokenId);
    if (lock) {
      if (now >= lock.expiresAt) {
        // expired -> fall through to create fresh lock
        console.log('[OPEN] Existing lock expired, creating new one');
      } else if (!sameAddr(lock.ownerAtAcquire, w)) {
        // locked by someone else -> cooldown
        console.warn('[OPEN] Cartridge locked by another owner:', { 
          lockedBy: lock.ownerAtAcquire, 
          requestedBy: w,
          expiresAt: new Date(lock.expiresAt).toISOString()
        });
        return reply.status(409).send({
          code: 'cartridge_locked',
          message: 'Cartridge is locked by another owner',
          details: {
            cooldownUntil: new Date(lock.expiresAt).toISOString(),
            lockedBy: lock.ownerAtAcquire,
          },
        });
      } else {
        // same owner -> join existing lock; ensure minerId is bound (informational)
        await SessionStore.setOwnershipMinerId(canonical.chainId, canonical.contract, canonical.tokenId, minerId);
        console.log('[OPEN] Joined existing ownership lock, bound minerId');
      }
    }

    // 2) Create ownership lock if none or expired
    let finalLock = lock;
    if (!lock || now >= lock.expiresAt) {
      const payload = {
        ownerAtAcquire: w,
        ownerMinerId: minerId,
        issuedAt: now,
        lastActive: now,
        expiresAt: now + 3_600_000, // 1 hour
        phase: 'active' as const,
      };
      const ok = await SessionStore.createOwnershipLock(canonical.chainId, canonical.contract, canonical.tokenId, payload);
      if (!ok) {
        // race: someone else grabbed it
        const cur = await SessionStore.getOwnershipLock(canonical.chainId, canonical.contract, canonical.tokenId);
        console.warn('[OPEN] Race condition: ownership lock taken by another process');
        return reply.status(409).send({
          code: 'cartridge_locked',
          message: 'Cartridge just became locked',
          details: {
            cooldownUntil: cur?.expiresAt ? new Date(cur.expiresAt).toISOString() : null,
            lockedBy: cur?.ownerAtAcquire ?? null,
          },
        });
      }
      finalLock = payload;
      console.log('[OPEN] Created new ownership lock');
    }

    // 3) Session lock: one active tab/session
    const gotSession = await SessionStore.acquireSessionLock(canonical.chainId, canonical.contract, canonical.tokenId, clientSessionId, w, minerId);
    if (!gotSession) {
      const ttl = await SessionStore.getSessionLockPttlMs(canonical.chainId, canonical.contract, canonical.tokenId);
      const holderMinerId = await SessionStore.getSessionHolderMinerId(canonical.chainId, canonical.contract, canonical.tokenId);
      console.warn('[OPEN] Session lock conflict:', { holderMinerId, ttlSec: Math.max(0, Math.ceil(ttl / 1000)) });
      return reply.status(409).send({
        code: 'session_conflict',
        message: 'Another session is active for this cartridge',
        details: { holderMinerId, ttlSec: Math.max(0, Math.ceil(ttl / 1000)) },
      });
    }

    // 4) Create/refresh short session doc (45s)
    const session = {
      sessionId: clientSessionId,
      wallet: w,
      cartridge: { chainId: canonical.chainId, contract: canonical.contract, tokenId: canonical.tokenId },
      minerId,
      createdAt: now,
      lastActive: now
    };
    await SessionStore.createSession(session);
    await SessionStore.addWalletSession(w, canonical.chainId, canonical.contract, canonical.tokenId, clientSessionId);

    // 5) Issue job + policy + TTLs (with IP address for rate limiting)
    const ipAddress = request.headers['x-forwarded-for'] as string || request.ip;
    const result = await jobManager.createJob(clientSessionId, ipAddress);
    
    if (!result.job) {
      // CRITICAL: Clean up ALL state created before this point
      await SessionStore.releaseSessionLock(canonical.chainId, canonical.contract, canonical.tokenId);
      await SessionStore.deleteSession(clientSessionId);
      await SessionStore.removeWalletSession(w, clientSessionId); // FIX: Remove wallet session tracking
      
      // If rate limited, return specific error
      if (result.error) {
        return errorResponse(reply, 429, 'rate_limit_exceeded', result.error.reason);
      }
      
      return errorResponse(reply, 500, 'internal_error', 'Failed to create job');
    }
    
    const job = result.job;

    console.log('[OPEN] Session created successfully:', { sessionId: clientSessionId, jobId: job.jobId });

    return reply.send({
      sessionId: clientSessionId,
      ownershipTtlSec: Math.ceil((finalLock!.expiresAt - now) / 1000),
      sessionTtlSec: Math.ceil(60_000 / 1000), // 60 seconds
      job: serializeJob(job),
      policy: {
        heartbeatSec: 20,
        cooldownSec: 2
      },
    });
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
  
  // Check cadence eligibility before creating job
  const eligibility = jobManager.canIssueJob(
    session.wallet,
    session.cartridge.contract,
    session.cartridge.tokenId
  );
  
  if (!eligibility.eligible) {
    // Cadence gate - return null job with eligibility info
    console.log(`[GET_NEXT_JOB] Cadence gate for ${session.wallet}:${session.cartridge.tokenId} - wait ${eligibility.waitMs}ms`);
    return reply.send({
      job: null,
      cadence: {
        eligible: false,
        waitMs: eligibility.waitMs,
        message: `Must wait ${Math.ceil(eligibility.waitMs / 1000)}s before next job`
      }
    });
  }
  
  const ipAddress = request.headers['x-forwarded-for'] as string || request.ip;
  const result = await jobManager.createJob(sessionId, ipAddress);
  
  // Handle rate limiting
  if (result.error) {
    console.log(`[GET_NEXT_JOB] Rate limit for ${session.wallet}: ${result.error.reason}`);
    return reply.send({
      job: null,
      rateLimit: {
        limited: true,
        reason: result.error.reason,
        waitMs: result.error.waitMs,
        message: `Rate limit exceeded - wait ${Math.ceil(result.error.waitMs / 1000)}s`
      },
      cadence: { eligible: true, waitMs: 0 }
    });
  }
  
  if (!result.job) {
    return reply.code(500).send({ error: 'Failed to create job' });
  }
  
  return reply.send({ job: serializeJob(result.job), cadence: { eligible: true, waitMs: 0 } });
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
    
    if (!ownershipLock || !sameAddr(ownershipLock.ownerAtAcquire, session.wallet)) {
      console.log(`[CLAIM_DEBUG] Ownership lock lost for ${contract}:${tokenId}`);
      
      reply.header('X-Instance', String(process.env.HOSTNAME || 'unknown'));
      reply.header('X-Lock-Owner', String('none'));
      reply.header('X-Lock-Session', String('none'));
      reply.header('X-Lock-Expires', String('0'));
      
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
      
      reply.header('X-Instance', String(process.env.HOSTNAME || 'unknown'));
      reply.header('X-Lock-Owner', String(session.wallet));
      reply.header('X-Lock-Session', String('none'));
      reply.header('X-Lock-Expires', String('0'));
      
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
      await SessionStore.refreshOwnershipLock(chainId, contract, tokenId, Date.now(), 3_600_000);
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
    reply.header('X-Instance', String(process.env.HOSTNAME || 'unknown'));
    reply.header('X-Lock-Owner', String(minerId));
    reply.header('X-Lock-Session', String(sessionId));
    reply.header('X-Lock-Expires', String(Date.now() + 45000));
    
    return result;
    
  } catch (error: any) {
    fastify.log.error('Error processing claim:', error);
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'Claim processing failed' });
  }
});

// Process claimV2 (tier-based rewards, no rewardAmount in signature)
fastify.post<{ Body: ClaimReq }>('/v2/claim/v2', async (request, reply) => {
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
    console.log(`[CLAIM_V2_DEBUG] Session minerId: ${session.minerId}, Claim minerId: ${minerId}, Lock key: ${chainId}:${contract}:${tokenId}`);
    
    // Validate both locks for claim
    const ownershipLock = await SessionStore.getOwnershipLock(chainId, contract, tokenId);
    const sessionLock = await SessionStore.getSessionLock(chainId, contract, tokenId);
    
    if (!ownershipLock || !sameAddr(ownershipLock.ownerAtAcquire, session.wallet)) {
      console.log(`[CLAIM_V2_DEBUG] Ownership lock lost for ${contract}:${tokenId}`);
      
      return reply.code(409).send({ 
        error: 'ownership_lock_lost',
        details: 'Cartridge ownership changed during mining session'
      });
    }
    
    if (!sessionLock || sessionLock.minerId !== minerId) {
      console.log(`[CLAIM_V2_DEBUG] Session lock lost for ${contract}:${tokenId}`);
      
      return reply.code(409).send({ 
        error: 'session_lock_lost',
        details: 'Another miner is using this cartridge'
      });
    }
    
    // Refresh both locks
    try {
      await SessionStore.refreshOwnershipLock(chainId, contract, tokenId, Date.now(), 3_600_000);
      await SessionStore.refreshSessionLock(chainId, contract, tokenId, sessionId, session.wallet);
    } catch (error) {
      console.error('[CLAIM_V2_DEBUG] Lock refresh failed:', error);
      return reply.code(500).send({ error: 'lock_refresh_failed' });
    }
    
    console.log('[CLAIM_V3_DEBUG] About to call processClaimV3 with:', request.body);
    const result = await claimProcessor.processClaimV3(request.body);
    console.log('[CLAIM_V3_DEBUG] processClaimV3 result:', result);
    if (!result) {
      return reply.code(400).send({ error: 'Failed to process claimV3' });
    }
    
    // Add success headers
    reply.header('X-Instance', String(process.env.HOSTNAME || 'unknown'));
    reply.header('X-Lock-Owner', String(minerId));
    reply.header('X-Lock-Session', String(sessionId));
    reply.header('X-Lock-Expires', String(Date.now() + 45000));
    
    return result;
    
  } catch (error: any) {
    fastify.log.error('Error processing claimV2:', error);
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'ClaimV2 processing failed' });
  }
});

// Close session
fastify.post<{ Body: { sessionId: string } }>('/v2/session/close', async (request, reply) => {
  const { sessionId } = request.body;
  
  // Get session to release lock
  const session = await SessionStore.getSession(sessionId);
  if (session) {
    const { chainId, contract, tokenId } = session.cartridge;
    await SessionStore.releaseSessionLock(chainId, contract, tokenId);
  }
  
  // Delete session
  await SessionStore.deleteSession(sessionId);
  return { ok: true };
});

// Mint cartridge endpoint
fastify.post<{ Body: { wallet: string } }>('/v2/mint', async (request, reply) => {
  try {
    const { wallet } = request.body;
    
    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' });
    }
    
    // Normalize wallet address
    const normalizedWallet = normalizeAddress(wallet);
    
    // Mint the cartridge
    const result = await mintingService.mintCartridge(normalizedWallet);
    
    if (result.success) {
      return {
        success: true,
        txHash: result.txHash,
        message: 'Cartridge minted successfully'
      };
    } else {
      return reply.code(400).send({ 
        error: result.error || 'Minting failed' 
      });
    }
  } catch (error: any) {
    fastify.log.error('Error in mint endpoint:', error);
    return reply.code(500).send({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// Get mint info endpoint
fastify.get('/v2/mint/info', async (request, reply) => {
  try {
    const supplyInfo = await mintingService.getSupplyInfo();
    return {
      totalSupply: supplyInfo.totalSupply,
      maxSupply: supplyInfo.maxSupply,
      remaining: supplyInfo.remaining
    };
  } catch (error: any) {
    fastify.log.error('Error getting mint info:', error);
    return reply.code(500).send({ 
      error: error.message || 'Failed to get mint info' 
    });
  }
});

// Admin endpoints (basic stats)
fastify.get('/admin/stats', async () => {
  return {
    sessions: { active: 'N/A' }, // Redis stats not implemented yet
    claims: claimProcessor.getStats(),
    cartridges: cartridgeRegistry.getAllCartridges().length
  };
});

// Admin endpoint to clear all claims data (for migration to new chain)
fastify.post('/admin/clear-claims', async (request, reply) => {
  try {
    const auth = request.headers.authorization || '';
    if (!ADMIN_TOKEN || auth !== `Bearer ${ADMIN_TOKEN}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { getDB } = await import('./db.js');
    const d = getDB();
    
    // Clear all claims
    const deleteClaims = d.prepare('DELETE FROM claims');
    const claimsDeleted = deleteClaims.run();
    
    // Clear daily stats
    const deleteStats = d.prepare('DELETE FROM daily_stats');
    const statsDeleted = deleteStats.run();
    
    // Reset claim processor stats
    claimProcessor.resetClaims();
    
    return reply.send({
      success: true,
      claimsDeleted: claimsDeleted.changes || 0,
      statsDeleted: statsDeleted.changes || 0,
      message: 'All claims and statistics cleared. Ready for fresh ApeChain data.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error clearing claims:', error);
    return reply.code(500).send({ 
      error: 'Failed to clear claims',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug lock info
fastify.get('/v2/debug/lock', async (request, reply) => {
  const { sessionId, cartridge } = request.query as { sessionId?: string; cartridge?: string };
  
  if (sessionId) {
    const session = await SessionStore.getSession(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }
    
    const { chainId, contract, tokenId } = session.cartridge;
    const ownershipLock = await SessionStore.getOwnershipLock(chainId, contract, tokenId);
    
    return {
      sessionId,
      cartridge: `${contract}:${tokenId}`,
      ownerWallet: ownershipLock?.ownerAtAcquire ?? null,
      sessionWallet: session.wallet,
      match: sameAddr(ownershipLock?.ownerAtAcquire, session.wallet),
      sessionMinerId: session.minerId, // Keep for telemetry
      ttl: ownershipLock ? Math.floor((ownershipLock.lastActive + 3_600_000 - Date.now()) / 1000) : 0
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
  const epochDiff = getDifficultyForEpoch(epoch);
  
  // Get dynamic difficulty based on active miners
  const { getDB } = await import('./db.js');
  const db = getDB();
  const now = Date.now();
  const activeWindowMs = 10 * 60 * 1000; // 10 minutes
  
  const result = await db.pool.query(`
    SELECT COUNT(DISTINCT wallet) AS active_miners
    FROM claims
    WHERE status='confirmed' 
      AND confirmed_at >= $1
  `, [now - activeWindowMs]);
  
  const activeMiners = parseInt(result.rows[0]?.active_miners || '0');
  const dynamicDiff = Rewards.getDifficultyForActiveMiners(activeMiners);
  
  return {
    epoch,
    epochDifficulty: epochDiff,
    activeMiners,
    dynamicDifficulty: dynamicDiff,
    override: getDifficultyOverride()
  };
});

// Heartbeat route to refresh locks (two-tier system)
fastify.post('/v2/session/heartbeat', async (request, reply) => {
  try {
    const { sessionId, minerId, tokenId, chainId, contract, wallet } = request.body as any;
    
    console.log('[HB] Request:', { sessionId, minerId, tokenId, chainId, contract, wallet });
    
    if (!sessionId || !minerId || !tokenId || !chainId || !contract) {
      console.warn('[HB] 400 missing fields:', { 
        sessionId: !!sessionId, 
        minerId: !!minerId, 
        tokenId: !!tokenId, 
        chainId: !!chainId, 
        contract: !!contract 
      });
      return errorResponse(reply, 400, 'invalid_payload', 'sessionId, minerId, tokenId, chainId, and contract required');
    }
    
    // Canonicalize cartridge parameters
    const canonical = canonicalizeCartridge({ chainId, contract, tokenId });
    const cartKeyString = cartKey(canonical);
    
    console.log('[HB] Canonicalized:', { 
      original: { chainId, contract, tokenId },
      canonical,
      cartKey: cartKeyString
    });
    
    const session = await SessionStore.getSession(sessionId);
    if (!session) {
      console.warn('[HB] 404 session not found:', { sessionId });
      return errorResponse(reply, 404, 'session_not_found', 'Session expired - please restart mining');
    }
    
    // Step 1: Validate ownership lock (wallet-only validation)
    const hbOwnershipLock = await SessionStore.getOwnershipLock(canonical.chainId, canonical.contract, canonical.tokenId);
    if (!hbOwnershipLock || !sameAddr(hbOwnershipLock.ownerAtAcquire, session.wallet)) {
      console.warn('[HB] 409 ownership lock lost:', { sessionId, wallet: session.wallet });
      return errorResponse(reply, 409, 'ownership_conflict', 'Ownership lock lost - another wallet may have taken over', { expectedWallet: hbOwnershipLock?.ownerAtAcquire, receivedWallet: session.wallet });
    }
    
    // Step 2: Validate session lock (minerId + sessionId validation for multi-tab prevention)
    const sessionLock = await SessionStore.getSessionLock(canonical.chainId, canonical.contract, canonical.tokenId);
    if (!sessionLock || sessionLock.sessionId !== sessionId || sessionLock.wallet !== session.wallet) {
      console.warn('[HB] 409 session lock lost:', { sessionId, sessionLock });
      return errorResponse(reply, 409, 'session_conflict', 'Session lock lost - another session may be active', { expectedSessionId: sessionLock?.sessionId, receivedSessionId: sessionId });
    }
    
    // Step 3: Check for miner ID mismatch (different tab from same wallet)
    if (session.minerId !== minerId) {
      // Handle legacy miner ID migration
      if (session.minerId === 'legacy-miner' || !session.minerId) {
        console.log('[HB] Migrating legacy miner ID:', { from: session.minerId, to: minerId, sessionId });
        session.minerId = minerId;
        await SessionStore.createSession(session);
      } else {
        console.warn('[HB] 409 session conflict - different tab:', { expect: session.minerId, got: minerId, sessionId });
        return errorResponse(reply, 409, 'session_conflict', 'Different browser tab detected - only one tab can mine this cartridge', { expectedMinerId: session.minerId, receivedMinerId: minerId });
      }
    }
    
    // Ownership lock is wallet-scoped only (no minerId adoption needed)
    
    // Validate session cartridge matches request using canonical keys
    const sessionCartKey = cartKey(session.cartridge);
    console.log('[HB] CartKey comparison:', {
      sessionCartKey,
      requestCartKey: cartKeyString,
      session: session.cartridge,
      request: canonical,
      match: sessionCartKey === cartKeyString
    });
    
    if (sessionCartKey !== cartKeyString) {
      console.warn('[HB] 409 cartridge mismatch:', { 
        sessionCartKey,
        requestCartKey: cartKeyString,
        session: session.cartridge,
        request: canonical
      });
      return errorResponse(reply, 409, 'ownership_conflict', 'Cartridge mismatch', {
        session: session.cartridge,
        request: canonical
      });
    }
    
    // Step 5: Refresh both locks
    try {
      // Refresh ownership lock (update lastActive)
      await SessionStore.refreshOwnershipLock(canonical.chainId, canonical.contract, canonical.tokenId, Date.now(), 3_600_000);
      
      // Refresh session lock (60s TTL)
      const sessionRefreshed = await SessionStore.refreshSessionLock(canonical.chainId, canonical.contract, canonical.tokenId, sessionId, session.wallet);
      if (!sessionRefreshed) {
        console.warn('[HB] 409 session refresh failed:', { sessionId });
        return errorResponse(reply, 409, 'ownership_conflict', 'Session lock refresh failed');
      }
      
      // Refresh session TTL
      await SessionStore.refreshSession(sessionId);
      
    } catch (error) {
      console.error('[HB] Lock refresh error:', error);
      return errorResponse(reply, 500, 'internal_error', 'Lock refresh error');
    }
    
    // Add lock headers for debugging
    reply.header('X-Instance', String(process.env.HOSTNAME || 'unknown'));
    reply.header('X-Lock-Owner', String(session.wallet));
    reply.header('X-Lock-Session', String(sessionId));
    reply.header('X-Lock-Expires', Date.now() + 60000); // 60s from now
    
    console.log('[HB] 200 success:', { sessionId, minerId, wallet: session.wallet });
    return { ok: true };
    
  } catch (error: any) {
    fastify.log.error('Error processing heartbeat:', error);
    return errorResponse(reply, 400, 'internal_error', 'Heartbeat failed', { details: error?.message });
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

// DISABLED: Magic Eden refresh overwrites our bot-created orders
// The bot stores full orders via /market/admin/store-order
// We don't want Magic Eden's incomplete data overwriting them
// import { refreshListingsCache } from './routes/market.js';
// setInterval(() => {
//   refreshListingsCache().catch(err =>
//     console.error('[Market] Refresh failed:', err)
//   );
// }, 30_000); // Every 30 seconds

// Declare stopPoller outside start function for signal handler access
let stopPoller: (() => void) | null = null;

// Start server
const start = async () => {
  try {
    // Initialize database
    await initDb(process.env.DATABASE_URL);
    
    // Run paid messages migration (PostgreSQL only)
    if (process.env.DATABASE_URL?.startsWith('postgresql://')) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const migrationPath = path.join(process.cwd(), 'migrations', '2025-paid-messages.sql');
        if (fs.existsSync(migrationPath)) {
          const migration = fs.readFileSync(migrationPath, 'utf8');
          await pool.query(migration);
          console.log('✅ Paid messages migration applied');
        }
        await pool.end();
      } catch (err) {
        console.error('❌ Paid messages migration failed:', err);
      }
    }
    
    // Initialize paid messages table (creates if not exists)
    await initPaidMessagesTable();
    
    // Start message scheduler (fair queueing system)
    startMessageScheduler();
    
    // Start receipt poller after database is initialized
    stopPoller = startReceiptPoller(process.env.RPC_URL!);
    
    // DISABLED: We don't fetch from Magic Eden anymore
    // The bot creates and stores full orders via /market/admin/store-order
    // console.log('[Market] Initializing listings cache...');
    // await refreshListingsCache().catch(err =>
    //   console.error('[Market] Initial refresh failed:', err)
    // );
    
    await fastify.listen({ 
      port: config.PORT, 
      host: config.HOST 
    });
    
    console.log(`🚀 MineBoy Backend v2 running on ${config.HOST}:${config.PORT}`);
    console.log(`📡 Connected to ${config.CHAIN_ID === 33139 ? 'ApeChain mainnet' : config.CHAIN_ID === 33111 ? 'Curtis testnet' : `Chain ${config.CHAIN_ID}`} (${config.CHAIN_ID})`);
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

// Debug endpoints
fastify.get('/v2/debug/locks', async (req, reply) => {
  try {
    if (!requireDebugAuth(req, reply)) return;

    const { chainId, contract, tokenId, wallet, minerId } = req.query as Record<string, string>;
    if (!chainId || !contract || !tokenId) {
      return reply.code(400).send({ code: 'bad_request', message: 'Missing chainId/contract/tokenId' });
    }

    const canonical = canonicalizeCartridge({ chainId, contract, tokenId });
    const now = Date.now();

    const ownership = await SessionStore.getOwnershipLock(canonical.chainId, canonical.contract, canonical.tokenId);
    const oPttl = await SessionStore.getOwnershipPttlMs(canonical.chainId, canonical.contract, canonical.tokenId);
    const sessionLock = await SessionStore.getSessionLock(canonical.chainId, canonical.contract, canonical.tokenId);
    const sPttl = await SessionStore.getSessionLockPttlMs(canonical.chainId, canonical.contract, canonical.tokenId);

    const resp: any = {
      cart: canonical,
      key: cartKey(canonical),
      now,
      ownership: ownership && {
        ...ownership,
        remainingSec: ownership.expiresAt > now ? Math.ceil((ownership.expiresAt - now) / 1000) : 0,
        pttlMs: oPttl,
        status:
          !ownership
            ? 'missing'
            : ownership.phase === 'cooldown'
            ? 'cooldown'
            : ownership.expiresAt <= now
            ? 'expired'
            : 'active',
      },
      sessionLock: sessionLock && {
        ...sessionLock,
        ttlSec: sPttl > 0 ? Math.ceil(sPttl / 1000) : 0,
        pttlMs: sPttl,
      },
    };

    if (wallet) {
      const w = normalizeAddress(wallet);
      resp.matches = resp.matches || {};
      resp.matches.walletMatchesOwnerAtAcquire = ownership ? sameAddr(ownership.ownerAtAcquire, w) : false;
    }
    if (minerId) {
      resp.matches = resp.matches || {};
      resp.matches.minerMatchesOwnerMinerId = ownership ? ownership.ownerMinerId === minerId : false;
      resp.matches.minerMatchesSessionLock = sessionLock ? sessionLock.minerId === minerId : false;
    }

    return reply.send(resp);
  } catch (e) {
    return reply.code(500).send({ code: 'debug_error', message: 'Failed to inspect locks', details: String(e) });
  }
});

// Audit endpoint to export all claims for transparency
fastify.get('/v2/audit/claims', async (req, reply) => {
  try {
    if (!requireDebugAuth(req, reply)) return;

    const { getDB } = await import('./db.js');
    const d = getDB();
    
    // Get ALL claims (successful, failed, pending, expired)
    const allClaimsStmt = d.prepare(`
      SELECT 
        id,
        wallet,
        cartridge_id,
        hash,
        amount_wei,
        tx_hash,
        status,
        created_at,
        confirmed_at,
        pending_expires_at,
        CASE 
          WHEN status = 'confirmed' THEN 'SUCCESS'
          WHEN status = 'failed' THEN 'FAILED'
          WHEN status = 'expired' THEN 'EXPIRED'
          WHEN status = 'pending' THEN 'PENDING'
          ELSE 'UNKNOWN'
        END as audit_status
      FROM claims
      ORDER BY created_at DESC
    `);
    const allClaims = allClaimsStmt.all();
    
    // Get summary statistics
    const statsStmt = d.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'confirmed' THEN CAST(amount_wei AS INTEGER) ELSE 0 END) as total_rewards_wei
      FROM claims
      GROUP BY status
    `);
    const stats = statsStmt.all();
    
    return reply.send({
      audit: {
        totalClaims: allClaims.length,
        generatedAt: new Date().toISOString(),
        summary: stats,
        allClaims: allClaims
      }
    });
  } catch (e) {
    return reply.code(500).send({ code: 'audit_error', message: 'Failed to generate audit', details: String(e) });
  }
});

// Backfill endpoint to attach transaction hash to pending claims
fastify.post<{ Body: { txHash: string } }>('/v2/admin/attach-tx-by-hash', async (req, reply) => {
  try {
    if (!requireDebugAuth(req, reply)) return;

    const { txHash } = req.body;
    if (!txHash) {
      return reply.code(400).send({ error: 'txHash required' });
    }

    const { getDB } = await import('./db.js');
    const d = getDB();
    
    // Find pending claims that might match this transaction
    // Look for claims created within the last 30 minutes
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const stmt = d.prepare(`
      SELECT id, wallet, created_at, status
      FROM claims
      WHERE created_at >= @thirtyMinutesAgo
      ORDER BY created_at DESC
    `);
    const pendingClaims = await stmt.all({ thirtyMinutesAgo }); // ← await
    
    return reply.send({
      message: 'Found pending claims',
      txHash,
      pendingClaims,
      instructions: 'Use POST /v2/claim/tx with claimId and txHash to backfill'
    });
  } catch (e) {
    return reply.code(500).send({ code: 'backfill_error', message: 'Failed to find pending claims', details: String(e) });
  }
});

// Debug endpoint to inspect claims database
fastify.get('/v2/debug/claims', async (req, reply) => {
  try {
    if (!requireDebugAuth(req, reply)) return;

    const { getDB } = await import('./db.js');
    const d = getDB();
    
    // Get all confirmed claims
    const claimsStmt = d.prepare(`
      SELECT wallet, amount_wei, confirmed_at, cartridge_id, created_at, status
      FROM claims
      WHERE status='confirmed'
      ORDER BY confirmed_at DESC
      LIMIT 20
    `);
    const confirmedClaims = await claimsStmt.all(); // ← await
    
    // Get all pending claims
    const pendingStmt = d.prepare(`
      SELECT wallet, amount_wei, created_at, cartridge_id, status, pending_expires_at, tx_hash
      FROM claims
      WHERE status='pending'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    const pendingClaims = await pendingStmt.all(); // ← await
    
    // Get all claims by status
    const statusStmt = d.prepare(`
      SELECT status, COUNT(*) as count
      FROM claims
      GROUP BY status
    `);
    const statusCounts = await statusStmt.all(); // ← await
    
    // Group confirmed claims by wallet to see duplicates
    const walletGroups = new Map();
    for (const claim of confirmedClaims) {
      const wallet = claim.wallet.toLowerCase();
      if (!walletGroups.has(wallet)) {
        walletGroups.set(wallet, []);
      }
      walletGroups.get(wallet).push(claim);
    }
    
    return reply.send({
      statusCounts,
      confirmedClaims: {
        total: confirmedClaims.length,
        uniqueWallets: walletGroups.size,
        claimsByWallet: Object.fromEntries(walletGroups),
        allClaims: confirmedClaims
      },
      pendingClaims: {
        total: pendingClaims.length,
        allClaims: pendingClaims
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return reply.code(500).send({ code: 'debug_error', message: 'Failed to inspect claims', details: String(e) });
  }
});

fastify.post<{ Body: { chainId: number; contract: string; tokenId: string } }>('/v2/debug/session/unlock', async (req, reply) => {
  try {
    if (!requireDebugAuth(req, reply)) return;

    const { chainId, contract, tokenId } = req.body;
    if (!chainId || !contract || !tokenId) {
      return reply.code(400).send({ code: 'bad_request', message: 'Missing chainId/contract/tokenId' });
    }
    const canonical = canonicalizeCartridge({ chainId, contract, tokenId });

    const prev = await SessionStore.getSessionLock(canonical.chainId, canonical.contract, canonical.tokenId);
    await SessionStore.releaseSessionLock(canonical.chainId, canonical.contract, canonical.tokenId);
    return reply.send({ ok: true, released: !!prev, previous: prev ?? null });
  } catch (e) {
    return reply.code(500).send({ code: 'debug_error', message: 'Failed to unlock session', details: String(e) });
  }
});

// ---- Message Management Routes ----

// Get all messages (public) - combines admin and currently playing paid messages
// Returns structured objects with text, color, prefix for proper banner styling
fastify.get('/v2/messages', async (req, reply) => {
  const adminMessages = await messageStore.getMessages();
  const playingPaidMessages = await getCurrentlyPlaying();
  
  // Format MINEBOY admin messages as structured objects
  const adminMessagesStructured = adminMessages.map(text => ({
    text,
    color: '#ffffff', // white
    prefix: 'MineBoy: ',
    type: 'MINEBOY'
  }));
  
  // Format paid messages with proper metadata
  const paidMessagesStructured = playingPaidMessages.map(m => {
    const prefix = m.message_type === 'PAID' ? 'PAID CONTENT: ' 
                 : m.message_type === 'SHILL' ? 'Shilled Content: '
                 : 'MineBoy: ';
    const color = m.message_type === 'PAID' ? '#4ade80' // green
                : m.message_type === 'SHILL' ? '#ff4444' // red
                : '#ffffff'; // white
    
    return {
      text: m.message,
      color,
      prefix,
      type: m.message_type
    };
  });
  
  // Combine: admin messages first, then paid messages
  const allMessages = [...adminMessagesStructured, ...paidMessagesStructured];
  
  return reply.send({ messages: allMessages });
});

// Get all messages with metadata (admin only)
fastify.get('/v2/admin/messages', async (req, reply) => {
  if (!requireDebugAuth(req, reply)) return;
  const messages = await messageStore.getAllMessages();
  return reply.send({ messages });
});

// Add a new message (admin only)
fastify.post<{ Body: { text: string } }>('/v2/admin/messages', async (req, reply) => {
  if (!requireDebugAuth(req, reply)) return;
  
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return reply.code(400).send({ code: 'bad_request', message: 'Missing or invalid text' });
  }
  
  const id = await messageStore.addMessage(text);
  return reply.send({ ok: true, id });
});

// Remove a message (admin only)
fastify.delete<{ Params: { id: string } }>('/v2/admin/messages/:id', async (req, reply) => {
  if (!requireDebugAuth(req, reply)) return;
  
  const { id } = req.params;
  const removed = await messageStore.removeMessage(id);
  
  if (!removed) {
    return reply.code(404).send({ code: 'not_found', message: 'Message not found' });
  }
  
  return reply.send({ ok: true });
});

// Update a message (admin only)
fastify.put<{ Params: { id: string }; Body: { text: string } }>('/v2/admin/messages/:id', async (req, reply) => {
  if (!requireDebugAuth(req, reply)) return;
  
  const { id } = req.params;
  const { text } = req.body;
  
  if (!text || typeof text !== 'string') {
    return reply.code(400).send({ code: 'bad_request', message: 'Missing or invalid text' });
  }
  
  const updated = messageStore.updateMessage(id, text);
  
  if (!updated) {
    return reply.code(404).send({ code: 'not_found', message: 'Message not found' });
  }
  
  return reply.send({ ok: true });
});

// Clear all messages (admin only)
fastify.delete('/v2/admin/messages', async (req, reply) => {
  if (!requireDebugAuth(req, reply)) return;
  messageStore.clearAll();
  return reply.send({ ok: true });
});

// ---- Paid Message Routes ----

// Submit a paid message (public, requires payment verification)
fastify.post<{ Body: { message: string; txHash: string; wallet: string; messageType?: 'PAID' | 'SHILL' } }>(
  '/v2/messages/paid',
  async (req, reply) => {
    try {
      const { message, txHash, wallet, messageType = 'PAID' } = req.body;
      
      // DEBUG: Check message at server entry
      console.log('[PM:BE] Server received message:', JSON.stringify(message));
      console.log('[PM:BE] Message length:', message?.length);
      console.log('[PM:BE] Contains "d"?', message?.includes('d') || message?.includes('D'));
      
      if (!message || !txHash || !wallet) {
        return reply.code(400).send({ 
          code: 'bad_request', 
          message: 'Missing message, txHash, or wallet' 
        });
      }
      
      // Validate message type
      if (messageType !== 'PAID' && messageType !== 'SHILL') {
        return reply.code(400).send({
          code: 'invalid_message_type',
          message: 'messageType must be PAID or SHILL'
        });
      }
      
      // Validate message content
      const validation = validateMessage(message, messageType);
      if (!validation.ok) {
        return reply.code(400).send({ 
          code: 'invalid_message', 
          message: validation.reason 
        });
      }
      
      // Rate limit per wallet (3 messages per hour)
      const isRateLimited = await walletRateLimit(wallet);
      if (isRateLimited) {
        return reply.code(429).send({
          code: 'rate_limit',
          message: 'Too many messages this hour (limit: 3 per hour)'
        });
      }
      
      // Verify transaction on-chain via router contract
      let verifyResult;
      try {
        verifyResult = await verifyOnChain(txHash as `0x${string}`, wallet, validation.cleaned, messageType);
      } catch (e: any) {
        console.error('[PAID_MESSAGE] Verification failed:', e);
        return reply.code(400).send({
          code: 'verification_failed',
          message: e.message || 'Transaction verification failed'
        });
      }
      
      // All checks passed - add the paid message
      const result = await addPaidMessage({
        wallet,
        message: validation.cleaned,
        txHash: txHash as `0x${string}`,
        amountWei: verifyResult.amountWei,
        messageType,
      });
      
      console.log(`[PAID_MESSAGE] Added ${messageType} message from ${wallet}: "${validation.cleaned}" (tx: ${txHash})`);
      
      return reply.send({ 
        ok: true, 
        messageId: result.id,
        expiresAt: result.expiresAt,
        messageType,
      });
      
    } catch (error: any) {
      console.error('[PAID_MESSAGE] Error:', error);
      return reply.code(500).send({ 
        code: 'internal_error', 
        message: 'Failed to process paid message' 
      });
    }
  }
);

// Get all active paid messages (public)
fastify.get('/v2/messages/paid', async (req, reply) => {
  const messages = await getActivePaidMessages();
  return reply.send({ 
    messages: messages.map(m => ({
      id: m.id,
      message: m.message,
      wallet: m.wallet,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
      messageType: m.messageType,
      color: m.color,
      prefix: m.prefix,
      bannerDurationSec: m.bannerDurationSec,
    }))
  });
});

// Remove a paid message (admin only)
fastify.delete<{ Params: { id: string } }>(
  '/v2/admin/messages/paid/:id',
  async (req, reply) => {
    if (!requireDebugAuth(req, reply)) return;
    
    const { id } = req.params;
    const removed = await removePaidMessage(id);
    
    if (!removed) {
      return reply.code(404).send({ code: 'not_found', message: 'Message not found' });
    }
    
    return reply.send({ ok: true });
  }
);

// Get paid message statistics (admin only)
fastify.get('/v2/admin/messages/paid/stats', async (req, reply) => {
  if (!requireDebugAuth(req, reply)) return;
  return reply.send(getPaidMessageStats());
});

// Post MINEBOY message (admin only)
fastify.post<{ Body: { message: string } }>(
  '/v2/admin/messages/mineboy',
  async (req, reply) => {
    if (!requireDebugAuth(req, reply)) return;
    
    try {
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return reply.code(400).send({
          code: 'bad_request',
          message: 'Message is required'
        });
      }
      
      // Validate message content
      const validation = validateMessage(message, 'MINEBOY');
      if (!validation.ok) {
        return reply.code(400).send({
          code: 'invalid_message',
          message: validation.reason
        });
      }
      
      // Add MINEBOY message directly (no TX required)
      const result = addPaidMessage({
        wallet: 'SYSTEM',
        message: validation.cleaned,
        txHash: `mineboy-${randomUUID()}` as `0x${string}`,
        amountWei: '0',
        messageType: 'MINEBOY',
      });
      
      console.log(`[MINEBOY] Added system message: "${validation.cleaned}"`);
      
      return reply.send({
        ok: true,
        messageId: result.id,
        expiresAt: result.expiresAt,
      });
      
    } catch (error: any) {
      console.error('[MINEBOY] Error:', error);
      return reply.code(500).send({
        code: 'internal_error',
        message: error.message || 'Failed to add system message'
      });
    }
  }
);

// Get queue status (public)
fastify.get<{ Querystring: { wallet?: string } }>(
  '/v2/messages/queue',
  async (req, reply) => {
    try {
      const { wallet } = req.query;
      const db = getDB();
      
      // Total active messages
      const totalActive = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM paid_messages 
        WHERE status = 'active'
      `).get() as { count: number };
      
      // Your position (if wallet provided)
      let yourPosition = null;
      if (wallet) {
        const walletLower = wallet.toLowerCase();
        const result = await db.prepare(`
          SELECT COUNT(*) + 1 as position 
          FROM paid_messages 
          WHERE status = 'active' 
            AND (priority < (SELECT COALESCE(MIN(priority), 999999) FROM paid_messages WHERE wallet = @wallet AND status = 'active')
            OR (priority = (SELECT COALESCE(MIN(priority), 999999) FROM paid_messages WHERE wallet = @wallet AND status = 'active') 
                AND created_at < (SELECT COALESCE(MIN(created_at), 0) FROM paid_messages WHERE wallet = @wallet AND status = 'active')))
        `).get({ wallet: walletLower }) as { position: number };
        
        // Check if wallet has any active messages
        const hasActive = await db.prepare(`
          SELECT 1 FROM paid_messages WHERE wallet = @wallet AND status = 'active' LIMIT 1
        `).get({ wallet: walletLower });
        
        yourPosition = hasActive ? result.position : null;
      }
      
      // Estimate wait time (assuming 10 seconds per message)
      const estimatedWaitMin = Math.ceil(totalActive.count * 10 / 60);
      
      // Backlog status
      let backlog: 'LOW' | 'MEDIUM' | 'HIGH';
      if (totalActive.count > 300) {
        backlog = 'HIGH';
      } else if (totalActive.count > 100) {
        backlog = 'MEDIUM';
      } else {
        backlog = 'LOW';
      }
      
      return reply.send({
        totalActive: totalActive.count,
        yourPosition,
        estimatedWaitMin,
        backlog,
      });
      
    } catch (error: any) {
      console.error('[QUEUE] Error:', error);
      return reply.code(500).send({
        code: 'internal_error',
        message: 'Failed to get queue status'
      });
    }
  }
);

// Cleanup expired messages (runs periodically)
setInterval(async () => {
  const expired = await markExpired();
  if (expired > 0) {
    console.log(`[PAID_MESSAGE] Expired ${expired} old messages`);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (stopPoller) stopPoller();
  await fastify.close();
  process.exit(0);
});

start();