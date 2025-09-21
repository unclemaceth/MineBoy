import { getRedis } from "./redis";
import { encode, decode } from "./redisJson";

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
  return `${PREFIX}lock:cartridge:${chainId}:${contract.toLowerCase()}:${tokenId}`;
}

// Session lock: prevents multi-tab mining (60 seconds)
function sessionLockKey(chainId: number, contract: string, tokenId: string) {
  return `${PREFIX}lock:cartridge:session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
}

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
      async acquireOwnershipLock(chainId: number, contract: string, tokenId: string, wallet: string) {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const value = JSON.stringify({ wallet, issuedAt: Date.now(), lastActive: Date.now() });
        const ok = await r!.set(key, value, "NX", "PX", OWNERSHIP_LOCK_TTL_MS);
        return ok === "OK";
      },

      async refreshOwnershipLock(chainId: number, contract: string, tokenId: string, wallet: string) {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const cur = await r!.get(key);
        if (!cur) return false;
        
        try {
          const data = JSON.parse(cur);
          if (data.wallet !== wallet) return false;
          
          // Update lastActive and refresh TTL
          data.lastActive = Date.now();
          await r!.set(key, JSON.stringify(data), "PX", OWNERSHIP_LOCK_TTL_MS);
          return true;
        } catch {
          return false;
        }
      },

      async getOwnershipLock(chainId: number, contract: string, tokenId: string) {
        const key = ownershipLockKey(chainId, contract, tokenId);
        const cur = await r!.get(key);
        if (!cur) return null;
        
        try {
          return JSON.parse(cur);
        } catch {
          return null;
        }
      },

      // Session lock: prevents multi-tab mining (60 seconds, allows graceful recovery)
      async acquireSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = sessionLockKey(chainId, contract, tokenId);
        const value = JSON.stringify({ sessionId, wallet, updatedAt: Date.now() });
        const ok = await r!.set(key, value, "NX", "PX", SESSION_LOCK_TTL_MS);
        return ok === "OK";
      },

      async refreshSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = sessionLockKey(chainId, contract, tokenId);
        const cur = await r!.get(key);
        if (!cur) return false;
        
        try {
          const data = JSON.parse(cur);
          if (data.sessionId !== sessionId || data.wallet !== wallet) return false;
          
          // Update timestamp and refresh TTL
          data.updatedAt = Date.now();
          await r!.set(key, JSON.stringify(data), "PX", SESSION_LOCK_TTL_MS);
          return true;
        } catch {
          return false;
        }
      },

      async getSessionLock(chainId: number, contract: string, tokenId: string) {
        const key = sessionLockKey(chainId, contract, tokenId);
        const cur = await r!.get(key);
        if (!cur) return null;
        
        try {
          return JSON.parse(cur);
        } catch {
          return null;
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
      _ownershipLocks: new Map<string, { wallet: string; issuedAt: number; lastActive: number; expires: number }>(),
      _sessionLocks: new Map<string, { sessionId: string; wallet: string; updatedAt: number; expires: number }>(),

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
      async acquireOwnershipLock(chainId: number, contract: string, tokenId: string, wallet: string) {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const now = Date.now();
        const l = this._ownershipLocks.get(key);
        
        if (!l || l.expires < now) {
          this._ownershipLocks.set(key, { 
            wallet, 
            issuedAt: now, 
            lastActive: now, 
            expires: now + OWNERSHIP_LOCK_TTL_MS 
          });
          return true;
        }
        return l.wallet === wallet;
      },

      async refreshOwnershipLock(chainId: number, contract: string, tokenId: string, wallet: string) {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const now = Date.now();
        const l = this._ownershipLocks.get(key);
        
        if (!l || l.wallet !== wallet || l.expires < now) return false;
        
        l.lastActive = now;
        l.expires = now + OWNERSHIP_LOCK_TTL_MS;
        return true;
      },

      async getOwnershipLock(chainId: number, contract: string, tokenId: string) {
        const key = `${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._ownershipLocks.get(key);
        const now = Date.now();
        
        if (!l || l.expires < now) return null;
        return { wallet: l.wallet, issuedAt: l.issuedAt, lastActive: l.lastActive };
      },

      async acquireSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const now = Date.now();
        const l = this._sessionLocks.get(key);
        
        if (!l || l.expires < now) {
          this._sessionLocks.set(key, { 
            sessionId, 
            wallet, 
            updatedAt: now, 
            expires: now + SESSION_LOCK_TTL_MS 
          });
          return true;
        }
        return l.sessionId === sessionId && l.wallet === wallet;
      },

      async refreshSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const now = Date.now();
        const l = this._sessionLocks.get(key);
        
        if (!l || l.sessionId !== sessionId || l.wallet !== wallet || l.expires < now) return false;
        
        l.updatedAt = now;
        l.expires = now + SESSION_LOCK_TTL_MS;
        return true;
      },

      async getSessionLock(chainId: number, contract: string, tokenId: string) {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._sessionLocks.get(key);
        const now = Date.now();
        
        if (!l || l.expires < now) return null;
        return { sessionId: l.sessionId, wallet: l.wallet, updatedAt: l.updatedAt };
      },

      async releaseSessionLock(chainId: number, contract: string, tokenId: string, sessionId: string, wallet: string) {
        const key = `session:${chainId}:${contract.toLowerCase()}:${tokenId}`;
        const l = this._sessionLocks.get(key);
        
        if (l && l.sessionId === sessionId && l.wallet === wallet) {
          this._sessionLocks.delete(key);
          return true;
        }
        return false;
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
