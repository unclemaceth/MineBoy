/// <reference lib="webworker" />
export {};

import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

declare const self: DedicatedWorkerGlobalScope;

type InStart = {
  type: 'START';
  job: {
    algo: 'sha256-suffix';   // keep existing
    charset: 'hex';
    nonce: string;           // 0x...
    // NEW:
    rule?: 'suffix' | 'bits';
    suffix?: string;
    difficultyBits?: number;
  };
};

type InStop = { type: 'STOP' };
type InMsg = InStart | InStop;

type OutTick = { type: 'TICK'; attempts: number; hr: number };
type OutFound = {
  type: 'FOUND';
  hash: string;        // 0x...
  preimage: string;    // string input fed to SHA-256
  attempts: number;
  hr: number;
};
type OutError = { type: 'ERROR'; message: string };
type OutMsg = OutTick | OutFound | OutError;

const ctx = self;

let running = false;
let attempts = 0;
let startTs = 0;
let lastTickTs = 0;


function toLowerHex(s: string) {
  return s.startsWith('0x') ? s.slice(2).toLowerCase() : s.toLowerCase();
}

function sha256HexAscii(s: string): string {
  // Canonical SHA-256 of UTF-8 string -> 0x + lowercase hex
  return '0x' + bytesToHex(sha256(utf8ToBytes(s)));
}

function hrNow(): number {
  const dur = Math.max(1, performance.now() - startTs) / 1000;
  return Math.floor(attempts / dur);
}

function hasTrailingZeroBitsHex(hash: string, nBits: number): boolean {
  const hex = (hash.startsWith('0x') ? hash.slice(2) : hash).toLowerCase();
  const tzNibble = [4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0];

  let remaining = nBits;
  for (let i = hex.length - 1; i >= 0 && remaining > 0; i--) {
    const v = parseInt(hex[i], 16);
    if (Number.isNaN(v)) return false;
    if (v === 0) { remaining -= 4; continue; }
    remaining -= tzNibble[v];
    break;
  }
  return remaining <= 0;
}

function mine({ nonce, rule, suffix, difficultyBits }: {
  nonce: string;
  rule?: 'suffix' | 'bits';
  suffix?: string;
  difficultyBits?: number;
}) {
  const mode: 'suffix' | 'bits' = rule ?? (typeof difficultyBits === 'number' ? 'bits' : 'suffix');
  const lowerSuffix = (suffix ?? '').toLowerCase();

  startTs = performance.now();
  lastTickTs = startTs;
  attempts = 0;
  running = true;

  let counter = 0;

  while (running) {
    const preimage = `${nonce}:${counter}`;
    const hash = sha256HexAscii(preimage);
    attempts++;
    counter++;

    let ok = false;
    if (mode === 'suffix') {
      ok = hash.toLowerCase().slice(2).endsWith(lowerSuffix);
    } else {
      ok = hasTrailingZeroBitsHex(hash, difficultyBits ?? 0);
    }

    if (ok) {
      running = false;
      const hr = Math.round((attempts / ((performance.now() - startTs) / 1000)) * 10) / 10;
      const out: OutFound = {
        type: 'FOUND',
        hash,
        preimage,
        attempts,
        hr,
      };
      console.log('Found hash!', out);
      ctx.postMessage(out);
      return;
    }

    // Send TICK every 256 attempts or every 500ms, whichever comes first
    if (attempts % 256 === 0) {
      const now = performance.now();
      if (now - lastTickTs > 100) { // Don't spam too fast
        lastTickTs = now;
        const out: OutTick = { type: 'TICK', attempts, hr: hrNow() };
        ctx.postMessage(out);
      }
    }
  }
}

ctx.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  console.log('Worker received message:', msg);
  
  if (msg.type === 'STOP') {
    console.log('Worker stopping...');
    running = false;
    return;
  }
  if (msg.type === 'START') {
    if (running) running = false;
    const { nonce, rule, suffix, difficultyBits } = msg.job;

    try {
      mine({ nonce, rule, suffix, difficultyBits });
    } catch (err) {
      const out: OutError = { type: 'ERROR', message: String((err instanceof Error ? err.message : String(err))) };
      ctx.postMessage(out);
    }
  }
};
