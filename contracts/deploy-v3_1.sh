#!/bin/bash
# Delegate.xyz V3.1 Deployment Helper Script
# This script will guide you through deploying MiningClaimRouterV3_1

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 MiningClaimRouterV3_1 Deployment Helper"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "❌ Error: Foundry (forge) is not installed"
    echo "Install from: https://getfoundry.sh"
    exit 1
fi

echo "✅ Foundry detected"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Deployment Configuration
DEPLOYER_PRIVATE_KEY=0x...
REWARD_TOKEN_ADDRESS=0x...
TREASURY_WALLET=0x...
BACKEND_SIGNER_ADDRESS=0x...
ADMIN_ADDRESS=0x...
RPC_URL=https://apechain.caldera.xyz/http
EOF
    echo "✅ Created .env file"
    echo "❗ Please edit .env with your values and run this script again"
    exit 0
fi

# Source .env
source .env

# Validate required variables
MISSING=()
[ -z "$DEPLOYER_PRIVATE_KEY" ] && MISSING+=("DEPLOYER_PRIVATE_KEY")
[ -z "$REWARD_TOKEN_ADDRESS" ] && MISSING+=("REWARD_TOKEN_ADDRESS")
[ -z "$TREASURY_WALLET" ] && MISSING+=("TREASURY_WALLET")
[ -z "$BACKEND_SIGNER_ADDRESS" ] && MISSING+=("BACKEND_SIGNER_ADDRESS")
[ -z "$ADMIN_ADDRESS" ] && MISSING+=("ADMIN_ADDRESS")
[ -z "$RPC_URL" ] && MISSING+=("RPC_URL")

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${MISSING[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please update .env file and try again"
    exit 1
fi

echo "✅ All environment variables set"
echo ""

# Display configuration
echo "📋 Deployment Configuration:"
echo "   RPC URL: $RPC_URL"
echo "   Reward Token: $REWARD_TOKEN_ADDRESS"
echo "   Treasury: $TREASURY_WALLET"
echo "   Signer: $BACKEND_SIGNER_ADDRESS"
echo "   Admin: $ADMIN_ADDRESS"
echo ""

# Confirm deployment
read -p "Deploy to ApeChain? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "🚀 Deploying MiningClaimRouterV3_1..."
echo ""

# Run deployment
forge script script/DeployRouterV3_1.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --slow \
  -vvv

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Copy the deployed address from above"
echo "2. Add to backend .env:"
echo "   ROUTER_V3_1_ADDRESS=0x..."
echo "   DELEGATE_PHASE1_ENABLED=false"
echo ""
echo "3. Add to frontend .env:"
echo "   NEXT_PUBLIC_ROUTER_V3_1_ADDRESS=0x..."
echo "   NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED=false"
echo ""
echo "4. Configure contract (see DELEGATE_V3_1_DEPLOYMENT_GUIDE.md)"
echo "   - Add allowed cartridges"
echo "   - Add fee recipients"
echo "   - Add multipliers"
echo ""
echo "5. Deploy backend + frontend with flags = false"
echo ""
echo "6. Test on staging (flip flags to true)"
echo ""
echo "7. Roll out to production when ready!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

