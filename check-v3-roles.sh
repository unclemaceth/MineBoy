#!/bin/bash
# Check roles on V3 router
V3_ROUTER=0x5883d7a4A1b503ced7c799Baf3d677A23093E564
RPC=https://rpc.apechain.com/http

echo "Checking V3 Router: $V3_ROUTER"
echo ""

# Admin role (bytes32(0))
ADMIN_ROLE=0x0000000000000000000000000000000000000000000000000000000000000000
# Signer role
SIGNER_ROLE=0xe2f4eaae4a9751e85a3e4a7b9587827a877f29914755229b07a7b2da98285f70

echo "Testing known addresses for ADMIN_ROLE..."
cast call $V3_ROUTER "hasRole(bytes32,address)(bool)" $ADMIN_ROLE 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5 --rpc-url $RPC && echo "✅ 0x46Cd...FAc5 is ADMIN" || echo "❌ 0x46Cd...FAc5 NOT admin"
cast call $V3_ROUTER "hasRole(bytes32,address)(bool)" $ADMIN_ROLE 0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043 --rpc-url $RPC && echo "✅ 0xB8bb...A043 is ADMIN" || echo "❌ 0xB8bb...A043 NOT admin"

echo ""
echo "Testing known addresses for SIGNER_ROLE..."
cast call $V3_ROUTER "hasRole(bytes32,address)(bool)" $SIGNER_ROLE 0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043 --rpc-url $RPC && echo "✅ 0xB8bb...A043 is SIGNER" || echo "❌ 0xB8bb...A043 NOT signer"
cast call $V3_ROUTER "hasRole(bytes32,address)(bool)" $SIGNER_ROLE 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5 --rpc-url $RPC && echo "✅ 0x46Cd...FAc5 is SIGNER" || echo "❌ 0x46Cd...FAc5 NOT signer"

echo ""
echo "Getting treasury wallet..."
cast call $V3_ROUTER "treasuryWallet()(address)" --rpc-url $RPC
