// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {ApeBitToken} from "../src/ApeBitToken.sol";
import {MiningClaimRouter} from "../src/MiningClaimRouter.sol";

contract SimpleTieredRewardsTest is Test {
    ApeBitToken public token;
    MiningClaimRouter public router;
    
    address public admin = address(0x1);
    address public signer = address(0x2);
    address public user = address(0x3);
    address public mockCartridge = address(0x4);
    
    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy ApeBitToken
        token = new ApeBitToken(admin);
        
        // Prepare reward table (8-128 ABIT across 16 tiers)
        uint256[16] memory rewardTable;
        rewardTable[0] = 8 * 10**18;   // 8 ABIT
        rewardTable[1] = 16 * 10**18;  // 16 ABIT
        rewardTable[2] = 24 * 10**18;  // 24 ABIT
        rewardTable[3] = 32 * 10**18;  // 32 ABIT
        rewardTable[4] = 40 * 10**18;  // 40 ABIT
        rewardTable[5] = 48 * 10**18;  // 48 ABIT
        rewardTable[6] = 56 * 10**18;  // 56 ABIT
        rewardTable[7] = 64 * 10**18;  // 64 ABIT
        rewardTable[8] = 72 * 10**18;  // 72 ABIT
        rewardTable[9] = 80 * 10**18;  // 80 ABIT
        rewardTable[10] = 88 * 10**18; // 88 ABIT
        rewardTable[11] = 96 * 10**18; // 96 ABIT
        rewardTable[12] = 104 * 10**18; // 104 ABIT
        rewardTable[13] = 112 * 10**18; // 112 ABIT
        rewardTable[14] = 120 * 10**18; // 120 ABIT
        rewardTable[15] = 128 * 10**18; // 128 ABIT
        
        // Deploy MiningClaimRouter
        router = new MiningClaimRouter(
            address(token),
            signer,
            admin,
            rewardTable
        );
        
        // Grant MINTER_ROLE to router
        token.grantRole(token.MINTER_ROLE(), address(router));
        
        // Allow mock cartridge in router
        router.setCartridgeAllowed(mockCartridge, true);
        
        vm.stopPrank();
    }
    
    function testRewardTiers() public view {
        // Test all 16 reward tiers
        assertEq(router.rewardPerTier(0), 8 * 10**18, "Tier 0 should be 8 APEBIT");
        assertEq(router.rewardPerTier(1), 16 * 10**18, "Tier 1 should be 16 APEBIT");
        assertEq(router.rewardPerTier(2), 24 * 10**18, "Tier 2 should be 24 APEBIT");
        assertEq(router.rewardPerTier(3), 32 * 10**18, "Tier 3 should be 32 APEBIT");
        assertEq(router.rewardPerTier(4), 40 * 10**18, "Tier 4 should be 40 APEBIT");
        assertEq(router.rewardPerTier(5), 48 * 10**18, "Tier 5 should be 48 APEBIT");
        assertEq(router.rewardPerTier(6), 56 * 10**18, "Tier 6 should be 56 APEBIT");
        assertEq(router.rewardPerTier(7), 64 * 10**18, "Tier 7 should be 64 APEBIT");
        assertEq(router.rewardPerTier(8), 72 * 10**18, "Tier 8 should be 72 APEBIT");
        assertEq(router.rewardPerTier(9), 80 * 10**18, "Tier 9 should be 80 APEBIT");
        assertEq(router.rewardPerTier(10), 88 * 10**18, "Tier 10 should be 88 APEBIT");
        assertEq(router.rewardPerTier(11), 96 * 10**18, "Tier 11 should be 96 APEBIT");
        assertEq(router.rewardPerTier(12), 104 * 10**18, "Tier 12 should be 104 APEBIT");
        assertEq(router.rewardPerTier(13), 112 * 10**18, "Tier 13 should be 112 APEBIT");
        assertEq(router.rewardPerTier(14), 120 * 10**18, "Tier 14 should be 120 APEBIT");
        assertEq(router.rewardPerTier(15), 128 * 10**18, "Tier 15 should be 128 APEBIT");
    }
    
    function testTierFromHash() public view {
        // Test tier derivation from workHash
        // Tier 0: 0x0000...
        bytes32 hash0 = bytes32(0x0000000000000000000000000000000000000000000000000000000000000000);
        uint8 tier0 = router.getTierFromHash(hash0);
        assertEq(tier0, 0, "Tier 0 derivation failed");
        
        // Tier 15: 0xf000...
        bytes32 hash15 = bytes32(0xf000000000000000000000000000000000000000000000000000000000000000);
        uint8 tier15 = router.getTierFromHash(hash15);
        assertEq(tier15, 15, "Tier 15 derivation failed");
        
        // Tier 7: 0x7000...
        bytes32 hash7 = bytes32(0x7000000000000000000000000000000000000000000000000000000000000000);
        uint8 tier7 = router.getTierFromHash(hash7);
        assertEq(tier7, 7, "Tier 7 derivation failed");
    }
    
    function testAdminFunctions() public {
        vm.startPrank(admin);
        
        // Test reward table update
        uint256[16] memory newTable;
        newTable[0] = 10 * 10**18;   // 10 APEBIT
        newTable[1] = 20 * 10**18;   // 20 APEBIT
        newTable[2] = 30 * 10**18;   // 30 APEBIT
        newTable[3] = 40 * 10**18;   // 40 APEBIT
        newTable[4] = 50 * 10**18;   // 50 APEBIT
        newTable[5] = 60 * 10**18;   // 60 APEBIT
        newTable[6] = 70 * 10**18;   // 70 APEBIT
        newTable[7] = 80 * 10**18;   // 80 APEBIT
        newTable[8] = 90 * 10**18;   // 90 APEBIT
        newTable[9] = 100 * 10**18;  // 100 APEBIT
        newTable[10] = 110 * 10**18; // 110 APEBIT
        newTable[11] = 120 * 10**18; // 120 APEBIT
        newTable[12] = 130 * 10**18; // 130 APEBIT
        newTable[13] = 140 * 10**18; // 140 APEBIT
        newTable[14] = 150 * 10**18; // 150 APEBIT
        newTable[15] = 160 * 10**18; // 160 APEBIT
        router.setRewardTable(newTable);
        
        // Verify update
        assertEq(router.rewardPerTier(0), 10 * 10**18, "Tier 0 should be 10 APEBIT");
        assertEq(router.rewardPerTier(15), 160 * 10**18, "Tier 15 should be 160 APEBIT");
        
        // Test signer update
        address newSigner = address(0x5);
        router.setSigner(newSigner);
        assertTrue(router.isSigner(newSigner), "New signer should have role");
        
        // Test cartridge allowlist
        router.setCartridgeAllowed(mockCartridge, false);
        assertFalse(router.allowedCartridge(mockCartridge), "Cartridge should be disallowed");
        
        router.setCartridgeAllowed(mockCartridge, true);
        assertTrue(router.allowedCartridge(mockCartridge), "Cartridge should be allowed");
        
        vm.stopPrank();
    }
    
    function testPauseUnpause() public {
        // Test pause functionality
        vm.startPrank(admin);
        router.pauseClaims();
        assertTrue(router.paused(), "Contract should be paused");
        
        router.unpauseClaims();
        assertFalse(router.paused(), "Contract should be unpaused");
        vm.stopPrank();
    }
    
    function testEIP712Types() public view {
        // Test EIP-712 type hashes
        bytes32 claimTypeHash = router.getClaimTypeHash();
        bytes32 claimV2TypeHash = router.getClaimV2TypeHash();
        bytes32 domainSeparator = router.getDomainSeparator();
        
        assertTrue(claimTypeHash != bytes32(0), "Claim type hash should not be zero");
        assertTrue(claimV2TypeHash != bytes32(0), "ClaimV2 type hash should not be zero");
        assertTrue(domainSeparator != bytes32(0), "Domain separator should not be zero");
        
        // Verify they're different
        assertTrue(claimTypeHash != claimV2TypeHash, "Type hashes should be different");
    }
    
    function testTokenMinting() public {
        // Test direct token minting (what the router does)
        vm.startPrank(admin);
        uint256 mintAmount = 100 * 10**18; // 100 APEBIT
        token.mint(user, mintAmount);
        assertEq(token.balanceOf(user), mintAmount, "Token balance should match minted amount");
        vm.stopPrank();
    }
    
    function testMineFee() public {
        // Test mine fee functionality
        assertEq(router.getMineFee(), 0.001 ether, "Mine fee should be 0.001 APE");
        assertEq(router.feeRecipient(), admin, "Fee recipient should be admin");
        
        // Test fee recipient update
        vm.startPrank(admin);
        address newRecipient = address(0x6);
        router.setFeeRecipient(newRecipient);
        assertEq(router.feeRecipient(), newRecipient, "Fee recipient should be updated");
        vm.stopPrank();
    }
}
