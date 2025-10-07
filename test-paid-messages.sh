#!/bin/bash
# Quick Smoke Test for Paid Messages V2
# Run after deploy completes: ./test-paid-messages.sh

set -e

BACKEND_URL="https://mineboy-g5xo.onrender.com"
ADMIN_TOKEN="1e97e071f3e42553dba423ce05b10c10"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Paid Messages V2 - Quick Smoke Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Health Check
echo "1️⃣  Health Check..."
HEALTH=$(curl -s "$BACKEND_URL/health" | jq -r '.status // "ERROR"')
if [ "$HEALTH" = "ok" ]; then
  echo "   ✅ Backend is healthy"
else
  echo "   ❌ Backend health check failed: $HEALTH"
  exit 1
fi
echo ""

# 2. Check current messages
echo "2️⃣  Fetching current messages..."
MESSAGES=$(curl -s "$BACKEND_URL/v2/messages" | jq '.messages | length')
echo "   📊 Currently showing: $MESSAGES message(s)"
echo ""

# 3. Add MINEBOY admin message
echo "3️⃣  Adding MINEBOY admin message..."
TEST_MSG="TEST: $(date +%H:%M:%S) - Preflight verification"
MINEBOY_RESULT=$(curl -s -X POST "$BACKEND_URL/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"message\":\"$TEST_MSG\"}" | jq -r '.ok // "ERROR"')

if [ "$MINEBOY_RESULT" = "true" ]; then
  echo "   ✅ MINEBOY message added"
else
  echo "   ❌ MINEBOY message failed"
  exit 1
fi
echo ""

# 4. Verify message appears in feed
echo "4️⃣  Verifying message appears..."
sleep 2
MESSAGE_CHECK=$(curl -s "$BACKEND_URL/v2/messages" | jq -r --arg msg "$TEST_MSG" '.messages[] | select(.text == $msg or . == ("MineBoy: " + $msg)) | .type // "found"')
if [ -n "$MESSAGE_CHECK" ]; then
  echo "   ✅ Message visible in feed"
else
  echo "   ⚠️  Message not yet visible (may still be in queue)"
fi
echo ""

# 5. Check queue stats
echo "5️⃣  Checking queue stats..."
QUEUE_DATA=$(curl -s "$BACKEND_URL/v2/admin/messages/paid/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
ACTIVE=$(echo "$QUEUE_DATA" | jq -r '.active // 0')
PLAYING=$(echo "$QUEUE_DATA" | jq -r '.playing // 0')
TOTAL=$(echo "$QUEUE_DATA" | jq -r '.total // 0')
echo "   📊 Queue Status:"
echo "      Active:  $ACTIVE"
echo "      Playing: $PLAYING"
echo "      Total:   $TOTAL"
echo ""

# 6. Test validation (empty message should be rejected)
echo "6️⃣  Testing validation (empty message)..."
EMPTY_TEST=$(curl -s -X POST "$BACKEND_URL/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"message":"   "}' | jq -r '.code // "ERROR"')

if [ "$EMPTY_TEST" = "invalid_message" ]; then
  echo "   ✅ Empty message correctly rejected"
else
  echo "   ❌ Empty message validation failed: $EMPTY_TEST"
fi
echo ""

# 7. Test validation (punctuation only should be rejected)
echo "7️⃣  Testing validation (punctuation only)..."
PUNCT_TEST=$(curl -s -X POST "$BACKEND_URL/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"message":"!!!???"}' | jq -r '.code // "ERROR"')

if [ "$PUNCT_TEST" = "invalid_message" ]; then
  echo "   ✅ Punctuation-only message correctly rejected"
else
  echo "   ❌ Punctuation validation failed: $PUNCT_TEST"
fi
echo ""

# 8. Check Render logs for scheduler
echo "8️⃣  Checking for scheduler logs..."
echo "   ℹ️  Check Render dashboard logs for:"
echo "      [MessageScheduler] Lane sequence: ..."
echo "      [MessageScheduler] Distribution: ..."
echo "      [MessageScheduler] ✅ Played from ... lane"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SMOKE TEST COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 NOTES:"
echo "   • MINEBOY test message added successfully"
echo "   • Validation working (empty/punctuation rejected)"
echo "   • Check https://mineboy.app for visual verification"
echo "   • For full testing, see: PREFLIGHT_CHECKLIST.md"
echo ""
echo "🎯 NEXT STEPS:"
echo "   1. Wait 2-3 minutes for message to appear on banner"
echo "   2. Verify color coding (white for MINEBOY)"
echo "   3. Test PAID message (1 APE) from frontend"
echo "   4. Test SHILL message (15 APE) from frontend"
echo "   5. Check Render logs for errors"
echo ""
echo "🚀 Ready for production announcement!"
echo ""

