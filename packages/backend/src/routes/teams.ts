import { FastifyInstance } from 'fastify';
import { getDB } from '../db.js';
import { getCurrentSeasonId, listTeams, getUserTeam, setUserTeam, getArcadeName, setArcadeName, generateNameNonce, verifyAndConsumeNameNonce } from '../db.js';
import { verifyMessage, getAddress } from 'ethers';

export default async function routes(app: FastifyInstance) {
  app.get('/v2/teams', async (_, reply) => {
    try {
      const db = getDB();
      const teams = await listTeams(db);
      return reply.send(teams);
    } catch (error) {
      app.log.error('Failed to list teams:', error);
      return reply.code(500).send({ error: 'Failed to fetch teams' });
    }
  });

  app.get('/v2/user/team', async (req, reply) => {
    try {
      const wallet = (req.query as any).wallet as string;
      if (!wallet) {
        return reply.code(400).send({ error: 'wallet query parameter required' });
      }
      
      const db = getDB();
      const seasonId = await getCurrentSeasonId(db);
      const team = await getUserTeam(db, wallet, seasonId);
      
      return reply.send({ team });
    } catch (error) {
      app.log.error('Failed to get user team:', error);
      return reply.code(500).send({ error: 'Failed to fetch user team' });
    }
  });

  app.post('/v2/user/team', async (req, reply) => {
    try {
      const { wallet, teamSlug } = req.body as { wallet?: string; teamSlug?: string };
      
      if (!wallet || !teamSlug) {
        return reply.code(400).send({ error: 'wallet and teamSlug required in request body' });
      }
      
      const db = getDB();
      const seasonId = await getCurrentSeasonId(db);
      
      await setUserTeam(db, wallet, seasonId, teamSlug);
      const team = await getUserTeam(db, wallet, seasonId);
      
      return reply.send({ ok: true, team });
    } catch (error) {
      app.log.error('Failed to set user team:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to set user team' });
    }
  });

  // Arcade name routes
  app.get('/v2/user/name', async (req, reply) => {
    try {
      const wallet = (req.query as any).wallet as string;
      if (!wallet) {
        return reply.code(400).send({ error: 'wallet required' });
      }
      
      const db = getDB();
      const name = await getArcadeName(db, wallet);
      
      return reply.send({ wallet, name });
    } catch (error) {
      app.log.error('Failed to get arcade name:', error);
      return reply.code(500).send({ error: 'Failed to fetch arcade name' });
    }
  });

  app.get('/v2/user/name/nonce', async (req, reply) => {
    try {
      const wallet = (req.query as any).wallet as string;
      if (!wallet) {
        return reply.code(400).send({ error: 'wallet required' });
      }
      
      const db = getDB();
      const nonce = await generateNameNonce(db, wallet);
      
      return reply.send({ nonce });
    } catch (error) {
      app.log.error('Failed to generate nonce:', error);
      return reply.code(500).send({ error: 'Failed to generate nonce' });
    }
  });

  app.post('/v2/user/name', async (req, reply) => {
    try {
      const { wallet, name, nonce, expiry, sig } = req.body as { 
        wallet?: string; 
        name?: string; 
        nonce?: string; 
        expiry?: string; 
        sig?: string; 
      };
      
      if (!wallet || !name || !nonce || !expiry || !sig) {
        return reply.code(400).send({ error: 'wallet, name, nonce, expiry, and sig required' });
      }

      const db = getDB();
      
      // Verify nonce
      const nonceValid = await verifyAndConsumeNameNonce(db, wallet, nonce);
      if (!nonceValid) {
        return reply.code(400).send({ error: 'invalid_nonce' });
      }
      
      // Check expiry
      const now = Date.now();
      if (Date.parse(expiry) < now) {
        return reply.code(400).send({ error: 'expired' });
      }
      
      // Build message and verify signature
      const message = `MineBoy: set arcade name
Wallet: ${getAddress(wallet)}
Name: ${name}
Nonce: ${nonce}
Expires: ${expiry}`;
      
      const recovered = await verifyMessage(message, sig);
      if (getAddress(recovered) !== getAddress(wallet)) {
        return reply.code(400).send({ error: 'bad_sig' });
      }
      
      // Set the name
      await setArcadeName(db, wallet, name);
      return reply.code(201).send({ ok: true, name: name.toUpperCase() });
    } catch (e: any) {
      if (e.code === 'NAME_TAKEN') return reply.code(409).send({ error: 'taken' });
      if (e.code === 'WALLET_ALREADY_NAMED') return reply.code(409).send({ error: 'locked' });
      app.log.error('Failed to set arcade name:', e);
      return reply.code(500).send({ error: 'server_error' });
    }
  });
}
