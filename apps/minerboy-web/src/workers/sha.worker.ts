// @ts-ignore - tell TS it's a worker module
export {};

import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

type InStart = {
  type: 'START';
  job: {
    algo: 'sha256-suffix';
    suffix: string;      // lowercase expected
    charset: 'hex';
    nonce: string;       // 0x...
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

const ctx: DedicatedWorkerGlobalScope = self as any;

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

function mineSuffix(nonce: string, suffix: string) {
  console.log('mineSuffix called with:', { nonce, suffix });
  const lowerSuffix = toLowerHex(suffix);
  console.log('Looking for suffix:', lowerSuffix);
  
  // Quick SHA-256 sanity check
  const testHash = sha256HexAscii('test');
  console.log('SHA-256 test: sha256("test") =', testHash);
  console.log('Expected: 0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  
  startTs = performance.now();
  lastTickTs = startTs;
  attempts = 0;
  running = true;

  // very simple stream: preimage = `${nonce}:${counterHex}`
  let counter = 0;
  console.log('Starting mining loop...');

  while (running) {
    const preimage = `${nonce}:${counter}`;        // nonce as-is; counter decimal
    const hash = sha256HexAscii(preimage);         // sha256(utf8(preimage)) -> 0x + hex
    attempts++;
    counter++; // Move counter increment right after attempts

    // Debug first few attempts and every 1000 after
    if (attempts <= 10 || attempts % 1000 === 0) {
      console.log(`Attempt ${attempts}: preimage="${preimage}" -> hash="${hash}" (ends with "${hash.slice(-2)}")`);
    }

    if (hash.toLowerCase().endsWith(lowerSuffix)) {
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
    const { algo, suffix, nonce } = msg.job;
    console.log('Worker starting with:', { algo, suffix, nonce });
    
    if (algo !== 'sha256-suffix') {
      const out: OutError = { type: 'ERROR', message: `Unsupported algo: ${algo}` };
      ctx.postMessage(out);
      return;
    }
    // fire and forget
    console.log('Worker calling mineSuffix...');
    try {
      mineSuffix(nonce, suffix);
    } catch (err) {
      console.log('Worker error:', err);
      const out: OutError = { type: 'ERROR', message: String(err?.message || err) };
      ctx.postMessage(out);
    }
  }
};
