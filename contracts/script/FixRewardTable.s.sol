// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouter.sol";

/**
 * @title FixRewardTable
 * @dev Update the reward table to correct tier values
 * Tier 0 (0x0... Hashalicious) = 128 ABIT
 * Tier 15 (0xf... Trash Hash) = 8 ABIT
 */
contract FixRewardTable is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Fixing reward table for deployed router...");
        
        // Deployed router address
        address routerAddress = 0x9c19d64fA17C4EB276FE3DFf4A8a6E57F42e43FF;
        MiningClaimRouter router = MiningClaimRouter(payable(routerAddress));
        
        console.log("Router address:", routerAddress);
        
        // Correct reward table: Tier 0 = 128, decreasing by 8 per tier
        uint256[16] memory correctRewardTable = [
            uint256(128 ether), // Tier 0 (0x0...) Hashalicious - BEST
            uint256(120 ether), // Tier 1 (0x1...) Hashtalavista, Baby
            uint256(112 ether), // Tier 2 (0x2...) Monster Mash
            uint256(104 ether), // Tier 3 (0x3...) Magic Mix
            uint256(96 ether),  // Tier 4 (0x4...) Zesty Zap
            uint256(88 ether),  // Tier 5 (0x5...) Mythical Hash
            uint256(80 ether),  // Tier 6 (0x6...) Epic Hash
            uint256(72 ether),  // Tier 7 (0x7...) Hashtastic
            uint256(64 ether),  // Tier 8 (0x8...) Juicy Jolt
            uint256(56 ether),  // Tier 9 (0x9...) Mega Hash
            uint256(48 ether),  // Tier 10 (0xa...) Great Hash
            uint256(40 ether),  // Tier 11 (0xb...) Solid Shard
            uint256(32 ether),  // Tier 12 (0xc...) Decent Drip
            uint256(24 ether),  // Tier 13 (0xd...) Basic Batch
            uint256(16 ether),  // Tier 14 (0xe...) Meh Hash
            uint256(8 ether)    // Tier 15 (0xf...) Trash Hash - WORST
        ];
        
        console.log("\nUpdating reward table...");
        console.log("Tier 0 (0x0... Hashalicious): 128 ABIT");
        console.log("Tier 1 (0x1... Hashtalavista): 120 ABIT");
        console.log("...");
        console.log("Tier 15 (0xf... Trash Hash): 8 ABIT");
        
        router.setRewardTable(correctRewardTable);
        
        console.log("\nReward table updated successfully!");
        
        // Verify the update
        console.log("\nVerifying update:");
        console.log("Tier 0 reward:", router.rewardPerTier(0) / 1 ether, "ABIT");
        console.log("Tier 15 reward:", router.rewardPerTier(15) / 1 ether, "ABIT");
        
        vm.stopBroadcast();
        
        console.log("\n=== Update Complete ===");
    }
}

