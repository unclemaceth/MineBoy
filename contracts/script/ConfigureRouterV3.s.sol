// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouterV3.sol";

/**
 * @title ConfigureRouterV3
 * @dev Configures fees, multipliers, and allowed NFTs for V3 router
 * 
 * Usage:
 *   1. Update ROUTER_ADDRESS below with your deployed V3 router
 *   2. Update fee recipients, multipliers, and allowed NFTs as needed
 *   3. Run: forge script script/ConfigureRouterV3.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy
 */
contract ConfigureRouterV3 is Script {
    // ⚠️ UPDATE THIS WITH YOUR DEPLOYED V3 ROUTER ADDRESS
    address constant ROUTER_ADDRESS = address(0); // TODO: Set after deployment
    
    // Fee recipients (V3 Flywheel System)
    address constant MERCHANT_WALLET = 0xFB53Da794d3d4d831255e7AB40F4649791331e75; // Gold Cap
    address constant FLYWHEEL_WALLET = 0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4; // NPC trading bot
    address constant TEAM_WALLET = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5; // Team
    address constant LP_WALLET = 0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043; // LP management
    
    // NFT addresses
    address constant NAPC_CONTRACT = 0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA;
    address constant PICKAXE_CONTRACT = 0x3322b37349aefd6f50f7909b641f2177c1d34d25;
    address constant CARTRIDGE_CONTRACT = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
    
    function run() external {
        require(ROUTER_ADDRESS != address(0), "Set ROUTER_ADDRESS first");
        
        MiningClaimRouterV3 router = MiningClaimRouterV3(payable(ROUTER_ADDRESS));
        
        console.log("================================================");
        console.log("Configuring MiningClaimRouterV3");
        console.log("================================================");
        console.log("Router:", ROUTER_ADDRESS);
        console.log("Admin:", msg.sender);
        console.log("");
        
        vm.startBroadcast();
        
        // ============= ADD FEE RECIPIENTS (V3 FLYWHEEL) =============
        console.log("Adding fee recipients (V3 Flywheel System)...");
        
        // Merchant (NGT/GoldCap): 0.0025 APE
        if (MERCHANT_WALLET != address(0)) {
            router.addFeeRecipient(MERCHANT_WALLET, 0.0025 ether);
            console.log("  [0] Merchant:", MERCHANT_WALLET, "- 0.0025 APE");
        }
        
        // Flywheel (NPC trading bot): 0.0050 APE
        if (FLYWHEEL_WALLET != address(0)) {
            router.addFeeRecipient(FLYWHEEL_WALLET, 0.0050 ether);
            console.log("  [1] Flywheel:", FLYWHEEL_WALLET, "- 0.0050 APE");
        }
        
        // Team: 0.0015 APE
        router.addFeeRecipient(TEAM_WALLET, 0.0015 ether);
        console.log("  [2] Team:", TEAM_WALLET, "- 0.0015 APE");
        
        // LP: 0.0010 APE
        if (LP_WALLET != address(0)) {
            router.addFeeRecipient(LP_WALLET, 0.0010 ether);
            console.log("  [3] LP:", LP_WALLET, "- 0.0010 APE");
        }
        
        uint256 totalFee = router.getTotalMineFee();
        console.log("");
        console.log("Total mine fee:", totalFee, "wei (", totalFee / 1 ether, "APE )");
        console.log("Expected: 10000000000000000 wei (0.01 APE)");
        console.log("");
        
        // ============= ADD NFT MULTIPLIERS =============
        console.log("Adding NFT multipliers...");
        
        // NAPC: 1+ owned = 1.2x
        router.addMultiplier(
            NAPC_CONTRACT,
            1, // min balance
            12000, // 1.2x in basis points
            "NAPC"
        );
        console.log("  [0] NAPC (1+): 1.2x multiplier");
        
        // NAPC Whale: 10+ owned = 1.5x
        router.addMultiplier(
            NAPC_CONTRACT,
            10, // min balance
            15000, // 1.5x in basis points
            "NAPC Whale"
        );
        console.log("  [1] NAPC Whale (10+): 1.5x multiplier");
        
        console.log("");
        
        // ============= ALLOW MINING NFTs =============
        console.log("Allowing mining NFTs...");
        
        // Allow pickaxes (primary)
        router.setCartridgeAllowed(PICKAXE_CONTRACT, true);
        console.log("  Pickaxes:", PICKAXE_CONTRACT, "- ALLOWED");
        
        // Allow original cartridges (legacy support)
        router.setCartridgeAllowed(CARTRIDGE_CONTRACT, true);
        console.log("  Cartridges:", CARTRIDGE_CONTRACT, "- ALLOWED");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("================================================");
        console.log("CONFIGURATION COMPLETE");
        console.log("================================================");
        console.log("");
        console.log("Verification commands:");
        console.log("");
        console.log("# Check total fee:");
        console.log("cast call", ROUTER_ADDRESS, "\"getTotalMineFee()(uint256)\" --rpc-url https://rpc.apechain.com");
        console.log("");
        console.log("# Check fee recipient 0:");
        console.log("cast call", ROUTER_ADDRESS, "\"feeRecipients(uint256)(address,uint256,bool)\" 0 --rpc-url https://rpc.apechain.com");
        console.log("");
        console.log("# Check multiplier 0:");
        console.log("cast call", ROUTER_ADDRESS, "\"multipliers(uint256)(address,uint256,uint256,bool,string)\" 0 --rpc-url https://rpc.apechain.com");
        console.log("");
        console.log("# Check pickaxes allowed:");
        console.log("cast call", ROUTER_ADDRESS, "\"allowedCartridge(address)(bool)\"", PICKAXE_CONTRACT, "--rpc-url https://rpc.apechain.com");
        console.log("");
        console.log("================================================");
    }
}

