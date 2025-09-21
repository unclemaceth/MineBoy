import { getRedis } from "./redis";
import { encode, decode } from "./redisJson";
import { canonicalizeCartridge, cartKey, normalizeAddress, sameAddr } from "./canonical";

// Ownership lock types
export type OwnershipLock = {
  ownerAtAcquire: string;          // wallet bound at acquire
  ownerMinerId?: string | null;    // informational only
  issuedAt: number;
  lastActive: number;
  expiresAt: number;
  phase?: 'active' | 'cooldown';
};

export type SessionLock = {
  sessionId: string;
  wallet: string;
  minerId: string;
  issuedAt: number;
};

const PREFIX = process.env.REDIS_PREFIX ?? "mineboy:v2:";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 45_000);
// Two-tier locking system
const OWNERSHIP_LOCK_TTL_MS = Number(process.env.OWNERSHIP_LOCK_TTL_MS ?? 3_600_000); // 1 hour
const SESSION_LOCK_TTL_MS = Number(process.env.SESSION_LOCK_TTL_MS ?? 60_000); // 60 seconds

type Session = {
  sessionId: string;
  minerId: string;
  wallet: string;
  cartridge: { chainId: number; contract: string; tokenId: string };
  job?: { jobId: string; nonce: string; suffix: string; height?: number };
  createdAt: number;
};

const r = getRedis();

function sKey(id: string) {
  return `${PREFIX}s:${id}`;
}

// Ownership lock: reserves cartridge for wallet (1 hour)
function ownershipLockKey(chainId: number, contract: string, tokenId: string) {
  const canonical = canonicalizeCartridge({ chainId, contract, tokenId });
  const key = cartKey(canonical);
  return `${PREFIX}lock:cartridge:${key}`;
}

// Session lock: prevents multi-tab mining (60 seconds)
function sessionLockKey(chainId: number, contract: string, tokenId: string) {
  const canonical = canonicalizeCartridge({ chainId, contract, tokenId });
  const key = cartKey(canonical);
  return `${PREFIX}lock:cartridge:session:${key}`;
}

// Wallet session tracking for limits
function walletSessionsKey(wallet: string) {
  return `${PREFIX}wallet:sessions:${wallet.toLowerCase()}`;
}

function sessionMetaKey(sessionId: string) {
  return `${PREFIX}session:meta:${sessionId}`;
}

// Session limit configuration
const WALLET_SESSION_LIMIT = Number(process.env.WALLET_SESSION_LIMIT ?? 10);

