import { getRedis } from "./redis";

const PREFIX = process.env.REDIS_PREFIX ?? "mineboy:v2:";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 45_000);
const LOCK_TTL_MS    = Number(process.env.LOCK_TTL_MS    ?? 45_000);

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
function lKey(contract: string, tokenId: string) {
  return `${PREFIX}lock:${contract.toLowerCase()}:${tokenId}`;
}

export const SessionStore = r
  ? {
      kind: "redis" as const,

      async createSession(s: Session) {
        const key = sKey(s.sessionId);
        await r!.set(key, JSON.stringify(s), "PX", SESSION_TTL_MS);
        return s;
      },

      async getSession(sessionId: string): Promise<Session | null> {
        const raw = await r!.get(sKey(sessionId));
        return raw ? (JSON.parse(raw) as Session) : null;
      },

      async refreshSession(sessionId: string) {
        await r!.pexpire(sKey(sessionId), SESSION_TTL_MS);
      },

      async setJob(sessionId: string, job: Session["job"]) {
        const key = sKey(sessionId);
        const raw = await r!.get(key);
        if (!raw) return false;
        const s = JSON.parse(raw) as Session;
        s.job = job ?? undefined;
        const ttl = await r!.pttl(key);
        await r!.set(key, JSON.stringify(s), "PX", Math.max(ttl, 1));
        return true;
      },

      async deleteSession(sessionId: string) {
        await r!.del(sKey(sessionId));
      },

      // Cartridge lock (exclusive access)
      async acquireLock(contract: string, tokenId: string, owner: string) {
        const key = lKey(contract, tokenId);
        // NX + PX => set if not exists with TTL
        const ok = await r!.set(key, owner, "NX", "PX", LOCK_TTL_MS);
        return ok === "OK";
      },

      async refreshLock(contract: string, tokenId: string, owner: string) {
        const key = lKey(contract, tokenId);
        const cur = await r!.get(key);
        if (cur !== owner) return false;
        await r!.pexpire(key, LOCK_TTL_MS);
        return true;
      },

      async releaseLock(contract: string, tokenId: string, owner: string) {
        const key = lKey(contract, tokenId);
        const cur = await r!.get(key);
        if (cur === owner) await r!.del(key);
      },
    }
  : {
      // Fallback in-memory (dev only)
      kind: "memory" as const,
      _s: new Map<string, any>(),
      _l: new Map<string, { owner: string; expires: number }>(),

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

      async acquireLock(contract: string, tokenId: string, owner: string) {
        const key = `${contract}:${tokenId}`;
        const l = this._l.get(key);
        const now = Date.now();
        if (!l || l.expires < now) {
          this._l.set(key, { owner, expires: now + LOCK_TTL_MS });
          return true;
        }
        return l.owner === owner;
      },
      async refreshLock(contract: string, tokenId: string, owner: string) {
        const key = `${contract}:${tokenId}`;
        const l = this._l.get(key);
        if (!l || l.owner !== owner) return false;
        l.expires = Date.now() + LOCK_TTL_MS;
        return true;
      },
      async releaseLock(contract: string, tokenId: string, owner: string) {
        const key = `${contract}:${tokenId}`;
        const l = this._l.get(key);
        if (l && l.owner === owner) this._l.delete(key);
      },
    };
