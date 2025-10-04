// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouterV3.sol";

/**
 * @title DeployRouterV3
 * @dev Deploys MiningClaimRouterV3 with dynamic fees and NFT multipliers
 * 
 * Usage:
 *   forge script script/DeployRouterV3.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy
 * 
 * Required env vars:
 *   - PRIVATE_KEY: Deployer private key
 *   - BACKEND_SIGNER: Backend signer public address (has SIGNER_ROLE)
 */
contract DeployRouterV3 is Script {
    // MineStrategy token address (deploy this first!)
    address mineStrategyToken; // Will be loaded from env: MNESTR_TOKEN_ADDRESS
    
    // Treasury wallet (receives 10% dev siphon, optional - can be address(0))
    address treasuryWallet; // Will be loaded from env: TREASURY_WALLET (or 0x0)
    
    // Admin configuration
    address admin; // Will be set to msg.sender (deployer)
    address backendSigner; // Will be loaded from env
    
    // Initial reward table (same as V2)
    uint256[16] initialRewardTable = [
        100 ether,  // Tier 0: 100 ABIT
        95 ether,   // Tier 1: 95 ABIT
        90 ether,   // Tier 2: 90 ABIT
        85 ether,   // Tier 3: 85 ABIT
        80 ether,   // Tier 4: 80 ABIT
        75 ether,   // Tier 5: 75 ABIT
        70 ether,   // Tier 6: 70 ABIT
        65 ether,   // Tier 7: 65 ABIT
        60 ether,   // Tier 8: 60 ABIT
        55 ether,   // Tier 9: 55 ABIT
        50 ether,   // Tier 10: 50 ABIT
        45 ether,   // Tier 11: 45 ABIT
        40 ether,   // Tier 12: 40 ABIT
        35 ether,   // Tier 13: 35 ABIT
        30 ether,   // Tier 14: 30 ABIT
        25 ether    // Tier 15: 25 ABIT
    ];
    
    function run() external {
        // Load required addresses from env
        mineStrategyToken = vm.envAddress("MNESTR_TOKEN_ADDRESS");
        require(mineStrategyToken != address(0), "MNESTR_TOKEN_ADDRESS not set");
        
        // Treasury is optional (can be address(0) and set later via setTreasuryWallet)
        try vm.envAddress("TREASURY_WALLET") returns (address _treasury) {
            treasuryWallet = _treasury;
        } catch {
            treasuryWallet = address(0);
            console.log("WARNING: TREASURY_WALLET not set, using address(0). Set later with setTreasuryWallet()");
        }
        
        backendSigner = vm.envAddress("BACKEND_SIGNER");
        require(backendSigner != address(0), "BACKEND_SIGNER not set");
        
        vm.startBroadcast();
        
        // Set admin to deployer
        admin = msg.sender;
        
        console.log("================================================");
        console.log("Deploying MiningClaimRouterV3");
        console.log("================================================");
        console.log("Network: ApeChain Mainnet");
        console.log("Deployer:", admin);
        console.log("Backend Signer:", backendSigner);
        console.log("MineStrategy Token:", mineStrategyToken);
        console.log("Treasury Wallet:", treasuryWallet);
        console.log("");
        
        // Deploy V3 Router
        MiningClaimRouterV3 router = new MiningClaimRouterV3(
            mineStrategyToken,
            treasuryWallet,
            backendSigner,
            admin,
            initialRewardTable
        );
        
        vm.stopBroadcast();
        
        console.log("================================================");
        console.log("DEPLOYMENT SUCCESSFUL");
        console.log("================================================");
        console.log("MiningClaimRouterV3:", address(router));
        console.log("");
        console.log("Next Steps:");
        console.log("1. Grant MINTER_ROLE to router:");
        console.log("   forge script script/GrantMinterRole.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy");
        console.log("");
        console.log("2. Configure fees and multipliers:");
        console.log("   forge script script/ConfigureRouterV3.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy");
        console.log("");
        console.log("3. Allow mining NFTs (cartridges/pickaxes):");
        console.log("   cast send", address(router), "\"setCartridgeAllowed(address,bool)\" <NFT_ADDRESS> true");
        console.log("");
        console.log("4. Update env vars on Render and Vercel");
        console.log("   ROUTER_ADDRESS=", address(router));
        console.log("");
        console.log("================================================");
        
        // Deployment complete!
    }
}

