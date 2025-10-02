#!/bin/bash

# Simple CSV audit: Just send the list of valid tx hashes to the backend
# Let the backend do the work

API_URL="https://mineboy-g5xo.onrender.com"
ADMIN_TOKEN="1e97e071f3e42553dba423ce05b10c10"
CSV_FILE="/Users/mattrenshaw/ApeBit Miner/apps/minerboy-web/public/export-token-0x5f942b20b8aa905b8f6a46ae226e7f6bf2f44023.csv"

echo "🔍 CSV-based audit (sending valid tx list to backend)..."
echo ""

# Extract all transaction hashes from CSV
echo "📄 Loading real ApeChain transactions from CSV..."
REAL_TXS=$(awk -F',' 'NR>1 {gsub(/"/, "", $1); print tolower($1)}' "$CSV_FILE" | jq -R . | jq -s .)
REAL_TX_COUNT=$(echo "$REAL_TXS" | jq 'length')

echo "✅ Found $REAL_TX_COUNT real transactions"
echo ""
echo "📤 Sending to backend for audit..."

# Send the list to backend
curl -X POST "$API_URL/v2/admin/audit-claims-csv" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"validTxHashes\": $REAL_TXS}" | jq '.'

echo ""
echo "✨ Done!"

