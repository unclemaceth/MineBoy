// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouterV3_1.sol";

/**
 * @title DeployRouterV3_1
 * @dev Deployment script for MiningClaimRouterV3_1 (with delegate support)
 * 
 * Usage:
 *   forge script script/DeployRouterV3_1.s.sol --rpc-url $RPC_URL --broadcast --verify --slow
 * 
 * Required environment variables:
 *   - DEPLOYER_PRIVATE_KEY: Private key of deployer wallet
 *   - REWARD_TOKEN_ADDRESS: Address of ABIT/MNESTR token
 *   - TREASURY_WALLET: Address to receive 10% of mined tokens
 *   - BACKEND_SIGNER_ADDRESS: Backend signer public address (gets SIGNER_ROLE)
 *   - ADMIN_ADDRESS: Admin address (gets DEFAULT_ADMIN_ROLE)
 */
contract DeployRouterV3_1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address rewardToken = vm.envAddress("REWARD_TOKEN_ADDRESS");
        address treasuryWallet = vm.envAddress("TREASURY_WALLET");
        address signer = vm.envAddress("BACKEND_SIGNER_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");

        console.log("=== MiningClaimRouterV3_1 Deployment ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Reward Token:", rewardToken);
        console.log("Treasury:", treasuryWallet);
        console.log("Signer:", signer);
        console.log("Admin:", admin);
        console.log("");

        // Default reward table (can be updated later via setRewardTier)
        // Tiers 0-15 based on first nibble of workHash
        uint256[16] memory rewardTable = [
            0 ether,        // Tier 0: disabled (too easy)
            2 ether,        // Tier 1
            4 ether,        // Tier 2
            8 ether,        // Tier 3
            15 ether,       // Tier 4
            25 ether,       // Tier 5
            35 ether,       // Tier 6
            45 ether,       // Tier 7
            55 ether,       // Tier 8
            65 ether,       // Tier 9
            75 ether,       // Tier 10
            90 ether,       // Tier 11
            110 ether,      // Tier 12
            140 ether,      // Tier 13
            180 ether,      // Tier 14
            230 ether       // Tier 15 (hardest)
        ];

        vm.startBroadcast(deployerPrivateKey);

        MiningClaimRouterV3_1 router = new MiningClaimRouterV3_1(
            rewardToken,
            treasuryWallet,
            signer,
            admin,
            rewardTable
        );

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("MiningClaimRouterV3_1:", address(router));
        console.log("");
        console.log("IMPORTANT: Add this to your .env:");
        console.log("ROUTER_V3_1_ADDRESS=%s", address(router));
        console.log("");
        console.log("Next steps:");
        console.log("1. Add allowed cartridges: router.allowCartridge(address, true)");
        console.log("2. Add fee recipients: router.addFeeRecipient(address, amount)");
        console.log("3. Add multipliers: router.addMultiplier(nftContract, minBalance, multiplierBps, name)");
        console.log("4. Verify roles:");
        console.log("   - SIGNER_ROLE: %s", signer);
        console.log("   - DEFAULT_ADMIN_ROLE: %s", admin);
        console.log("");

        vm.stopBroadcast();
    }
}

