#!/bin/bash
set -e

echo "================================================"
echo "🚀 PaidMessagesRouter V2 Deployment"
echo "================================================"
echo ""

# Set working directory
cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from flywheel-bot config..."
    
    # Extract deployer private key (same wallet used for all previous deployments)
    DEPLOYER_KEY=$(grep ADMIN_PRIVATE_KEY ../packages/flywheel-bot/.env | cut -d'=' -f2)
    
    # Create .env
    cat > .env << EOF
# Deployer Wallet: 0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98
# (Same wallet used for all previous contract deployments)
PRIVATE_KEY=$DEPLOYER_KEY

# ApeChain RPC
RPC_URL=https://rpc.apechain.com/http
EOF
    
    echo "✅ .env file created"
    echo ""
fi

# Install dependencies (if needed)
if [ ! -d "lib" ]; then
    echo "Installing Foundry dependencies..."
    forge install
    echo ""
fi

# Compile contracts
echo "📦 Compiling contracts..."
forge build
echo ""

# Deploy
echo "🚀 Deploying to ApeChain..."
echo ""

forge script script/DeployPaidMessagesRouter.s.sol:DeployPaidMessagesRouter \
  --rpc-url https://rpc.apechain.com/http \
  --broadcast \
  -vvvv

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "⚠️  NEXT STEPS:"
echo ""
echo "1. Copy the contract address from above"
echo "2. Update backend env var: PAID_MESSAGES_ROUTER=0xNEW_ADDRESS"
echo "3. Update frontend env var: NEXT_PUBLIC_PAID_MESSAGES_ROUTER=0xNEW_ADDRESS"
echo "4. Re-enable SHILL in PaidMessageModal.tsx"
echo "5. Test both PAID (1 APE) and SHILL (15 APE) messages"
echo ""
echo "See DEPLOY_V2_INSTRUCTIONS.md for details"
echo ""
