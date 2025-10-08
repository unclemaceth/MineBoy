#!/bin/bash
# Configure V3_1 fee recipients to match V3

# YOU MUST SET THIS AFTER DEPLOYMENT:
V3_1_ROUTER=0xYOUR_DEPLOYED_V3_1_ADDRESS_HERE

ADMIN_KEY=0xcffbaab80d2e527a812ceaa145834957085cf2ba1792144a1c5f62ec989fad14
RPC=https://rpc.apechain.com/http

echo "🔧 Configuring V3_1 Fee Recipients"
echo "Router: $V3_1_ROUTER"
echo ""

# Fee Recipients (in wei)
NGT_MERCHANT=0xFB53Da794d3d4d831255e7AB40F4649791331e75
NGT_AMOUNT=2500000000000000  # 0.0025 APE

FLYWHEEL=0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4
FLYWHEEL_AMOUNT=5000000000000000  # 0.005 APE

TEAM_ADMIN=0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5
TEAM_AMOUNT=1500000000000000  # 0.0015 APE

LP_FUND=0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043
LP_AMOUNT=1000000000000000  # 0.001 APE

echo "Adding fee recipients..."
echo ""

echo "1. NGT Merchant: $NGT_MERCHANT (0.0025 APE)"
cast send $V3_1_ROUTER "addFeeRecipient(address,uint256)" $NGT_MERCHANT $NGT_AMOUNT \
  --private-key $ADMIN_KEY --rpc-url $RPC --legacy

echo ""
echo "2. Flywheel: $FLYWHEEL (0.005 APE)"
cast send $V3_1_ROUTER "addFeeRecipient(address,uint256)" $FLYWHEEL $FLYWHEEL_AMOUNT \
  --private-key $ADMIN_KEY --rpc-url $RPC --legacy

echo ""
echo "3. Team/Admin: $TEAM_ADMIN (0.0015 APE)"
cast send $V3_1_ROUTER "addFeeRecipient(address,uint256)" $TEAM_ADMIN $TEAM_AMOUNT \
  --private-key $ADMIN_KEY --rpc-url $RPC --legacy

echo ""
echo "4. LP Fund: $LP_FUND (0.001 APE)"
cast send $V3_1_ROUTER "addFeeRecipient(address,uint256)" $LP_FUND $LP_AMOUNT \
  --private-key $ADMIN_KEY --rpc-url $RPC --legacy

echo ""
echo "✅ All fee recipients configured!"
echo "Total fees per claim: 0.01 APE"
