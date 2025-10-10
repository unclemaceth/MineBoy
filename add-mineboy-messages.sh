#!/bin/bash
# Re-add MINEBOY sponsored messages (these will persist now!)

API="https://mineboy-g5xo.onrender.com"
TOKEN="1e97e071f3e42553dba423ce05b10c10"

echo "🎬 Adding MINEBOY sponsored messages..."
echo ""

# Message 1: MineBoy it Mines stuff!
curl -s -X POST "$API/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "MineBoy it Mines stuff!"}' | jq

echo ""

# Message 2: Zards sponsorship
curl -s -X POST "$API/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Season 2 Prizes Sponsored by Zards - Pixelated Wi-ZARDS on ApeChain, find them on MAGIC EDEN!"}' | jq

echo ""

# Message 3: MMWalk sponsorship
curl -s -X POST "$API/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Season 2 Prizes Sponsored by MMWalk - The Foxy Fam, IOS, App store Native Game coming soon to Mobile!"}' | jq

echo ""

# Message 4: DonDiablo sponsorship
curl -s -X POST "$API/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Season 2 Prizes Sponsored by DonDiablo - Typical Tigers are Coming to OTHERSIDE - Pre-Order your 3D avatar on typicaltigers.xyz"}' | jq

echo ""

# Message 5: PNUTS sponsorship
curl -s -X POST "$API/v2/admin/messages/mineboy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Buy $PNUTS by Gs on Ape - or Rida will WAPEY WAPEY your collection!"}' | jq

echo ""
echo "✅ Messages added! Checking banner..."
echo ""

# Verify messages are showing
curl -s "$API/v2/messages" | jq '.messages | length'
echo "messages total"

