# 🚀 Tiered Rewards Deployment Checklist

## Pre-Deployment

### ✅ Contract Testing
- [ ] All unit tests pass (`forge test`)
- [ ] Fuzz tests validate tier mapping (`forge test --match-contract FuzzTieredRewardsTest`)
- [ ] Contracts compile without warnings (`forge build`)
- [ ] EIP-712 signatures work correctly
- [ ] All 16 reward tiers (8-128 ABIT) validated

### ✅ Security Review
- [ ] Signer role-based access control implemented
- [ ] Pause/unpause functionality tested
- [ ] Admin functions restricted to DEFAULT_ADMIN_ROLE
- [ ] Nonce replay protection verified
- [ ] Cartridge ownership verification working

## Staging Deployment

### 1. Deploy Contracts to Curtis Testnet
```bash
cd contracts
PRIVATE_KEY=your_private_key npx hardhat run scripts/deploy_staging.js --network curtis
```

### 2. Verify Deployment
- [ ] ApeBitToken deployed successfully
- [ ] MiningClaimRouter deployed successfully
- [ ] MINTER_ROLE granted to router
- [ ] Reward table seeded correctly (8-128 ABIT)
- [ ] Signer role granted correctly

### 3. Update Backend Configuration
```bash
# Update staging backend .env
ROUTER_ADDRESS=0x...
REWARD_TOKEN_ADDRESS=0x...
SIGNER_PRIVATE_KEY=0x...
CHAIN_ID=33111
CLAIM_LEGACY_ENABLED=false
REPLAY_CHECK_ONCHAIN=false
```

### 4. Update Frontend Configuration
```bash
# Update staging frontend .env.local
NEXT_PUBLIC_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=33111
NEXT_PUBLIC_API_BASE=https://staging-api.minerboy.io
```

## Post-Deployment Testing

### ✅ End-to-End Validation
- [ ] Mining flow works end-to-end
- [ ] CLAIM banner shows correct tier info
- [ ] claimV2() executes successfully
- [ ] ABIT tokens minted correctly
- [ ] All 16 reward tiers testable
- [ ] Error handling works (expired claims, bad signatures)

### ✅ Admin Functions
- [ ] Pause/unpause works
- [ ] Reward table updates work
- [ ] Signer rotation works
- [ ] Cartridge allowlist updates work

### ✅ Monitoring Setup
- [ ] Health check endpoint working (`/healthz`)
- [ ] Version endpoint working (`/version`)
- [ ] Logging configured for tier, amount, difficulty
- [ ] Error rate monitoring enabled
- [ ] Claim success rate tracking

## Production Readiness

### ✅ Security Hardening
- [ ] DEFAULT_ADMIN_ROLE transferred to multisig
- [ ] Signer key rotated to production key
- [ ] Rate limiting enabled
- [ ] Anomaly detection configured
- [ ] Emergency pause procedures documented

### ✅ Operational Readiness
- [ ] Deployment scripts tested
- [ ] Rollback procedures documented
- [ ] Monitoring alerts configured
- [ ] Support procedures established
- [ ] Documentation updated

## Rollback Plan

### If Issues Detected
1. **Immediate**: Pause claims using `pauseClaims()`
2. **Investigate**: Check logs and error rates
3. **Fix**: Deploy updated contracts if needed
4. **Resume**: Unpause with `unpauseClaims()`

### Emergency Contacts
- **Dev Team**: [Contact Info]
- **Ops Team**: [Contact Info]
- **Security Team**: [Contact Info]

## Success Criteria

### ✅ Launch Success Metrics
- [ ] 0 critical errors in first 24 hours
- [ ] >95% claim success rate
- [ ] All 16 reward tiers functioning
- [ ] No security incidents
- [ ] User feedback positive

### ✅ Performance Metrics
- [ ] Average claim time < 30 seconds
- [ ] API response time < 2 seconds
- [ ] 99.9% uptime maintained
- [ ] No gas optimization issues

---

**Deployment Date**: ___________  
**Deployed By**: ___________  
**Verified By**: ___________  
**Status**: ___________ (Pending/In Progress/Complete/Failed)
