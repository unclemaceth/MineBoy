#!/bin/bash
# Complete V3.1 setup to match V3 exactly

set -e

V3_1=0x2CE721f9C67D64E935AE30F2B19B991ce8bbe0D6
ADMIN_KEY=0xdac7387d42276072a45ecc981f8c924bac79208f97d647ac77463a626e5d01d1
RPC=https://rpc.apechain.com/http
NPC_CONTRACT=0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA

echo "🔧 Setting up V3.1 Router: $V3_1"
echo ""

# ============= REWARD TABLE =============
echo "📊 Setting Reward Table (128 - tier*8 formula)..."
echo ""

declare -a rewards=(
  "128000000000000000000"  # Tier 0: 128 MNESTR (Hashalicious) - 0x0...
  "120000000000000000000"  # Tier 1: 120 MNESTR (Hashtalavista, Baby) - 0x1...
  "112000000000000000000"  # Tier 2: 112 MNESTR (Monster Mash) - 0x2...
  "104000000000000000000"  # Tier 3: 104 MNESTR (Magic Mix) - 0x3...
  "96000000000000000000"   # Tier 4: 96 MNESTR (Zesty Zap) - 0x4...
  "88000000000000000000"   # Tier 5: 88 MNESTR (Mythical Hash) - 0x5...
  "80000000000000000000"   # Tier 6: 80 MNESTR (Epic Hash) - 0x6...
  "72000000000000000000"   # Tier 7: 72 MNESTR (Hashtastic) - 0x7...
  "64000000000000000000"   # Tier 8: 64 MNESTR (Juicy Jolt) - 0x8...
  "56000000000000000000"   # Tier 9: 56 MNESTR (Mega Hash) - 0x9...
  "48000000000000000000"   # Tier 10: 48 MNESTR (Great Hash) - 0xa...
  "40000000000000000000"   # Tier 11: 40 MNESTR (Solid Shard) - 0xb...
  "32000000000000000000"   # Tier 12: 32 MNESTR (Decent Drip) - 0xc...
  "24000000000000000000"   # Tier 13: 24 MNESTR (Basic Batch) - 0xd...
  "16000000000000000000"   # Tier 14: 16 MNESTR (Meh Hash) - 0xe...
  "8000000000000000000"    # Tier 15: 8 MNESTR (Trash Hash) - 0xf...
)

for tier in {0..15}; do
  reward=${rewards[$tier]}
  mnestr=$((128 - tier * 8))
  echo "  Tier $tier = $mnestr MNESTR..."
  cast send $V3_1 "setRewardPerTier(uint8,uint256)" $tier $reward \
    --private-key $ADMIN_KEY \
    --rpc-url $RPC \
    --legacy \
    --gas-limit 100000 \
    > /dev/null 2>&1
done

echo "✅ Reward table set!"
echo ""

# ============= NPC MULTIPLIERS =============
echo "🎯 Setting NPC Multipliers..."
echo ""

# Multiplier 1: 1 NPC = 1.2x (12000 bps)
echo "  Adding: 1 NPC = 1.2x multiplier..."
cast send $V3_1 "addMultiplier(address,uint256,uint256,string)" \
  $NPC_CONTRACT \
  1 \
  12000 \
  "1 NPC" \
  --private-key $ADMIN_KEY \
  --rpc-url $RPC \
  --legacy \
  --gas-limit 150000 \
  > /dev/null 2>&1

# Multiplier 2: 10 NPCs = 1.5x (15000 bps)
echo "  Adding: 10 NPCs = 1.5x multiplier..."
cast send $V3_1 "addMultiplier(address,uint256,uint256,string)" \
  $NPC_CONTRACT \
  10 \
  15000 \
  "10 NPCs" \
  --private-key $ADMIN_KEY \
  --rpc-url $RPC \
  --legacy \
  --gas-limit 150000 \
  > /dev/null 2>&1

echo "✅ NPC multipliers set!"
echo ""

# ============= SUMMARY =============
echo "================================"
echo "✅ V3.1 SETUP COMPLETE!"
echo "================================"
echo ""
echo "Reward Table (0x{nibble}... → MNESTR):"
echo "  0x0... Hashalicious: 128 MNESTR"
echo "  0x1... Hashtalavista, Baby: 120 MNESTR"
echo "  0x2... Monster Mash: 112 MNESTR"
echo "  0x3... Magic Mix: 104 MNESTR"
echo "  0x4... Zesty Zap: 96 MNESTR"
echo "  0x5... Mythical Hash: 88 MNESTR"
echo "  0x6... Epic Hash: 80 MNESTR"
echo "  0x7... Hashtastic: 72 MNESTR"
echo "  0x8... Juicy Jolt: 64 MNESTR"
echo "  0x9... Mega Hash: 56 MNESTR"
echo "  0xa... Great Hash: 48 MNESTR"
echo "  0xb... Solid Shard: 40 MNESTR"
echo "  0xc... Decent Drip: 32 MNESTR"
echo "  0xd... Basic Batch: 24 MNESTR"
echo "  0xe... Meh Hash: 16 MNESTR"
echo "  0xf... Trash Hash: 8 MNESTR"
echo ""
echo "NPC Multipliers:"
echo "  1 NPC = 1.2x"
echo "  10 NPCs = 1.5x"
echo ""
echo "🚀 V3.1 is now configured to match V3!"

