class HeartbeatController {
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private inFlight = false;
  private inClaim = false;

  start(fn: () => Promise<void>, intervalMs = 5000) {
    if (this.active) return;
    this.active = true;
    this.timer = setInterval(async () => {
      if (this.inFlight || this.inClaim) return;
      this.inFlight = true;
      try { 
        await fn(); 
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      } finally { 
        this.inFlight = false; 
      }
    }, intervalMs);
    console.log('[HeartbeatController] Started');
  }

  async tickOnce(fn: () => Promise<void>) {
    if (this.inFlight || this.inClaim) return;
    this.inFlight = true;
    try { 
      await fn(); 
    } catch (error) {
      console.warn('Heartbeat tick failed:', error);
    } finally { 
      this.inFlight = false; 
    }
  }

  stop() {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.inFlight = false;
    console.log('[HeartbeatController] Stopped');
  }

  pauseForClaim() {
    this.inClaim = true;
    console.log('[HeartbeatController] Paused for claim');
  }

  resumeAfterClaim() {
    this.inClaim = false;
    console.log('[HeartbeatController] Resumed after claim');
  }

  isActive() { 
    return this.active; 
  }

  isInClaim() {
    return this.inClaim;
  }
}

export const heartbeat = new HeartbeatController();
