# ✅ Complete NPC Flywheel Bot Setup Checklist

## 🎯 Overview

This bot will automatically:
1. Buy cheap NPCs from the marketplace
2. Relist them at +20% markup
3. When sold, swap 99% of APE profits → MNESTR
4. Burn ALL the MNESTR (creating scarcity!)
5. Repeat forever

---

## 📋 COMPLETE CHECKLIST

### Phase 1: Liquidity Setup (FIRST TIME ONLY) ⚠️

This creates the MNESTR/APE pool so the bot can swap and burn.

- [ ] **1.1 Add environment variables to `.env`:**
  ```bash
  ADMIN_PRIVATE_KEY=0x...        # Key that can mint MNESTR
  LP_WALLET=0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043
  LP_PRIVATE_KEY=0x...           # Private key for LP wallet
  ```

- [ ] **1.2 Mint MNESTR for liquidity:**
  ```bash
  cd /Users/mattrenshaw/ApeBit\ Miner/packages/flywheel-bot
  npm run script:mint
  ```
  ✅ Success: "LP Wallet now has: 10000000 MNESTR"

- [ ] **1.3 Send APE to LP wallet:**
  - Send 100-200 APE to `0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043`
  - Check balance: https://apescan.io/address/0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043

- [ ] **1.4 Create MNESTR/APE pool on Camelot:**
  ```bash
  npm run script:add-liquidity
  ```
  ✅ Success: "🎉 SUCCESS! The MNESTR/APE pool is now live!"

- [ ] **1.5 (Optional) Lock or burn LP tokens for trust**

**📖 Detailed Guide:** See [LIQUIDITY_SETUP.md](./LIQUIDITY_SETUP.md)

---

### Phase 2: Bot Configuration

Now configure the actual trading bot.

- [ ] **2.1 Add Flywheel wallet private key to `.env`:**
  ```bash
  FLYWHEEL_PRIVATE_KEY=0x...     # Private key for 0x08AD...B0C4
  ```

- [ ] **2.2 Verify all addresses in `.env`:**
  ```bash
  MNESTR=0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276 ✓
  NPC_COLLECTION=0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA ✓
  FLYWHEEL_WALLET=0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4 ✓
  MARKET_ROUTER=0x224ecB4Eae96d31372D1090c3B0233C8310dBbaB ✓
  DEX_ROUTER=0x18E621B64d7808c3C47bccbbD7485d23F257D26f ✓
  WAPE=0x48b62137EdfA95a428D35C09E44256a739F6B557 ✓
  ```

- [ ] **2.3 Adjust policy settings if needed:**
  ```bash
  MARKUP_BPS=2000              # 2000 = +20% relist
  DAILY_SPEND_CAP_APE=250      # Max APE to spend per day
  BUY_BUFFER_BPS=100           # 1% buffer for gas
  ```

---

### Phase 3: Listing Source

The bot needs to know WHAT to buy. Choose one:

#### Option A: Manual Testing (Start Here)

- [ ] **3.1 Get a test listing from OpenSea/Magic Eden:**
  - Find a cheap NPC for sale
  - Copy the transaction data (to, data, value)

- [ ] **3.2 Edit `src/market/manualListings.ts`:**
  ```typescript
  export async function getNextListing(): Promise<ManualListing | null> {
    return {
      to: "0x224ecB4Eae96d31372D1090c3B0233C8310dBbaB",
      data: "0x...", // Paste calldata here
      valueWei: "10000000000000000", // 0.01 APE example
      tokenId: "123",
      priceNative: "0.01"
    };
  }
  ```

#### Option B: API Integration (Production)

- [ ] **3.3 Get API key** from OpenSea or Magic Eden
- [ ] **3.4 Implement API calls** in `manualListings.ts`
- [ ] **3.5 Test API** returns valid listings

---

### Phase 4: Testing Locally

- [ ] **4.1 Run the bot locally:**
  ```bash
  cd /Users/mattrenshaw/ApeBit\ Miner/packages/flywheel-bot
  npm run dev
  ```

- [ ] **4.2 Verify startup output:**
  ```
  ╔════════════════════════════════════════════════════════╗
  ║       NPC FLYWHEEL BOT - STARTING                      ║
  ╚════════════════════════════════════════════════════════╝
  
  [Init] Flywheel address: 0x08AD...B0C4
  [Init] Daily spend cap: 250 APE
  [Init] Markup: +20%
  [Init] Burn rate: 99%
  ```

- [ ] **4.3 Watch for first buy (if listing available):**
  ```
  [Buy] Attempting to buy tokenId=123 for 0.01 APE
  [Buy:OK] tx=0xabc...
  [Verify:OK] We now own tokenId=123
  ```

- [ ] **4.4 Verify relist happens:**
  ```
  [List:OK] Listed tokenId=123 at 0.012 APE
  ```

**Note:** Relisting currently just logs. See Phase 5 to make it actually list.

---

### Phase 5: Marketplace Relisting (TODO)

Currently the bot LOGS the relist but doesn't create an actual marketplace listing.

- [ ] **5.1 Choose marketplace** (OpenSea or Magic Eden)
- [ ] **5.2 Get API documentation** for creating listings
- [ ] **5.3 Edit `src/market/list.ts`** to call their API
- [ ] **5.4 Test relisting** creates actual marketplace order
- [ ] **5.5 Store orderHash/orderId** for tracking

**This is the missing 5% for full automation!**

