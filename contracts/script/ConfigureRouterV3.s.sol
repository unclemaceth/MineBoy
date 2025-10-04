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
    
    // Fee recipients
    address constant YOUR_WALLET = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5;
    address constant VAULT_ADDRESS = address(0); // TODO: Set vault address
    address constant GOLDCAP_ADDRESS = address(0); // TODO: Set gold cap address
    
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
        
        // ============= ADD FEE RECIPIENTS =============
        console.log("Adding fee recipients...");
        
        // You: 0.002 APE
        router.addFeeRecipient(YOUR_WALLET, 0.002 ether);
        console.log("  [0] Your wallet:", YOUR_WALLET, "- 0.002 APE");
        
        // Vault: 0.002 APE (if address is set)
        if (VAULT_ADDRESS != address(0)) {
            router.addFeeRecipient(VAULT_ADDRESS, 0.002 ether);
            console.log("  [1] Vault:", VAULT_ADDRESS, "- 0.002 APE");
        }
        
        // Gold Cap: 0.002 APE (if address is set)
        if (GOLDCAP_ADDRESS != address(0)) {
            router.addFeeRecipient(GOLDCAP_ADDRESS, 0.002 ether);
            console.log("  [2] Gold Cap:", GOLDCAP_ADDRESS, "- 0.002 APE");
        }
        
        uint256 totalFee = router.getTotalMineFee();
        console.log("");
        console.log("Total mine fee:", totalFee, "wei (", totalFee / 1 ether, "APE )");
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

