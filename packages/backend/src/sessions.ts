import { OpenSessionReq, Job } from '../../shared/src/mining.ts';
import { config } from './config.js';

export interface SessionData {
  sessionId: string;
  wallet: `0x${string}`;
  cartridge: {
    contract: `0x${string}`;
    tokenId: string;
  };
  createdAt: number;
  lastHeartbeat: number;
  currentJob?: Job;
}

/**
 * Session management - tracks active mining sessions
 */
export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private tokenSessions: Map<string, string> = new Map(); // tokenKey -> sessionId
  
  constructor() {
    // Clean up expired sessions every 30 seconds
    setInterval(() => this.cleanupExpiredSessions(), 30000);
  }
  
  /**
   * Create a new session
   */
  createSession(req: OpenSessionReq): SessionData {
    const sessionId = this.generateSessionId();
    const tokenKey = this.getTokenKey(req.cartridge.contract, req.cartridge.tokenId);
    
    // Close any existing session for this token
    const existingSessionId = this.tokenSessions.get(tokenKey);
    if (existingSessionId) {
      this.closeSession(existingSessionId);
    }
    
    const session: SessionData = {
      sessionId,
      wallet: req.wallet,
      cartridge: {
        contract: req.cartridge.contract,
        tokenId: req.cartridge.tokenId
      },
      createdAt: Date.now(),
      lastHeartbeat: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    this.tokenSessions.set(tokenKey, sessionId);
    
    console.log(`Created session ${sessionId} for wallet ${req.wallet} with token ${tokenKey}`);
    return session;
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Update session heartbeat
   */
  heartbeat(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.lastHeartbeat = Date.now();
    return true;
  }
  
  /**
   * Set current job for session
   */
  setJob(sessionId: string, job: Job): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.currentJob = job;
    return true;
  }
  
  /**
   * Close session
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const tokenKey = this.getTokenKey(session.cartridge.contract, session.cartridge.tokenId);
    
    this.sessions.delete(sessionId);
    this.tokenSessions.delete(tokenKey);
    
    console.log(`Closed session ${sessionId}`);
    return true;
  }
  
  /**
   * Check if session is valid and not expired
   */
  isValidSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const now = Date.now();
    const heartbeatExpiry = session.lastHeartbeat + (config.JOB_TTL_MS * 3); // 3x job TTL
    
    return now < heartbeatExpiry;
  }
  
  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      const heartbeatExpiry = session.lastHeartbeat + (config.JOB_TTL_MS * 3);
      if (now > heartbeatExpiry) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      this.closeSession(sessionId);
    }
    
    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate token key for uniqueness constraint
   */
  private getTokenKey(contract: string, tokenId: string): string {
    return `${contract.toLowerCase()}:${tokenId}`;
  }
  
  /**
   * Get session stats
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(s => ({
        sessionId: s.sessionId,
        wallet: s.wallet,
        tokenKey: this.getTokenKey(s.cartridge.contract, s.cartridge.tokenId),
        age: Date.now() - s.createdAt,
        lastHeartbeat: Date.now() - s.lastHeartbeat
      }))
    };
  }
}

export const sessionManager = new SessionManager();
