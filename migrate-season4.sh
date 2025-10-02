#!/bin/bash

# Season 4 Migration Script
# Processes CSV and credits wallets to new season

API_URL="https://mineboy-g5xo.onrender.com"
ADMIN_TOKEN="1e97e071f3e42553dba423ce05b10c10"
CSV_FILE="/Users/mattrenshaw/ApeBit Miner/apps/minerboy-web/public/export-token-0x5f942b20b8aa905b8f6a46ae226e7f6bf2f44023.csv"

echo "🔄 Starting Season 4 Migration..."
echo ""

# Process CSV: aggregate ABIT per wallet, convert to wei
echo "📊 Processing CSV data..."
CSV_DATA=$(awk -F',' '
BEGIN { print "[" }
NR>1 {
  gsub(/"/, "", $6);  # Remove quotes from wallet
  gsub(/"/, "", $7);  # Remove quotes from amount
  wallet = tolower($6);
  amount = $7;
  
  # Convert ABIT to wei (multiply by 10^18)
  wei = amount * 1000000000000000000;
  
  # Accumulate per wallet
  total[wallet] += wei;
}
END {
  first = 1;
  for (w in total) {
    if (!first) printf ",";
    first = 0;
    printf "{\"wallet\":\"%s\",\"amount\":\"%d\"}", w, total[w];
  }
  print "]"
}' "$CSV_FILE")

WALLET_COUNT=$(echo "$CSV_DATA" | jq 'length')
echo "✅ Found $WALLET_COUNT unique wallets"
echo ""

# Call migration endpoint
echo "🚀 Creating Season 4 and crediting wallets..."
curl -X POST "$API_URL/v2/admin/migrate-season" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"csvData\": $CSV_DATA}" | jq '.'

echo ""
echo "✨ Migration complete!"
echo ""
echo "Next steps:"
echo "1. Check leaderboard to verify scores"
echo "2. Turn off maintenance mode"
echo "3. Comment out CLOSED overlay in layout.tsx"

