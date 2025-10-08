# Paid Messages V2 - Management Guide

**Production System:** https://mineboy.app  
**Backend API:** https://mineboy-g5xo.onrender.com  
**Admin Token:** `1e97e071f3e42553dba423ce05b10c10`  

---

## 📋 Quick Reference

### Message Types

| Type | Color | Prefix | Duration | Cost |
|------|-------|--------|----------|------|
| **MINEBOY** | White (#ffffff) | "MineBoy: " | Forever* | Free (admin only) |
| **PAID** | Green (#4ade80) | "PAID CONTENT: " | 1 hour | 1 APE |
| **SHILL** | Red (#ff4444) | "Shilled Content: " | 4 hours | 15 APE |

\* MINEBOY messages persist until manually removed

---

## 🎮 Managing MINEBOY Messages

### Add a Sponsor Message

```bash
curl -X POST https://mineboy-g5xo.onrender.com/v2/admin/messages/mineboy \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Your sponsor message here"}'
```

**Example:**
```bash
curl -X POST https://mineboy-g5xo.onrender.com/v2/admin/messages/mineboy \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Season 2 Prizes Sponsored by Cool NFT Project - Check them out on CoolNFTs.xyz"}'
```

**Response:**
```json
{"ok":true,"messageId":"4e866ecf-2a05-44e6-bca7-086f1fdf2364"}
```

---

### List All MINEBOY Messages

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' | jq '.messages'
```

**Response:**
```json
[
  {
    "id": "4e866ecf-2a05-44e6-bca7-086f1fdf2364",
    "text": "Season 2 Prizes Sponsored by Zards...",
    "addedAt": 1728345678000
  },
  ...
]
```

---

### Remove a MINEBOY Message

```bash
curl -X DELETE https://mineboy-g5xo.onrender.com/v2/admin/messages/<MESSAGE_ID> \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10'
```

**Example:**
```bash
# First, list messages to get the ID
curl -s https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' | jq '.messages[] | {id, text: .text[0:50]}'

# Then delete by ID
curl -X DELETE https://mineboy-g5xo.onrender.com/v2/admin/messages/4e866ecf-2a05-44e6-bca7-086f1fdf2364 \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10'
```

---

## 💰 Monitoring Paid Messages

### View Currently Playing Messages

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq '.messages[] | {text, type, prefix}'
```

**Shows what's currently visible in the banner**

---

### View Message Queue

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '.messages[] | {
  id: .id[0:8],
  type: .message_type,
  status: .status,
  wallet: .wallet[0:10],
  message: .message[0:50]
}'
```

**Shows all messages in the system (active, playing, expired)**

---

### Check a Specific Wallet's Messages

```bash
curl -s "https://mineboy-g5xo.onrender.com/v2/messages/queue?wallet=0xYOUR_ADDRESS" | jq '.'
```

**Response:**
```json
{
  "yourMessages": [
    {
      "id": "abc123...",
      "message": "BUY $TOKEN!",
      "status": "playing",
      "expiresAt": 1728349278000
    }
  ],
  "yourPosition": 2,
  "totalActive": 5
}
```

---

## 📊 Analytics & Monitoring

### Total Messages by Type

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '[.messages[] | .message_type] | group_by(.) | map({type: .[0], count: length})'
```

**Example Output:**
```json
[
  {"type": "MINEBOY", "count": 4},
  {"type": "PAID", "count": 12},
  {"type": "SHILL", "count": 2}
]
```

---

### Revenue (PAID messages only)

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '[.messages[] | select(.message_type == "PAID") | .amount_wei | tonumber] | add / 1000000000000000000'
```

**Output:** Total APE collected from PAID messages

---

### Active vs Expired Messages

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '[.messages[] | .status] | group_by(.) | map({status: .[0], count: length})'
```

**Example Output:**
```json
[
  {"status": "active", "count": 3},
  {"status": "playing", "count": 2},
  {"status": "expired", "count": 15}
]
```

---

### Top Contributors (Wallets)

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '[.messages[] | select(.message_type != "MINEBOY") | .wallet] | group_by(.) | map({wallet: .[0], count: length}) | sort_by(.count) | reverse | .[0:10]'
```

---

## 🔧 Troubleshooting

### Messages Not Showing?

```bash
# 1. Check if messages exist in database
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '.messages | length'

# 2. Check if they're active
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '[.messages[] | select(.status == "active" or .status == "playing")] | length'

# 3. Check what frontend is receiving
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq '.messages | length'

# 4. Check backend logs
# Go to Render dashboard → mineboy-backend → Logs
# Look for: "[MessageScheduler]" lines
```

---

### Double Prefix Bug Returns?

Check if `messageStore.getMessages()` is adding prefix to the text:

```bash
# Should return raw text WITHOUT "MineBoy: " prefix
curl -s https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' | jq '.messages[0].text'
```

**Correct:** `"Season 2 Prizes Sponsored by..."`  
**Wrong:** `"MineBoy: Season 2 Prizes Sponsored by..."`

If wrong, check `packages/backend/src/messages.ts` line 92 - should be:
```typescript
return messages.map(m => m.message); // Don't add prefix here
```

---

### Messages Expired Unexpectedly?

MINEBOY messages should have expiration ~100 years in the future:

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '.messages[] | select(.message_type == "MINEBOY") | {id: .id[0:8], expires_at, now: (now * 1000 | floor), years_until_expiry: ((.expires_at - (now * 1000 | floor)) / (365 * 24 * 60 * 60 * 1000) | floor)}'
```

**Should show:** `years_until_expiry: 100`

---

## 🚨 Emergency Commands

### Clear All MINEBOY Messages

```bash
# List all MINEBOY messages
curl -s https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' | jq -r '.messages[].id' | while read id; do
  curl -X DELETE "https://mineboy-g5xo.onrender.com/v2/admin/messages/$id" \
    -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10'
  echo "Deleted: $id"
done
```

---

### Blacklist a Wallet (Spam Protection)

```bash
curl -X POST https://mineboy-g5xo.onrender.com/v2/admin/blacklist \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' \
  -H 'Content-Type: application/json' \
  -d '{"wallet":"0xSPAMMER_ADDRESS","reason":"Inappropriate content"}'
```

---

### Check Blacklist

```bash
curl -s https://mineboy-g5xo.onrender.com/v2/admin/blacklist \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' | jq '.'
```

---

## 📝 Daily Management Checklist

### Morning Check (5 minutes)

```bash
# 1. How many messages are active?
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq '.messages | length'

# 2. Any inappropriate content?
curl -s https://mineboy-g5xo.onrender.com/v2/messages | jq '.messages[] | {type, text: .text[0:60]}'

# 3. MINEBOY messages still there?
curl -s https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H 'Authorization: Bearer 1e97e071f3e42553dba423ce05b10c10' | jq '.messages | length'
```

### Weekly Check (10 minutes)

```bash
# 1. How much revenue this week?
# (Check messages created in last 7 days)
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq --arg week_ago "$(($(date +%s) - 604800))000" '[.messages[] | select(.message_type == "PAID" and (.created_at | tonumber) > ($week_ago | tonumber)) | .amount_wei | tonumber] | add / 1000000000000000000'

# 2. Top contributors
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '[.messages[] | select(.message_type != "MINEBOY") | .wallet] | group_by(.) | map({wallet: .[0], count: length}) | sort_by(.count) | reverse | .[0:5]'

# 3. Any wallets to blacklist?
# (Check for spam patterns - same message multiple times)
curl -s https://mineboy-g5xo.onrender.com/v2/messages/paid | jq '[.messages[] | .message] | group_by(.) | map({message: .[0][0:40], count: length}) | select(.count > 3)'
```

---

## 🎯 Current Sponsor Messages (As of Oct 2025)

```
1. Buy $PNUTS by Gs on Ape - or Rida will WAPEY WAPEY your collection!
2. Season 2 Prizes Sponsored by DonDiablo - Typical Tigers are Coming to OTHERSIDE - Pre-Order your 3D avatar on typicaltigers.xyz
3. Season 2 Prizes Sponsored by MMWalk - The Foxy Fam, IOS, App store Native Game coming soon to Mobile!
4. Season 2 Prizes Sponsored by Zards - Pixelated Wi-ZARDS on ApeChain, find them on MAGIC EDEN!
```

---

## 🔗 Useful Links

- **Frontend:** https://mineboy.app
- **Backend API:** https://mineboy-g5xo.onrender.com
- **Render Dashboard:** https://dashboard.render.com/
- **Contract:** `0x...` (PaidMessagesRouter on ApeChain)
- **GitHub Repo:** https://github.com/unclemaceth/MineBoy

---

## 📚 Related Documentation

- `PAID_MESSAGES_PRODUCTION_READY.md` - Full system documentation
- `PREFLIGHT_CHECKLIST.md` - Pre-launch verification
- `DATABASE_QUERIES.md` - Advanced PostgreSQL queries
- `SECURITY_AUDIT.md` - Security features and considerations

---

## 🆘 Support

If you encounter issues:

1. Check Render logs: Dashboard → mineboy-backend → Logs
2. Look for `[MessageScheduler]` or `[PAID_MESSAGE]` log lines
3. Verify database state with the analytics commands above
4. Check if the issue is frontend (banner) or backend (API)

**System is production-ready as of October 8, 2025** ✅

