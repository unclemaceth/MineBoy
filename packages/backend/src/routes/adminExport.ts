import { FastifyInstance } from 'fastify';
import { getDB } from '../db.js';

function toAbitString(totalWei: string, decimals = 18) {
  const wei = BigInt(totalWei);
  const divisor = BigInt(10 ** decimals);
  const abit = wei / divisor;
  return abit.toString();
}

export async function registerAdminExportRoute(fastify: FastifyInstance) {
  // Export all wallets and their points as CSV
  fastify.get('/v2/admin/export/snapshot', async (req, reply) => {
    const adminToken = process.env.ADMIN_TOKEN;
    const authHeader = req.headers['x-admin-token'] || req.headers['authorization'];
    
    if (!adminToken || !authHeader?.includes(adminToken)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const db = getDB();
      
      // Get all confirmed claims grouped by wallet
      const result = await db.pool.query(`
        SELECT wallet, amount_wei, confirmed_at, cartridge_id
        FROM claims
        WHERE status='confirmed'
        ORDER BY wallet, confirmed_at
      `);
      
      const claims = result.rows as Array<{
        wallet: string;
        amount_wei: string;
        confirmed_at: number;
        cartridge_id: number;
      }>;
      
      // Group by wallet
      const walletTotals = new Map<string, {
        total_wei: bigint;
        claims: number;
        cartridges: Set<number>;
        first_claim_at: number;
        last_claim_at: number;
      }>();
      
      for (const claim of claims) {
        const walletKey = claim.wallet.toLowerCase();
        const existing = walletTotals.get(walletKey) || {
          total_wei: 0n,
          claims: 0,
          cartridges: new Set<number>(),
          first_claim_at: claim.confirmed_at,
          last_claim_at: 0,
        };
        
        existing.total_wei += BigInt(claim.amount_wei);
        existing.claims += 1;
        existing.cartridges.add(claim.cartridge_id);
        existing.first_claim_at = Math.min(existing.first_claim_at, claim.confirmed_at);
        existing.last_claim_at = Math.max(existing.last_claim_at, claim.confirmed_at);
        
        walletTotals.set(walletKey, existing);
      }
      
      // Convert to array and sort by total descending
      const results = Array.from(walletTotals.entries())
        .map(([wallet, data]) => ({
          wallet,
          total_wei: data.total_wei.toString(),
          total_abit: toAbitString(data.total_wei.toString()),
          claims: data.claims,
          cartridges: data.cartridges.size,
          first_claim_at: new Date(data.first_claim_at).toISOString(),
          last_claim_at: new Date(data.last_claim_at).toISOString(),
        }))
        .sort((a, b) => {
          const aWei = BigInt(a.total_wei);
          const bWei = BigInt(b.total_wei);
          if (aWei > bWei) return -1;
          if (aWei < bWei) return 1;
          return 0;
        });
      
      // Format as CSV
      const format = (req.query as any)?.format || 'json';
      
      if (format === 'csv') {
        const csvLines = [
          'wallet,total_abit,total_wei,claims,cartridges,first_claim_at,last_claim_at',
          ...results.map(r => 
            `${r.wallet},${r.total_abit},${r.total_wei},${r.claims},${r.cartridges},${r.first_claim_at},${r.last_claim_at}`
          )
        ];
        
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="snapshot-${Date.now()}.csv"`);
        return reply.send(csvLines.join('\n'));
      }
      
      // Return JSON by default
      return reply.send({
        ok: true,
        timestamp: new Date().toISOString(),
        total_wallets: results.length,
        total_claims: results.reduce((sum, r) => sum + r.claims, 0),
        total_abit: results.reduce((sum, r) => sum + BigInt(r.total_wei), 0n).toString(),
        wallets: results,
      });
      
    } catch (error) {
      console.error('❌ Export error:', error);
      return reply.code(500).send({ 
        error: 'Failed to export snapshot', 
        details: String(error) 
      });
    }
  });
}

