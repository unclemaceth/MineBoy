// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {ApeBitToken} from "../src/ApeBitToken.sol";
import {MiningClaimRouter} from "../src/MiningClaimRouter.sol";

contract DebugTest is Test {
    function testBasicDeployment() public {
        address admin = address(0x1);
        address signer = address(0x2);
        
        vm.startPrank(admin);
        
        // Deploy ApeBitToken
        ApeBitToken token = new ApeBitToken(admin);
        console.log("Token deployed at:", address(token));
        
        // Test simple reward table
        uint256[16] memory rewardTable;
        rewardTable[0] = 8 * 10**18; // 8 ABIT
        rewardTable[1] = 16 * 10**18; // 16 ABIT
        rewardTable[2] = 24 * 10**18; // 24 ABIT
        // ... etc
        
        console.log("Reward table prepared");
        
        // Deploy MiningClaimRouter
        MiningClaimRouter router = new MiningClaimRouter(
            address(token),
            signer,
            admin,
            rewardTable
        );
        
        console.log("Router deployed at:", address(router));
        
        // Grant MINTER_ROLE to router
        token.grantRole(token.MINTER_ROLE(), address(router));
        
        console.log("MINTER_ROLE granted");
        
        vm.stopPrank();
        
        // Test basic functionality
        assertTrue(address(token) != address(0), "Token should be deployed");
        assertTrue(address(router) != address(0), "Router should be deployed");
        assertEq(router.rewardPerTier(0), 8 * 10**18, "Tier 0 should be 8 ABIT");
    }
}
