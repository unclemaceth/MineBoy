# 🐛 Letter 'D' Bug Summary (For GPT Investigation)

## **The Problem:**
Users cannot type or display the letter 'D' (uppercase or lowercase) in text inputs across the platform.

---

## **Affected Areas:**
1. **Paid Messages:** Users submit "Dare you!" → displays as "are you!"
2. **Arcade Names:** Users reported same issue when setting names
3. **Pattern:** All instances of 'D' or 'd' are stripped/removed

---

## **Technical Flow:**

### **Paid Messages:**
```
Frontend (React) → Backend (Node.js) → Database (SQLite)
```

1. **Frontend (`PaidMessageModal.tsx`):**
   - User types in `<textarea>` 
   - State: `const [message, setMessage] = useState('')`
   - Handler: `onChange={(e) => setMessage(e.target.value)}`
   - No sanitization/filtering in frontend code
   - Sends to backend via POST `/v2/messages/paid`

2. **Backend (`paidMessages.ts`):**
   - Receives message in body
   - Validates via `validateMessage()`:
     ```typescript
     const cleaned = raw.normalize('NFKC').trim();
     if (!passesBlacklist(cleaned)) {
       return { ok: false, reason: 'Message contains inappropriate content' };
     }
     return { ok: true, cleaned };
     ```
   - `normalize('NFKC')` - Unicode normalization (tested, works fine)
   - `passesBlacklist()` - Checks profanity/abuse list
   - Stores in SQLite database

3. **Database (SQLite):**
   - Table: `paid_messages`
   - Column: `message TEXT NOT NULL`
   - Standard UTF-8 text storage

4. **Display:**
   - Retrieved from database
   - Sent via API `/v2/messages/paid`
   - Rendered in frontend banner

### **Arcade Names:**
```
Frontend → Backend → PostgreSQL
```

1. **Frontend:** User sets arcade name
2. **Backend (`db.ts`):**
   ```typescript
   export function sanitizeArcadeName(raw: string): string {
     const up = raw.trim().toUpperCase();
     if (up.length < 1 || up.length > 8) throw new Error('Name must be 1–8 chars');
     if (!/^[A-Z0-9_]+$/.test(up)) throw new Error('Only A–Z, 0–9, _ allowed');
     return up;
   }
   ```
   - **SUSPICIOUS:** This explicitly allows `A-Z` (should include 'D')
   - But regex test might be failing?
   - Or `.toUpperCase()` might have issue with 'D'?

3. **Database:** PostgreSQL, `user_names` table

---

## **What We Know:**

### ✅ **NOT the Issue:**
- **Unicode normalization:** Tested `'Dare you!'.normalize('NFKC')` → works fine
- **Contract:** Messages don't come from contract, it's just a payment router
- **Database encoding:** SQLite/PostgreSQL both support 'D' natively
- **CSS/Rendering:** Other letters display fine

### ❓ **Possible Causes:**

#### **Theory 1: Profanity Filter Overly Aggressive**
```typescript
const BLACKLIST = [
  'fuck', 'shit', 'dick', 'damn', ...
];
```
- Maybe `dick` check is matching partial 'D'?
- Or `damn` causing issues?
- **But:** The check is `normalized.includes(term.toLowerCase())`
- This shouldn't strip single 'D'

#### **Theory 2: Regex Filtering**
```typescript
const REGEX_PATTERNS = [
  /\b(fuck|shit|ass|...)\b/i,
  /http[s]?:\/\//i,
  /[^\x20-\x7E\s]/g, // ← SUSPICIOUS: Only ASCII printable chars
];
```
- Pattern `/[^\x20-\x7E\s]/g` removes non-ASCII
- 'D' is ASCII 0x44 (within range)
- Should NOT be filtered

#### **Theory 3: Frontend IME/Input Issue**
- Some Input Method Editors (IME) strip characters
- Browser autocorrect might be interfering
- **But:** Multiple users across devices reported this

#### **Theory 4: Database Collation**
- SQLite default collation might treat 'D' specially?
- **Unlikely:** 'D' is standard ASCII

#### **Theory 5: toUpperCase() Edge Case**
```typescript
const up = raw.trim().toUpperCase();
```
- Some locales have special 'D' handling (e.g., Croatian Dž)
- **But:** This is Node.js server-side, not user locale

---

## **Test Cases to Investigate:**

### **Test 1: Check Raw Input**
```typescript
// In validateMessage(), add logging:
console.log('[DEBUG] Raw input:', JSON.stringify(raw));
console.log('[DEBUG] After normalize:', JSON.stringify(cleaned));
console.log('[DEBUG] Char codes:', [...cleaned].map(c => c.charCodeAt(0)));
```

