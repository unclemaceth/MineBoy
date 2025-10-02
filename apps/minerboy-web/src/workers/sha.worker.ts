/// <reference lib="webworker" />
export {};

import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

declare const self: DedicatedWorkerGlobalScope;

type InStart = {
  type: 'START';
  job: {
    algo: 'sha256-suffix';
    charset: 'hex';
    nonce: string;           // 0x...
    // ANTI-BOT REQUIRED FIELDS
    counterStart: number;    // inclusive
    counterEnd: number;      // exclusive
    maxHps: number;          // target hashrate (e.g., 5000)
    allowedSuffixes: string[]; // e.g., ["00000", "10000", ..., "f0000"]
    // DEPRECATED (kept for error messages)
    suffix?: string;
    rule?: 'suffix' | 'bits';
    difficultyBits?: number;
  };
  sid: string;
};

type InStop = { type: 'STOP' };
type InMsg = InStart | InStop;

type OutTick = { 
  type: 'TICK'; 
  attempts: number; 
  hr: number; 
  hash: string; 
  nibs: number[]; 
  sid: string;
  // ANTI-BOT: Progress tracking
  counter: number;         // current counter value
  progress: number;        // 0-100 percentage
  estimatedSecondsLeft: number;
};
type OutFound = {
  type: 'FOUND';
  hash: string;        // 0x...
  preimage: string;    // nonce:counter
  attempts: number;
  hr: number;
  sid: string;
  counter: number;     // final counter value
};
type OutStopped = { type: 'STOPPED'; sid: string; reason: string };
type OutError = { type: 'ERROR'; message: string; sid: string };
type OutMsg = OutTick | OutFound | OutStopped | OutError;

const ctx = self;

let running = false;
let attempts = 0;
let startTs = 0;
let lastTickTs = 0;
let sid: string | null = null;


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

