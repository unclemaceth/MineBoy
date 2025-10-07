# 🚨 URGENT: Paid Messages Bugs Found During Testing

## Status: **NEEDS IMMEDIATE FIX**

---

## **BUG #1: Letter 'D' Disappearing (CRITICAL)** 🔥

### **Observed Behavior:**
- User typed: "**D**are you! I'll whoop ya all up an' **d**own ser!"
- Displayed: "are you! I'll whoop ya all up an' own ser!"
- **The letter 'D' (both uppercase and lowercase) is being stripped!**

### **Impact:**
- ❌ Paid messages corrupted
- ❌ Arcade names corrupted (multiple users reported this)
- ❌ Potentially affects ALL text inputs in the system

### **Root Cause:** UNKNOWN (needs investigation)

**Possible causes:**
1. **Frontend textarea issue** - Some browsers/IME strip characters
2. **Backend Unicode normalization** - `normalize('NFKC')` might have edge case
3. **Database encoding** - SQLite BLOB storage issue
4. **Display rendering** - CSS/font issue hiding characters
5. **Profanity filter** - Overly aggressive word replacement

### **Investigation Steps:**
1. ✅ Tested Unicode normalization - works fine
2. ⏳ Need to check actual transaction data (msgHash on-chain)
3. ⏳ Need to check database contents directly
4. ⏳ Need to reproduce with controlled input

### **Transaction for Analysis:**
- TX Hash: `0x0c5dca06e2ed5234ae927601c30e01030f3b9755ccaf56ff493ac5266843b731`
- Expected: "Dare you! I'll whoop ya all up and down ser!"
- Got: "are you! I'll whoop ya all up an own ser!"

### **User Reports:**
- Same issue reported for arcade names
- Multiple users affected
- Not a one-time glitch

---

## **BUG #2: Queue Endpoint 500 Error** ⚠️

### **Observed Behavior:**
```
Failed to load resource: the server responded with a status of 500 ()
mineboy-g5xo.onrender.com/v2/messages/queue?wallet=0x6779081f37ad502A31D14b348c7C1d248A2cf117
```

### **Root Cause:** `db` variable scope issue in `server.ts`

**Problem:**
- Line 1596 in `server.ts` references `db` (PostgreSQL)
- But paid messages use SQLite database
- Need to import and use the correct database reference

### **Fix Required:**
```typescript
// In server.ts, need to import the SQLite db from paidMessages
import { getPaidMessagesDb } from './paidMessages.js';

// Then in the queue endpoint (line 1596)
const paidDb = getPaidMessagesDb();
const totalActive = paidDb.prepare(`
  SELECT COUNT(*) as count 
  FROM paid_messages 
  WHERE status = 'active'
`).get() as { count: number };
```

### **Impact:**
- ❌ Queue position not showing for users
- ❌ Frontend showing null queue position
- ⚠️ Doesn't break submission, just UX issue

---

## **BUG #3: Message Not Auto-Refreshing** ⚠️

### **Observed Behavior:**
- Message appeared after submission
- **But user had to manually reload page to see it**
- Auto-refresh callback not working

### **Root Cause:** `onMessageSubmitted` callback not triggering refresh

**Problem in `PaidMessageModal.tsx`:**
```typescript
// Line 60-62
if (onMessageSubmitted) {
  onMessageSubmitted();
}
```

This callback is called, but the parent component (`page.tsx`) might not be refetching the messages list.

### **Fix Required:**
Check `page.tsx` to ensure:
1. `onMessageSubmitted` callback is properly defined
2. It triggers a refetch of `/v2/messages` or `/v2/messages/paid`
3. The message display component is listening for updates

---

## **PRIORITY FIX ORDER:**

### **1. BUG #1 (CRITICAL) - Letter 'D' Disappearing**
**Why:** Corrupts ALL user text input across the platform

**Steps:**
1. Check transaction `0x0c5dca06e2ed5234ae927601c30e01030f3b9755ccaf56ff493ac5266843b731` on ApeScan
2. Decode the `msgHash` from the `Paid` event
3. Compare with what's in database
4. Reproduce with controlled test
5. Identify and fix root cause

---

### **2. BUG #2 (HIGH) - Queue Endpoint 500**
**Why:** Breaks UX, easy to fix

**Steps:**
1. Export `db` from `paidMessages.ts` as `getPaidMessagesDb()`
2. Import in `server.ts`
3. Use correct db reference in queue endpoint
4. Test endpoint returns 200

---

### **3. BUG #3 (MEDIUM) - Auto-Refresh**
**Why:** Minor UX issue, users can reload manually

**Steps:**
1. Check parent component callback
2. Ensure refetch is triggered
3. Test message appears without reload

---

## **TESTING CHECKLIST (After Fixes):**

### **Test Case 1: Letter 'D' Works**
- [ ] Type: "Donald Duck does dare deeds down deep" (all D positions)
- [ ] Submit as PAID message
- [ ] Verify all 'D's appear correctly
- [ ] Check database directly
- [ ] Check on-chain msgHash

### **Test Case 2: Queue Endpoint Works**
- [ ] Call `/v2/messages/queue?wallet=YOUR_WALLET`
- [ ] Should return 200 with `{ totalActive, yourPosition, estimatedWaitMin, backlog }`
- [ ] No 500 errors

### **Test Case 3: Auto-Refresh Works**
- [ ] Submit PAID message
- [ ] Message appears WITHOUT manual reload
- [ ] Queue position updates automatically
- [ ] Banner shows message within 30 seconds

---

## **WORKAROUNDS (Until Fixed):**

### **For Users:**
1. **Letter 'D' issue:** Avoid words starting with 'D' (not acceptable!)
2. **Queue issue:** Ignore queue position (it's just informational)
3. **Auto-refresh:** Reload page after submitting message

### **For Team:**
1. **Disable SHILL** temporarily if issue is severe
2. **Add warning** about text input bugs
3. **Monitor Discord** for more user reports

---

## **CONTRACT STATUS:**

**✅ Contract is fine!**
- Address: `0xD7E1110A69753459079F1aA8403C1846b9e886AB`
- Fee splits: Working correctly
- Payment validation: Working correctly
- This is a **backend/frontend** bug, not a contract bug

---

## **REVENUE IMPACT:**

| Scenario | Impact |
|----------|--------|
| **Bug #1 (Letter D)** | 🔴 **HIGH** - Users won't pay if messages are corrupted |
| **Bug #2 (Queue)** | 🟡 **LOW** - Doesn't block payments, just UX |
| **Bug #3 (Refresh)** | 🟡 **LOW** - Users can reload manually |

**Recommendation:** Fix Bug #1 IMMEDIATELY before marketing paid messages.

---

**Created:** October 7, 2025  
**Priority:** CRITICAL  
**Status:** Needs investigation and fixes
