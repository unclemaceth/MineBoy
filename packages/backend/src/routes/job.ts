import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jobManager } from '../jobs.js';
import { SessionStore } from '../sessionStore.js';
import { normalizeAddress } from '../canonical.js';

/**
 * Eligibility check endpoint
 * Returns whether a cartridge is eligible for a new job (cadence gating)
 */
export function registerJobRoutes(fastify: FastifyInstance) {
  /**
   * GET /v2/job/eligibility
   * Check if cartridge is eligible for next job
   * 
   * Query params:
   * - sessionId: current session ID
   * 
   * Returns:
   * - eligible: boolean
   * - waitMs: milliseconds until eligible (0 if eligible now)
   * - message: human-readable message
   */
  fastify.get('/v2/job/eligibility', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { sessionId?: string };
    
    if (!query.sessionId) {
      return reply.code(400).send({
        code: 'invalid_request',
        message: 'Missing required query parameter: sessionId'
      });
    }
    
    try {
      // Get session to extract cartridge info
      const session = await SessionStore.getSession(query.sessionId);
      if (!session) {
        return reply.code(404).send({
          code: 'session_not_found',
          message: 'Session not found or expired'
        });
      }
      
      // Check eligibility using jobManager
      const eligibility = jobManager.canIssueJob(
        normalizeAddress(session.wallet),
        session.cartridge.contract,
        session.cartridge.tokenId
      );
      
      // Return eligibility status
      return reply.send({
        eligible: eligibility.eligible,
        waitMs: eligibility.waitMs,
        message: eligibility.eligible 
          ? 'Ready for next job' 
          : `Must wait ${Math.ceil(eligibility.waitMs / 1000)}s before next job`
      });
    } catch (error) {
      console.error('[ELIGIBILITY] Error checking eligibility:', error);
      return reply.code(500).send({
        code: 'internal_error',
        message: 'Failed to check eligibility'
      });
    }
  });
}

