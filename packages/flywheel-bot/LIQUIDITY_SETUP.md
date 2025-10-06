# 💧 Setting Up MNESTR Liquidity

## 🎯 Why You Need This

The bot needs to swap APE → MNESTR to burn it. But right now:
- ❌ **No MNESTR in circulation** (nothing has been minted yet)
- ❌ **No liquidity pool on Camelot** (nowhere to swap)

So we need to:
1. ✅ **Mint** MNESTR for the liquidity pool
2. ✅ **Create** the MNESTR/APE pool on Camelot
3. ✅ **Then** the bot can swap and burn!

---

## 📋 What You'll Need

### Environment Variables

Edit `.env` and add these:

```bash
# Admin key (whoever can mint MNESTR - probably V3 Router deployer)
ADMIN_PRIVATE_KEY=0x...

# LP wallet info (already set)
LP_WALLET=0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043
LP_PRIVATE_KEY=0x...
```

### Resources Needed

- **ADMIN_PRIVATE_KEY**: The key that can mint MNESTR (probably your deployer key)
- **LP_WALLET APE**: ~100-200 APE to pair with MNESTR
- **Time**: ~5 minutes total

---

## 🚀 Step-by-Step Guide

### Step 1: Mint MNESTR (1 minute)

This mints 10,000,000 MNESTR to the LP wallet (1% of the 1B cap).

```bash
cd /Users/mattrenshaw/ApeBit\ Miner/packages/flywheel-bot
npm run script:mint
```

**You should see:**
```
╔═══════════════════════════════════════════╗
║   STEP 1: MINT MNESTR FOR LP              ║
╚═══════════════════════════════════════════╝

MNESTR Token: 0xAe0D...C276
Current Supply: 0 MNESTR
Cap: 1000000000 MNESTR

Minting...
✅ Minted successfully!
LP Wallet now has: 10000000 MNESTR

✅ Step 1 Complete!
```

**What just happened?**
- 10M MNESTR was created and sent to your LP wallet
- This is ~1% of the 1B total supply cap
- Still 990M MNESTR left to mint (Router will mint more as people claim)

---

### Step 2: Add APE to LP Wallet (manual)

Before creating the pool, make sure your LP wallet has APE:

```bash
# Check LP wallet balance at:
# https://apescan.io/address/0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043

# If it needs APE, send ~100-200 APE from another wallet
```

**How much APE do you need?**

The initial price will be: `APE_amount / MNESTR_amount`

Examples:
- **100 APE + 10M MNESTR = 0.00001 APE per MNESTR** (recommended start)
- **200 APE + 10M MNESTR = 0.00002 APE per MNESTR**
- **50 APE + 10M MNESTR = 0.000005 APE per MNESTR**

Start conservative (100-200 APE is fine). You can add more liquidity later.

---

### Step 3: Create the Pool (2 minutes)

This pairs your MNESTR with APE on Camelot DEX:

```bash
npm run script:add-liquidity
```

**Before running, edit the script** if you want different amounts:

Open `scripts/02-add-liquidity.ts` and change:
```typescript
const mnestrToAddHuman = "10000000";  // How much MNESTR
const apeToAddHuman = "100";          // How much APE
```

**You should see:**
```
╔═══════════════════════════════════════════╗
║   STEP 2: ADD LIQUIDITY TO CAMELOT        ║
╚═══════════════════════════════════════════╝

LP Wallet: 0xB8bb...A043
MNESTR Balance: 10000000 MNESTR
APE Balance: 150 APE

Preparing to add liquidity:
   MNESTR: 10000000
   APE: 100
   Initial Price: 0.00001 APE per MNESTR

Approving router...
✅ Approval confirmed

Adding liquidity to Camelot...
✅ Liquidity added!

🎉 SUCCESS! The MNESTR/APE pool is now live!
```

**What just happened?**
- Created a new MNESTR/APE trading pair on Camelot
- Set the initial price
- You received LP tokens in your LP wallet
- **The bot can now swap APE → MNESTR!** 🎉

