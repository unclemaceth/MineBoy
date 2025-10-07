/**
 * Health Status Tracker
 * Phase 3: Monitoring & Ops
 */

import { formatEther } from 'ethers';
import { flywheel, treasury } from '../wallets.js';
import { cfg } from '../config.js';
import { hasLock } from '../redis.js';

// Track last activity timestamps
export const health = {
  lastBuyAt: null as Date | null,
  lastListAt: null as Date | null,
  lastBurnAt: null as Date | null,
  lastSwapFailure: null as Date | null,
  lastBuyFailure: null as Date | null,
  lastListFailure: null as Date | null,
  
  // Counters
  totalBuys: 0,
  totalSales: 0,
  totalBurns: 0,
  totalSwapFailures: 0,
  totalBuyFailures: 0,
  totalListFailures: 0,
  
  // Rate limit tracking
  currentPurchasesPerMin: 0,
  currentListingsPerHour: 0,
};

export function recordBuy() {
  health.lastBuyAt = new Date();
  health.totalBuys++;
}

export function recordList() {
  health.lastListAt = new Date();
  // Don't increment totalSales here - that's for actual sales (confirmations)
}

export function recordBurn() {
  health.lastBurnAt = new Date();
  health.totalBurns++;
}

export function recordBuyFailure() {
  health.lastBuyFailure = new Date();
  health.totalBuyFailures++;
}

export function recordListFailure() {
  health.lastListFailure = new Date();
  health.totalListFailures++;
}

export function recordSwapFailure() {
  health.lastSwapFailure = new Date();
  health.totalSwapFailures++;
}

/**
 * Get current health status as JSON
 */
export async function getHealthStatus(): Promise<{
  ok: boolean;
  emergencyStop: boolean;
  burnLock: string;
  lastBuyAt: string | null;
  lastListAt: string | null;
  lastBurnAt: string | null;
  balances: {
    flywheelAPE: string;
    treasuryAPE: string;
    treasuryMNESTR: string;
  };
  counters: {
    totalBuys: number;
    totalBurns: number;
    totalSwapFailures: number;
    totalBuyFailures: number;
    totalListFailures: number;
  };
  version: string;
}> {
  const emergencyStop = process.env.EMERGENCY_STOP === '1' || process.env.EMERGENCY_STOP === 'true';
  
  // Check burn lock status
  const burnLockHeld = await hasLock('flywheel:burn:lock');
  
  // Get wallet balances
  const flywheelAddr = await flywheel.getAddress();
  const treasuryAddr = await treasury.getAddress();
  
  const flywheelAPE = await flywheel.provider!.getBalance(flywheelAddr);
  const treasuryAPE = await treasury.provider!.getBalance(treasuryAddr);
  
  // Get MNESTR balance
  const { Contract } = await import('ethers');
  const mnestrContract = new Contract(
    cfg.mnestr,
    ['function balanceOf(address) view returns (uint256)'],
    treasury.provider
  );
  const treasuryMNESTR = await mnestrContract.balanceOf(treasuryAddr);
  
  return {
    ok: !emergencyStop,
    emergencyStop,
    burnLock: burnLockHeld ? 'locked' : 'free',
    lastBuyAt: health.lastBuyAt?.toISOString() ?? null,
    lastListAt: health.lastListAt?.toISOString() ?? null,
    lastBurnAt: health.lastBurnAt?.toISOString() ?? null,
    balances: {
      flywheelAPE: formatEther(flywheelAPE),
      treasuryAPE: formatEther(treasuryAPE),
      treasuryMNESTR: formatEther(treasuryMNESTR),
    },
    counters: {
      totalBuys: health.totalBuys,
      totalBurns: health.totalBurns,
      totalSwapFailures: health.totalSwapFailures,
      totalBuyFailures: health.totalBuyFailures,
      totalListFailures: health.totalListFailures,
    },
    version: process.env.RENDER_GIT_COMMIT?.substring(0, 7) || 'dev',
  };
}

/**
 * Check for anomalies and return warnings
 */
export function checkAnomalies(): string[] {
  const warnings: string[] = [];
  const now = Date.now();
  
  // No activity for 6 hours (during market hours UTC 10-22)
  const utcHour = new Date().getUTCHours();
  const isMarketHours = utcHour >= 10 && utcHour <= 22;
  
  if (isMarketHours) {
    const sixHoursMs = 6 * 60 * 60 * 1000;
    
    if (health.lastBuyAt && (now - health.lastBuyAt.getTime()) > sixHoursMs) {
      warnings.push('No buys for 6+ hours during market hours');
    }
    
    if (health.lastListAt && (now - health.lastListAt.getTime()) > sixHoursMs) {
      warnings.push('No listings for 6+ hours during market hours');
    }
  }
  
  // Treasury stuck (no burn for 2h while having APE)
  const twoHoursMs = 2 * 60 * 60 * 1000;
  if (health.lastBurnAt && (now - health.lastBurnAt.getTime()) > twoHoursMs) {
    warnings.push('No burn for 2+ hours (treasury may be stuck)');
  }
  
  return warnings;
}
