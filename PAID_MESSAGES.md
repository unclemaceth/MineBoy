# Paid Message System

## Overview
Users can pay 1 APE to display their message in the scrolling banner for 1 hour.

## Specifications
- **Cost:** 1 APE per message
- **Duration:** 1 hour (60 minutes)
- **Max Length:** 64 characters
- **Payment Destination:** Team Wallet (`0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5`)
- **Moderation:** Auto-approve with word blacklist
- **Display:** Messages prefixed with "💎 PAID: " in the scrolling banner

## How It Works

### User Flow:
1. User clicks on the scrolling message banner
2. Modal opens with message input and instructions
3. User types their message (max 64 chars)
4. User clicks "PAY 1 APE & POST"
5. Wallet prompts for 1 APE payment to team wallet
6. Transaction is confirmed on-chain
7. Backend verifies transaction and adds message
8. Message appears in scrolling banner for 1 hour

### Backend Verification:
- Transaction must be from the claimed wallet
- Transaction must be to the team wallet
- Amount must be exactly 1 APE
- Transaction must be confirmed (status = 1)
- Transaction hash must not have been used before
- Message must pass content validation

### Content Validation:
- Not empty
- Max 64 characters
- Comprehensive blacklist filtering:
  - Profanity and explicit content
  - Hate speech and slurs (race, religion, sexuality, disability)
  - Harassment and threats
  - Spam and scam phrases
  - Leetspeak and obfuscation detection via regex
  - Unicode normalization (NFKC) to catch special characters

## API Endpoints

### Submit Paid Message
```
POST /v2/messages/paid
Body: {
  message: string,
  txHash: string,
  wallet: string
}
Response: {
  ok: true,
  messageId: string,
  expiresAt: number
}
```

### Get Active Paid Messages
```
GET /v2/messages/paid
Response: {
  messages: [{
    id: string,
    message: string,
    wallet: string,
    createdAt: number,
    expiresAt: number
  }]
}
```

### Get All Messages (Combined)
```
GET /v2/messages
Response: {
  messages: string[] // Admin messages + paid messages with "💎 PAID: " prefix
}
```

### Admin: Remove Paid Message
```
DELETE /v2/admin/messages/paid/:id
Headers: { Authorization: Bearer <ADMIN_TOKEN> }
Response: { ok: true }
```

### Admin: Get Statistics
```
GET /v2/admin/messages/paid/stats
Headers: { Authorization: Bearer <ADMIN_TOKEN> }
Response: {
  total: number,
  active: number,
  expired: number,
  removed: number,
  totalRevenue: string (wei)
}
```

## Database Schema

```sql
CREATE TABLE paid_messages (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  message TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  amount_wei TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
```

## Automatic Cleanup
- Expired messages are automatically marked as 'expired' every 5 minutes
- Expired messages are no longer returned in the public API
- Database keeps historical records for analytics

## Moderation

### Blacklist Management
The system uses a comprehensive blacklist with 200+ terms and regex patterns:

**Categories covered:**
- Profanity (general, British, American)
- Sexual/explicit content
- Hate slurs (race, religion, sexuality, disability)
- Harassment and threats
- Drug references
- Spam/scam phrases
- ASCII art patterns

**Regex patterns** catch leetspeak variants like:
- `f*ck` → `f_u_c_k`, `fμck`, `fuçk`
- `sh!t` → `sh1t`, `sh|t`
- `n!gger` → `n1gger`, `n!gg3r`

To add more terms, edit `packages/backend/src/paidMessages.ts`:

```typescript
const BLACKLIST = [
  // Add new words here
];

const REGEX_PATTERNS = [
  // Add new regex patterns here
];
```

### Manual Removal
Admins can remove inappropriate messages via the admin API:
```bash
curl -X DELETE \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.example.com/v2/admin/messages/paid/<message_id>
```

## Revenue Tracking
All payments go directly to the team wallet on-chain. The backend tracks:
- Total messages posted
- Total revenue (sum of all payments)
- Active vs expired messages
- Removed messages (moderation actions)

Access stats via:
```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.example.com/v2/admin/messages/paid/stats
```

## Frontend Integration
- Click scrolling banner to open paid message modal
- Modal handles payment transaction
- Automatic submission after transaction confirms
- User-friendly error messages
- Success confirmation

## Security Features
- On-chain transaction verification
- Duplicate transaction prevention
- Wallet address verification
- Payment amount verification
- Transaction confirmation requirement
- Content validation and blacklist filtering
