# Environment Variables for Delegate.xyz V3.1

## Backend Environment Variables

Add these to your `.env` file or Render dashboard:

```bash
# V3.1 Router Address (from deployment)
ROUTER_V3_1_ADDRESS=0x1234567890abcdef1234567890abcdef12345678

# Feature Flag (START WITH FALSE!)
DELEGATE_PHASE1_ENABLED=false

# Existing Variables (no changes needed)
RPC_URL=https://apechain.caldera.xyz/http
CHAIN_ID=33139
ROUTER_ADDRESS=0xOLD_V3_ADDRESS_HERE
REWARD_TOKEN_ADDRESS=0xABIT_TOKEN_ADDRESS
SIGNER_PRIVATE_KEY=0xYOUR_BACKEND_SIGNER_PRIVATE_KEY
TREASURY_WALLET=0xYOUR_TREASURY_ADDRESS
```

### On Render:
1. Dashboard → Your Service → Environment
2. Click "Add Environment Variable"
3. Add `ROUTER_V3_1_ADDRESS` = `0x...`
4. Add `DELEGATE_PHASE1_ENABLED` = `false`
5. Click "Save Changes" (triggers redeploy)

---

## Frontend Environment Variables

Add these to `.env.local` (local dev) and Vercel/hosting (production):

```bash
# V3.1 Router Address (same as backend)
NEXT_PUBLIC_ROUTER_V3_1_ADDRESS=0x1234567890abcdef1234567890abcdef12345678

# Feature Flag (START WITH FALSE!)
NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED=false

# Existing Variables
NEXT_PUBLIC_API_BASE=https://mineboy-g5xo.onrender.com
NEXT_PUBLIC_ROUTER_ADDRESS=0xOLD_V3_ADDRESS_HERE
NEXT_PUBLIC_CHAIN_ID=33139
```

### On Vercel:
1. Project Settings → Environment Variables
2. Add `NEXT_PUBLIC_ROUTER_V3_1_ADDRESS` = `0x...`
3. Add `NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED` = `false`
4. Redeploy (or wait for next auto-deploy)

---

## Deployment Environment Variables

When deploying the V3_1 contract, you need these:

```bash
# Foundry Deployment (.env or export)
DEPLOYER_PRIVATE_KEY=0xYOUR_DEPLOYER_WALLET_PRIVATE_KEY
REWARD_TOKEN_ADDRESS=0xABIT_TOKEN_ADDRESS
TREASURY_WALLET=0xYOUR_TREASURY_ADDRESS
BACKEND_SIGNER_ADDRESS=0xYOUR_BACKEND_SIGNER_PUBLIC_ADDRESS
ADMIN_ADDRESS=0xYOUR_ADMIN_ADDRESS
RPC_URL=https://apechain.caldera.xyz/http
```

**Important:**
- `BACKEND_SIGNER_ADDRESS` is the PUBLIC address (not private key!)
- This must match the private key in backend's `SIGNER_PRIVATE_KEY`
- Same signer as V3 (for consistency)

---

## Feature Flag Workflow

### Phase 1: Deploy (flags OFF)
```bash
# Backend
DELEGATE_PHASE1_ENABLED=false

# Frontend
NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED=false
```
**Result:** V3 behavior, V3.1 code dormant

### Phase 2: Staging Test (flags ON)
```bash
# Backend (staging only)
DELEGATE_PHASE1_ENABLED=true

# Frontend (staging only)
NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED=true
```
**Result:** V3.1 active, delegate flow enabled

### Phase 3: Production Rollout
```bash
# Backend (production)
DELEGATE_PHASE1_ENABLED=true

# Frontend (production)
NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED=true
```
**Result:** Users can delegate cold wallets

### Phase 4: Rollback (if needed)
```bash
# Flip both back to false
DELEGATE_PHASE1_ENABLED=false
NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED=false
```
**Result:** Instant rollback to V3

---

## Quick Checklist

- [ ] Deploy V3_1 contract → get address
- [ ] Add `ROUTER_V3_1_ADDRESS` to backend (Render)
- [ ] Add `DELEGATE_PHASE1_ENABLED=false` to backend
- [ ] Add `NEXT_PUBLIC_ROUTER_V3_1_ADDRESS` to frontend (Vercel)
- [ ] Add `NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED=false` to frontend
- [ ] Redeploy both (auto-triggers on Render/Vercel)
- [ ] Test V3 still works (flags off = V3 mode)
- [ ] Create staging environment
- [ ] Flip flags to `true` on staging
- [ ] Test delegate flow
- [ ] Flip flags to `true` on production (when ready)

---

## Troubleshooting

**Backend not recognizing flag:**
- Check Render dashboard → Environment
- Verify `DELEGATE_PHASE1_ENABLED` exists
- Check logs: `[DELEGATE]` messages should appear when enabled

**Frontend not showing vault UI:**
- Check `.env.local` (local) or Vercel dashboard (prod)
- Verify `NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED` exists
- Check browser console: `process.env.NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED`

**Wrong router being used:**
- Backend checks `config.DELEGATE_PHASE1_ENABLED`
- If `true` → uses `ROUTER_V3_1_ADDRESS`
- If `false` → uses `ROUTER_ADDRESS` (V3)
- Check backend logs: `[CLAIM_SIGN_V3]` vs `[CLAIM_SIGN_V3.1]`

**Delegation not working:**
- Ensure Delegate.xyz registry deployed on ApeChain
- Check delegation at: https://delegate.xyz
- Verify vault address owns the NFT
- Check backend logs: `[DELEGATE] Checking delegation...`

---

## Security Notes

1. **Never commit `.env` files to git**
   - Add `.env` to `.gitignore`
   - Use Render/Vercel dashboards for production

2. **Start with flags OFF**
   - Deploy everything first
   - Test V3 works
   - Then enable delegate

3. **Private keys never in frontend**
   - `NEXT_PUBLIC_*` vars are PUBLIC
   - Never put private keys in frontend env vars

4. **Instant rollback ready**
   - Any issues → flip flags to `false`
   - No code changes needed

---

## Summary

**2 new backend vars:**
- `ROUTER_V3_1_ADDRESS` = deployed contract
- `DELEGATE_PHASE1_ENABLED` = false (start)

**2 new frontend vars:**
- `NEXT_PUBLIC_ROUTER_V3_1_ADDRESS` = deployed contract
- `NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED` = false (start)

**All other vars:** No changes needed!

Done! 🎉

