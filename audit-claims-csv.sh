#!/bin/bash

# CSV-based audit: Compare database claims against ApeScan export
# Any claim NOT in the CSV = Curtis testnet claim = should be failed

API_URL="https://mineboy-g5xo.onrender.com"
ADMIN_TOKEN="1e97e071f3e42553dba423ce05b10c10"
CSV_FILE="/Users/mattrenshaw/ApeBit Miner/apps/minerboy-web/public/export-token-0x5f942b20b8aa905b8f6a46ae226e7f6bf2f44023.csv"

echo "🔍 Starting CSV-based claim audit..."
echo ""

# Extract all transaction hashes from CSV (lowercase for comparison)
echo "📄 Loading real ApeChain transactions from CSV..."
REAL_TXS=$(awk -F',' 'NR>1 {gsub(/"/, "", $1); print tolower($1)}' "$CSV_FILE" | sort | uniq)
REAL_TX_COUNT=$(echo "$REAL_TXS" | wc -l | tr -d ' ')
echo "✅ Found $REAL_TX_COUNT unique transaction hashes in CSV"
echo ""

# Create a temporary file with the real tx hashes
TMP_REAL_TXS="/tmp/real_apechain_txs.txt"
echo "$REAL_TXS" > "$TMP_REAL_TXS"

# Get all confirmed claims from database
echo "🔍 Fetching all confirmed claims from database..."
OFFSET=0
LIMIT=100
TOTAL_VERIFIED=0
TOTAL_FAILED=0
TOTAL_CHECKED=0

while true; do
  # Fetch batch of confirmed claims
  RESPONSE=$(curl -s "$API_URL/v2/admin/claims?status=confirmed&offset=$OFFSET&limit=$LIMIT" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  # Check if we got any claims
  CLAIMS_JSON=$(echo "$RESPONSE" | jq -r '.claims // []')
  CLAIM_COUNT=$(echo "$CLAIMS_JSON" | jq 'length')
  
  if [ "$CLAIM_COUNT" -eq 0 ]; then
    echo "✨ No more claims to process"
    break
  fi
  
  echo ""
  echo "📊 Processing batch at offset $OFFSET..."
  
  BATCH_VERIFIED=0
  BATCH_FAILED=0
  
  # Process each claim in the batch
  for i in $(seq 0 $((CLAIM_COUNT - 1))); do
    CLAIM=$(echo "$CLAIMS_JSON" | jq -r ".[$i]")
    CLAIM_ID=$(echo "$CLAIM" | jq -r '.id')
    TX_HASH=$(echo "$CLAIM" | jq -r '.txHash // empty' | tr '[:upper:]' '[:lower:]')
    
    if [ -z "$TX_HASH" ]; then
      continue
    fi
    
    # Check if this tx hash is in our CSV of real ApeChain transactions
    if grep -q "^$TX_HASH\$" "$TMP_REAL_TXS"; then
      # Real ApeChain transaction - keep as confirmed
      ((BATCH_VERIFIED++))
      ((TOTAL_VERIFIED++))
    else
      # NOT in CSV = Curtis testnet claim - mark as failed
      echo "   ❌ Failing Curtis claim: $CLAIM_ID (tx: ${TX_HASH:0:10}...)"
      
      curl -s -X POST "$API_URL/v2/admin/claims/$CLAIM_ID/fail" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
      
      ((BATCH_FAILED++))
      ((TOTAL_FAILED++))
    fi
    
    ((TOTAL_CHECKED++))
  done
  
  echo "   ✅ Verified: $BATCH_VERIFIED"
  echo "   ❌ Failed: $BATCH_FAILED"
  echo "   📈 Progress: $TOTAL_CHECKED claims checked"
  
  # Move to next batch
  OFFSET=$((OFFSET + LIMIT))
  
  # Small delay to avoid overwhelming the API
  sleep 0.1
done

# Cleanup
rm -f "$TMP_REAL_TXS"

echo ""
echo "✨ Audit complete!"
echo ""
echo "📊 Final Results:"
echo "   ✅ Total Verified (Real ApeChain): $TOTAL_VERIFIED"
echo "   ❌ Total Failed (Curtis testnet): $TOTAL_FAILED"
echo "   📈 Total Checked: $TOTAL_CHECKED"

