const LOCK_TTL_MS = 300_000; // 5 minutes for debugging

type Lock = { minerId: string; ts: number };

export class LockManager {
  private map = new Map<string, Lock>();

  private key(chainId: number, contract: string, tokenId: string) {
    return `${chainId}:${contract.toLowerCase()}:${tokenId}`;
  }

  acquire(chainId: number, contract: string, tokenId: string, minerId: string): { ok: boolean; reason?: string } {
    const k = this.key(chainId, contract, tokenId);
    const now = Date.now();
    const cur = this.map.get(k);
    if (!cur || now - cur.ts > LOCK_TTL_MS) {
      this.map.set(k, { minerId, ts: now });
      return { ok: true };
    }
    if (cur.minerId === minerId) {
      this.map.set(k, { minerId, ts: now }); // refresh
      return { ok: true };
    }
    return { ok: false, reason: 'Cartridge is currently locked by another miner' };
  }

  refresh(chainId: number, contract: string, tokenId: string, minerId: string): boolean {
    const k = this.key(chainId, contract, tokenId);
    const cur = this.map.get(k);
    const now = Date.now();
    if (cur && cur.minerId === minerId) {
      this.map.set(k, { minerId, ts: now });
      return true;
    }
    return false;
  }

  release(chainId: number, contract: string, tokenId: string, minerId: string) {
    const k = this.key(chainId, contract, tokenId);
    const cur = this.map.get(k);
    if (cur && cur.minerId === minerId) this.map.delete(k);
  }
}

export const locks = new LockManager();