function sampleNibs(hashHex: string): number[] {
  const h = hashHex.startsWith('0x') ? hashHex.slice(2) : hashHex; // 64 hex chars (32 bytes)
  // 9 evenly-spaced nibbles across the digest
  const ix = [0, 8, 16, 24, 32, 40, 48, 56, 63];
  return ix.map(i => parseInt(h[i] || '0', 16));
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

/**
 * Check if hash matches any allowed suffix
 */
function hashMatchesAllowedSuffixes(hash: string, allowedSuffixes: string[]): boolean {
  const h = hash.toLowerCase().slice(2); // remove 0x
  for (const suffix of allowedSuffixes) {
    const s = suffix.toLowerCase().replace(/^0x/, '');
    if (h.endsWith(s)) return true;
  }
  return false;
}

/**
 * STRICT MODE Mining with 5k H/s throttle and counter windows
 */
function mine({ 
  nonce, 
  counterStart, 
  counterEnd, 
  maxHps, 
  allowedSuffixes 
}: {
  nonce: string;
  counterStart: number;
  counterEnd: number;
  maxHps: number;
  allowedSuffixes: string[];
}) {
  // STRICT: Validate required fields
  if (!allowedSuffixes || allowedSuffixes.length === 0) {
    throw new Error('Job missing allowedSuffixes - client must upgrade');
  }
  if (counterStart === undefined || counterEnd === undefined) {
    throw new Error('Job missing counter window - client must upgrade');
  }
  if (!maxHps || maxHps <= 0) {
    throw new Error('Job missing maxHps - client must upgrade');
  }

  startTs = performance.now();
  lastTickTs = startTs;
  attempts = 0;
  running = true;

  let counter = counterStart;
  const totalWindow = counterEnd - counterStart;
  
  // ANTI-BOT: Calculate sleep time for throttling
  // Target: maxHps hashes per second
  // Sleep for ~1ms every N hashes to achieve target rate
  const msPerHash = 1000 / maxHps;
  const hashesPerBatch = 100; // Process 100 hashes, then check if we need to sleep
  const targetBatchMs = hashesPerBatch * msPerHash;
  
  let batchStart = performance.now();
  let batchCount = 0;

  console.log(`[WORKER] Starting STRICT mining: counter [${counterStart}, ${counterEnd}), maxHps=${maxHps}, allowedSuffixes=${allowedSuffixes.length}`);

  while (running && counter < counterEnd) {
    // Check running flag - immediate exit
    if (!running) {
      console.log('[WORKER] Stop flag detected, exiting mine loop');
      ctx.postMessage({ 
        type: 'STOPPED', 
        sid: sid || '', 
        reason: 'manual_stop' 
      } as OutStopped);
      return;
    }

    const preimage = `${nonce}:${counter}`;
    const hash = sha256HexAscii(preimage);
    attempts++;
    batchCount++;

    // STRICT: Check against allowedSuffixes
    const ok = hashMatchesAllowedSuffixes(hash, allowedSuffixes);

    if (ok) {
      running = false;
      const elapsed = (performance.now() - startTs) / 1000;
      const hr = Math.round((attempts / elapsed) * 10) / 10;
      const out: OutFound = {
        type: 'FOUND',
        hash,
        preimage,
        attempts,
        hr,
        sid: sid || '',
        counter,
      };
      console.log('[WORKER] Found hash!', out);
      ctx.postMessage(out);
      return;
    }

    counter++;

    // ANTI-BOT: Throttle to maxHps
    if (batchCount >= hashesPerBatch) {
      const batchElapsed = performance.now() - batchStart;
      const sleepMs = Math.max(0, targetBatchMs - batchElapsed);
      
      if (sleepMs > 1) {
        // Add jitter (±10%) to make throttling less detectable
        const jitter = sleepMs * 0.1 * (Math.random() * 2 - 1);
        const actualSleep = Math.max(1, sleepMs + jitter);
        
        // Busy-wait sleep (more accurate than setTimeout in worker)
        const sleepUntil = performance.now() + actualSleep;
        while (performance.now() < sleepUntil && running) {
          // Spin
        }
      }
      
      batchStart = performance.now();
      batchCount = 0;
    }

    // Send TICK for UI updates
    if (attempts % 256 === 0) {
      const now = performance.now();
      if (now - lastTickTs > 80) { // ~12 fps for smooth visualizer
        lastTickTs = now;
        const elapsed = (now - startTs) / 1000;
        const currentHr = attempts / elapsed;
        const progress = Math.min(100, ((counter - counterStart) / totalWindow) * 100);
        const remaining = counterEnd - counter;
        const estimatedSecondsLeft = remaining / Math.max(1, currentHr);
        
        const out: OutTick = { 
          type: 'TICK', 
          attempts, 
          hr: Math.round(currentHr),
          hash,
          nibs: sampleNibs(hash),
          sid: sid || '',
          counter,
          progress,
          estimatedSecondsLeft: Math.round(estimatedSecondsLeft),
        };
        ctx.postMessage(out);
      }
    }
  }

  // Reached end of counter window without finding hash
  if (counter >= counterEnd) {
    running = false;
    console.log(`[WORKER] Exhausted counter window [${counterStart}, ${counterEnd})`);
    ctx.postMessage({ 
      type: 'STOPPED', 
      sid: sid || '', 
      reason: 'window_exhausted' 
    } as OutStopped);
  }
}

ctx.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  console.log('[WORKER] Received message:', msg.type);
  
  if (msg.type === 'STOP') {
    console.log('[WORKER] Stopping...');
    running = false;
    return;
  }
  
  if (msg.type === 'START') {
    // Stop any existing work
    if (running) {
      console.log('[WORKER] Stopping previous work before starting new job');
      running = false;
    }
    
    const { job, sid: incomingSid } = msg;
    sid = incomingSid;

    // STRICT: Validate required fields
    if (!job.counterStart && job.counterStart !== 0) {
      const out: OutError = { 
        type: 'ERROR', 
        message: 'Job missing counterStart - client must upgrade',
        sid: sid || '',
      };
      ctx.postMessage(out);
      return;
    }
    
    if (!job.counterEnd) {
      const out: OutError = { 
        type: 'ERROR', 
        message: 'Job missing counterEnd - client must upgrade',
        sid: sid || '',
      };
      ctx.postMessage(out);
      return;
    }
    
    if (!job.maxHps) {
      const out: OutError = { 
        type: 'ERROR', 
        message: 'Job missing maxHps - client must upgrade',
        sid: sid || '',
      };
      ctx.postMessage(out);
      return;
    }
    
    if (!job.allowedSuffixes || job.allowedSuffixes.length === 0) {
      const out: OutError = { 
        type: 'ERROR', 
        message: 'Job missing allowedSuffixes - client must upgrade',
        sid: sid || '',
      };
      ctx.postMessage(out);
      return;
    }

    console.log('[WORKER] Starting STRICT mining with validated job');
    
    try {
      mine({ 
        nonce: job.nonce,
        counterStart: job.counterStart,
        counterEnd: job.counterEnd,
        maxHps: job.maxHps,
        allowedSuffixes: job.allowedSuffixes,
      });
    } catch (err) {
      const out: OutError = { 
        type: 'ERROR', 
        message: String((err instanceof Error ? err.message : String(err))),
        sid: sid || '',
      };
      ctx.postMessage(out);
    }
  }
};