---

## 🔒 Step 4: Lock LP Tokens (Optional but Recommended)

You now hold LP tokens in your LP wallet. For trust/security:

**Option A: Burn them** (most trustless)
```bash
# Send LP tokens to 0x000000000000000000000000000000000000dEaD
# This makes liquidity PERMANENT (can never be removed)
```

**Option B: Lock them** (flexible)
```bash
# Use a timelock contract (locks for X months/years)
# Gives you option to adjust later
```

**Option C: Keep them** (least trust)
```bash
# Keep control of liquidity (can add/remove)
# Less trustless but more flexible
```

---

## ✅ Verification

### Check the Pool Exists

Visit Camelot DEX on ApeChain:
```
https://app.camelot.exchange/pools
```

Search for MNESTR - you should see the MNESTR/APE pair!

### Test a Small Swap

```bash
# From any wallet, try swapping 0.1 APE → MNESTR
# Should work without errors
```

### Check LP Balance

```bash
# Your LP wallet should have LP tokens
# Check at: https://apescan.io/address/0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043
```

---

## 🧮 Math Examples

### Starting Price Scenarios

| MNESTR | APE | Price per MNESTR | What 1 APE buys |
|--------|-----|------------------|-----------------|
| 10M | 100 | 0.00001 APE | ~100,000 MNESTR |
| 10M | 200 | 0.00002 APE | ~50,000 MNESTR |
| 10M | 50 | 0.000005 APE | ~200,000 MNESTR |
| 5M | 100 | 0.00002 APE | ~50,000 MNESTR |

**Recommendation:** Start with 10M MNESTR + 100 APE (price = 0.00001)

This means when the bot swaps 1 APE of profits, it gets ~100k MNESTR to burn!

---

## 🚨 Important Notes

### One-Time Setup
You only need to run these scripts **ONCE** to bootstrap the system.

After that:
- The V3 Router mints new MNESTR as people claim
- The bot burns MNESTR on every sale
- You can add more liquidity later if needed

### Safety
- **Daily mint from claims:** ~5,000 MNESTR per day (rough estimate)
- **Bot burns:** 99% of every sale goes to burn
- **Net effect:** MNESTR supply should grow slowly from claims, shrink from burns

### When to Add More Liquidity

Add more if:
- Trading volume increases significantly
- Slippage becomes too high (>5%)
- You want to stabilize the price

---

## 🐛 Troubleshooting

### "Not enough MNESTR"
- Run Step 1 (mint) first
- Check LP wallet balance on ApeScan

### "Not enough APE"
- Send more APE to LP wallet before Step 3
- You need ~100-200 APE minimum

### "Transaction failed"
- Check ADMIN_PRIVATE_KEY has MINTER_ROLE
- Verify LP_PRIVATE_KEY is correct
- Ensure gas is available

### "Pool already exists"
- Good! Skip to verification steps
- Check the pool on Camelot

---

## ✅ Checklist

- [ ] Add `ADMIN_PRIVATE_KEY` to `.env`
- [ ] Add `LP_PRIVATE_KEY` to `.env`  
- [ ] Run `npm run script:mint` (Step 1)
- [ ] Send APE to LP wallet (Step 2)
- [ ] Edit amounts in `02-add-liquidity.ts` if desired
- [ ] Run `npm run script:add-liquidity` (Step 3)
- [ ] Verify pool exists on Camelot
- [ ] (Optional) Lock or burn LP tokens
- [ ] Test bot with a small listing

---

## 🎉 You're Done!

Once you see:
```
🎉 SUCCESS! The MNESTR/APE pool is now live!
```

**The bot is ready to burn!** 🔥

Every time it sells an NPC:
1. Takes 99% of APE balance
2. Swaps on Camelot: APE → MNESTR
3. Burns ALL the MNESTR received
4. MNESTR supply decreases! ⬇️

Next: [Run the bot](./SETUP_GUIDE.md) and watch it burn! 🚀
