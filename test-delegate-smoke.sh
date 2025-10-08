#!/bin/bash
# Delegate V3.1 Smoke Tests
# Tests immutable caller enforcement and delegation flow

set -e

# Configuration
BACKEND_URL="${BACKEND_URL:-https://mineboy-g5xo.onrender.com}"
HOT_WALLET="0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5"
VAULT_WALLET="0x909102DbF4A1bC248BC5F9eedaD589e7552Ad164"
DIFFERENT_HOT="0xDEADBEEF22f50E02a0aa00220022002200220022"
CHAIN_ID=33139
CONTRACT="0x3322b37349AeFD6F50F7909B641f2177c1D34D25"
TOKEN_ID="133"
SESSION_ID="smoke-$(date +%s)"

echo "🧪 Delegate V3.1 Smoke Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backend:  $BACKEND_URL"
echo "Hot:      $HOT_WALLET"
echo "Vault:    $VAULT_WALLET"
echo "Session:  $SESSION_ID"
echo ""

# Test 1: Open delegated session
echo "📝 Test 1: Open delegated session (hot → vault)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -sS -X POST "$BACKEND_URL/v2/session/open" \
  -H 'content-type: application/json' \
  -d "{
    \"sessionId\":\"$SESSION_ID\",
    \"wallet\":\"$HOT_WALLET\",
    \"vault\":\"$VAULT_WALLET\",
    \"chainId\":$CHAIN_ID,
    \"contract\":\"$CONTRACT\",
    \"tokenId\":\"$TOKEN_ID\",
    \"minerId\":\"mb_smoke\"
  }")

if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ FAIL: Session open failed"
  echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
  exit 1
fi

echo "✅ PASS: Session opened successfully"
echo "$RESPONSE" | jq '{sessionId, owner, caller}' 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 2: Heartbeat from same hot wallet (should succeed)
echo "💓 Test 2: Heartbeat from original caller (should succeed)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -sS -X POST "$BACKEND_URL/v2/session/heartbeat" \
  -H 'content-type: application/json' \
  -d "{
    \"sessionId\":\"$SESSION_ID\",
    \"minerId\":\"mb_smoke\",
    \"wallet\":\"$HOT_WALLET\",
    \"chainId\":$CHAIN_ID,
    \"contract\":\"$CONTRACT\",
    \"tokenId\":\"$TOKEN_ID\"
  }")

if echo "$RESPONSE" | grep -qE "error|409|403"; then
  echo "❌ FAIL: Heartbeat should succeed from original caller"
  echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
  exit 1
fi

echo "✅ PASS: Heartbeat accepted from original caller"
echo ""

# Test 3: Heartbeat from different hot wallet (should fail with 403)
echo "🚫 Test 3: Heartbeat from different caller (should BLOCK)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -sS -w "\nHTTP_STATUS:%{http_code}" -X POST "$BACKEND_URL/v2/session/heartbeat" \
  -H 'content-type: application/json' \
  -d "{
    \"sessionId\":\"$SESSION_ID\",
    \"minerId\":\"mb_smoke\",
    \"wallet\":\"$DIFFERENT_HOT\",
    \"chainId\":$CHAIN_ID,
    \"contract\":\"$CONTRACT\",
    \"tokenId\":\"$TOKEN_ID\"
  }")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" != "403" ]; then
  echo "❌ FAIL: Expected 403 caller_changed, got $HTTP_STATUS"
  echo "$BODY" | jq '.' || echo "$BODY"
  exit 1
fi

if ! echo "$BODY" | grep -q "caller_changed"; then
  echo "❌ FAIL: Expected 'caller_changed' error message"
  echo "$BODY" | jq '.' || echo "$BODY"
  exit 1
fi

echo "✅ PASS: Correctly blocked different caller (403 caller_changed)"
echo "$BODY" | jq '.error, .message, .details' 2>/dev/null || echo "$BODY"
echo ""

# Test 4: Verify session is still valid with original caller
echo "🔄 Test 4: Verify session still valid with original caller"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -sS -X POST "$BACKEND_URL/v2/session/heartbeat" \
  -H 'content-type: application/json' \
  -d "{
    \"sessionId\":\"$SESSION_ID\",
    \"minerId\":\"mb_smoke\",
    \"wallet\":\"$HOT_WALLET\",
    \"chainId\":$CHAIN_ID,
    \"contract\":\"$CONTRACT\",
    \"tokenId\":\"$TOKEN_ID\"
  }")

if echo "$RESPONSE" | grep -qE "error|409|403"; then
  echo "❌ FAIL: Session should still be valid"
  echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
  exit 1
fi

echo "✅ PASS: Session remains valid with original caller"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL TESTS PASSED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Security Invariants Verified:"
echo "  ✓ Delegated session opens correctly"
echo "  ✓ Original caller can send heartbeats"
echo "  ✓ Different caller is BLOCKED (403 caller_changed)"
echo "  ✓ Session remains valid after blocked attempt"
echo ""
echo "🚀 System is secure and ready for production!"

