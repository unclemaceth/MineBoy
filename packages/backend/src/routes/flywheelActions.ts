import { FastifyInstance } from 'fastify';
import { spawn } from 'child_process';
import path from 'path';

// Only allow admin to trigger listing actions
function requireAdmin(req: any, reply: any) {
  const token = req.headers['x-admin-token'] || req.headers['authorization'] || '';
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
  
  if (!token || !token.includes(ADMIN_TOKEN)) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
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
        app.log.info(`[Flywheel] Triggering listing for NPC #${tokenId}...`);
        
        // Path to flywheel bot
        const botDir = path.join(process.cwd(), '..', 'flywheel-bot');
        
        // Run the listing script
        const child = spawn('npm', ['run', 'list-owned'], {
          cwd: botDir,
          env: {
            ...process.env,
            OWNED_TOKEN_IDS: tokenId // Override to only list this one
          }
        });
        
        let output = '';
        let errorOutput = '';
        
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        // Wait for completion (with timeout)
        const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
          const timeout = setTimeout(() => {
            child.kill();
            resolve({ success: false, output: 'Timeout after 30 seconds' });
          }, 30000);
          
          child.on('close', (code) => {
            clearTimeout(timeout);
            resolve({
              success: code === 0,
              output: output + errorOutput
            });
          });
        });
        
        if (result.success) {
          app.log.info(`[Flywheel] Successfully listed NPC #${tokenId}`);
          return reply.send({
            ok: true,
            tokenId,
            message: `NPC #${tokenId} listed successfully`
          });
        } else {
          app.log.error(`[Flywheel] Failed to list NPC #${tokenId}: ${result.output}`);
          return reply.code(500).send({
            error: 'Listing failed',
            message: result.output
          });
        }
        
      } catch (error: any) {
        app.log.error('[Flywheel] Error triggering listing:', error);
        return reply.code(500).send({
          error: 'Failed to trigger listing',
          message: error.message
        });
      }
    }
  );
}