---

### Phase 6: End-to-End Test

Once relisting works, test the complete cycle:

- [ ] **6.1 Bot buys an NPC**
  ```
  [Buy:OK] tx=0x...
  ```

- [ ] **6.2 Bot lists it at +20%**
  ```
  [List:OK] Listed at 0.012 APE
  ```

- [ ] **6.3 Someone buys it** (or you buy it manually)
  ```
  [Watch:SOLD] tokenId=123 has been sold!
  ```

- [ ] **6.4 Bot swaps and burns:**
  ```
  [Settle] Processing sale proceeds...
  [Swap] Swapping 9900000000000000 wei APE...
  [Settle] Burning 123456789 wei of MNESTR...
  [Settle:OK] Burned 123456789 wei MNESTR! 🔥
  ```

**✅ If you see that last line = FULL SUCCESS!** 🎉

---

### Phase 7: Production Deployment

- [ ] **7.1 Go to Render.com**
- [ ] **7.2 Create new Background Worker:**
  - Name: `npc-flywheel-bot`
  - Repo: Your GitHub repo
  - Root Directory: `packages/flywheel-bot`
  - Build Command: `npm install`
  - Start Command: `npm run dev`
  - Node: 18+

- [ ] **7.3 Add ALL environment variables from `.env`**
  - Copy from your local `.env`
  - Use "Secret File" for `FLYWHEEL_PRIVATE_KEY`

- [ ] **7.4 Deploy and monitor logs**
  - Should see bot startup
  - Watch for buy/sell/burn cycles

- [ ] **7.5 Set up monitoring/alerts** (optional)
  - Slack/Discord webhook for burns
  - Email alerts for errors
  - Dashboard for stats

---

## 🔍 Verification Checklist

### Liquidity Pool
- [ ] MNESTR/APE pair exists on Camelot
- [ ] Can manually swap small amount (0.1 APE → MNESTR)
- [ ] LP tokens visible in LP wallet

### Bot Startup
- [ ] Bot shows correct Flywheel address
- [ ] Shows correct configuration (markup, cap)
- [ ] No immediate errors

### First Buy
- [ ] Transaction confirms on-chain
- [ ] Bot verifies NFT ownership
- [ ] Spend tracked correctly

### First Sale
- [ ] Bot detects sale
- [ ] Swap executes successfully
- [ ] MNESTR burn confirms
- [ ] Total supply decreased

---

## 📊 Monitoring Metrics

Track these to measure success:

### Key Metrics
- **MNESTR Total Supply** (should decrease over time)
- **Flywheel APE Balance** (grows from claims, shrinks from buys)
- **Total MNESTR Burned** (accumulates with each cycle)
- **NPCs Owned** (should be 0-1 most of the time)
- **Successful Cycles** (buy → sell → burn count)

### Where to Check
- **MNESTR Supply:** ApeScan token page
- **Flywheel Balance:** https://apescan.io/address/0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4
- **Bot Logs:** Render dashboard or local terminal
- **Transaction History:** ApeScan for Flywheel wallet

---

## 🚨 Safety Features

Built-in protections:

- ✅ **Daily spend cap** (250 APE max per day)
- ✅ **Gas buffer** (keeps 1% APE for fees)
- ✅ **Ownership verification** (confirms we received NFT)
- ✅ **Balance checks** (only buys if we can afford it)
- ✅ **Burn confirmation** (logs all burns with tx hash)

---

## 🐛 Common Issues

### "No listings available"
- Check `getNextListing()` returns valid data
- Verify listing still exists on marketplace

### "Not enough APE"
- Flywheel wallet needs more APE
- Wait for claims to accumulate (0.005 APE each)

### "Swap failed"
- Verify liquidity pool exists (Phase 1)
- Check DEX_ROUTER address is correct
- Ensure WAPE→MNESTR route has liquidity

### "NFT not received"
- Listing may have been sold already
- Check MARKET_ROUTER address is correct
- Verify calldata is valid

---

## 📖 Documentation

- **LIQUIDITY_SETUP.md** - How to create the MNESTR/APE pool
- **SETUP_GUIDE.md** - Quick start guide
- **README.md** - Technical documentation
- **This file** - Complete checklist

---

## 🎯 Success Criteria

You'll know everything is working when:

1. ✅ MNESTR/APE pool exists on Camelot
2. ✅ Bot runs without errors
3. ✅ Bot buys NPCs when available
4. ✅ Bot lists them at +20%
5. ✅ When sold, bot swaps 99% APE → MNESTR
6. ✅ Bot burns ALL MNESTR received
7. ✅ MNESTR total supply decreases with each burn
8. ✅ Cycle repeats automatically

**The ultimate success metric:** MNESTR supply going DOWN over time! 📉🔥

---

## 🎉 You're Ready!

Follow this checklist top to bottom, and you'll have a fully automated NPC trading bot that creates deflationary pressure on MNESTR!

**Current Progress:**
- ✅ Bot code: 95% complete
- ⚠️ Liquidity: Need to run setup scripts
- ⚠️ Relisting: Need marketplace API integration
- ⚠️ Testing: Need end-to-end test

**Next immediate steps:**
1. Run Phase 1 (liquidity setup)
2. Run Phase 2-4 (bot configuration and testing)
3. Add marketplace relisting (Phase 5)
4. Deploy to production (Phase 7)

Need help with any step? Just ask! 🚀
