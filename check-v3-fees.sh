#!/bin/bash
V3_ROUTER=0x5883d7a4A1b503ced7c799Baf3d677A23093E564
RPC=https://rpc.apechain.com/http

echo "🔍 Checking V3 Router Fee Recipients"
echo "Router: $V3_ROUTER"
echo ""

# Check total fee recipients
echo "Getting fee recipient count..."
RECIPIENT_COUNT=$(cast call $V3_ROUTER "getFeeRecipientCount()(uint256)" --rpc-url $RPC)
echo "Total fee recipients: $RECIPIENT_COUNT"
echo ""

if [ "$RECIPIENT_COUNT" != "0" ]; then
    echo "📋 Fee Recipients:"
    for i in $(seq 0 $((RECIPIENT_COUNT - 1))); do
        echo ""
        echo "Recipient #$i:"
        RECIPIENT=$(cast call $V3_ROUTER "feeRecipients(uint256)(address,uint256)" $i --rpc-url $RPC)
        echo "$RECIPIENT"
    done
else
    echo "No fee recipients configured"
fi
