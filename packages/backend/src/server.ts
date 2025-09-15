import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { OpenSessionReq, ClaimReq } from '../../shared/src/mining.ts';
import { config } from './config.js';
import { cartridgeRegistry } from './registry.js';
import { ownershipVerifier } from './ownership.js';
import { sessionManager } from './sessions.js';
import { jobManager } from './jobs.js';
import { claimProcessor } from './claims.js';

const fastify = Fastify({ 
  logger: true,
  disableRequestLogging: false
});

// Register CORS
await fastify.register(cors, {
  origin: true, // Allow all origins for development
  credentials: true
});

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
  const { wallet, cartridge, clientInfo } = request.body;
  
  try {
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
    
    // Create session
    const session = sessionManager.createSession(request.body);
    
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
      },
      claim: cartridgeConfig.claim
    };
    
  } catch (error) {
    fastify.log.error('Error opening session:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

// Session heartbeat
fastify.post<{ Body: { sessionId: string } }>('/v2/session/heartbeat', async (request, reply) => {
  const { sessionId } = request.body;
  
  if (!sessionManager.isValidSession(sessionId)) {
    return reply.code(404).send({ error: 'Session not found or expired' });
  }
  
  const success = sessionManager.heartbeat(sessionId);
  if (!success) {
    return reply.code(404).send({ error: 'Session not found' });
  }
  
  return { ok: true };
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
    const result = await claimProcessor.processClaim(request.body);
    if (!result) {
      return reply.code(400).send({ error: 'Failed to process claim' });
    }
    
    return result;
    
  } catch (error) {
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
    
    console.log(`🚀 MinerBoy Backend v2 running on ${config.HOST}:${config.PORT}`);
    console.log(`📡 Connected to Curtis testnet (${config.CHAIN_ID})`);
    console.log(`🎮 ${config.ALLOWED_CARTRIDGES.length} cartridges configured`);
    console.log(`💰 Initial reward: ${config.INITIAL_REWARD_WEI} wei (${config.INITIAL_REWARD_WEI.slice(0, 3)} ABIT)`);
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();