### **Test 2: Check Database Contents**
```sql
-- In SQLite paid_messages.db:
SELECT message FROM paid_messages WHERE tx_hash = '0x0c5dca06e2ed5234ae927601c30e01030f3b9755ccaf56ff493ac5266843b731';
```

### **Test 3: Check API Response**
```bash
curl https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '.messages[0].message'
```

### **Test 4: Controlled Reproduction**
```typescript
// Direct test in Node.js:
const raw = "Donald Duck dares deeply";
const cleaned = raw.normalize('NFKC').trim();
console.log('Input:', raw);
console.log('Output:', cleaned);
console.log('Match:', raw === cleaned);
```

### **Test 5: Check Blacklist Function**
```typescript
// Test passesBlacklist directly:
const testMessages = [
  "Dare you!",
  "Donald Duck",
  "DEADLINE",
  "diamond hands",
  "D",
  "d"
];

for (const msg of testMessages) {
  const passes = passesBlacklist(msg);
  console.log(`"${msg}" → ${passes ? 'PASS' : 'BLOCKED'}`);
}
```

---

## **Likely Culprit Ranking:**

1. **🔴 HIGH: Blacklist Function Bug**
   - `passesBlacklist()` might have hidden logic
   - Check for word boundary issues
   - Check for partial matching

2. **🟡 MEDIUM: Regex Pattern Replacement**
   - Some regex might be replacing 'D' with ''
   - Check `REGEX_PATTERNS` array

3. **🟡 MEDIUM: Frontend Input Handler**
   - Browser/IME stripping characters
   - Check for autocorrect/spell-check interference

4. **🟢 LOW: Database Encoding**
   - SQLite storing incorrectly
   - Check actual database contents

5. **🟢 LOW: Unicode Normalization**
   - Already tested, works fine

---

## **Investigation Priority:**

### **Step 1: Add Debug Logging**
Add to `validateMessage()` in `paidMessages.ts`:
```typescript
console.log('[PAID_MSG_DEBUG] Raw:', raw);
console.log('[PAID_MSG_DEBUG] Cleaned:', cleaned);
console.log('[PAID_MSG_DEBUG] Passes blacklist:', passesBlacklist(cleaned));
```

### **Step 2: Check Database**
SSH to Render, open SQLite:
```bash
sqlite3 paid_messages.db
SELECT id, message, created_at FROM paid_messages ORDER BY created_at DESC LIMIT 5;
```

### **Step 3: Test Blacklist Function**
Create test script:
```bash
cd packages/backend
node -e "
const msg = 'Dare you!';
const normalized = msg.normalize('NFKC').toLowerCase();
const blacklist = ['damn', 'dick', 'dare'];
for (const term of blacklist) {
  if (normalized.includes(term.toLowerCase())) {
    console.log('BLOCKED by:', term);
  }
}
"
```

---

## **Expected Behavior:**
- User types: "Dare you! I dare you! Down down down!"
- Frontend stores: "Dare you! I dare you! Down down down!"
- Backend receives: "Dare you! I dare you! Down down down!"
- Database stores: "Dare you! I dare you! Down down down!"
- API returns: "Dare you! I dare you! Down down down!"
- Display shows: "Dare you! I dare you! Down down down!"

## **Actual Behavior:**
- Display shows: "are you! I are you! own own own!"

---

## **Related Code Files:**
- Frontend: `apps/minerboy-web/src/components/PaidMessageModal.tsx`
- Backend: `packages/backend/src/paidMessages.ts`
- Arcade: `packages/backend/src/db.ts` (line 647: `sanitizeArcadeName`)
- Server: `packages/backend/src/server.ts`

---

## **Questions for GPT:**
1. What could cause ONLY the letter 'D' to be stripped?
2. Is there a known Unicode/locale issue with 'D'?
3. Could Node.js `.normalize('NFKC')` have a bug with 'D'?
4. Could SQLite collation affect 'D' specifically?
5. Could a regex accidentally match and remove 'D'?
6. Is there a profanity filter library that blocks 'D' (thinking 'dick')?

---

**Transaction to Analyze:**
`0x0c5dca06e2ed5234ae927601c30e01030f3b9755ccaf56ff493ac5266843b731`

**Test Wallet:**
`0x6779081f37ad502A31D14b348c7C1d248A2cf117`

**Expected Message:**
"Uncle Mac is the best Mac there ever was or will be, fight me on it! Go on, I **dare** you! I'll whoop ya all up an' **down** ser!"

**Actual Display:**
"Uncle Mac is the best Mac there ever was or will be, fight me on it! Go on, I are you! I'll whoop ya all up an' own ser!"

---

**Created:** October 7, 2025  
**Priority:** CRITICAL  
**Status:** Under Investigation