export const SessionStore = r
  ? {
      kind: "redis" as const,

      async createSession(s: Session) {
        const key = sKey(s.sessionId);
        await r!.set(key, encode(s), "PX", SESSION_TTL_MS);
        return s;
      },

      async getSession(sessionId: string): Promise<Session | null> {
        const raw = await r!.get(sKey(sessionId));
        return raw ? decode<Session>(raw) : null;
      },

      async refreshSession(sessionId: string) {
        await r!.pexpire(sKey(sessionId), SESSION_TTL_MS);
      },

      async setJob(sessionId: string, job: Session["job"]) {
        const key = sKey(sessionId);
        const raw = await r!.get(key);
        if (!raw) return false;
        const s = decode<Session>(raw);
        s.job = job ?? undefined;
        const ttl = await r!.pttl(key);
        await r!.set(key, encode(s), "PX", Math.max(ttl, 1));
        return true;
      },

      async deleteSession(sessionId: string) {
        await r!.del(sKey(sessionId));
      },

      // Two-tier locking system
      
      // Ownership lock: reserves cartridge for wallet (1 hour anti-flip protection)
      async getOwnershipLock(chainId: number, contract: string, tokenId: string): Promise<OwnershipLock | null> {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const raw = await r!.get(key);
        return raw ? JSON.parse(raw) as OwnershipLock : null;
      },

      async createOwnershipLock(chainId: number, contract: string, tokenId: string, payload: OwnershipLock): Promise<boolean> {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const ok = await r!.set(key, JSON.stringify(payload), "NX", "PX", OWNERSHIP_LOCK_TTL_MS);
        return ok === "OK";
      },

      async setOwnershipMinerId(chainId: number, contract: string, tokenId: string, minerId: string): Promise<void> {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const cur = await this.getOwnershipLock(chainId, contract, tokenId);
        if (!cur) return;
        if (!cur.ownerMinerId || cur.ownerMinerId === 'legacy-miner') {
          cur.ownerMinerId = minerId;
          await r!.set(key, JSON.stringify(cur), "PX", OWNERSHIP_LOCK_TTL_MS);
        }
      },

      async refreshOwnershipLock(chainId: number, contract: string, tokenId: string, nowMs: number, ttlMs: number): Promise<void> {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const cur = await this.getOwnershipLock(chainId, contract, tokenId);
        if (!cur) return;
        if (cur.phase && cur.phase !== 'active') return; // don't extend cooldown
        cur.lastActive = nowMs;
        cur.expiresAt = nowMs + ttlMs;
        await r!.set(key, JSON.stringify(cur), "PX", OWNERSHIP_LOCK_TTL_MS);
      },

      async freezeOwnershipToCooldown(chainId: number, contract: string, tokenId: string): Promise<void> {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const cur = await this.getOwnershipLock(chainId, contract, tokenId);
        if (!cur) return;
        cur.phase = 'cooldown';
        await r!.set(key, JSON.stringify(cur), "PX", OWNERSHIP_LOCK_TTL_MS);
      },

      async getOwnershipPttlMs(chainId: number, contract: string, tokenId: string): Promise<number> {
        const key = ownershipLockKey(chainId, contract, tokenId);
        return await r!.pttl(key);
      },

      // Session lock helpers
      async getSessionLock(chainId: number, contract: string, tokenId: string): Promise<SessionLock | null> {
        const key = sessionLockKey(chainId, contract, tokenId);
        const raw = await r!.get(key);
        return raw ? JSON.parse(raw) as SessionLock : null;
      },

      async getSessionLockPttlMs(chainId: number, contract: string, tokenId: string): Promise<number> {
        const key = sessionLockKey(chainId, contract, tokenId);
        return await r!.pttl(key);
      },

      async getSessionHolderMinerId(chainId: number, contract: string, tokenId: string): Promise<string | null> {
        const lock = await this.getSessionLock(chainId, contract, tokenId);
        return lock?.minerId ?? null;
      },

      async releaseSessionLock(chainId: number, contract: string, tokenId: string): Promise<void> {
        const key = sessionLockKey(chainId, contract, tokenId);
        await r!.del(key);
      },


      // Session lock: prevents multi-tab mining (60 seconds, allows graceful recovery)
      async acquireSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string, minerId: string) {
        const key = sessionLockKey(chainId, contract, tokenId);
        const value: SessionLock = { sessionId, wallet, minerId, issuedAt: Date.now() };
        const ok = await r!.set(key, JSON.stringify(value), "NX", "PX", SESSION_LOCK_TTL_MS);
        return ok === "OK";
      },

      async refreshSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = sessionLockKey(chainId, contract, tokenId);
        const cur = await r!.get(key);
        if (!cur) return false;
        
        try {
          const data = JSON.parse(cur) as SessionLock;
          if (data.sessionId !== sessionId || data.wallet !== wallet) return false;
          
          // Update timestamp and refresh TTL
          data.issuedAt = Date.now();
          await r!.set(key, JSON.stringify(data), "PX", SESSION_LOCK_TTL_MS);
          return true;
        } catch {
          return false;
        }
      },

      async releaseSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = sessionLockKey(chainId, contract, tokenId);
        const cur = await r!.get(key);
        if (!cur) return false;
        
        try {
          const data = JSON.parse(cur);
          if (data.sessionId === sessionId && data.wallet === wallet) {
            await r!.del(key);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      // Wallet session limit management
      async checkWalletSessionLimit(wallet: string): Promise<{ allowed: boolean; activeCount: number; limit: number }> {
        const key = walletSessionsKey(wallet);
        
        // Clean up expired sessions first
        await this.cleanupExpiredWalletSessions(wallet);
        
        // Count active sessions
        const activeCount = await r!.scard(key);
        const allowed = activeCount < WALLET_SESSION_LIMIT;
        
        return { allowed, activeCount, limit: WALLET_SESSION_LIMIT };
      },

      async addWalletSession(wallet: string, chainId: number, contract: string, tokenId: string, sessionId: string) {
        const walletKey = walletSessionsKey(wallet);
        const sessionKey = sessionMetaKey(sessionId);
        const member = `${chainId}:${contract.toLowerCase()}:${tokenId}:${sessionId}`;
        
        // Add to wallet sessions set
        await r!.sadd(walletKey, member);
        
        // Store session metadata for cleanup
        await r!.set(sessionKey, JSON.stringify({ 
          wallet, 
          chainId, 
          contract, 
          tokenId, 
          sessionId, 
          createdAt: Date.now() 
        }), "EX", 3600); // 1 hour TTL
      },

      async removeWalletSession(wallet: string, sessionId: string) {
        const walletKey = walletSessionsKey(wallet);
        const sessionKey = sessionMetaKey(sessionId);
        
        // Get session metadata to find the member
        const sessionData = await r!.get(sessionKey);
        if (sessionData) {
          try {
            const meta = JSON.parse(sessionData);
            const member = `${meta.chainId}:${meta.contract.toLowerCase()}:${meta.tokenId}:${sessionId}`;
            await r!.srem(walletKey, member);
          } catch (error) {
            console.error('Failed to parse session metadata:', error);
          }
        }
        
        // Remove session metadata
        await r!.del(sessionKey);
      },

      async cleanupExpiredWalletSessions(wallet: string) {
        const walletKey = walletSessionsKey(wallet);
        const members = await r!.smembers(walletKey);
        
        for (const member of members) {
          const parts = member.split(':');
          if (parts.length === 4) {
            const [chainId, contract, tokenId, sessionId] = parts;
            
            // Check if session lock still exists
            const lockKey = sessionLockKey(Number(chainId), contract, tokenId);
            const sessionLockExists = await r!.exists(lockKey);
            
            if (!sessionLockExists) {
              // Session lock expired, remove from wallet sessions
              await r!.srem(walletKey, member);
              await r!.del(sessionMetaKey(sessionId));
            }
          }
        }
      },

      // Backward compatibility - will be removed after migration
      async acquireLock(contract: string, tokenId: string, owner: string) {
        // This is now handled by the two-tier system
        throw new Error("Use acquireOwnershipLock and acquireSessionLock instead");
      },

      async refreshLock(contract: string, tokenId: string, owner: string) {
        // This is now handled by the two-tier system
        throw new Error("Use refreshOwnershipLock and refreshSessionLock instead");
      },

      async releaseLock(contract: string, tokenId: string, owner: string) {
        // This is now handled by the two-tier system
        throw new Error("Use releaseSessionLock instead");
      },
    }
  : {
      // Fallback in-memory (dev only)
      kind: "memory" as const,
      _s: new Map<string, any>(),
      _ownershipLocks: new Map<string, OwnershipLock>(),
      _sessionLocks: new Map<string, SessionLock>(),
      _walletSessions: new Map<string, Set<string>>(), // wallet -> Set of session members
      _sessionMeta: new Map<string, { wallet: string; chainId: number; contract: string; tokenId: string; sessionId: string; createdAt: number }>(),

      async createSession(s: Session) {
        this._s.set(s.sessionId, s);
        return s;
      },
      async getSession(id: string) {
        return this._s.get(id) ?? null;
      },
      async refreshSession(_id: string) {},
      async setJob(id: string, job: Session["job"]) {
        const s = this._s.get(id);
        if (!s) return false;
        s.job = job;
        return true;
      },
      async deleteSession(id: string) {
        this._s.delete(id);
      },

      // Two-tier locking system (memory fallback)
      async getOwnershipLock(chainId: number, contract: string, tokenId: string): Promise<OwnershipLock | null> {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._ownershipLocks.get(key);
        const now = Date.now();
        
        if (!l || l.expiresAt < now) return null;
        return l;
      },

      async createOwnershipLock(chainId: number, contract: string, tokenId: string, payload: OwnershipLock): Promise<boolean> {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const now = Date.now();
        const l = this._ownershipLocks.get(key);
        
        if (!l || l.expiresAt < now) {
          this._ownershipLocks.set(key, payload);
          return true;
        }
        return false; // Already exists and not expired
      },

      async setOwnershipMinerId(chainId: number, contract: string, tokenId: string, minerId: string): Promise<void> {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._ownershipLocks.get(key);
        const now = Date.now();
        
        if (!l || l.expiresAt < now) return;
        if (!l.ownerMinerId || l.ownerMinerId === 'legacy-miner') {
          l.ownerMinerId = minerId;
        }
      },

      async refreshOwnershipLock(chainId: number, contract: string, tokenId: string, nowMs: number, ttlMs: number): Promise<void> {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._ownershipLocks.get(key);
        
        if (!l || l.expiresAt < nowMs) return;
        if (l.phase && l.phase !== 'active') return; // don't extend cooldown
        
        l.lastActive = nowMs;
        l.expiresAt = nowMs + ttlMs;
      },

      async freezeOwnershipToCooldown(chainId: number, contract: string, tokenId: string): Promise<void> {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._ownershipLocks.get(key);
        
        if (!l) return;
        l.phase = 'cooldown';
      },

      async getOwnershipPttlMs(chainId: number, contract: string, tokenId: string): Promise<number> {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._ownershipLocks.get(key);
        const now = Date.now();
        
        if (!l || l.expiresAt < now) return 0;
        return l.expiresAt - now;
      },

      async acquireSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string, minerId: string) {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const now = Date.now();
        const l = this._sessionLocks.get(key);
        
        if (!l || l.issuedAt + SESSION_LOCK_TTL_MS < now) {
          this._sessionLocks.set(key, { 
            sessionId, 
            wallet, 
            minerId,
            issuedAt: now
          });
          return true;
        }
        return l.sessionId === sessionId && l.wallet === wallet;
      },

      async refreshSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._sessionLocks.get(key);
        const now = Date.now();
        
        if (!l || l.sessionId !== sessionId || l.wallet !== wallet || l.issuedAt + SESSION_LOCK_TTL_MS < now) return false;
        
        l.issuedAt = now;
        return true;
      },

      async getSessionLock(chainId: number, contract: string, tokenId: string): Promise<SessionLock | null> {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._sessionLocks.get(key);
        const now = Date.now();
        
        if (!l || l.issuedAt + SESSION_LOCK_TTL_MS < now) return null;
        return l;
      },

      async getSessionLockPttlMs(chainId: number, contract: string, tokenId: string): Promise<number> {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._sessionLocks.get(key);
        const now = Date.now();
        
        if (!l || l.issuedAt + SESSION_LOCK_TTL_MS < now) return 0;
        return (l.issuedAt + SESSION_LOCK_TTL_MS) - now;
      },

      async getSessionHolderMinerId(chainId: number, contract: string, tokenId: string): Promise<string | null> {
        const lock = await this.getSessionLock(chainId, contract, tokenId);
        return lock?.minerId ?? null;
      },

      async releaseSessionLock(chainId: number, contract: string, tokenId: string): Promise<void> {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        this._sessionLocks.delete(key);
      },

      // Wallet session limit management (memory fallback)
      async checkWalletSessionLimit(wallet: string): Promise<{ allowed: boolean; activeCount: number; limit: number }> {
        // Clean up expired sessions first
        await this.cleanupExpiredWalletSessions(wallet);
        
        // Count active sessions
        const sessions = this._walletSessions.get(wallet.toLowerCase()) || new Set();
        const activeCount = sessions.size;
        const allowed = activeCount < WALLET_SESSION_LIMIT;
        
        return { allowed, activeCount, limit: WALLET_SESSION_LIMIT };
      },

      async addWalletSession(wallet: string, chainId: number, contract: string, tokenId: string, sessionId: string) {
        const walletKey = wallet.toLowerCase();
        const member = `${chainId}:${contract.toLowerCase()}:${tokenId}:${sessionId}`;
        
        // Add to wallet sessions set
        if (!this._walletSessions.has(walletKey)) {
          this._walletSessions.set(walletKey, new Set());
        }
        this._walletSessions.get(walletKey)!.add(member);
        
        // Store session metadata
        this._sessionMeta.set(sessionId, { 
          wallet, 
          chainId, 
          contract, 
          tokenId, 
          sessionId, 
          createdAt: Date.now() 
        });
      },

      async removeWalletSession(wallet: string, sessionId: string) {
        const walletKey = wallet.toLowerCase();
        const meta = this._sessionMeta.get(sessionId);
        
        if (meta && meta.wallet === wallet) {
          const member = `${meta.chainId}:${meta.contract.toLowerCase()}:${meta.tokenId}:${sessionId}`;
          this._walletSessions.get(walletKey)?.delete(member);
          this._sessionMeta.delete(sessionId);
        }
      },

      async cleanupExpiredWalletSessions(wallet: string) {
        const walletKey = wallet.toLowerCase();
        const sessions = this._walletSessions.get(walletKey);
        if (!sessions) return;
        
        const now = Date.now();
        const toRemove: string[] = [];
        
        for (const member of sessions) {
          const parts = member.split(':');
          if (parts.length === 4) {
            const [chainId, contract, tokenId, sessionId] = parts;
            
            // Check if session lock still exists
            const lockKey = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
            const sessionLock = this._sessionLocks.get(lockKey);
            
            if (!sessionLock || sessionLock.expires < now || sessionLock.sessionId !== sessionId) {
              toRemove.push(member);
            }
          }
        }
        
        // Remove expired sessions
        for (const member of toRemove) {
          sessions.delete(member);
          const parts = member.split(':');
          if (parts.length === 4) {
            this._sessionMeta.delete(parts[3]); // sessionId
          }
        }
      },

      // Backward compatibility - will be removed after migration
      async acquireLock(contract: string, tokenId: string, owner: string) {
        throw new Error("Use acquireOwnershipLock and acquireSessionLock instead");
      },
      async refreshLock(contract: string, tokenId: string, owner: string) {
        throw new Error("Use refreshOwnershipLock and refreshSessionLock instead");
      },
      async releaseLock(contract: string, tokenId: string, owner: string) {
        throw new Error("Use releaseSessionLock instead");
      },
    };
