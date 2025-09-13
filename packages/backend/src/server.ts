import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();

// CORS configuration - lock to claim web origin
app.use(cors({
  origin: ["http://localhost:3000", "https://claim.yourdomain.com"],
  credentials: true
}));

app.use(express.json());

type Device = {
  activeMiner: `0x${string}` | null;
  lastSwitchAt: number;
  dailyClaims: { day: string; count: number };
};
const devices = new Map<string, Device>(); // installId -> device state

type Sess = { exp: number; installId: string; miner: `0x${string}`; skip: boolean };
const sessions = new Map<string, Sess>();

const DAY = () => new Date().toISOString().slice(0,10);
const SWITCH_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const DAILY_FREE_CLAIMS = 3;

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of sessions.entries()) {
    if (sess.exp < now) {
      sessions.delete(token);
    }
  }
}, 60_000); // cleanup every minute

// Create a new session with device-wallet binding
app.post("/session", (req, res) => {
  const { installId, miner } = req.body as { installId?: string; miner?: string };
  
  if (!installId || !miner) {
    return res.status(400).json({ 
      error: "installId and miner required" 
    });
  }

  let d = devices.get(installId);
  const now = Date.now();
  
  if (!d) {
    // New device
    d = { 
      activeMiner: miner as `0x${string}`, 
      lastSwitchAt: now, 
      dailyClaims: { day: DAY(), count: 0 } 
    };
    devices.set(installId, d);
    console.log(`📱 New device ${installId.slice(0, 8)}... bound to ${miner.slice(0, 8)}...`);
  } else if (!d.activeMiner) {
    // Device exists but no miner set
    d.activeMiner = miner as `0x${string}`;
    d.lastSwitchAt = now;
    console.log(`🔗 Device ${installId.slice(0, 8)}... bound to ${miner.slice(0, 8)}...`);
  } else if (d.activeMiner.toLowerCase() !== miner.toLowerCase()) {
    // Trying to switch wallet
    if (now - d.lastSwitchAt < SWITCH_COOLDOWN_MS) {
      const remainingHours = Math.ceil((SWITCH_COOLDOWN_MS - (now - d.lastSwitchAt)) / (60 * 60 * 1000));
      console.log(`⏰ Device ${installId.slice(0, 8)}... switch blocked, ${remainingHours}h remaining`);
      return res.status(429).json({ 
        error: "switch-cooldown",
        message: `Can switch wallet in ${remainingHours} hours`,
        remainingMs: SWITCH_COOLDOWN_MS - (now - d.lastSwitchAt)
      });
    }
    d.activeMiner = miner as `0x${string}`;
    d.lastSwitchAt = now;
    console.log(`🔄 Device ${installId.slice(0, 8)}... switched to ${miner.slice(0, 8)}...`);
  }

  // Create session token
  const token = crypto.randomBytes(24).toString("base64url");
  const exp = now + 90_000; // 90 seconds
  
  sessions.set(token, { 
    exp, 
    installId, 
    miner: miner as `0x${string}`, 
    skip: false 
  });
  
  console.log(`🎫 Session ${token.slice(0, 8)}... created for device ${installId.slice(0, 8)}...`);
  
  res.json({ 
    session: token, 
    ttl: 90,
    expires: exp,
    miner: d.activeMiner
  });
});

// Check if session is valid
app.get("/session/check", (req, res) => {
  const auth = req.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  
  if (!token) {
    return res.status(401).json({ 
      ok: false, 
      error: "No bearer token provided" 
    });
  }
  
  const sess = sessions.get(token);
  const now = Date.now();
  
  if (!sess) {
    console.log(`❌ Session ${token.slice(0, 8)}... not found`);
    return res.status(401).json({ 
      ok: false, 
      error: "Session not found" 
    });
  }
  
  if (sess.exp < now) {
    console.log(`⏰ Session ${token.slice(0, 8)}... expired`);
    sessions.delete(token);
    return res.status(401).json({ 
      ok: false, 
      error: "Session expired" 
    });
  }

  // Verify device binding still matches
  const device = devices.get(sess.installId);
  if (!device || !device.activeMiner || device.activeMiner.toLowerCase() !== sess.miner.toLowerCase()) {
    console.log(`🚫 Session ${token.slice(0, 8)}... device binding mismatch`);
    sessions.delete(token);
    return res.status(403).json({ 
      ok: false, 
      error: "Device binding changed" 
    });
  }
  
  console.log(`✅ Session ${token.slice(0, 8)}... valid (${Math.round((sess.exp - now) / 1000)}s remaining)`);
  
  res.json({ 
    ok: true, 
    miner: sess.miner,
    installId: sess.installId,
    skip: sess.skip, 
    exp: sess.exp,
    remaining: Math.round((sess.exp - now) / 1000)
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: Date.now(),
    activeSessions: sessions.size
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 ApeBit backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Session endpoint: POST http://localhost:${PORT}/session`);
  console.log(`✅ Session check: GET http://localhost:${PORT}/session/check`);
});
