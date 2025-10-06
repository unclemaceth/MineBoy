/**
 * Treasury Webhook Server
 * 
 * Listens for NPC sale notifications and triggers the burn sequence
 */

import http from 'http';
import { executeBurn } from './burn.js';

const PORT = Number(process.env.WEBHOOK_PORT || 3001);

interface WebhookPayload {
  event: string;
  tokenId: string;
  buyer: string;
  txHash: string;
}

let burnInProgress = false;

/**
 * Start the webhook server
 */
export function startWebhookServer() {
  const server = http.createServer(async (req, res) => {
    // Only accept POST requests to /webhook
    if (req.method !== 'POST' || req.url !== '/webhook') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    // Parse request body
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const payload: WebhookPayload = JSON.parse(body);

        if (payload.event !== 'npc-sold') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid event type' }));
          return;
        }

        console.log(`\n[Webhook] Received NPC sale notification:`);
        console.log(`  Token: #${payload.tokenId}`);
        console.log(`  Buyer: ${payload.buyer}`);
        console.log(`  Tx: ${payload.txHash}`);

        // Prevent concurrent burns
        if (burnInProgress) {
          console.log(`[Webhook] Burn already in progress, skipping...`);
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, message: 'Burn already in progress' }));
          return;
        }

        // Acknowledge the webhook immediately
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'Burn triggered' }));

        // Execute burn in background
        burnInProgress = true;
        try {
          const result = await executeBurn();
          console.log(`\n[Webhook] ✅ Burn completed successfully!`);
          console.log(`  APE received: ${result.apeReceived}`);
          console.log(`  APE swapped: ${result.apeForSwap}`);
          console.log(`  APE for gas: ${result.apeForGas}`);
          console.log(`  MNESTR burned: ${result.mnestrBurned} 🔥`);
          console.log(`  Tx: ${result.txHash}\n`);
        } catch (error: any) {
          console.error(`[Webhook] ❌ Burn failed: ${error.message}`);
        } finally {
          burnInProgress = false;
        }
      } catch (error: any) {
        console.error(`[Webhook] Error processing webhook: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`\n[Webhook] Treasury webhook server listening on port ${PORT}`);
    console.log(`[Webhook] Endpoint: http://localhost:${PORT}/webhook\n`);
  });

  return server;
}
