#!/bin/bash
# Fix V3.1 reward table to match V3 (128 - tier*8 formula)

set -e

V3_1=0x2CE721f9C67D64E935AE30F2B19B991ce8bbe0D6
ADMIN_KEY=0xdac7387d42276072a45ecc981f8c924bac79208f97d647ac77463a626e5d01d1
RPC=https://rpc.apechain.com/http

echo "🔧 Fixing V3.1 Reward Table..."
echo "Contract: $V3_1"
echo ""

# Correct reward table: 128 - (tier * 8)
# Tier 0 = 128, Tier 1 = 120, ..., Tier 15 = 8

declare -a rewards=(
  "128000000000000000000"  # Tier 0: 128 MNESTR (Hashalicious)
  "120000000000000000000"  # Tier 1: 120 MNESTR (Hashtalavista, Baby)
  "112000000000000000000"  # Tier 2: 112 MNESTR (Monster Mash)
  "104000000000000000000"  # Tier 3: 104 MNESTR (Magic Mix)
  "96000000000000000000"   # Tier 4: 96 MNESTR (Zesty Zap)
  "88000000000000000000"   # Tier 5: 88 MNESTR (Mythical Hash)
  "80000000000000000000"   # Tier 6: 80 MNESTR (Epic Hash)
  "72000000000000000000"   # Tier 7: 72 MNESTR (Hashtastic)
  "64000000000000000000"   # Tier 8: 64 MNESTR (Juicy Jolt)
  "56000000000000000000"   # Tier 9: 56 MNESTR (Mega Hash)
  "48000000000000000000"   # Tier 10: 48 MNESTR (Great Hash)
  "40000000000000000000"   # Tier 11: 40 MNESTR (Solid Shard)
  "32000000000000000000"   # Tier 12: 32 MNESTR (Decent Drip)
  "24000000000000000000"   # Tier 13: 24 MNESTR (Basic Batch)
  "16000000000000000000"   # Tier 14: 16 MNESTR (Meh Hash)
  "8000000000000000000"    # Tier 15: 8 MNESTR (Trash Hash)
)

for tier in {0..15}; do
  reward=${rewards[$tier]}
  mnestr=$((128 - tier * 8))
  echo "Setting Tier $tier = $mnestr MNESTR..."
  cast send $V3_1 "setRewardPerTier(uint8,uint256)" $tier $reward \
    --private-key $ADMIN_KEY \
    --rpc-url $RPC \
    --legacy \
    --gas-limit 100000
done

echo ""
echo "✅ Reward table fixed!"
echo ""
echo "=== VERIFICATION ===="
for tier in {0..15}; do
  mnestr=$((128 - tier * 8))
  echo "Tier $tier should be $mnestr MNESTR"
done

