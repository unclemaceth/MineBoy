#!/bin/bash

# Audit all claims in batches
# Usage: ./audit-claims.sh

API_URL="https://mineboy-g5xo.onrender.com/v2/admin/audit-claims"
ADMIN_TOKEN="1e97e071f3e42553dba423ce05b10c10"
BATCH_SIZE=100

echo "🔍 Starting claim audit..."
echo ""

offset=0
total_verified=0
total_failed=0
total_notfound=0
total_errors=0

while true; do
  echo "📊 Processing batch at offset $offset..."
  
  response=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"limit\": $BATCH_SIZE, \"offset\": $offset}")
  
  # Check if request failed
  if [ $? -ne 0 ]; then
    echo "❌ Request failed"
    exit 1
  fi
  
  # Parse response
  ok=$(echo "$response" | jq -r '.ok')
  if [ "$ok" != "true" ]; then
    echo "❌ API error: $response"
    exit 1
  fi
  
  processed=$(echo "$response" | jq -r '.processed')
  verified=$(echo "$response" | jq -r '.verified')
  failed=$(echo "$response" | jq -r '.failed')
  notfound=$(echo "$response" | jq -r '.notFound')
  errors=$(echo "$response" | jq -r '.errors')
  nextOffset=$(echo "$response" | jq -r '.nextOffset')
  progress=$(echo "$response" | jq -r '.progress.percent')
  
  total_verified=$((total_verified + verified))
  total_failed=$((total_failed + failed))
  total_notfound=$((total_notfound + notfound))
  total_errors=$((total_errors + errors))
  
  echo "   ✅ Verified: $verified"
  echo "   ❌ Failed: $failed"
  echo "   🔍 Not Found: $notfound"
  echo "   ⚠️  Errors: $errors"
  echo "   📈 Progress: $progress%"
  echo ""
  
  # Check if done
  if [ "$nextOffset" = "null" ] || [ -z "$nextOffset" ]; then
    echo "✨ Audit complete!"
    echo ""
    echo "📊 Final Results:"
    echo "   ✅ Total Verified: $total_verified"
    echo "   ❌ Total Failed (fixed): $total_failed"
    echo "   🔍 Total Not Found: $total_notfound"
    echo "   ⚠️  Total Errors: $total_errors"
    break
  fi
  
  offset=$nextOffset
  
  # Small delay between batches
  sleep 1
done

