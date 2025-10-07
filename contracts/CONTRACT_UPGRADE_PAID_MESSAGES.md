# PaidMessagesRouter Contract Upgrade Needed

## 🚨 ISSUE: Single Price Constraint

### Current Problem
The deployed `PaidMessagesRouter` contract only accepts payments of **exactly one price**:

```solidity
// Line 78-79 in PaidMessagesRouter.sol
function pay(bytes32 msgHash) external payable nonReentrant {
    if (msg.value != price) revert WrongAmount();  // ❌ STRICT EQUALITY
    // ...
}
```

**Impact:**
- Cannot support PAID (1 APE) and SHILL (15 APE) messages simultaneously
- If `price = 1 APE`, then 15 APE payments REVERT
- If `price = 15 APE`, then 1 APE payments REVERT

---

## ✅ WHAT WORKS

### Fee Splits (Implemented Correctly)
The contract properly splits payments 4 ways:
- **Merchant Wallet** (configurable %)
- **Flywheel Wallet** (configurable %) ← NPC trading bot
- **Team Wallet** (configurable %)
- **LP Wallet** (configurable %)

All configurable via `setFeeSplits()` admin function.

---

## 🔧 SOLUTION OPTIONS

### Option A: Minimum Price Check (Simplest)

**Change:**
```solidity
// From:
if (msg.value != price) revert WrongAmount();

// To:
uint256 public minPrice; // Rename from 'price'

if (msg.value < minPrice) revert WrongAmount();
```

**Pros:**
- One line change
- Allows flexible pricing (1 APE, 15 APE, any amount)
- Backend validates correct amounts
- Fee splits still work

**Cons:**
- Users could overpay (but backend prevents this via UI)

---

### Option B: Price Tiers (Proper Multi-Tier)

**Add:**
```solidity
enum MessageType { PAID, SHILL, MINEBOY }

mapping(MessageType => uint256) public prices;

function pay(bytes32 msgHash, MessageType msgType) external payable nonReentrant {
    if (msg.value != prices[msgType]) revert WrongAmount();
    
    // ... fee splits ...
    
    emit Paid(msg.sender, msg.value, msgHash, uint8(msgType));
}

function setPrice(MessageType msgType, uint256 newPrice) external onlyRole(ADMIN_ROLE) {
    prices[msgType] = newPrice;
    emit PriceUpdated(uint8(msgType), newPrice);
}
```

**Pros:**
- Explicit type-based pricing
- Strong validation
- Clear intent

**Cons:**
- More complex
- Frontend needs to pass `msgType` parameter
- ABI changes (need to update frontend)

---

### Option C: Remove Price Check (Fully Flexible)

**Change:**
```solidity
// Remove the check entirely
function pay(bytes32 msgHash) external payable nonReentrant {
    // No price check - accept any amount
    
    // ... fee splits ...
}
```

**Pros:**
- Maximum flexibility
- Backend controls all pricing logic

**Cons:**
- No on-chain price enforcement
- Requires trust in backend validation

---

## 📋 RECOMMENDATION: Option A

**Why:**
1. **Simplest:** One line change
2. **Safe:** Still has minimum price check
3. **Flexible:** Supports any amount ≥ minPrice
4. **Compatible:** No ABI changes, no frontend changes needed
5. **Future-proof:** Can add explicit tiers later if needed

**Implementation:**
```solidity
// PaidMessagesRouter.sol

uint256 public minPrice; // Renamed from 'price'

constructor(
    // ... other params ...
    uint256 _minPrice  // Renamed
) {
    minPrice = _minPrice; // Set to 1 APE
    // ...
}

function pay(bytes32 msgHash) external payable nonReentrant {
    if (msg.value < minPrice) revert WrongAmount();  // ✅ GREATER OR EQUAL
    
    // ... rest stays the same ...
}

function setMinPrice(uint256 newMinPrice) external onlyRole(ADMIN_ROLE) {
    uint256 oldPrice = minPrice;
    minPrice = newMinPrice;
    emit PriceUpdated(oldPrice, newMinPrice);
}
```

---

## 🚀 DEPLOYMENT STEPS

1. **Update Contract:**
   - Change `price` to `minPrice`
   - Change `!=` to `<`
   - Deploy new contract

2. **Update Backend:**
   - Update `PAID_MESSAGES_ROUTER` env var to new address
   - No code changes needed (backend already validates)

3. **Update Frontend:**
   - Update `NEXT_PUBLIC_PAID_MESSAGES_ROUTER` to new address
   - Re-enable SHILL option in dropdown
   - No other changes needed

4. **Configure Contract:**
   ```bash
   # Set minPrice to 1 APE
   cast send $ROUTER "setMinPrice(uint256)" 1000000000000000000 --private-key $ADMIN_KEY
   
   # Set fee splits (example: 25/50/15/10)
   cast send $ROUTER "setFeeSplits(uint256,uint256,uint256,uint256)" 2500 5000 1500 1000 --private-key $ADMIN_KEY
   ```

---

## 📊 CURRENT STATUS

| Feature | Status | Notes |
|---------|--------|-------|
| **PAID Messages** | ✅ Working | 1 APE (contract supports) |
| **SHILL Messages** | ⏸️ Disabled | Needs contract update |
| **MINEBOY Messages** | ✅ Working | Backend only, no payment |
| **Fee Splits** | ✅ Working | 4-way split functional |
| **Backend** | ✅ Ready | Supports all types |
| **Frontend** | ✅ Ready | SHILL disabled temporarily |

---

## ⏭️ NEXT STEPS

1. Deploy updated contract with minPrice check
2. Update env vars with new router address
3. Re-enable SHILL in frontend
4. Test with both 1 APE and 15 APE payments
5. Verify fee splits are working

---

**Estimated Time:** 30-45 minutes for full deployment and testing
